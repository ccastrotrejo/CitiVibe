import { describe, expect, it } from 'vitest';
import { CAMERA_PROJECTION, CITY, LANDMARKS, ROUTE_LENGTH, sampleRoute, validateLandmarks } from '../content/city';
import { CameraController, OVERVIEW } from './camera';
import { FrameClock, STEP } from './clock';
import { WorldModel } from './model';

describe('bounded simulation clock', () => {
  it('runs the same simulation at 30 and 60 Hz', () => {
    function ticks(rate: number) {
      const clock = new FrameClock();
      let result = 0;
      for (let i = 0; i <= rate * 10; i++) clock.advance(i * 1000 / rate, () => result++);
      return result;
    }
    expect(ticks(30)).toBe(300);
    expect(ticks(60)).toBe(300);
  });

  it('discards five minutes hidden and bounds a long visible frame', () => {
    const clock = new FrameClock();
    let ticks = 0;
    clock.advance(0, () => ticks++);
    clock.advance(1000 / 30, () => ticks++);
    expect(ticks).toBe(1);
    clock.reset();
    clock.advance(300000, () => ticks++);
    expect(ticks).toBe(1);
    clock.advance(300000 + 1000 / 30, () => ticks++);
    expect(ticks).toBe(2);
    clock.advance(400000, () => ticks++);
    expect(ticks).toBe(5);
  });
});

describe('single camera owner', () => {
  it('keeps all walkers and vehicles on accumulated snow without accumulating their vertical offset', () => {
    const model = new WorldModel(false, { weather: 'snow', rainIntensityMmH: 20 });
    model.environment.physics.bindSurface(() => 0, () => 1);
    model.environment.physics.surface.snowSweMm = 6;
    for (let tick = 0; tick < 600; tick++) model.step(STEP);
    for (const actor of model.simulation.actors) {
      expect(actor.position.y).toBeGreaterThan(0.15);
      expect(actor.position.y).toBeLessThan(0.2);
    }
    model.command({ type: 'set-rain-intensity', millimetersPerHour: 0 });
    expect(model.snapshot().rainIntensityMmH).toBe(0);
    model.command({ type: 'set-paused', paused: true });
    const positions = model.simulation.actors.map(({ position }) => ({ ...position }));
    const water = structuredClone(model.environment.physics.groundWater.states);
    for (let tick = 0; tick < 900; tick++) model.step(STEP);
    expect(model.simulation.actors.map(({ position }) => position)).toEqual(positions);
    expect(model.environment.physics.groundWater.states).toEqual(water);
  });

  it('orbits through every azimuth with bounded tilt and resets the full pose', () => {
    const model = new WorldModel(true);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    const pivot = { x: model.camera.pose.x, z: model.camera.pose.z };
    for (let i = 0; i < 80; i++) {
      model.command({ type: 'navigate', rotate: 0.2, tilt: 0.1 });
      expect(model.camera.pose.x).toBe(pivot.x);
      expect(model.camera.pose.z).toBe(pivot.z);
    }
    expect(model.camera.pose.pitch).toBe(CAMERA_PROJECTION.maxPitch);
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free', selectedId: CITY.landmark.id, paused: true });
    model.command({ type: 'navigate', tilt: -100 });
    expect(model.camera.pose.pitch).toBe(CAMERA_PROJECTION.minPitch);
    expect(() => model.command({ type: 'navigate', tilt: NaN })).toThrow('finite');
    model.command({ type: 'reset' });
    expect(model.camera.pose).toEqual(OVERVIEW);
  });

  it.each([0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2])('can pan to all four map edges at yaw %f', (yaw) => {
    const camera = new CameraController();
    camera.navigate({ type: 'navigate', rotate: yaw - camera.pose.yaw });
    for (const [x, z] of [[-28, -28], [28, -28], [28, 28], [-28, 28]]) {
      const dx = x - camera.pose.x;
      const dz = z - camera.pose.z;
      camera.navigate({
        type: 'navigate',
        panX: Math.cos(yaw) * dx - Math.sin(yaw) * dz,
        panZ: Math.sin(yaw) * dx + Math.cos(yaw) * dz,
      });
      expect(camera.pose.x).toBeCloseTo(x);
      expect(camera.pose.z).toBeCloseTo(z);
    }
  });

  it('cancels transitions on manual input and retains selection', () => {
    const model = new WorldModel(false);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.step(0.03);
    model.command({ type: 'navigate', panX: 2 });
    const pose = { ...model.camera.pose };
    for (let i = 0; i < 100; i++) model.step(STEP);
    expect(model.camera.pose).toEqual(pose);
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free', selectedId: CITY.landmark.id });
  });

  it('manual navigation stops focus at the current pose without clearing its target', () => {
    const model = new WorldModel(false);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.step(STEP);
    const before = { ...model.camera.pose };
    model.command({ type: 'navigate', zoom: 0.1 });
    expect(model.camera.pose.x).toBe(before.x);
    expect(model.camera.pose.z).toBe(before.z);
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free', selectedId: CITY.landmark.id });
    const stopped = { ...model.camera.pose };
    for (let i = 0; i < 50; i++) model.step(STEP);
    expect(model.camera.pose).toEqual(stopped);
  });

  it('freezes actors and an in-flight focus for 30 seconds, then resumes without catch-up', () => {
    const model = new WorldModel(false);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.step(STEP);
    model.command({ type: 'set-paused', paused: true });
    const camera = { ...model.camera.pose };
    const actors = structuredClone(model.simulation.actors);
    for (let i = 0; i < 900; i++) model.step(STEP);
    expect(model.camera.pose).toEqual(camera);
    expect(model.simulation.actors).toEqual(actors);
    model.command({ type: 'set-paused', paused: false });
    model.step(STEP);
    expect(model.simulation.elapsed).toBeCloseTo(2 * STEP);
    expect(model.camera.pose).not.toEqual(camera);
  });

  it('allows static navigation while paused', () => {
    const model = new WorldModel(true);
    model.command({ type: 'focus-landmark', id: LANDMARKS[1].id });
    expect(model.camera.pose.x).toBe(LANDMARKS[1].position.x);
    model.command({ type: 'reset' });
    expect(model.camera.pose).toEqual(OVERVIEW);
    expect(model.snapshot()).toMatchObject({ paused: true, selectedId: null });
  });

  it('preserves a focus transition through pause but never through modal dismissal', () => {
    const model = new WorldModel(false);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.command({ type: 'set-paused', paused: true });
    expect(model.camera.mode).toBe('focus');
    model.command({ type: 'set-paused', paused: false });
    model.command({ type: 'open-panel' });
    const pose = { ...model.camera.pose };
    model.step(STEP);
    expect(model.camera.pose).toEqual(pose);
    expect(model.simulation.elapsed).toBeGreaterThan(0);
    model.command({ type: 'close-panel' });
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free' });
    model.step(STEP);
    expect(model.camera.pose).toEqual(pose);
  });

  it('rejects invalid POI without silently switching targets', () => {
    const model = new WorldModel(false);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.command({ type: 'focus-landmark', id: 'missing' });
    expect(model.snapshot().message).toBe('Landmark unavailable.');
    expect(model.snapshot().selectedId).toBe(CITY.landmark.id);
  });

  it('bounds all manual camera directions and immediate focus', () => {
    const camera = new CameraController();
    for (let i = 0; i < 100; i++) camera.navigate({ type: 'navigate', panX: 20, panZ: -20, rotate: 1, zoom: 0.5 });
    expect(Math.abs(camera.pose.x)).toBeLessThanOrEqual(CITY.bounds);
    expect(Math.abs(camera.pose.z)).toBeLessThanOrEqual(CITY.bounds);
    expect(camera.pose.zoom).toBe(2.7);
    expect(Math.abs(camera.pose.yaw)).toBeLessThanOrEqual(Math.PI);
    camera.navigate({ type: 'navigate', zoom: -100 });
    for (let i = 0; i < 10; i++) camera.navigate({ type: 'navigate', zoom: -1 });
    expect(camera.pose.zoom).toBe(0.65);
    expect(() => camera.navigate({ type: 'navigate', panX: NaN })).toThrow('finite');
  });

  it('starts reduced motion paused and cancels automation on a live preference change', () => {
    const model = new WorldModel(false);
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.command({ type: 'set-reduced-motion', reduced: true });
    expect(model.snapshot()).toMatchObject({ paused: true, reducedMotion: true, cameraMode: 'free' });
    model.command({ type: 'set-paused', paused: false });
    model.command({ type: 'focus-landmark', id: CITY.landmark.id });
    model.step(STEP);
    expect(model.camera.pose.x).toBe(CITY.landmark.position.x);
  });
});

describe('authored content', () => {
  it('validates stable, bounded semantic IDs', () => {
    expect(() => validateLandmarks(LANDMARKS)).not.toThrow();
    expect(() => validateLandmarks([])).toThrow();
    expect(() => validateLandmarks([LANDMARKS[0], LANDMARKS[0]])).toThrow('unique');
    expect(() => validateLandmarks([{ ...LANDMARKS[0], position: { x: Infinity, y: 0, z: 0 } }])).toThrow('anchor');
  });

  describe('tour arbitration and guided views', () => {
    function advance(model: WorldModel, seconds: number) {
      for (let i = 0; i < seconds * 30; i++) model.step(STEP);
    }

    it('runs deterministic global segments with bounded, continuous camera travel', () => {
      const a = new WorldModel(false);
      const b = new WorldModel(false);
      a.command({ type: 'start-tour' });
      b.command({ type: 'start-tour' });
      for (let i = 0; i < 240 * 30; i++) {
        const previous = { ...a.camera.pose };
        a.step(STEP);
        b.step(STEP);
        expect(a.camera.pose).toEqual(b.camera.pose);
        expect(Math.hypot(a.camera.pose.x - previous.x, a.camera.pose.z - previous.z)).toBeLessThan(0.2);
        expect(Math.abs(a.camera.pose.x)).toBeLessThanOrEqual(CITY.bounds);
        expect(Math.abs(a.camera.pose.z)).toBeLessThanOrEqual(CITY.bounds);
      }
      expect(a.camera.revision).toBeGreaterThan(10);
      expect(a.snapshot().view).toMatchObject({ guided: false, total: 4 });
    });

    it('uses selected-landmark compositions and preserves them through pause', () => {
      const model = new WorldModel(false);
      model.command({ type: 'focus-landmark', id: LANDMARKS[1].id });
      model.command({ type: 'start-tour' });
      advance(model, 3);
      const before = { ...model.camera.pose };
      const view = model.snapshot().view;
      model.command({ type: 'set-paused', paused: true });
      advance(model, 60);
      expect(model.camera.pose).toEqual(before);
      expect(model.snapshot().view).toEqual(view);
      model.command({ type: 'set-paused', paused: false });
      advance(model, 1);
      expect(model.camera.pose).not.toEqual(before);
      expect(model.snapshot().view?.subject).toBe(LANDMARKS[1].name);
    });

    it.each(['navigate', 'reset', 'stop', 'clear-selection', 'open-panel'] as const)('cancels automation on %s without restarting it later', (type) => {
      const model = new WorldModel(false);
      model.command({ type: 'start-tour' });
      advance(model, 1);
      model.command({ type });
      if (type === 'open-panel') model.command({ type: 'close-panel' });
      advance(model, 1);
      const pose = { ...model.camera.pose };
      advance(model, 60);
      expect(model.snapshot().view).toBeNull();
      expect(model.camera.pose).toEqual(pose);
    });

    it('refuses continuous tours while paused and allows stepwise views in reduced motion', () => {
      const model = new WorldModel(false);
      model.command({ type: 'set-paused', paused: true });
      model.command({ type: 'start-tour' });
      expect(model.snapshot().message).toContain('Resume');
      expect(model.snapshot().view).toBeNull();
      model.command({ type: 'set-reduced-motion', reduced: true });
      model.command({ type: 'start-tour' });
      expect(model.snapshot().view).toMatchObject({ guided: true, index: 0 });
      const pose = { ...model.camera.pose };
      model.command({ type: 'set-paused', paused: false });
      advance(model, 120);
      expect(model.camera.pose).toEqual(pose);
      model.command({ type: 'guided-step', direction: -1 });
      expect(model.snapshot().view?.index).toBe(3);
      model.command({ type: 'guided-step', direction: 1 });
      expect(model.snapshot().view?.index).toBe(0);
      model.command({ type: 'focus-landmark', id: LANDMARKS[2].id });
      expect(model.snapshot().view).toBeNull();
    });
  });

  it('has a closed continuous route with tangent continuity', () => {
    const before = sampleRoute(ROUTE_LENGTH - 0.001);
    const after = sampleRoute(0.001);
    expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeCloseTo(0.002, 4);
    expect(before.heading).toBeCloseTo(after.heading, 3);
  });
});
