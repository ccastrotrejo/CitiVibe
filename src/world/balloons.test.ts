// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BALLOONS, BalloonDrift, createBalloonsVisual } from './balloons';

const DT = 1 / 30;

function nextGap(seed: number): { seed: number; seconds: number } {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { seed: next, seconds: 150 + Math.floor(next / 0x100000000 * 151) };
}

function waitForDrift(simulation: BalloonDrift): number {
  let ticks = 0;
  while (!simulation.state.active && ticks <= 300 * 30) {
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

describe('BalloonDrift', () => {
  it.each([5309, 0, 0xffffffff])('seed %s starts inactive and waits exactly its seeded 150–300-second gap', (seed) => {
    const simulation = new BalloonDrift(seed);
    const state = simulation.state;
    const gap = nextGap(seed).seconds;
    expect(state.active).toBe(false);
    expect(state.position).toEqual({ x: BALLOONS.startX, y: BALLOONS.altitude, z: BALLOONS.startZ });
    for (let tick = 0; tick < gap * 30 - 1; tick += 1) simulation.step(DT);
    expect(state.active).toBe(false);
    simulation.step(DT);
    expect(state.active).toBe(true);
    expect(state.position).toEqual({ x: BALLOONS.startX, y: BALLOONS.altitude, z: BALLOONS.startZ });
  });

  it('is reproducible without wall time, timers, or ambient randomness', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness'); });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Wall time'); });
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const interval = vi.spyOn(globalThis, 'setInterval');
    try {
      const first = new BalloonDrift();
      const second = new BalloonDrift(5309);
      const different = new BalloonDrift(10);
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
    const simulation = new BalloonDrift();
    const before = JSON.stringify(simulation);
    expect(() => simulation.step(delta)).toThrow(RangeError);
    expect(JSON.stringify(simulation)).toBe(before);
  });

  it.each([NaN, Infinity, -1, 1.1, 0x100000000])('rejects invalid seed %s', (seed) => {
    expect(() => new BalloonDrift(seed)).toThrow(RangeError);
  });

  it('caps catch-up deltas and freezes both the gap and drift position when no time advances', () => {
    const clamped = new BalloonDrift();
    const normal = new BalloonDrift();
    clamped.step(600);
    normal.step(DT);
    expect(clamped).toEqual(normal);
    const quiet = JSON.stringify(clamped);
    for (let tick = 0; tick < 900; tick += 1) clamped.step(0);
    expect(JSON.stringify(clamped)).toBe(quiet);
    waitForDrift(clamped);
    waitForDrift(normal);
    clamped.step(600);
    normal.step(DT);
    expect(clamped).toEqual(normal);
  });

  it('suppresses and freezes reduced motion, then requires a fresh quiet gap instead of resuming mid-drift', () => {
    const simulation = new BalloonDrift();
    const state = simulation.state;
    waitForDrift(simulation);
    for (let tick = 0; tick < BALLOONS.routeLength / (BALLOONS.speed * DT) / 2; tick += 1) simulation.step(DT);
    expect(state.active).toBe(true);
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
    expect(state.position).toEqual({ x: BALLOONS.startX, y: BALLOONS.altitude, z: BALLOONS.startZ });
  });

  it('reuses one state and visual through bounded gaps and continuous, safe drifts', () => {
    const simulation = new BalloonDrift();
    const visual = createBalloonsVisual();
    const original = inventory(visual.group);
    const state = simulation.state;
    const position = state.position;
    let exits = 0;
    let x = position.x;
    let z = position.z;
    const maxX = Math.abs(BALLOONS.startX);
    const maxZ = Math.abs(BALLOONS.startZ);
    try {
      for (let tick = 0; tick < 180_000; tick += 1) {
        const wasActive = state.active;
        simulation.step(DT);
        if (wasActive && !state.active) {
          exits += 1;
          expect(Math.abs(position.x)).toBe(maxX);
          expect(Math.abs(position.z)).toBe(maxZ);
          expect(inventory(visual.group)).toEqual(original);
        }
        const movement = Math.hypot(position.x - x, position.z - z);
        if (![position.x, position.y, position.z, state.heading].every(Number.isFinite) ||
          position.y !== BALLOONS.altitude || Math.abs(position.x) > maxX + 1e-9 || Math.abs(position.z) > maxZ + 1e-9 ||
          movement > BALLOONS.speed * DT + 1e-9) {
          throw new Error(`Discontinuous or unsafe balloon position at tick ${tick}`);
        }
        visual.group.visible = state.active;
        visual.group.position.set(position.x, position.y, position.z);
        visual.group.rotation.y = state.heading;
        x = position.x;
        z = position.z;
      }
      expect(exits).toBeGreaterThan(0);
      expect(inventory(visual.group)).toEqual(original);
    } finally {
      visual.dispose();
    }
  });

  it('derives its route length from the drift endpoints', () => {
    expect(BALLOONS.routeLength).toBe(Math.hypot(BALLOONS.endX - BALLOONS.startX, BALLOONS.endZ - BALLOONS.startZ));
  });
});

describe('original balloon visual', () => {
  it('uses a bounded unbranded bunch, shared geometry, no shadows, and no selection metadata', () => {
    const visual = createBalloonsVisual();
    try {
      const resources = inventory(visual.group);
      expect(visual.group.visible).toBe(false);
      expect(visual.group.position).toEqual(new THREE.Vector3());
      expect(resources.meshes).toBe(BALLOONS.colors.length * 3);
      expect(resources.geometries.size).toBe(3);
      expect(resources.materials.size).toBe(BALLOONS.colors.length + 1);
      expect(resources.triangles).toBeLessThan(2000);
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
      expect(bounds.getBoundingSphere(new THREE.Sphere()).radius).toBeLessThan(8);
    } finally {
      visual.dispose();
    }
  });

  it('disposes each owned geometry/material exactly once and detaches without affecting another instance', () => {
    const first = createBalloonsVisual();
    const second = createBalloonsVisual();
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
