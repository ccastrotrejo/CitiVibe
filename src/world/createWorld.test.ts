import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { InstancedMesh, NeutralToneMapping, OrthographicCamera, Scene, Vector3 } from 'three';
import { CAMERA_ANCHORS, CAMERA_PROJECTION } from '../content/city';
import { CITY_EXTENT } from '../content/streets';
import { COURT_PLAYERS } from '../content/courts';
import { PLAY_AREA, PLAY_PEOPLE } from '../content/play';
import { MAX_SNOW_SWE_MM } from './weatherPhysics';
import { createWorld } from './createWorld';
import { WorldModel } from './model';

const gpu = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
  disconnected: vi.fn(),
  shadowMap: { enabled: false, needsUpdate: false, autoUpdate: false },
  toneMapping: 0,
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  return {
    ...original,
    WebGLRenderer: class {
      shadowMap = gpu.shadowMap;
      set toneMapping(value: number) { gpu.toneMapping = value; }
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
  Object.assign(gpu.shadowMap, { enabled: false, needsUpdate: false, autoUpdate: false });
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
  it('rebuilds the same weather clothing, seated transitions and departing visitor instance matrices', () => {
    const model = new WorldModel(false, { weather: 'rain' });
    for (let tick = 0; tick < 20 * 30; tick++) model.step(1 / 30);
    model.command({ type: 'set-paused', paused: true });
    const { canvas, world } = mount(model);
    onTestFinished(() => world.dispose());
    const matrices = () => {
      const scene: unknown = gpu.render.mock.lastCall?.[0];
      if (!(scene instanceof Scene)) throw new Error('Missing rendered weather scene.');
      const activity = scene.getObjectByName('Instanced neighborhood activity');
      if (!activity) throw new Error('Missing instanced weather-aware people.');
      return activity.children.map((part) => {
        if (!(part instanceof InstancedMesh)) throw new Error('Unexpected person submission.');
        return Array.from(part.instanceMatrix.array);
      });
    };
    expect(model.simulation.resting.states.some((visit) => visit.phase === 'departing')).toBe(true);
    const retained = JSON.stringify(model.simulation);
    const before = matrices();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(matrices()).toEqual(before);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(matrices()).toEqual(before);
    expect(JSON.stringify(model.simulation)).toBe(retained);
    world.command({ type: 'set-weather', weather: 'snow' });
    expect(matrices()).not.toEqual(before);
    const snow = matrices();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(matrices()).toEqual(snow);
  });

  it('retains shared-bike users and docked inventory through paused graphics restoration', () => {
    const model = new WorldModel(false);
    const { canvas, world } = mount(model);
    onTestFinished(() => world.dispose());
    tick(0);
    for (let time = 34; time < 2400; time += 34) tick(time);
    world.command({ type: 'set-paused', paused: true });
    const snapshot = () => {
      const scene: unknown = gpu.render.mock.lastCall?.[0];
      if (!(scene instanceof Scene)) throw new Error('Missing rendered scene.');
      return ['lantern-bike-bay', 'willow-bike-bay', 'juniper-bike-bay'].flatMap((id) =>
        ['checkout bicycle', 'parked bicycle', 'neighbor checking a bicycle'].map((suffix) => {
          const group = scene.getObjectByName(`${id}: ${suffix}`);
          if (!group) throw new Error(`Missing bike-share rig: ${id}: ${suffix}.`);
          group.updateWorldMatrix(true, true);
          const matrices: number[][] = [];
          group.traverse((part) => matrices.push(part.matrixWorld.toArray()));
          return matrices;
        }));
    };
    const before = snapshot();
    expect(model.simulation.elapsed).toBeGreaterThan(2);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(snapshot()).toEqual(before);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(snapshot()).toEqual(before);
    expect(frames.size).toBe(0);
  });

  it('retains all vehicle light colors and beam positions through pause, hidden time and context restoration', () => {
    const model = new WorldModel(false);
    const { canvas, world } = mount(model);
    onTestFinished(() => world.dispose());
    world.command({ type: 'set-time', time: 'night' });
    tick(0);
    for (let time = 34; time < 2400; time += 34) tick(time);
    world.command({ type: 'set-paused', paused: true });
    const snapshot = () => {
      const scene: unknown = gpu.render.mock.lastCall?.[0];
      if (!(scene instanceof Scene)) throw new Error('Missing rendered scene.');
      return ['Vehicle lamp lenses', 'Soft ground illumination'].map((name) => {
        const mesh = scene.getObjectByName(name);
        if (!(mesh instanceof InstancedMesh)) throw new Error(`Missing ${name}.`);
        return { count: mesh.count, matrices: Array.from(mesh.instanceMatrix.array), colors: Array.from(mesh.instanceColor!.array) };
      });
    };
    const before = snapshot();
    expect(before[0].count).toBe(582);
    expect(before[1].count).toBeGreaterThan(0);
    expect(gpu.toneMapping).toBe(NeutralToneMapping);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(snapshot()).toEqual(before);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(snapshot()).toEqual(before);
    expect(frames.size).toBe(0);
  });

  it('retains an active pedestrian crossing through pause, hidden time and graphics restoration', () => {
    const model = new WorldModel(false);
    for (let tick = 0; tick < 1800; tick++) {
      model.step(1 / 30);
      if (model.simulation.traffic.pedestrians.actors.some(({ activity }) => activity === 'crossing')) break;
    }
    expect(model.simulation.traffic.pedestrians.actors.some(({ activity }) => activity === 'crossing')).toBe(true);
    const { canvas, world } = mount(model);
    onTestFinished(() => world.dispose());
    world.command({ type: 'set-paused', paused: true });
    const retained = model.simulation.traffic.pedestrians;
    const snapshot = JSON.stringify(model.simulation);
    tick(1000);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(model.simulation.traffic.pedestrians).toBe(retained);
    expect(JSON.stringify(model.simulation)).toBe(snapshot);
    world.command({ type: 'set-paused', paused: false });
    tick(300034); tick(300068);
    expect(JSON.stringify(model.simulation)).not.toBe(snapshot);
  });

  it('wires meadow movement, pause, hidden time, snow, reduced motion and restored poses to the retained clock', () => {
    const model = new WorldModel(false);
    const { canvas, world } = mount(model);
    onTestFinished(() => world.dispose());
    const renderedScene = () => {
      const scene: unknown = gpu.render.mock.lastCall?.[0];
      if (!(scene instanceof Scene)) throw new Error('Missing rendered scene');
      return scene;
    };
    const snapshot = () => PLAY_PEOPLE.map(({ id }) => {
      const group = renderedScene().getObjectByName(id)!;
      const parts: number[][] = [];
      group.traverse((part) => parts.push([...part.position.toArray(), ...part.quaternion.toArray()]));
      return parts;
    });
    const initial = snapshot();
    tick(0); tick(34); tick(68);
    expect(snapshot()).not.toEqual(initial);
    world.command({ type: 'set-paused', paused: true });
    const paused = snapshot();
    tick(5000);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    tick(300000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(snapshot()).toEqual(paused);
    model.environment.physics.surface.snowSweMm = MAX_SNOW_SWE_MM;
    model.environment.physics.revision++;
    world.command({ type: 'navigate', zoom: 0.1 }); tick(300034);
    for (const { id } of PLAY_PEOPLE) {
      expect(renderedScene().getObjectByName(id)!.position.y).toBeCloseTo(PLAY_AREA.surfaceY + model.environment.physics.snowDepth);
    }
    const snowy = snapshot();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(snapshot()).toEqual(snowy);
    world.command({ type: 'set-reduced-motion', reduced: true });
    const still = snapshot();
    world.command({ type: 'set-paused', paused: false });
    tick(300100); tick(300134);
    // Resumed weather may melt snow; only the ground support may change in the still pose.
    for (const parts of still) parts[0][1] = PLAY_AREA.surfaceY + model.environment.physics.snowDepth;
    expect(snapshot()).toEqual(still);
  });

  it('refreshes weather shadows on simulation and motion changes but not camera-only redraws', () => {
    const model = new WorldModel(false);
    const { world } = mount(model);
    onTestFinished(() => world.dispose());
    expect(gpu.shadowMap.needsUpdate).toBe(true);
    gpu.shadowMap.needsUpdate = false;
    world.command({ type: 'navigate', zoom: 0.1 });
    tick(0);
    expect(gpu.shadowMap.needsUpdate).toBe(false);
    tick(34);
    expect(gpu.shadowMap.needsUpdate).toBe(true);
    gpu.shadowMap.needsUpdate = false;
    world.command({ type: 'set-reduced-motion', reduced: true });
    expect(gpu.shadowMap.needsUpdate).toBe(true);
    world.dispose();
  });

  it('preserves court support above retained snow through paused redraw and graphics recovery', () => {
    const model = new WorldModel(true);
    const { canvas, world } = mount(model);
    onTestFinished(() => world.dispose());
    const scene: unknown = gpu.render.mock.lastCall?.[0];
    if (!(scene instanceof Scene)) throw new Error('Missing rendered scene');
    const player = scene.getObjectByName(COURT_PLAYERS[0].id)!;
    const groundY = player.position.y;
    model.environment.physics.surface.snowSweMm = MAX_SNOW_SWE_MM;
    model.environment.physics.revision++;
    world.command({ type: 'navigate', zoom: 0.1 });
    tick(0);
    expect(player.position.y - groundY).toBeCloseTo(model.environment.physics.snowDepth);
    const snowyPosition = player.position.clone();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    const restored: unknown = gpu.render.mock.lastCall?.[0];
    if (!(restored instanceof Scene)) throw new Error('Missing restored scene');
    expect(restored.getObjectByName(COURT_PLAYERS[0].id)!.position).toEqual(snowyPosition);
    expect(model.simulation.elapsed).toBe(0);
    world.dispose();
  });

  it('fits all expanded ground corners in the overview and renders every guided tour view', () => {
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
    world.command({ type: 'start-tour' });
    for (const anchor of CAMERA_ANCHORS) {
      expect(model.camera.pose).toEqual(anchor.pose);
      expect(model.snapshot().view?.subject).toBe(anchor.subject);
      world.command({ type: 'guided-step', direction: 1 });
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
    const before: unknown = gpu.render.mock.lastCall?.[0];
    if (!(before instanceof Scene)) throw new Error('Missing rendered scene');
    const basketball = before.getObjectByName('Basketball in play')!.position.clone();
    const pickleball = before.getObjectByName('Pickleball in play')!.position.clone();
    tick(300000);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(model.simulation.traffic.actors).toEqual(states);
    expect(model.simulation.traffic.signals).toEqual(signals);
    const rendered: unknown = gpu.render.mock.lastCall?.[0];
    if (!(rendered instanceof Scene)) throw new Error('Missing rendered scene');
    expect(rendered.getObjectByName('Instanced neighborhood activity')).toBeDefined();
    expect(rendered.getObjectByName('Basketball in play')!.position).toEqual(basketball);
    expect(rendered.getObjectByName('Pickleball in play')!.position).toEqual(pickleball);
    expect(frames.size).toBe(0);
    world.dispose();
  });

  it('keeps the orbit pivot centered and the camera above ground throughout tilt', () => {
    const model = new WorldModel(true);
    const { world } = mount(model);
    world.command({ type: 'navigate', panX: 20, panZ: 10 });
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
    world.command({ type: 'reset' });
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
    world.command({ type: 'navigate', panX: 20, zoom: 0.4 });
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
    // Ten complete world builds and disposals; keep headroom under parallel suite load.
  }, 20_000);
});
