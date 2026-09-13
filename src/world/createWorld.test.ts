import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrthographicCamera, Scene, Vector3 } from 'three';
import { CAMERA_PROJECTION, CITY, LANDMARKS } from '../content/city';
import { CITY_EXTENT } from '../content/streets';
import { createWorld } from './createWorld';
import { WorldModel } from './model';

const gpu = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
  disconnected: vi.fn(),
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  return {
    ...original,
    WebGLRenderer: class {
      shadowMap = { enabled: false };
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      render = gpu.render;
      dispose = gpu.dispose;
      forceContextLoss = gpu.forceContextLoss;
    },
  };
});

let frames: Map<number, FrameRequestCallback>;
let hidden = false;
let id = 0;

beforeEach(() => {
  vi.clearAllMocks();
  frames = new Map();
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as WebGL2RenderingContext);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect = gpu.disconnected;
  });
});
afterEach(() => vi.unstubAllGlobals());

function tick(time: number) {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(time);
}

function mount(model: WorldModel) {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 600));
  return { canvas, world: createWorld({ canvas, model, onChange: vi.fn(), onLifecycle: vi.fn() }) };
}

describe('runtime ownership and suspension', () => {
  it('fits all expanded ground corners in the overview and keeps new landmarks focusable', () => {
    const model = new WorldModel(true);
    const { world } = mount(model);
    const camera: unknown = gpu.render.mock.lastCall?.[1];
    if (!(camera instanceof OrthographicCamera)) throw new Error('Missing render camera');
    camera.updateMatrixWorld();
    for (const x of [-CITY_EXTENT.x, CITY_EXTENT.x]) {
      for (const z of [-CITY_EXTENT.z, CITY_EXTENT.z]) {
        const screen = new Vector3(x, 0, z).project(camera);
        expect(Math.abs(screen.x)).toBeLessThan(0.95);
        expect(Math.abs(screen.y)).toBeLessThan(0.95);
      }
    }
    for (const landmark of LANDMARKS.slice(3)) {
      world.command({ type: 'focus-landmark', id: landmark.id });
      expect(model.selectedId).toBe(landmark.id);
      expect(model.camera.pose.x).toBe(landmark.position.x);
      expect(model.camera.pose.z).toBe(landmark.position.z);
    }
    world.dispose();
  });

  it('renders expanded actors from retained state after pause and graphics restoration', () => {
    const model = new WorldModel(false);
    const { canvas, world } = mount(model);
    tick(0);
    tick(34);
    world.command({ type: 'set-paused', paused: true });
    const states = structuredClone(model.simulation.traffic.actors);
    const signals = structuredClone(model.simulation.traffic.signals);
    tick(300000);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(model.simulation.traffic.actors).toEqual(states);
    expect(model.simulation.traffic.signals).toEqual(signals);
    const rendered: unknown = gpu.render.mock.lastCall?.[0];
    if (!(rendered instanceof Scene)) throw new Error('Missing rendered scene');
    expect(rendered.getObjectByName('Instanced neighborhood activity')).toBeDefined();
    expect(frames.size).toBe(0);
    world.dispose();
  });

  it('keeps the orbit pivot centered and the camera above ground throughout tilt', () => {
    const model = new WorldModel(true);
    const { world } = mount(model);
    world.command({ type: 'focus-landmark', id: CITY.landmark.id });
    for (const tilt of [-100, 100, -0.2]) {
      world.command({ type: 'navigate', rotate: 1.5, tilt });
      tick(0);
      const camera: unknown = gpu.render.mock.lastCall?.[1];
      if (!(camera instanceof OrthographicCamera)) throw new Error('Missing render camera');
      camera.updateMatrixWorld();
      const pivot = new Vector3(model.camera.pose.x, 0, model.camera.pose.z);
      expect(camera.position.distanceTo(pivot)).toBeCloseTo(CAMERA_PROJECTION.distance);
      expect(camera.position.y).toBeGreaterThan(50);
      pivot.project(camera);
      expect(pivot.x).toBeCloseTo(0);
      expect(pivot.y).toBeCloseTo(0);
      expect(Math.abs(pivot.z)).toBeLessThan(1);
    }
    expect(frames.size).toBe(0);
    world.dispose();
  });

  it('owns one RAF chain and performs no work paused or hidden', () => {
    const model = new WorldModel(false);
    const { world } = mount(model);
    expect(frames.size).toBe(1);
    tick(0);
    tick(34);
    expect(model.simulation.elapsed).toBeCloseTo(1 / 30);
    world.command({ type: 'set-paused', paused: true });
    expect(frames.size).toBe(0);
    const rendered = gpu.render.mock.calls.length;
    tick(30000);
    expect(gpu.render).toHaveBeenCalledTimes(rendered);
    world.command({ type: 'focus-landmark', id: CITY.landmark.id });
    expect(gpu.render).toHaveBeenCalledTimes(rendered + 1);
    expect(frames.size).toBe(0);
    world.command({ type: 'set-paused', paused: false });
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    tick(300000);
    const elapsed = model.simulation.elapsed;
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    expect(model.simulation.elapsed).toBe(elapsed);
    tick(300034);
    expect(model.simulation.elapsed).toBeCloseTo(elapsed + 1 / 30);
    world.dispose();
    expect(frames.size).toBe(0);
  });

  it('does not suspend a visible second-screen city on window blur', () => {
    const { world } = mount(new WorldModel(false));
    window.dispatchEvent(new Event('blur'));
    expect(frames.size).toBe(1);
    world.dispose();
  });

  it('avoids duplicate GPU submissions between fixed simulation ticks', () => {
    const { world } = mount(new WorldModel(false));
    const initial = gpu.render.mock.calls.length;
    tick(0);
    tick(16);
    expect(gpu.render).toHaveBeenCalledTimes(initial);
    tick(34);
    expect(gpu.render).toHaveBeenCalledTimes(initial + 1);
    tick(49);
    expect(gpu.render).toHaveBeenCalledTimes(initial + 1);
    world.dispose();
  });

  it('coalesces rapid paused navigation into one requested render without advancing actors', () => {
    const model = new WorldModel(true);
    const { world } = mount(model);
    const initial = gpu.render.mock.calls.length;
    for (let index = 0; index < 20; index++) world.command({ type: 'navigate', panX: 0.1 });
    expect(gpu.render).toHaveBeenCalledTimes(initial);
    expect(frames.size).toBe(1);
    tick(34);
    expect(gpu.render).toHaveBeenCalledTimes(initial + 1);
    expect(model.simulation.elapsed).toBe(0);
    expect(frames.size).toBe(0);
    world.dispose();
  });

  it('releases GPU resources when leaving the document, but preserves a bfcache suspension', () => {
    const { world } = mount(new WorldModel(false));
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(gpu.dispose).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(frames.size).toBe(1);
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
    expect(gpu.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    world.dispose();
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });

  it('preserves user pause through pagehide/pageshow and context recovery', () => {
    const model = new WorldModel(true);
    const { canvas, world } = mount(model);
    world.command({ type: 'focus-landmark', id: CITY.landmark.id });
    const pose = { ...model.camera.pose };
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(frames.size).toBe(0);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(model.camera.pose).toEqual(pose);
    expect(model.paused).toBe(true);
    expect(frames.size).toBe(0);
    world.dispose();
  });

  it('releases resources idempotently across ten mount/unmount cycles', () => {
    for (let i = 0; i < 10; i++) {
      const { world } = mount(new WorldModel(false));
      tick(0);
      expect(frames.size).toBe(1);
      world.dispose();
      world.dispose();
      expect(frames.size).toBe(0);
    }
    expect(gpu.dispose).toHaveBeenCalledTimes(10);
    expect(gpu.forceContextLoss).toHaveBeenCalledTimes(10);
    expect(gpu.disconnected).toHaveBeenCalledTimes(10);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    expect(frames.size).toBe(0);
  });
});
