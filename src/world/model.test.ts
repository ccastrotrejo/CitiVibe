import { describe, expect, it } from 'vitest';
import { CAMERA_ANCHORS, CAMERA_PROJECTION, CITY, validateCameraAnchors } from '../content/city';
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
    model.command({ type: 'navigate', panZ: 20 });
    const pivot = { x: model.camera.pose.x, z: model.camera.pose.z };
    for (let i = 0; i < 80; i++) {
      model.command({ type: 'navigate', rotate: 0.2, tilt: 0.1 });
      expect(model.camera.pose.x).toBe(pivot.x);
      expect(model.camera.pose.z).toBe(pivot.z);
    }
    expect(model.camera.pose.pitch).toBe(CAMERA_PROJECTION.maxPitch);
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free', paused: true });
    model.command({ type: 'navigate', tilt: -100 });
    expect(model.camera.pose.pitch).toBe(CAMERA_PROJECTION.minPitch);
    expect(() => model.command({ type: 'navigate', tilt: NaN })).toThrow('finite');
    model.command({ type: 'reset' });
    expect(model.camera.pose).toEqual(OVERVIEW);
  });

  it.each([0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2])('can pan to all four map edges at yaw %f', (yaw) => {
    const camera = new CameraController();
    camera.navigate({ type: 'navigate', rotate: yaw - camera.pose.yaw });
    for (const [x, z] of [[-CITY.bounds.x, -CITY.bounds.z], [CITY.bounds.x, -CITY.bounds.z],
      [CITY.bounds.x, CITY.bounds.z], [-CITY.bounds.x, CITY.bounds.z]]) {
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

  it('cancels overview transitions on manual input', () => {
    const model = new WorldModel(false);
    model.command({ type: 'navigate', panX: 20 });
    model.command({ type: 'reset' });
    model.step(0.03);
    model.command({ type: 'navigate', panX: 2 });
    const pose = { ...model.camera.pose };
    for (let i = 0; i < 100; i++) model.step(STEP);
    expect(model.camera.pose).toEqual(pose);
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free' });
  });

  it('manual zoom stops a tour at its current position', () => {
    const model = new WorldModel(false);
    model.command({ type: 'navigate', panX: 20 });
    model.command({ type: 'start-tour' });
    model.step(STEP);
    const before = { ...model.camera.pose };
    model.command({ type: 'navigate', zoom: 0.1 });
    expect(model.camera.pose.x).toBe(before.x);
    expect(model.camera.pose.z).toBe(before.z);
    expect(model.snapshot()).toMatchObject({ cameraMode: 'free', view: null });
    const stopped = { ...model.camera.pose };
    for (let i = 0; i < 50; i++) model.step(STEP);
    expect(model.camera.pose).toEqual(stopped);
  });

  it('freezes actors and an overview transition for 30 seconds, then resumes without catch-up', () => {
    const model = new WorldModel(false);
    model.command({ type: 'navigate', panX: 20 });
    model.command({ type: 'reset' });
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
    model.command({ type: 'navigate', panX: 20 });
    expect(model.camera.pose).not.toEqual(OVERVIEW);
    expect(model.simulation.elapsed).toBe(0);
    model.command({ type: 'reset' });
    expect(model.camera.pose).toEqual(OVERVIEW);
    expect(model.snapshot()).toMatchObject({ paused: true });
  });

  it('preserves an overview transition through pause but never through modal dismissal', () => {
    const model = new WorldModel(false);
    model.command({ type: 'navigate', panX: 20 });
    model.command({ type: 'reset' });
    model.command({ type: 'set-paused', paused: true });
    expect(model.camera.mode).toBe('overview');
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

  it('keeps every city-wide guided view in its original order without selection state', () => {
    const model = new WorldModel(true);
    expect(model).not.toHaveProperty('selectedId');
    expect(model.snapshot()).not.toHaveProperty('selectedId');
    expect(CAMERA_ANCHORS.map(({ subject }) => subject)).toEqual([
      'District overview', 'Rainlight Pavilion', 'Crosstown Steps', 'Terrace Steps', 'Reservoir Walk', 'Juniper Court',
    ]);
    model.command({ type: 'start-tour' });
    for (const [index, anchor] of CAMERA_ANCHORS.entries()) {
      expect(model.snapshot()).toMatchObject({
        cameraMode: 'guided', paused: true,
        view: { guided: true, index, total: CAMERA_ANCHORS.length, subject: anchor.subject },
      });
      expect(model.camera.pose).toEqual(anchor.pose);
      model.step(STEP);
      expect(model.camera.pose).toEqual(anchor.pose);
      model.command({ type: 'guided-step', direction: 1 });
    }
    expect(model.camera.pose).toEqual(OVERVIEW);
  });

  it('bounds all manual camera directions', () => {
    const camera = new CameraController();
    for (let i = 0; i < 100; i++) camera.navigate({ type: 'navigate', panX: 20, panZ: -20, rotate: 1, zoom: 0.5 });
    expect(Math.abs(camera.pose.x)).toBeLessThanOrEqual(CITY.bounds.x);
    expect(Math.abs(camera.pose.z)).toBeLessThanOrEqual(CITY.bounds.z);
    expect(camera.pose.zoom).toBe(CAMERA_PROJECTION.maxZoom);
    expect(Math.abs(camera.pose.yaw)).toBeLessThanOrEqual(Math.PI);
    camera.navigate({ type: 'navigate', zoom: -100 });
    for (let i = 0; i < 10; i++) camera.navigate({ type: 'navigate', zoom: -1 });
    expect(camera.pose.zoom).toBe(0.65);
    expect(() => camera.navigate({ type: 'navigate', panX: NaN })).toThrow('finite');
  });

  it('starts reduced motion paused and cancels automation on a live preference change', () => {
    const model = new WorldModel(false);
    model.command({ type: 'start-tour' });
    model.command({ type: 'set-reduced-motion', reduced: true });
    expect(model.snapshot()).toMatchObject({ paused: true, reducedMotion: true, cameraMode: 'free' });
    model.command({ type: 'set-paused', paused: false });
    model.command({ type: 'start-tour' });
    model.command({ type: 'guided-step', direction: 1 });
    model.step(STEP);
    expect(model.camera.pose).toEqual(CAMERA_ANCHORS[1].pose);
  });

  it('freezes an interrupted weather blend while paused and resumes without catching up', () => {
    const model = new WorldModel(false);
    const reference = new WorldModel(false);
    for (const world of [model, reference]) {
      world.command({ type: 'set-weather', weather: 'rain' });
      for (let tick = 0; tick < 30; tick++) world.step(STEP);
      world.command({ type: 'set-weather', weather: 'snow' });
    }
    model.command({ type: 'set-paused', paused: true });
    const held = structuredClone(model.environment.frame);
    const physicsTime = model.environment.physics.time;
    for (let tick = 0; tick < 1800; tick++) model.step(STEP);
    model.resync();
    expect(model.environment.frame).toEqual(held);
    expect(model.environment.physics.time).toBe(physicsTime);
    model.command({ type: 'set-paused', paused: false });
    model.step(STEP);
    reference.step(STEP);
    expect(model.environment.frame).toEqual(reference.environment.frame);
  });

  it('keeps explicit paused and reduced-motion weather selections immediate without clearing snow', () => {
    const model = new WorldModel(true, { weather: 'snow' });
    model.environment.physics.surface.snowSweMm = 1;
    model.command({ type: 'set-weather', weather: 'rain' });
    expect(model.environment.frame).toMatchObject({ rain: 1, snow: 0 });
    model.command({ type: 'set-paused', paused: false });
    model.command({ type: 'set-weather', weather: 'sunny' });
    expect(model.environment.frame).toMatchObject({ rain: 0, snow: 0 });
    expect(model.environment.physics.surface.snowSweMm).toBe(1);
    model.step(STEP);
    expect(model.environment.frame).toMatchObject({ rain: 0, snow: 0 });
  });
});

describe('authored content', () => {
  it('validates nonempty, unique and bounded city-wide tour anchors', () => {
    expect(() => validateCameraAnchors(CAMERA_ANCHORS)).not.toThrow();
    expect(() => validateCameraAnchors([])).toThrow('no camera anchors');
    expect(() => validateCameraAnchors([CAMERA_ANCHORS[0], CAMERA_ANCHORS[0]])).toThrow('Invalid camera anchor');
    for (const change of [{ id: '' }, { subject: ' ' }]) {
      expect(() => validateCameraAnchors([{ ...CAMERA_ANCHORS[0], ...change }])).toThrow('Invalid camera anchor');
    }
    for (const change of [{ x: Infinity }, { x: CITY.bounds.x + 1 }, { z: CITY.bounds.z + 1 },
      { yaw: NaN }, { zoom: 0 }, { zoom: CAMERA_PROJECTION.maxZoom + 1 }, { pitch: 0 }, { pitch: Math.PI }]) {
      expect(() => validateCameraAnchors([{ ...CAMERA_ANCHORS[0], pose: { ...OVERVIEW, ...change } }])).toThrow('Invalid camera anchor');
    }
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
      for (let i = 0; i < 900 * 30; i++) {
        const previous = { ...a.camera.pose };
        a.step(STEP);
        b.step(STEP);
        expect(a.camera.pose).toEqual(b.camera.pose);
        expect(Math.hypot(a.camera.pose.x - previous.x, a.camera.pose.z - previous.z)).toBeLessThan(0.2);
        expect(Math.abs(a.camera.pose.x)).toBeLessThanOrEqual(CITY.bounds.x);
        expect(Math.abs(a.camera.pose.z)).toBeLessThanOrEqual(CITY.bounds.z);
      }
      expect(a.camera.revision).toBeGreaterThan(10);
      expect(a.snapshot().view).toMatchObject({ guided: false, total: CAMERA_ANCHORS.length });
    }, 20000);

    it('preserves the city-wide tour through pause and resumes from its retained pose', () => {
      const model = new WorldModel(false);
      model.command({ type: 'navigate', panX: 20 });
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
      expect(model.snapshot().view?.subject).toBe('District overview');
    });

    it.each(['navigate', 'reset', 'stop', 'open-panel'] as const)('cancels automation on %s without restarting it later', (type) => {
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
      expect(model.snapshot().view?.index).toBe(CAMERA_ANCHORS.length - 1);
      model.command({ type: 'guided-step', direction: 1 });
      expect(model.snapshot().view?.index).toBe(0);
      model.command({ type: 'navigate', panX: 2 });
      expect(model.snapshot().view).toBeNull();
    });
  });

});
