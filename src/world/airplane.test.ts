// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CAMERA_ANCHORS, CAMERA_PROJECTION, CITY } from '../content/city';
import { AIRPLANE, AirplaneSimulation, createAirplaneVisual } from './airplane';

const DT = 1 / 30;

function nextGap(seed: number): { seed: number; seconds: number } {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { seed: next, seconds: 90 + Math.floor(next / 0x100000000 * 91) };
}

function waitForFlight(simulation: AirplaneSimulation): number {
  let ticks = 0;
  while (!simulation.state.active && ticks <= 180 * 30) {
    simulation.step(DT);
    ticks += 1;
  }
  expect(simulation.state.active).toBe(true);
  return ticks;
}

function inventory(group: THREE.Group) {
  const objects: THREE.Object3D[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let triangles = 0;
  let meshes = 0;
  group.traverse((object) => {
    objects.push(object);
    if (object instanceof THREE.Mesh) {
      meshes += 1;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    }
  });
  return { objects, geometries, materials, triangles, meshes };
}

function cameraFor(aspect: number, x: number, z: number, yaw: number, zoom: number): THREE.OrthographicCamera {
  const height = Math.max(CAMERA_PROJECTION.overviewHeight, CAMERA_PROJECTION.overviewWidth / aspect);
  const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, CAMERA_PROJECTION.far);
  const radius = CAMERA_PROJECTION.distance * Math.cos(CAMERA_PROJECTION.defaultPitch);
  camera.position.set(x + Math.sin(yaw) * radius, CAMERA_PROJECTION.distance * Math.sin(CAMERA_PROJECTION.defaultPitch), z + Math.cos(yaw) * radius);
  camera.lookAt(x, 0, z);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function frustumFor(camera: THREE.OrthographicCamera): THREE.Frustum {
  return new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
}

describe('AirplaneSimulation', () => {
  it.each([2401, 0, 0xffffffff])('seed %s starts inactive and waits exactly its seeded 90–180-second gap', (seed) => {
    const simulation = new AirplaneSimulation(seed);
    const state = simulation.state;
    const position = state.position;
    const gap = nextGap(seed).seconds;
    expect(state.active).toBe(false);
    expect(state.position).toEqual({ x: AIRPLANE.startX, y: AIRPLANE.altitude, z: AIRPLANE.startZ });
    for (let tick = 0; tick < gap * 30 - 1; tick += 1) simulation.step(DT);
    expect(state.active).toBe(false);
    simulation.step(DT);
    expect(state.active).toBe(true);
    expect(simulation.state).toBe(state);
    expect(state.position).toBe(position);
    expect(state.position).toEqual({ x: AIRPLANE.startX, y: AIRPLANE.altitude, z: AIRPLANE.startZ });
  });

  it('is reproducible without wall time, timers, or ambient randomness', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness'); });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Wall time'); });
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const interval = vi.spyOn(globalThis, 'setInterval');
    try {
      const first = new AirplaneSimulation();
      const second = new AirplaneSimulation(2401);
      const different = new AirplaneSimulation(10);
      let observedDifference = false;
      for (let tick = 0; tick < 30_000; tick += 1) {
        first.step(DT);
        second.step(DT);
        different.step(DT);
        if (tick % 30 === 0) expect(first).toEqual(second);
        if (first.state.active !== different.state.active) observedDifference = true;
      }
      expect(observedDifference).toBe(true);
      expect(random).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
      expect(timer).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
      now.mockRestore();
      timer.mockRestore();
      interval.mockRestore();
    }
  });

  it.each([NaN, Infinity, -Infinity, -1, -0.01])('rejects delta %s without changing the scheduler', (delta) => {
    const simulation = new AirplaneSimulation();
    const before = JSON.stringify(simulation);
    expect(() => simulation.step(delta)).toThrow(RangeError);
    expect(JSON.stringify(simulation)).toBe(before);
    simulation.setReducedMotion(true);
    const reduced = JSON.stringify(simulation);
    expect(() => simulation.step(delta)).toThrow(RangeError);
    expect(JSON.stringify(simulation)).toBe(reduced);
  });

  it.each([NaN, Infinity, -1, 1.1, 0x100000000])('rejects invalid seed %s', (seed) => {
    expect(() => new AirplaneSimulation(seed)).toThrow(RangeError);
  });

  it('caps catch-up deltas and freezes both the gap and active position when no time advances', () => {
    const clamped = new AirplaneSimulation();
    const normal = new AirplaneSimulation();
    clamped.step(600);
    normal.step(DT);
    expect(clamped).toEqual(normal);
    const quiet = JSON.stringify(clamped);
    for (let tick = 0; tick < 900; tick += 1) clamped.step(0);
    expect(JSON.stringify(clamped)).toBe(quiet);
    waitForFlight(clamped);
    waitForFlight(normal);
    clamped.step(600);
    normal.step(DT);
    expect(clamped).toEqual(normal);
    const flying = JSON.stringify(clamped);
    for (let tick = 0; tick < 900; tick += 1) clamped.step(0);
    expect(JSON.stringify(clamped)).toBe(flying);
    clamped.step(DT);
    normal.step(DT);
    expect(clamped).toEqual(normal);
  });

  it('suppresses and freezes reduced motion, then requires a fresh quiet gap instead of resuming midflight', () => {
    const simulation = new AirplaneSimulation();
    const state = simulation.state;
    const position = state.position;
    waitForFlight(simulation);
    for (let tick = 0; tick < AIRPLANE.routeLength / (AIRPLANE.speed * DT) / 2; tick += 1) simulation.step(DT);
    expect(state.active).toBe(true);
    expect(state.position.x).toBe(0);
    simulation.setReducedMotion(true);
    expect(state.active).toBe(false);
    const disabled = JSON.stringify(simulation);
    for (let tick = 0; tick < 18_000; tick += 1) {
      simulation.step(DT);
      simulation.setReducedMotion(true);
    }
    expect(JSON.stringify(simulation)).toBe(disabled);
    simulation.setReducedMotion(false);
    expect(state.active).toBe(false);
    expect(state.position).toEqual({ x: AIRPLANE.startX, y: AIRPLANE.altitude, z: AIRPLANE.startZ });
    const gap = nextGap(nextGap(2401).seed).seconds;
    for (let tick = 0; tick < gap * 30 - 1; tick += 1) {
      simulation.setReducedMotion(false);
      simulation.step(DT);
      expect(state.active).toBe(false);
    }
    simulation.step(DT);
    expect(state.active).toBe(true);
    expect(simulation.state).toBe(state);
    expect(state.position).toBe(position);
  });

  it('freezes an initially suppressed gap and refreshes it only on a reduced-motion transition', () => {
    const simulation = new AirplaneSimulation();
    simulation.setReducedMotion(true);
    const disabled = JSON.stringify(simulation);
    for (let tick = 0; tick < 18_000; tick += 1) simulation.step(DT);
    expect(JSON.stringify(simulation)).toBe(disabled);
    simulation.setReducedMotion(false);
    expect(waitForFlight(simulation)).toBe(nextGap(nextGap(2401).seed).seconds * 30);
  });

  it('reuses one state and visual through 12,000 seconds of bounded gaps and continuous passes', () => {
    const simulation = new AirplaneSimulation();
    const visual = createAirplaneVisual();
    const original = inventory(visual.group);
    const state = simulation.state;
    const position = state.position;
    let gap = nextGap(2401);
    let waitingTicks = 0;
    let flightTicks = 0;
    let starts = 0;
    let exits = 0;
    let x = position.x;
    let z = position.z;
    try {
      for (let tick = 0; tick < 360_000; tick += 1) {
        const wasActive = state.active;
        simulation.step(DT);
        if (!wasActive) {
          waitingTicks += 1;
          if (state.active) {
            expect(waitingTicks).toBe(gap.seconds * 30);
            expect(waitingTicks).toBeGreaterThanOrEqual(90 * 30);
            expect(waitingTicks).toBeLessThanOrEqual(180 * 30);
            waitingTicks = 0;
            starts += 1;
            expect(Math.abs(position.x)).toBe(AIRPLANE.endX);
            expect(Math.abs(position.z)).toBe(AIRPLANE.endZ);
            expect(inventory(visual.group)).toEqual(original);
          }
        } else {
          flightTicks += 1;
          if (!state.active) {
            exits += 1;
            expect(flightTicks).toBe(AIRPLANE.routeLength / (AIRPLANE.speed * DT));
            expect(Math.abs(position.x)).toBe(AIRPLANE.endX);
            expect(Math.abs(position.z)).toBe(AIRPLANE.endZ);
            gap = nextGap(gap.seed);
            flightTicks = 0;
          }
        }
        if (starts - exits !== (state.active ? 1 : 0) || simulation.state !== state || state.position !== position) {
          throw new Error(`Airplane identity/population changed at tick ${tick}`);
        }
        const movement = Math.hypot(position.x - x, position.z - z);
        if (![position.x, position.y, position.z, state.heading].every(Number.isFinite) ||
          position.y !== AIRPLANE.altitude || Math.abs(position.x) > AIRPLANE.endX || Math.abs(position.z) > AIRPLANE.endZ ||
          movement > 15 * DT + 1e-9 ||
          Math.abs(position.x - x - Math.sin(state.heading) * movement) > 1e-9 ||
          Math.abs(position.z - z - Math.cos(state.heading) * movement) > 1e-9) {
          throw new Error(`Discontinuous or unsafe airplane position at tick ${tick}`);
        }
        visual.group.visible = state.active;
        visual.group.position.set(position.x, position.y, position.z);
        visual.group.rotation.y = state.heading;
        x = position.x;
        z = position.z;
      }
      expect(exits).toBeGreaterThanOrEqual(Math.floor(12000 / (AIRPLANE.maximumGap + AIRPLANE.routeLength / AIRPLANE.speed)));
      expect(exits).toBeLessThanOrEqual(Math.floor(12000 / (AIRPLANE.minimumGap + AIRPLANE.routeLength / AIRPLANE.speed)));
      expect(inventory(visual.group)).toEqual(original);
    } finally {
      visual.dispose();
    }
  });

  it('places the full airplane outside all tested desktop endpoint views, including maximum zoom-out and pan', () => {
    const endpoints = [
      new THREE.Vector3(AIRPLANE.startX, AIRPLANE.altitude, AIRPLANE.startZ),
      new THREE.Vector3(AIRPLANE.endX, AIRPLANE.altitude, AIRPLANE.endZ),
    ];
    const targets = [[0, 0], [-CITY.bounds.x, -CITY.bounds.z], [-CITY.bounds.x, CITY.bounds.z],
      [CITY.bounds.x, -CITY.bounds.z], [CITY.bounds.x, CITY.bounds.z]];
    for (const aspect of [4 / 3, 16 / 10, 16 / 9, 21 / 9, 32 / 9]) {
      for (const [x, z] of targets) {
        for (const zoom of [0.65, 1, 2.7, CAMERA_PROJECTION.maxZoom]) {
          for (let turn = 0; turn < 24; turn += 1) {
            const frustum = frustumFor(cameraFor(aspect, x, z, turn * Math.PI / 12, zoom));
            for (const endpoint of endpoints) {
              expect(frustum.intersectsSphere(new THREE.Sphere(endpoint, 6))).toBe(false);
            }
          }
        }
      }
    }
  });

  it('crosses the overview and retained garden views; distant closeups need not show every flight', () => {
    const retainedViews = CAMERA_ANCHORS.filter(({ id }) =>
      ['square-overview', 'pavilion-view', 'terrace-view', 'garden-view'].includes(id));
    expect(retainedViews).toHaveLength(4);
    for (const { pose } of retainedViews) {
      const frustum = frustumFor(cameraFor(16 / 9, pose.x, pose.z, pose.yaw, pose.zoom));
      let visible = false;
      for (let distance = 0; distance <= AIRPLANE.routeLength; distance += 5) {
        const fraction = distance / AIRPLANE.routeLength;
        if (frustum.containsPoint(new THREE.Vector3(
          AIRPLANE.startX + (AIRPLANE.endX - AIRPLANE.startX) * fraction,
          AIRPLANE.altitude,
          AIRPLANE.startZ + (AIRPLANE.endZ - AIRPLANE.startZ) * fraction,
        ))) visible = true;
      }
      expect(visible).toBe(true);
    }
    expect(AIRPLANE.routeLength).toBe(Math.hypot(AIRPLANE.endX - AIRPLANE.startX, AIRPLANE.endZ - AIRPLANE.startZ));
  });
});

describe('original airplane visual', () => {
  it('uses a bounded unbranded silhouette, shared geometry, no shadows, and no selection metadata', () => {
    const visual = createAirplaneVisual();
    try {
      const resources = inventory(visual.group);
      expect(visual.group.visible).toBe(false);
      expect(visual.group.position).toEqual(new THREE.Vector3());
      expect(resources.objects).toHaveLength(8);
      expect(resources.meshes).toBe(7);
      expect(resources.geometries.size).toBe(3);
      expect(resources.materials.size).toBe(2);
      expect(resources.triangles).toBe(528);
      for (const object of resources.objects) {
        expect(object.castShadow).toBe(false);
        expect(object.receiveShadow).toBe(false);
        expect(object.userData).toEqual({});
      }
      for (const material of resources.materials) {
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect((material as THREE.MeshStandardMaterial).map).toBeNull();
      }
      const bounds = new THREE.Box3().setFromObject(visual.group);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(7.6, 5);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(8.2, 5);
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(1.95, 5);
      expect(AIRPLANE.altitude + bounds.min.y).toBeGreaterThanOrEqual(42);
      expect(bounds.getBoundingSphere(new THREE.Sphere()).radius).toBeLessThan(6);
      const cockpit = visual.group.getObjectByName('Cockpit glazing')!;
      expect(cockpit.position.z).toBeGreaterThan(0);
    } finally {
      visual.dispose();
    }
  });

  it('disposes each owned geometry/material exactly once and detaches the visual without affecting another instance', () => {
    const first = createAirplaneVisual();
    const second = createAirplaneVisual();
    const scene = new THREE.Scene();
    scene.add(first.group, second.group);
    const firstResources = inventory(first.group);
    const secondResources = inventory(second.group);
    const disposeSpies = [...firstResources.geometries, ...firstResources.materials].map((resource) => vi.spyOn(resource, 'dispose'));
    const otherSpies = [...secondResources.geometries, ...secondResources.materials].map((resource) => vi.spyOn(resource, 'dispose'));
    first.group.visible = true;
    first.dispose();
    first.dispose();
    expect(first.group.visible).toBe(false);
    expect(first.group.parent).toBeNull();
    expect(first.group.children).toHaveLength(0);
    expect(scene.children).toEqual([second.group]);
    for (const spy of disposeSpies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of otherSpies) expect(spy).not.toHaveBeenCalled();
    second.dispose();
    for (const spy of otherSpies) expect(spy).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
  });
});
