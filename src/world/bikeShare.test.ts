import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BIKE_SHARE_LAYOUT as L, BIKE_SHARE_STATIONS, bikeShareBounds } from '../content/bikeShare';
import { ActorInstances } from './actorInstances';
import { buildBikeShare, buildSharedBike } from './bikeShare';
import { poseVehicleRig } from './locomotion';
import { buildStreetscape, type StreetscapeBuilder } from './streetscape';

const cleanups: (() => void)[] = [];

function createFixture(blueMaterial?: THREE.Material) {
  const box = new THREE.BoxGeometry();
  const head = new THREE.IcosahedronGeometry(1, 0);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const names = [
    'sand', 'stone', 'paving', 'road', 'line', 'cream', 'clay', 'teal', 'roof', 'copper',
    'copperEdge', 'glass', 'wood', 'leaf', 'leafLight', 'water', 'bus', 'rubber', 'taxi',
  ] as const;
  const palette = Object.fromEntries(names.map((name) => [name, material])) as
    Record<typeof names[number], THREE.MeshStandardMaterial>;
  const staticParts: THREE.Mesh[] = [];
  const builder: StreetscapeBuilder = {
    box, crown: head, cylinder, palette,
    add(shape, surface, position, scale, rotation = [0, 0, 0]) {
      const mesh = new THREE.Mesh(shape, surface);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      mesh.rotation.set(...rotation);
      staticParts.push(mesh);
    },
    block(surface, x, y, z, width, height, depth, yaw = 0) {
      builder.add(box, surface, [x, y, z], [width, height, depth], [0, yaw, 0]);
    },
  };
  const art = { box, head, material };
  const activity = buildBikeShare(builder, art, blueMaterial);
  cleanups.push(() => {
    activity.dispose();
    box.dispose();
    head.dispose();
    cylinder.dispose();
    material.dispose();
  });
  return { activity, art, staticParts, builder };
}

function matrices(groups: readonly THREE.Group[]) {
  const result: number[][] = [];
  for (const group of groups) {
    group.updateWorldMatrix(true, true);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) result.push([...object.matrixWorld.elements]);
    });
  }
  return result;
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

describe('shared-bike art and retained activity', () => {
  it('builds recognizable open step-through frames, blue fenders, baskets, wheels and tall kiosks', () => {
    const { activity, staticParts } = createFixture();
    expect(activity.rigs).toHaveLength(9);
    const bike = activity.rigs[0];
    expect(bike.getObjectByName('Low step-through tube')).toBeDefined();
    expect(bike.getObjectByName('Blue wheel fender')).toBeDefined();
    expect(bike.getObjectByName('Basket base')).toBeDefined();
    expect(bike.getObjectByName('Open basket strut')).toBeDefined();
    const names: string[] = [];
    bike.traverse((part) => names.push(part.name));
    expect(names.filter((name) => name === 'Rolling wheel')).toHaveLength(2);
    expect(names.filter((name) => name === 'Tire')).toHaveLength(24);
    expect(staticParts.filter((part) => part.scale.y > 2)).toHaveLength(3);
  });

  it('keeps all riders and bicycles visible, paired and continuous through departures and returns', () => {
    const { activity } = createFixture();
    const identity = [...activity.rigs];
    let previous: number[][] | undefined;
    for (let time = 0; time <= 48; time += 0.125) {
      activity.update(time, false);
      expect(activity.rigs).toEqual(identity);
      const next = matrices(activity.rigs);
      for (let index = 0; index < next.length; index += 1) {
        expect(next[index].every(Number.isFinite)).toBe(true);
        if (previous) {
          const delta = [12, 13, 14].map((axis) => next[index][axis] - previous![index][axis]);
          expect(Math.hypot(...delta)).toBeLessThan(0.24);
        }
      }
      for (const rig of activity.rigs) {
        rig.traverse((part) => expect(part.visible).toBe(true));
      }
      previous = next;
    }
    activity.update(0, false);
    const first = matrices(activity.rigs);
    activity.update(48, false);
    expect(matrices(activity.rigs)).toEqual(first);
  });

  it('renders ten actual bicycles side-by-side at each of three stations with an empty dock', () => {
    const { activity } = createFixture();
    activity.update(0, true);
    let total = 0;
    for (const [index, station] of BIKE_SHARE_STATIONS.entries()) {
      const parked = activity.rigs[index * 3 + 1];
      const bikes = [activity.rigs[index * 3],
        ...parked.children.filter((child): child is THREE.Group => child instanceof THREE.Group)];
      expect(bikes).toHaveLength(10);
      const slots = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      bikes.forEach((bike, bikeIndex) => {
        bike.updateWorldMatrix(true, true);
        const point = bike.getWorldPosition(new THREE.Vector3());
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(bike.getWorldQuaternion(new THREE.Quaternion()));
        expect(point.x).toBeCloseTo(station.x + slots[bikeIndex] * L.slotSpacing);
        expect(point.z).toBeCloseTo(station.z);
        expect(forward.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-10);
        const bounds = new THREE.Box3().setFromObject(bike);
        expect(bounds.max.x - bounds.min.x).toBeLessThan(L.slotSpacing);
      });
      total += bikes.length;
    }
    expect(total).toBe(30);
  });

  it('keeps all rendered moving parts and docks within their three roomy plaza pockets', () => {
    const { activity, staticParts } = createFixture();
    const boxes = BIKE_SHARE_STATIONS.map((station) => {
      const b = bikeShareBounds(station);
      return new THREE.Box3(new THREE.Vector3(b.minX, -1, b.minZ),
        new THREE.Vector3(b.maxX, 3, b.maxZ)).expandByScalar(1e-9);
    });
    for (const part of staticParts) {
      expect(boxes.some((box) => box.containsBox(new THREE.Box3().setFromObject(part)))).toBe(true);
    }
    for (let time = 0; time <= 48; time += 0.25) {
      activity.update(time, false);
      activity.rigs.forEach((group, index) => {
        group.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(boxes[Math.floor(index / 3)].containsBox(bounds)).toBe(true);
      });
    }
  });

  it('clears all existing streetscape geometry in all three full handling pockets', () => {
    const { builder, staticParts } = createFixture();
    const firstExistingPart = staticParts.length;
    const streetscape = buildStreetscape(builder);
    cleanups.push(() => streetscape.dispose());
    for (const station of BIKE_SHARE_STATIONS) {
      const b = bikeShareBounds(station);
      const occupied = new THREE.Box3(new THREE.Vector3(b.minX, station.surfaceY + 0.06, b.minZ),
        new THREE.Vector3(b.maxX, station.surfaceY + 2.2, b.maxZ));
      const intersections = staticParts.slice(firstExistingPart).filter((part) =>
        occupied.intersectsBox(new THREE.Box3().setFromObject(part)));
      expect(intersections.map((part) => part.position.toArray()), station.id).toEqual([]);
    }
  });

  it('preserves the existing saddle-hand pose after relocating the stations', () => {
    const { activity } = createFixture();
    const hands = (person: THREE.Group) => {
      const points: number[][] = [];
      person.updateWorldMatrix(true, true);
      person.traverse((part) => {
        if (part.name === 'Forearm and hand') {
          points.push(person.worldToLocal(part.getWorldPosition(new THREE.Vector3())).toArray());
        }
      });
      return points;
    };
    for (const phase of [2, 8, 17, 24, 30, 40]) {
      activity.update(phase, false);
      const original = hands(activity.rigs[2]);
      activity.update((phase - BIKE_SHARE_STATIONS[2].phase + 48) % 48, false);
      const rotated = hands(activity.rigs[8]);
      expect(rotated).toHaveLength(2);
      rotated.forEach((point, index) => point.forEach((value, axis) =>
        expect(value).toBeCloseTo(original[index][axis], 10)));
    }
  });

  it('preserves source poses on repeats, pause, reduced motion and reconstruction with snow', () => {
    const { activity } = createFixture();
    activity.update(10.125, false, 0.23);
    const saved = matrices(activity.rigs);
    activity.update(10.125, false, 0.23);
    expect(matrices(activity.rigs)).toEqual(saved);
    const rebuilt = createFixture().activity;
    rebuilt.update(10.125, false, 0.23);
    expect(matrices(rebuilt.rigs)).toEqual(saved);
    activity.update(0, true, 0.23);
    const still = matrices(activity.rigs);
    activity.update(777, true, 0.23);
    expect(matrices(activity.rigs)).toEqual(still);
    activity.update(0, true);
    const bare = matrices(activity.rigs);
    const lifts = still.map((matrix, index) => matrix[13] - bare[index][13]);
    expect(lifts.filter((lift) => Math.abs(lift) < 1e-10)).toHaveLength(6);
    lifts.filter((lift) => Math.abs(lift) >= 1e-10).forEach((lift) => expect(lift).toBeCloseTo(0.23));
    activity.rigs.forEach((group, index) =>
      expect(group.position.y).toBe(BIKE_SHARE_STATIONS[Math.floor(index / 3)].surfaceY));
  });

  it('keeps astride walking legs clear of the bicycle frame, wheels, and pedals', () => {
    const { activity } = createFixture();
    for (let time = 4; time <= 12; time += 0.25) {
      activity.update(time, false);
      BIKE_SHARE_STATIONS.forEach((_, index) => {
        const bike = activity.rigs[index * 3];
        const person = activity.rigs[index * 3 + 2];
        bike.updateWorldMatrix(true, true);
        person.updateWorldMatrix(true, true);
        person.traverse((leg) => {
          if (!(leg instanceof THREE.Mesh) ||
            !['Trouser thigh', 'Trouser shank', 'Exposed thigh', 'Bare lower leg', 'Shoe'].includes(leg.name)) return;
          const bounds = new THREE.Box3().setFromObject(leg);
          bike.traverse((part) => {
            if (!(part instanceof THREE.Mesh)) return;
            expect(bounds.intersectsBox(new THREE.Box3().setFromObject(part)),
              `${leg.name} intersects ${part.name} at ${time}`).toBe(false);
          });
        });
      });
    }
  });

  it('keeps adult soles planted and faceted tires supported throughout out-and-back movement', () => {
    const { activity } = createFixture();
    for (const groundLift of [0, 0.45]) {
      for (let time = 0; time <= 48; time += 0.125) {
        activity.update(time, false, groundLift);
        for (const [stationIndex, station] of BIKE_SHARE_STATIONS.entries()) {
          const floor = station.surfaceY + groundLift;
          const person = activity.rigs[stationIndex * 3 + 2];
          const soles: number[] = [];
          person.traverse((part) => {
            if (part instanceof THREE.Mesh && part.name === 'Shoe') {
              soles.push(new THREE.Box3().setFromObject(part).min.y);
            }
          });
          expect(soles).toHaveLength(2);
          expect(Math.min(...soles)).toBeCloseTo(floor, 8);
          expect(Math.max(...soles)).toBeGreaterThanOrEqual(floor - 1e-8);
          const bike = activity.rigs[stationIndex * 3];
          bike.updateWorldMatrix(true, true);
          bike.traverse((wheel) => {
            if (wheel.name !== 'Rolling wheel') return;
            const lowest = new THREE.Box3().setFromObject(wheel).min.y;
            expect(lowest).toBeGreaterThanOrEqual(floor - 1e-8);
            expect(lowest - floor).toBeLessThan(0.012);
          });
        }
      }
    }
  });

  it('shares only two primitive/material batches, bounds added geometry and borrows disposal', () => {
    const { activity, art, staticParts } = createFixture();
    const boxDispose = vi.spyOn(art.box, 'dispose');
    const materialDispose = vi.spyOn(art.material, 'dispose');
    const instances = new ActorInstances(activity.rigs);
    cleanups.push(() => instances.dispose());
    expect(instances.group.children.length).toBe(2);
    let triangles = staticParts.length * 12;
    for (const group of activity.rigs) {
      group.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        expect(part.material).toBe(art.material);
        expect([art.box, art.head]).toContain(part.geometry);
        triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
      });
    }
    expect(triangles).toBeLessThan(25_000);
    activity.dispose();
    activity.dispose();
    expect(boxDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
    const afterDispose = matrices(activity.rigs);
    activity.update(7, false);
    expect(matrices(activity.rigs)).toEqual(afterDispose);
  });

  it('exports a reusable blue bike for real lane riders without introducing owned resources', () => {
    const { art } = createFixture();
    const bike = buildSharedBike(art);
    expect(bike.wheels).toHaveLength(2);
    expect(bike.wheelRigs.map((wheel) => wheel.front)).toEqual([false, true]);
    expect(bike.pedals).toHaveLength(2);
    const bounds = new THREE.Box3().setFromObject(bike.group);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.005);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.54);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(1.65);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(1.9);
    let triangles = 0;
    bike.group.traverse((object) => {
      if (object instanceof THREE.Mesh) triangles += object.geometry.index!.count / 3;
    });
    expect(triangles).toBe(672);
    poseVehicleRig({
      kind: 'vehicle', body: bike.group, wheels: bike.wheelRigs, wheelRadius: 0.32, pedals: bike.pedals,
    }, { distance: 2, pitch: 0, roll: 0, steer: 0.15, drop: 0 });
    expect(bike.wheels[0].rotation.x).toBeCloseTo(2 / 0.32);
    expect(bike.wheelRigs[1].steer.rotation.y).toBeCloseTo(0.15);
    expect(bike.pedals[0].rotation.x).toBeCloseTo(2 / 0.65);
    expect(bike.pedals[1].rotation.x).toBeCloseTo(2 / 0.65 + Math.PI);
  });

  it('borrows the existing civic-blue material without tint multiplication or material ownership', () => {
    const blue = new THREE.MeshStandardMaterial({ color: '#256897' });
    cleanups.push(() => blue.dispose());
    const dispose = vi.spyOn(blue, 'dispose');
    const { activity, art } = createFixture(blue);
    const frame = activity.rigs[0].getObjectByName('Low step-through tube') as THREE.Mesh;
    expect(frame.material).toBe(blue);
    expect(frame.userData.instanceColor.getHexString()).toBe('ffffff');
    const instances = new ActorInstances(activity.rigs);
    cleanups.push(() => instances.dispose());
    expect(instances.group.children).toHaveLength(3);
    for (const group of activity.rigs) {
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) expect([blue, art.material]).toContain(object.material);
      });
    }
    activity.dispose();
    expect(dispose).not.toHaveBeenCalled();
  });

  it('shows green lock confirmation only after redocking and fixes indicators to the dock under snow', () => {
    const { activity } = createFixture();
    const green = activity.rigs[1].getObjectByName('Dock lock confirmed')!;
    const amber = activity.rigs[1].getObjectByName('Dock handling marker')!;
    for (const time of [0, 8, 24, 30]) {
      activity.update(time, false, 0.3);
      expect(green.scale.x).toBe(0);
      expect(amber.scale.x).toBe(0.08);
    }
    activity.update(33, false, 0.3);
    expect(green.scale.x).toBe(0.08);
    expect(amber.scale.x).toBe(0);
    expect(green.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0.53);
  });

  it('rejects invalid inputs before pose mutation', () => {
    const { activity } = createFixture();
    for (const lift of [-1, NaN, Infinity, 0.46]) {
      expect(() => activity.update(0, false, lift)).toThrow(RangeError);
    }
    expect(() => activity.update(-1, false)).toThrow(RangeError);
  });
});
