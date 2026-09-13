import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import { CAMERA_PROJECTION, CITY } from '../content/city';
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
      debug = { onShaderError: null };
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
  it('keeps the orbit pivot centered and the camera above ground throughout tilt', () => {
    const model = new WorldModel(true);
    const { world } = mount(model);
    world.command({ type: 'focus-landmark', id: CITY.landmark.id });
    for (const tilt of [-100, 100, -0.2]) {
      world.command({ type: 'navigate', rotate: 1.5, tilt });
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

  it('retains weather mass and particles through pause, hidden time, restore and a renderer retry', () => {
    const model = new WorldModel(false, { weather: 'snow' });
    const { canvas, world } = mount(model);
    tick(0);
    for (let step = 1; step <= 90; step++) tick(step * 1000 / 30);
    world.command({ type: 'set-paused', paused: true });
    const physics = model.environment.physics;
    const particles = physics.snow.positions.slice();
    const surface = { ...physics.surface };
    const time = physics.time;
    expect(surface.snowSweMm).toBeGreaterThan(0);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(physics.surface).toEqual(surface);
    expect(physics.snow.positions).toEqual(particles);
    expect(physics.time).toBe(time);
    world.command({ type: 'set-weather', weather: 'sunny' });
    expect(physics.surface).toEqual(surface);
    world.dispose();
    const retry = mount(model);
    expect(physics.snow.positions).toEqual(particles);
    expect(physics.surface).toEqual(surface);
    retry.world.command({ type: 'set-paused', paused: false });
    tick(600000);
    expect(physics.time).toBe(time);
    tick(600034);
    expect(physics.time).toBeCloseTo(time + 1 / 30);
    expect(physics.surface.snowSweMm).toBeLessThan(surface.snowSweMm);
    retry.world.dispose();
  });

  it('publishes environment status at most once per simulated second without an active camera', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 600));
    const onChange = vi.fn();
    const world = createWorld({ canvas, model: new WorldModel(false), onChange, onLifecycle: vi.fn() });
    tick(0);
    for (let frame = 1; frame <= 180; frame++) tick(frame * 1000 / 60);
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onChange.mock.calls.length).toBeLessThanOrEqual(3);
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
