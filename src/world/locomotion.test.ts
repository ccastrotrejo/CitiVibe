import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ActorSimulation } from './actors';
import { buildCityScene } from './scene';
import type { CityScene } from './scene';
import {
  Locomotion, VEHICLE, WALKER, footTrajectory, gaitPhase, poseVehicleRig, poseWalkerRig, solveLeg, strideLength,
} from './locomotion';
import type { VehicleRig, WalkerRig } from './locomotion';

const worlds: CityScene[] = [];
function scene() {
  const world = buildCityScene();
  worlds.push(world);
  return world;
}
afterEach(() => {
  worlds.forEach((world) => world.dispose());
  worlds.length = 0;
});

/** Ankle (planted contact) world position of one leg after posing. */
function ankleWorld(group: THREE.Group, rig: WalkerRig, leg: 0 | 1): THREE.Vector3 {
  group.updateMatrixWorld(true);
  return rig.legs[leg].knee.localToWorld(new THREE.Vector3(0, -WALKER.shank, 0));
}

describe('stride and gait phase', () => {
  it('grows stride with speed, then clamps to a reachable range', () => {
    expect(strideLength(0)).toBe(WALKER.strideMin);
    expect(strideLength(1)).toBeLessThanOrEqual(WALKER.strideMax);
    expect(strideLength(0.9)).toBeGreaterThan(strideLength(0.4));
    expect(strideLength(9)).toBe(WALKER.strideMax);
  });

  it('offsets the trailing leg by exactly half a cycle', () => {
    const stride = strideLength(1);
    for (const distance of [0, 0.37, 1.2, 5.9]) {
      const lead = gaitPhase(distance, stride);
      const trail = gaitPhase(distance, stride, 0.5);
      expect(((trail - lead) % 1 + 1) % 1).toBeCloseTo(0.5, 10);
    }
  });
});

describe('foot trajectory', () => {
  it('advances the planted foot backward at exactly body speed (no slide)', () => {
    const stride = 1;
    // World position of a foot on a straight path = distance + local z. During
    // stance this must be invariant with distance.
    let worldZ = Number.NaN;
    for (let distance = 0; distance < 0.55; distance += 0.01) {
      const phase = gaitPhase(distance, stride);
      const foot = footTrajectory(phase, stride);
      const here = distance + foot.z;
      if (!Number.isNaN(worldZ)) expect(here).toBeCloseTo(worldZ, 9);
      worldZ = here;
      expect(foot.y).toBe(0);
    }
  });

  it('lifts the swing foot and returns it to the ground at both ends', () => {
    expect(footTrajectory(0.6, 1).y).toBeCloseTo(0, 9);
    expect(footTrajectory(0.999, 1).y).toBeGreaterThanOrEqual(0);
    expect(footTrajectory(0.8, 1).y).toBeGreaterThan(0.02);
    for (let phase = 0; phase < 1; phase += 0.02) expect(footTrajectory(phase, 1).y).toBeGreaterThanOrEqual(0);
  });
});

describe('two-bone inverse kinematics', () => {
  it('places the ankle exactly on its target inside the reachable envelope', () => {
    const l1 = WALKER.thigh;
    const l2 = WALKER.shank;
    const maxReach = l1 + l2;
    for (const h of [-0.3, -0.1, 0, 0.15, 0.3]) {
      for (const drop of [0.55, 0.66, 0.72, 0.78]) {
        expect(Math.hypot(h, drop)).toBeLessThan(maxReach); // guard: genuinely reachable
        const { hip, knee } = solveLeg(h, drop);
        const footZ = l1 * Math.sin(hip) + l2 * Math.sin(hip - knee);
        const footY = -(l1 * Math.cos(hip) + l2 * Math.cos(hip - knee));
        expect(footZ).toBeCloseTo(h, 9);
        expect(footY).toBeCloseTo(-drop, 9);
      }
    }
  });

  it('never over-extends: an unreachable target clamps to a straight leg', () => {
    const maxReach = WALKER.thigh + WALKER.shank;
    const { knee } = solveLeg(0, maxReach + 0.5);
    expect(knee).toBeGreaterThanOrEqual(0);
    expect(knee).toBeLessThan(0.05); // near-straight, never inverts
  });
});

describe('articulated walker rig', () => {
  it('keeps the support foot ground-locked through its whole stance', () => {
    const world = scene();
    const group = world.actors.get('walker-3')!;
    const rig = group.userData.rig as WalkerRig;
    const stride = strideLength(1);
    const samples: THREE.Vector3[] = [];
    for (let phase = 0.05; phase <= 0.55; phase += 0.025) {
      const distance = phase * stride;
      group.position.set(0, 0, distance);
      group.rotation.y = 0;
      poseWalkerRig(rig, { distance, speed: 1, blend: 1, reducedMotion: false });
      samples.push(ankleWorld(group, rig, 0));
    }
    const xs = samples.map((point) => point.x);
    const zs = samples.map((point) => point.z);
    const ys = samples.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.001);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.001);
    ys.forEach((y) => expect(Math.abs(y)).toBeLessThan(0.01));
  });

  it('never buries or floats the swing foot away from the ground plane', () => {
    const world = scene();
    const group = world.actors.get('walker-3')!;
    const rig = group.userData.rig as WalkerRig;
    const stride = strideLength(1);
    for (let phase = 0.6; phase < 1; phase += 0.02) {
      const distance = phase * stride;
      group.position.set(0, 0, distance);
      poseWalkerRig(rig, { distance, speed: 1, blend: 1, reducedMotion: false });
      const ankle = ankleWorld(group, rig, 0);
      expect(ankle.y).toBeGreaterThan(-0.01);
    }
  });

  it('bobs the body twice per stride with a believable amplitude', () => {
    const world = scene();
    const rig = world.actors.get('walker-3')!.userData.rig as WalkerRig;
    const stride = strideLength(1);
    let maxima = 0;
    let previous = -Infinity;
    let rising = true;
    const heights: number[] = [];
    for (let phase = 0; phase < 1; phase += 0.005) {
      poseWalkerRig(rig, { distance: phase * stride, speed: 1, blend: 1, reducedMotion: false });
      const y = rig.pelvis.position.y;
      heights.push(y);
      if (y < previous && rising) maxima += 1;
      rising = y >= previous;
      previous = y;
    }
    expect(maxima).toBe(2);
    const amplitude = (Math.max(...heights) - Math.min(...heights)) / 2;
    expect(amplitude).toBeGreaterThan(0.01);
    expect(amplitude).toBeLessThan(0.03);
  });

  it('stands quietly with feet planted when not moving', () => {
    const world = scene();
    const group = world.actors.get('walker-3')!;
    const rig = group.userData.rig as WalkerRig;
    group.position.set(0, 0, 4);
    poseWalkerRig(rig, { distance: 4, speed: 0, blend: 0, reducedMotion: false });
    expect(rig.pelvis.position.y).toBeCloseTo(WALKER.hipY, 9);
    expect(rig.torso.position.x).toBe(0);
    for (const leg of [0, 1] as const) {
      const ankle = ankleWorld(group, rig, leg);
      expect(Math.abs(ankle.z - 4)).toBeLessThan(0.01);
      expect(Math.abs(ankle.y)).toBeLessThan(0.01);
    }
  });

  it('is a pure function of distance (reproducible poses)', () => {
    const world = scene();
    const group = world.actors.get('walker-3')!;
    const rig = group.userData.rig as WalkerRig;
    const sample = () => {
      group.position.set(0, 0, 2.4);
      poseWalkerRig(rig, { distance: 2.4, speed: 1, blend: 1, reducedMotion: false });
      return ankleWorld(group, rig, 0);
    };
    const first = sample();
    const second = sample();
    expect(second.x).toBe(first.x);
    expect(second.y).toBe(first.y);
    expect(second.z).toBe(first.z);
  });

  it('drops the bob and sway under reduced motion', () => {
    const world = scene();
    const rig = world.actors.get('walker-3')!.userData.rig as WalkerRig;
    poseWalkerRig(rig, { distance: 1.3, speed: 1, blend: 1, reducedMotion: true });
    expect(rig.pelvis.position.y).toBeCloseTo(WALKER.hipY, 9);
    expect(rig.torso.position.x).toBe(0);
    expect(rig.torso.rotation.z).toBe(0);
  });
});

describe('vehicle rig', () => {
  it('rolls wheels by distance over radius, monotonically', () => {
    const world = scene();
    const rig = world.actors.get('city-vehicle-1')!.userData.rig as VehicleRig;
    poseVehicleRig(rig, { distance: 3, pitch: 0, roll: 0, steer: 0, drop: 0 });
    for (const wheel of rig.wheels) expect(wheel.spin.rotation.x).toBeCloseTo(3 / rig.wheelRadius, 9);
    const before = rig.wheels[0].spin.rotation.x;
    poseVehicleRig(rig, { distance: 3.5, pitch: 0, roll: 0, steer: 0, drop: 0 });
    expect(rig.wheels[0].spin.rotation.x).toBeGreaterThan(before);
  });

  it('applies attitude to the body and steer only to front wheels', () => {
    const world = scene();
    const rig = world.bus.userData.rig as VehicleRig;
    poseVehicleRig(rig, { distance: 1, pitch: 0.02, roll: -0.01, steer: 0.15, drop: 0.02 });
    expect(rig.body.rotation.x).toBeCloseTo(0.02, 9);
    expect(rig.body.rotation.z).toBeCloseTo(-0.01, 9);
    expect(rig.body.position.y).toBeCloseTo(-0.02, 9);
    for (const wheel of rig.wheels) {
      expect(wheel.steer.rotation.y).toBeCloseTo(wheel.front ? 0.15 : 0, 9);
    }
  });
});

describe('locomotion driver', () => {
  it('drives bicycle wheels and alternating pedals from traveled distance', () => {
    const world = scene();
    const simulation = new ActorSimulation();
    const cyclist = simulation.actors.find((actor) => actor.kind === 'cyclist');
    expect(cyclist).toBeDefined();
    const rig = world.actors.get(cyclist!.id)!.userData.rig as VehicleRig;
    expect(rig.pedals).toHaveLength(2);
    poseVehicleRig(rig, { distance: 4.2, pitch: 0, roll: 0, steer: 0, drop: 0 });
    expect(rig.pedals![1].rotation.x - rig.pedals![0].rotation.x).toBeCloseTo(Math.PI);
    expect(rig.wheels[0].spin.rotation.x).toBeCloseTo(4.2 / rig.wheelRadius);
    const before = rig.pedals![0].rotation.x;
    const driver = new Locomotion();
    driver.update(simulation.actors, world.actors, 0, false);
    expect(rig.pedals![0].rotation.x).toBe(before);
  });

  it('poses every rig from a live simulation without drift or error', () => {
    const world = scene();
    const simulation = new ActorSimulation();
    const driver = new Locomotion();
    for (let frame = 0; frame < 120; frame += 1) {
      simulation.step(1 / 30);
      for (const actor of simulation.actors) {
        const group = world.actors.get(actor.id)!;
        group.position.set(actor.position.x, actor.position.y, actor.position.z);
        group.rotation.y = actor.heading;
      }
      driver.update(simulation.actors, world.actors, 1 / 30, false);
    }
    const bus = world.bus.userData.rig as VehicleRig;
    expect(Number.isFinite(bus.wheels[0].spin.rotation.x)).toBe(true);
    expect(Math.abs(bus.body.rotation.x)).toBeLessThanOrEqual(VEHICLE.maxPitch + 1e-9);
    expect(Math.abs(bus.body.rotation.z)).toBeLessThanOrEqual(VEHICLE.maxRoll + 1e-9);
  });

  it('is frame-rate independent: wheel spin depends only on distance', () => {
    const world = scene();
    const rig = world.actors.get('city-vehicle-1')!.userData.rig as VehicleRig;
    poseVehicleRig(rig, { distance: 7.25, pitch: 0, roll: 0, steer: 0, drop: 0 });
    const coarse = rig.wheels[0].spin.rotation.x;
    poseVehicleRig(rig, { distance: 0, pitch: 0, roll: 0, steer: 0, drop: 0 });
    poseVehicleRig(rig, { distance: 7.25, pitch: 0, roll: 0, steer: 0, drop: 0 });
    expect(rig.wheels[0].spin.rotation.x).toBe(coarse);
  });
});
