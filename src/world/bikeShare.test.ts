import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BIKE_SHARE_LAYOUT as L, BIKE_SHARE_STATIONS, BIKE_SHARE_STYLE,
  bikeShareBounds, sharedBikeKind } from '../content/bikeShare';
import { ActorInstances } from './actorInstances';
import { buildBikeShare, buildSharedBike } from './bikeShare';
import { poseVehicleRig } from './locomotion';
import { buildStreetscape, type StreetscapeBuilder } from './streetscape';
import { CityTraffic } from './traffic';

const cleanups: (() => void)[] = [];

function createFixture(blueMaterial?: THREE.Material) {
  const box = new THREE.BoxGeometry();
  const head = new THREE.IcosahedronGeometry(1, 0);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const names = [
    'sand', 'stone', 'paving', 'road', 'line', 'cream', 'clay', 'teal', 'roof', 'copper',
    'copperEdge', 'glass', 'wood', 'leaf', 'leafLight', 'water', 'bus', 'rubber', 'taxi',
    'facade',
  ] as const;
  const palette = Object.fromEntries(names.map((name) => [name, material])) as
    Record<typeof names[number], THREE.MeshStandardMaterial>;
  const staticParts: THREE.Mesh[] = [];
  const builder: StreetscapeBuilder = {
    box, crown: head, cylinder, palette,
    add(shape, surface, position, scale, rotation = [0, 0, 0], tint) {
      const mesh = new THREE.Mesh(shape, surface);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      mesh.rotation.set(...rotation);
      mesh.userData.tint = tint;
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
  it('lets every station neighbor leave the dock and reach the cycle lane', () => {
    const traffic = new CityTraffic();
    const riding = new Set<string>();
    for (let tick = 0; tick < 120 * 30; tick += 1) {
      traffic.step(1 / 30);
      for (const actor of traffic.actors) {
        if (actor.sharedBike?.phase === 'riding') riding.add(actor.id);
      }
    }
    expect([...riding].sort(), JSON.stringify(traffic.actors.filter((actor) => actor.sharedBike)))
      .toEqual(BIKE_SHARE_STATIONS.map((station) => station.riderId).sort());
  });

  it('keeps hands on the actual bicycle at every station and while walking around bends', () => {
    const { activity } = createFixture();
    const traffic = new CityTraffic();
    const touched = new Set<string>();
    for (let tick = 0; tick < 90 * 30; tick += 1) {
      traffic.step(1 / 30);
      if (tick % 6 !== 0) continue;
      activity.update(traffic.elapsed, false, 0.23, traffic.actors);
      for (const [index, station] of BIKE_SHARE_STATIONS.entries()) {
        const trip = traffic.actors.find((actor) => actor.id === station.riderId)!.sharedBike!;
        if (trip.phase === 'riding') continue;
        const bike = activity.rigs[index * 3];
        const person = activity.rigs[index * 3 + 2];
        person.updateWorldMatrix(true, true);
        const hands: THREE.Mesh[] = [];
        person.traverse((part) => {
          if (part instanceof THREE.Mesh && part.name === 'Forearm and hand') hands.push(part);
        });
        expect(hands).toHaveLength(2);
        for (const hand of hands) {
          const tip = hand.localToWorld(new THREE.Vector3(0, -0.5, 0));
          const contact = bike.worldToLocal(tip);
          expect(Math.abs(contact.x)).toBeLessThanOrEqual(0.091);
          expect(contact.y).toBeGreaterThanOrEqual(0.899);
          expect(contact.y).toBeLessThanOrEqual(0.941);
          expect(contact.z).toBeGreaterThanOrEqual(-0.391);
          expect(contact.z).toBeLessThanOrEqual(-0.279);
          expect(hand.parent!.scale.y).toBeLessThan(1.6);
        }
        touched.add(`${station.id}:${trip.phase}`);
      }
    }
    for (const station of BIKE_SHARE_STATIONS) expect(touched).toContain(`${station.id}:pushing-out`);
  });

  it('builds recognizable open step-through frames, blue fenders, baskets, wheels and tall kiosks', () => {
    const { activity, staticParts } = createFixture();
    expect(activity.rigs).toHaveLength(9);
    const bike = activity.rigs[0];
    expect(bike.getObjectByName('Low step-through tube')).toBeDefined();
    expect(bike.getObjectByName('Wheel fender')).toBeDefined();
    expect(bike.getObjectByName('Basket base')).toBeDefined();
    expect(bike.getObjectByName('Open basket strut')).toBeDefined();
    const names: string[] = [];
    bike.traverse((part) => names.push(part.name));
    expect(names.filter((name) => name === 'Rolling wheel')).toHaveLength(2);
    expect(names.filter((name) => name === 'Tire')).toHaveLength(24);
    expect(staticParts.filter((part) => part.scale.y > 2)).toHaveLength(3);
  });

  it('keeps initialized docked rigs continuous when no traffic snapshot is supplied', () => {
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
      expect(new Set(bikes.map((bike) => bike.userData.bikeKind))).toEqual(new Set(['classic', 'electric']));
      expect(activity.rigs[index * 3].userData.bikeKind).toBe(sharedBikeKind(station.riderId));
      const slots = Array.from({ length: L.slots }, (_, slot) => slot).filter((slot) => slot !== L.emptySlot);
      bikes.sort((a, b) => a.getWorldPosition(new THREE.Vector3()).x - b.getWorldPosition(new THREE.Vector3()).x);
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

  it('builds silver tapered docks with recessed dark faces and clear front-wheel channels', () => {
    const { activity, staticParts, art } = createFixture();
    activity.update(0, true);
    for (const [index, station] of BIKE_SHARE_STATIONS.entries()) {
      for (let slot = 0; slot < L.slots; slot += 1) {
        const x = station.x + slot * L.slotSpacing;
        const dock = staticParts.filter((part) =>
          Math.abs(part.position.x - x) < 0.25 && Math.abs(part.position.z - station.z) < 1.15 &&
          Math.abs(part.position.z - station.z) > 0.2);
        const face = dock.find((part) => part.userData.tint === BIKE_SHARE_STYLE.seat)!;
        expect(face).toBeDefined();
        const cheeks = dock.filter((part) => Math.abs(part.rotation.z) === 0.055);
        expect(cheeks).toHaveLength(2);
        for (const cheek of cheeks) {
          expect(cheek.userData.tint).toBe(BIKE_SHARE_STYLE.metal);
          const top = cheek.localToWorld(new THREE.Vector3(0, 0.5, 0));
          const bottom = cheek.localToWorld(new THREE.Vector3(0, -0.5, 0));
          expect(Math.abs(top.x - x)).toBeLessThan(Math.abs(bottom.x - x));
        }
        expect(face.position.z - face.scale.z / 2).toBeGreaterThan(cheeks[0].position.z - cheeks[0].scale.z / 2);
        expect(dock.every((part) => part.geometry === art.box && part.material === art.material)).toBe(true);
      }
      const bikes = [activity.rigs[index * 3], ...activity.rigs[index * 3 + 1].children
        .filter((child): child is THREE.Group => child instanceof THREE.Group)];
      for (const bike of bikes) {
        bike.updateWorldMatrix(true, true);
        const wheels: THREE.Object3D[] = [];
        bike.traverse((part) => { if (part.name === 'Rolling wheel') wheels.push(part); });
        const wheel = new THREE.Box3().setFromObject(wheels[1]);
        for (const part of staticParts) {
          const bounds = new THREE.Box3().setFromObject(part);
          if (bounds.max.y > station.surfaceY + 0.12) expect(bounds.intersectsBox(wheel)).toBe(false);
        }
      }
    }
  });

  it('keeps active lock indicators on the raised dock face without lighting the empty dock', () => {
    const { activity, staticParts } = createFixture();
    activity.update(0, true, 0.23);
    for (const [index, station] of BIKE_SHARE_STATIONS.entries()) {
      const parked = activity.rigs[index * 3 + 1];
      const marker = parked.getObjectByName('Dock lock confirmed')!;
      const point = marker.getWorldPosition(new THREE.Vector3());
      expect(point.x).toBeCloseTo(station.x + station.activeSlot * L.slotSpacing);
      expect(point.y).toBeCloseTo(station.surfaceY - L.surfaceY + L.dockIndicatorY);
      expect(point.z).toBeCloseTo(station.z + L.dockIndicatorZ);
      const empty = staticParts.find((part) =>
        part.position.x === station.x + L.emptySlot * L.slotSpacing &&
        part.position.z === station.z + L.dockIndicatorZ && part.scale.x === 0.08)!;
      expect(empty.userData.tint).toBe(BIKE_SHARE_STYLE.tire);
    }
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

  it('keeps the docked neighbor hand pose stable across station locations', () => {
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
    for (const phase of [0, 8, 24, 40]) {
      activity.update(phase, true);
      const original = hands(activity.rigs[2]);
      activity.update(phase, true);
      const rotated = hands(activity.rigs[8]);
      expect(original).toHaveLength(2);
      expect(rotated).toHaveLength(2);
      [...original, ...rotated].forEach((point) => point.forEach((value) =>
        expect(Number.isFinite(value)).toBe(true)));
    }
  });

  it('keeps docked neighbors subtly in motion so they never read as frozen', () => {
    const { activity } = createFixture();
    const personPose = (time: number, reducedMotion: boolean) => {
      activity.update(time, reducedMotion);
      const person = activity.rigs[2];
      person.updateWorldMatrix(true, true);
      const out: number[][] = [];
      person.traverse((object) => {
        if (object instanceof THREE.Mesh) out.push([...object.matrixWorld.elements]);
      });
      return out;
    };
    // Full motion: the resting neighbor shifts its weight between two docked moments.
    expect(personPose(3, false)).not.toEqual(personPose(4.2, false));
    // Reduced motion holds the docked pose perfectly still.
    expect(personPose(3, true)).toEqual(personPose(4.2, true));
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

  it('distinguishes electric bikes by battery, light, display and a heavier silver step-through frame', () => {
    const { art } = createFixture();
    const classic = buildSharedBike(art);
    const electric = buildSharedBike(art, undefined, 'electric');
    expect(classic.group.getObjectByName('Electric battery enclosure')).toBeUndefined();
    for (const name of ['Electric battery enclosure', 'Electric front light lens', 'Handlebar assist display']) {
      expect(electric.group.getObjectByName(name)).toBeDefined();
    }
    const frame = electric.group.getObjectByName('Low step-through tube') as THREE.Mesh;
    expect(frame.userData.instanceColor.getHexString()).toBe(BIKE_SHARE_STYLE.electricFrame.slice(1));
    expect(frame.scale.x).toBeGreaterThan(classic.group.getObjectByName('Low step-through tube')!.scale.x);
    const bounds = new THREE.Box3().setFromObject(electric.group);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(L.slotSpacing);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(2);
    electric.group.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        expect(part.material).toBe(art.material);
        expect(part.geometry).toBe(art.box);
      }
    });
    expect(electric.wheelRigs.map((wheel) => wheel.front)).toEqual([false, true]);
    expect(electric.pedals).toHaveLength(2);
  });

  it('borrows the existing civic-blue material without tint multiplication or material ownership', () => {
    const blue = new THREE.MeshStandardMaterial({ color: '#256897' });
    cleanups.push(() => blue.dispose());
    const dispose = vi.spyOn(blue, 'dispose');
    const { activity, art } = createFixture(blue);
    const frame = activity.rigs[0].getObjectByName('Basket base') as THREE.Mesh;
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

  it('shows the docked green lock confirmation and fixes indicators to the dock under snow', () => {
    const { activity } = createFixture();
    const green = activity.rigs[1].getObjectByName('Dock lock confirmed')!;
    const amber = activity.rigs[1].getObjectByName('Dock handling marker')!;
    for (const time of [0, 8, 24, 30]) {
      activity.update(time, false, 0.3);
      expect(green.scale.x).toBe(0.08);
      expect(amber.scale.x).toBe(0);
    }
    expect(green.scale.x).toBe(0.08);
    expect(amber.scale.x).toBe(0);
    expect(green.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(L.dockIndicatorY);
  });

  it('rejects invalid inputs before pose mutation', () => {
    const { activity } = createFixture();
    for (const lift of [-1, NaN, Infinity, 0.46]) {
      expect(() => activity.update(0, false, lift)).toThrow(RangeError);
    }
    expect(() => activity.update(-1, false)).toThrow(RangeError);
  });
});
