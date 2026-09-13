import * as THREE from 'three';
import {
  BIKE_SHARE_LAYOUT as L, BIKE_SHARE_STATIONS, BIKE_SHARE_STYLE as S,
  bikeSharePoint, sampleBikeShare, validateBikeShareStations, type BikeShareStation,
} from '../content/bikeShare';
import { createPersonProfile } from '../content/people';
import type { ActorState } from './actors';
import { poseWalkerRig, type WalkerRig, type WheelRig } from './locomotion';
import { buildPersonRig, personPart, type PersonArt } from './person';
import type { StreetscapeBuilder } from './streetscape';

type Triple = readonly [number, number, number];

export interface SharedBikeRig {
  readonly group: THREE.Group;
  readonly wheels: readonly THREE.Group[];
  readonly wheelRigs: WheelRig[];
  readonly pedals: THREE.Object3D[];
}

/**
 * Original full-size step-through bicycle. Borrowed person primitives/material allow
 * all colored parts to share existing ActorInstances batches, including street bikes.
 */
export function buildSharedBike(art: PersonArt, blueMaterial?: THREE.Material): SharedBikeRig {
  const group = new THREE.Group();
  group.name = 'Original blue shared bicycle';
  const part = (name: string, color: string, position: Triple, size: Triple, parent = group) => {
    const mesh = personPart(art, parent, name, color, position, size);
    if (color === S.blue && blueMaterial) {
      mesh.material = blueMaterial;
      mesh.userData.instanceColor = new THREE.Color(0xffffff);
    }
    return mesh;
  };
  const bar = (name: string, color: string, start: Triple, end: Triple, width: number, parent = group) => {
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
    const mesh = part(name, color,
      [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
      [width, direction.length(), width], parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  };
  const wheels: THREE.Group[] = [];
  const wheelRigs: WheelRig[] = [];
  const pedals: THREE.Object3D[] = [];
  for (const z of [-S.wheelbase / 2, S.wheelbase / 2]) {
    const steer = new THREE.Object3D();
    steer.position.set(0, S.wheelRadius, z);
    group.add(steer);
    const wheel = new THREE.Group();
    wheel.name = 'Rolling wheel';
    steer.add(wheel);
    wheels.push(wheel);
    wheelRigs.push({ steer, spin: wheel, front: z > 0 });
    for (let segment = 0; segment < 12; segment += 1) {
      const a = segment * Math.PI / 6;
      const b = (segment + 1) * Math.PI / 6;
      bar('Tire', S.tire,
        [0, Math.cos(a) * (S.wheelRadius - 0.024), Math.sin(a) * (S.wheelRadius - 0.024)],
        [0, Math.cos(b) * (S.wheelRadius - 0.024), Math.sin(b) * (S.wheelRadius - 0.024)], 0.048, wheel);
    }
    bar('Wheel spoke', S.metal, [0, 0.295, 0], [0, -0.295, 0], 0.014, wheel);
    // Faceted upper half-shells leave tires and empty wheel centers visible.
    for (let segment = 0; segment < 3; segment += 1) {
      const a = -Math.PI / 2 + segment * Math.PI / 3;
      const b = a + Math.PI / 3;
      const mesh = bar('Blue wheel fender', S.blue,
        [0, S.wheelRadius + Math.cos(a) * 0.39, z + Math.sin(a) * 0.39],
        [0, S.wheelRadius + Math.cos(b) * 0.39, z + Math.sin(b) * 0.39], 0.035);
      mesh.scale.x = 0.08;
    }
  }
  const crank: Triple = [0, 0.32, -0.1];
  const saddleStem: Triple = [0, 0.78, -0.28];
  const headset: Triple = [0, 0.83, 0.44];
  bar('Low step-through tube', S.blue, [0, 0.3, -0.28], [0, 0.35, 0.2], 0.085);
  bar('Curved step-through riser', S.blue, [0, 0.35, 0.2], headset, 0.09);
  bar('Seat tube', S.blue, crank, saddleStem, 0.075);
  bar('Rear frame stay', S.blue, [0, 0.32, -0.54], saddleStem, 0.05);
  bar('Front fork', S.blue, [0, 0.32, 0.54], [0, 0.83, 0.44], 0.055);
  part('Enclosed chain guard', S.blue, [0, 0.32, -0.3], [0.065, 0.16, 0.57]);
  bar('Seat post', S.metal, saddleStem, [0, 0.9, -0.28], 0.035);
  part('Saddle', S.seat, [0, 0.93, -0.28], [0.22, 0.065, 0.25]);
  bar('Upright handlebar stem', S.metal, headset, [0, 1.065, 0.48], 0.035);
  part('Handlebar', S.tire, [0, 1.065, 0.48], [S.handlebarWidth, 0.042, 0.065]);
  part('Plain release control', S.paleBlue, [0, 0.9, -0.39], [0.07, 0.04, 0.055]);
  for (const side of [-1, 1]) {
    const pedal = new THREE.Group();
    pedal.name = 'Pedal crank';
    pedal.position.set(side * 0.13, 0.32, -0.1);
    pedal.rotation.x = side < 0 ? 0 : Math.PI;
    group.add(pedal);
    pedals.push(pedal);
    part('Crank arm', S.metal, [0, -0.065, 0], [0.025, 0.13, 0.025], pedal);
    part('Pedal', S.seat, [side * 0.03, -0.13, 0], [0.16, 0.045, 0.12], pedal);
  }
  part('Basket base', S.blue, [0, 0.88, 0.65], [0.41, 0.035, 0.35]);
  for (const side of [-1, 1]) {
    part('Basket upper rail', S.blue, [side * 0.205, 1.095, 0.65], [0.024, 0.035, 0.37]);
    part('Basket end rail', S.blue, [0, 1.095, 0.65 + side * 0.175], [0.43, 0.035, 0.026]);
    for (const dz of [-0.15, 0.15]) {
      part('Open basket strut', S.blue, [side * 0.205, 0.985, 0.65 + dz], [0.022, 0.22, 0.022]);
    }
  }
  return { group, wheels, wheelRigs, pedals };
}

interface BayRig {
  station: BikeShareStation;
  bike: SharedBikeRig;
  person: THREE.Group;
  rig: WalkerRig;
  parked: THREE.Group;
  lockMarkers: readonly [THREE.Mesh, THREE.Mesh];
}

export interface BikeShareActivity {
  /** Include these sources in the parent's one ActorInstances; do not draw them separately. */
  readonly rigs: readonly THREE.Group[];
  update(elapsedSeconds: number, reducedMotion: boolean, groundLift?: number, actors?: readonly ActorState[]): void;
  /** Only detaches rig sources; shared art and parent instance buffers are never disposed here. */
  dispose(): void;
}

/** Static infrastructure enters parent batches; persistent bikes/people enter parent actor batches. */
export function buildBikeShare(
  builder: StreetscapeBuilder, art: PersonArt, blueMaterial?: THREE.Material,
): BikeShareActivity {
  validateBikeShareStations();
  const { block, palette: p } = builder;
  const bays: BayRig[] = [];
  const rigs: THREE.Group[] = [];
  for (const station of BIKE_SHARE_STATIONS) {
    const surfaceOffset = station.surfaceY - L.surfaceY;
    const place = (material: THREE.Material, x: number, y: number, z: number,
      width: number, height: number, depth: number) => {
      const point = bikeSharePoint(station, x, z);
      block(material, point.x, y + surfaceOffset, point.z, width, height, depth, station.yaw);
    };
    // Juniper already has continuous paving; don't overlay a coplanar duplicate slab.
    if (station.surfaceY === L.surfaceY) place(p.paving, (L.padMinX + L.padMaxX) / 2,
      -0.13, (L.padMinZ + L.padMaxZ) / 2, L.padMaxX - L.padMinX, 0.1, L.padMaxZ - L.padMinZ);
    for (let slot = 0; slot < L.slots; slot += 1) {
      const x = slot * L.slotSpacing;
      place(p.stone, x, -0.045, 0.85, 0.54, 0.07, 0.39);
      place(p.roof, x, 0.27, 0.86, 0.22, 0.58, 0.2);
      place(p.copperEdge, x, 0.47, 0.75, 0.23, 0.14, 0.1);
      if (slot > 0) place(p.line, x, 0.53, 0.68, 0.08, 0.04, 0.028);
      // Empty wheel guides remain visibly empty when their bicycle is walked out.
      for (const side of [-1, 1]) {
        place(p.copperEdge, x + side * 0.095, -0.005, 0.49, 0.035, 0.15, 0.58);
      }
    }
    const kioskX = 8.45;
    const kioskZ = 0.5;
    place(p.roof, kioskX, 0.94, kioskZ, 0.48, 2.04, 0.3);
    place(p.copperEdge, kioskX, 1.93, kioskZ, 0.52, 0.07, 0.34);
    place(p.line, kioskX - station.side * 0.247, 1.45, kioskZ, 0.016, 0.43, 0.24);
    place(p.glass, kioskX - station.side * 0.26, 1.13, kioskZ, 0.018, 0.19, 0.2);
    // Original three-bar civic marker, without words, logos, prices, or adverts.
    for (let mark = 0; mark < 3; mark += 1) {
      place(blueMaterial ?? p.teal, kioskX - station.side * 0.26, 1.34 + mark * 0.105, kioskZ,
        0.02, 0.038, 0.14 - mark * 0.027);
    }
    const bike = buildSharedBike(art, blueMaterial);
    bike.group.name = `${station.id}: checkout bicycle`;
    const parked = new THREE.Group();
    parked.name = `${station.id}: parked bicycle`;
    for (let slot = 0; slot < L.slots; slot += 1) {
      if (slot === station.activeSlot || slot === L.emptySlot) continue;
      const dockedBike = buildSharedBike(art, blueMaterial);
      dockedBike.group.name = `${station.id}: parked bicycle ${slot}`;
      dockedBike.group.position.x = slot * L.slotSpacing;
      parked.add(dockedBike.group);
    }
    const lockMarkers = [
      personPart(art, parked, 'Dock handling marker', '#dfac52',
        [0, 0, 0.68], [0.08, 0.04, 0.028]),
      personPart(art, parked, 'Dock lock confirmed', '#70ba83',
        [0, 0, 0.68], [0.08, 0.04, 0.028]),
    ] as const;
    const person = new THREE.Group();
    person.name = `${station.id}: neighbor checking a bicycle`;
    const profile = createPersonProfile(`${station.id}-neighbor`, 'cyclist');
    const rig = buildPersonRig(person, { ...profile, stature: 1.7, build: 0.94, bag: 'none', outfit: 'casual' }, art);
    for (const group of [bike.group, parked, person]) group.rotation.y = station.yaw;
    const dock = bikeSharePoint(station, station.activeSlot * L.slotSpacing, 0);
    bike.group.position.set(dock.x, station.surfaceY, dock.z);
    bays.push({ station, bike, parked, person, rig, lockMarkers });
    rigs.push(bike.group, parked, person);
  }
  const down = new THREE.Vector3(0, -1, 0);
  const handDirection = new THREE.Vector3();
  let disposed = false;
  const activity: BikeShareActivity = {
    rigs,
    update(elapsedSeconds, reducedMotion, groundLift = 0, actors: readonly ActorState[] = []) {
      if (disposed) return;
      if (!Number.isFinite(groundLift) || groundLift < 0 || groundLift > 0.45) {
        throw new RangeError('Bike-share ground lift must be between 0 and 0.45 metres.');
      }
      for (const { station, bike, parked, person, rig, lockMarkers } of bays) {
        const trip = actors.find((actor) => actor.id === station.riderId)?.sharedBike;
        const sample = sampleBikeShare(station, elapsedSeconds, reducedMotion, trip);
        const floor = station.surfaceY + groundLift;
        const showCheckout = sample.phase !== 'riding';
        const showPerson = sample.phase !== 'riding';
        bike.group.position.set(sample.bikeX, floor, sample.bikeZ);
        bike.group.rotation.y = sample.heading;
        bike.group.scale.setScalar(showCheckout ? 1 : 0);
        parked.position.set(station.x, floor, station.z);
        lockMarkers.forEach((marker, index) => {
          // Scene-owned instance colors stay immutable; transform-only markers need no extra draw.
          const active = sample.phase !== 'riding' && (index === 1) === sample.lockConfirmed;
          marker.scale.set(active ? 0.08 : 0, active ? 0.04 : 0, active ? 0.028 : 0);
          marker.position.y = 0.53 - L.surfaceY - groundLift;
        });
        person.position.set(sample.personX, floor, sample.personZ);
        person.rotation.y = sample.heading;
        person.scale.setScalar(showPerson ? 1 : 0);
        for (const wheel of bike.wheels) wheel.rotation.x = sample.displacement / S.wheelRadius;
        poseWalkerRig(rig, { distance: sample.displacement, speed: Math.max(0.2, sample.speed), blend: 1, reducedMotion });
        person.updateWorldMatrix(true, true);
        rig.arms.forEach((arm, index) => {
          const touch = index === 0 ? sample.latchTouch : 0;
          const hand = bikeSharePoint(station, (index === 0 ? -1 : 1) * 0.09 * (1 - touch),
            sample.displacement - 0.28 - 0.11 * touch);
          handDirection.set(hand.x, floor + 0.94 - 0.04 * touch, hand.z);
          arm.parent!.worldToLocal(handDirection).sub(arm.position);
          arm.quaternion.setFromUnitVectors(down, handDirection.normalize());
        });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const group of rigs) group.removeFromParent();
    },
  };
  activity.update(0, false);
  return activity;
}
