import * as THREE from 'three';
import {
  BIKE_SHARE_LAYOUT as L, BIKE_SHARE_STATIONS, BIKE_SHARE_STYLE as S,
  bikeSharePoint, sampleBikeShare, sharedBikeKind, validateBikeShareStations, type BikeShareStation, type SharedBikeKind,
} from '../content/bikeShare';
import { createPersonProfile } from '../content/people';
import type { ActorState } from './actors';
import { WALKER, poseWalkerRig, type WalkerRig, type WheelRig } from './locomotion';
import { buildPersonRig, personPart, type PersonArt } from './person';
import type { StreetscapeBuilder } from './streetscape';

type Triple = readonly [number, number, number];

export interface SharedBikeShapes {
  readonly cylinder?: THREE.BufferGeometry;
  readonly roundedBox?: THREE.BufferGeometry;
  readonly torus?: THREE.BufferGeometry;
  readonly alloy?: THREE.Material;
  readonly rubber?: THREE.Material;
}

export interface SharedBikeRig {
  readonly group: THREE.Group;
  readonly wheels: readonly THREE.Group[];
  readonly wheelRigs: WheelRig[];
  readonly pedals: THREE.Object3D[];
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Original full-size step-through bicycle. Borrowed scene/person primitives and materials allow
 * all colored and metallic parts to share existing ActorInstances batches across station & lane bikes.
 */
export function buildSharedBike(
  art: PersonArt,
  blueMaterial?: THREE.Material,
  kind: SharedBikeKind = 'classic',
  shapes?: SharedBikeShapes,
): SharedBikeRig {
  const group = new THREE.Group();
  group.name = kind === 'electric' ? 'Original electric shared bicycle' : 'Original blue shared bicycle';
  group.userData.bikeKind = kind;
  const electric = kind === 'electric';
  const frame = electric ? S.electricFrame : S.blue;
  const softBox = shapes?.roundedBox ?? art.box;
  const tubeShape = shapes?.cylinder ?? art.box;
  const tubeRadiusScale = shapes?.cylinder ? 0.5 : 1;

  const applyColor = (mesh: THREE.Mesh, color: string) => {
    if (color === S.blue && blueMaterial) {
      mesh.material = blueMaterial;
      mesh.userData.instanceColor = new THREE.Color(0xffffff);
    } else if (color === S.metal && shapes?.alloy) {
      mesh.material = shapes.alloy;
      mesh.userData.instanceColor = new THREE.Color(0xffffff);
    } else if (color === S.tire && shapes?.rubber) {
      mesh.material = shapes.rubber;
      mesh.userData.instanceColor = new THREE.Color(0xffffff);
    }
    return mesh;
  };
  const part = (
    name: string, color: string, position: Triple, size: Triple,
    parent: THREE.Object3D = group, rounded = false,
  ) => {
    const mesh = personPart(art, parent, name, color, position, size);
    if (rounded) mesh.geometry = softBox;
    return applyColor(mesh, color);
  };
  const tube = (
    name: string, color: string, start: Triple, end: Triple, diameter: number,
    parent: THREE.Object3D = group,
  ) => {
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
    const r = diameter * tubeRadiusScale;
    const mesh = personPart(art, parent, name, color,
      [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
      [r, direction.length(), r]);
    mesh.geometry = tubeShape;
    mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
    return applyColor(mesh, color);
  };
  const disc = (
    name: string, color: string, position: Triple, diameter: number, thickness: number,
    parent: THREE.Object3D = group,
  ) => {
    const r = diameter * tubeRadiusScale;
    const mesh = personPart(art, parent, name, color, position, [r, thickness, r]);
    mesh.geometry = tubeShape;
    mesh.rotation.z = Math.PI / 2;
    return applyColor(mesh, color);
  };

  const wheels: THREE.Group[] = [];
  const wheelRigs: WheelRig[] = [];
  const pedals: THREE.Object3D[] = [];
  const torusOuter = 0.305 + 0.025;
  const tireScale = 0.3195 / torusOuter;
  for (const z of [-S.wheelbase / 2, S.wheelbase / 2]) {
    const front = z > 0;
    const steer = new THREE.Object3D();
    steer.position.set(0, S.wheelRadius, z);
    group.add(steer);
    const wheel = new THREE.Group();
    wheel.name = 'Rolling wheel';
    steer.add(wheel);
    wheels.push(wheel);
    wheelRigs.push({ steer, spin: wheel, front });
    if (shapes?.torus) {
      const tire = personPart(art, wheel, 'Tire', S.tire, [0, 0, 0], [tireScale, tireScale, 1]);
      tire.geometry = shapes.torus;
      tire.rotation.y = Math.PI / 2;
      applyColor(tire, S.tire);
      const rim = personPart(art, wheel, 'Wheel rim', S.metal, [0, 0, 0], [0.89, 0.89, 0.62]);
      rim.geometry = shapes.torus;
      rim.rotation.y = Math.PI / 2;
      applyColor(rim, S.metal);
    } else {
      for (let segment = 0; segment < 12; segment += 1) {
        const a = segment * Math.PI / 6;
        const b = (segment + 1) * Math.PI / 6;
        tube('Tire', S.tire,
          [0, Math.cos(a) * (S.wheelRadius - 0.024), Math.sin(a) * (S.wheelRadius - 0.024)],
          [0, Math.cos(b) * (S.wheelRadius - 0.024), Math.sin(b) * (S.wheelRadius - 0.024)], 0.048, wheel);
      }
    }
    disc('Wheel hub', S.metal, [0, 0, 0], 0.068, 0.068, wheel);
    for (let spoke = 0; spoke < 4; spoke += 1) {
      const angle = (spoke * Math.PI) / 4;
      const sx = spoke % 2 === 0 ? -0.006 : 0.006;
      const dy = Math.cos(angle) * 0.275;
      const dz = Math.sin(angle) * 0.275;
      tube('Wheel spoke', S.metal, [sx, dy, dz], [sx, -dy, -dz], 0.01, wheel);
    }
    // Smooth 5-segment wrap-around fender arc plus thin alloy stays.
    const aStart = front ? -0.34 * Math.PI : -0.52 * Math.PI;
    const aEnd = front ? 0.44 * Math.PI : 0.34 * Math.PI;
    const segments = 5;
    for (let segment = 0; segment < segments; segment += 1) {
      const a = aStart + (segment / segments) * (aEnd - aStart);
      const b = aStart + ((segment + 1) / segments) * (aEnd - aStart);
      const rFender = 0.348;
      const mesh = part('Wheel fender', electric ? S.battery : S.blue, [
        0,
        S.wheelRadius + ((Math.cos(a) + Math.cos(b)) / 2) * rFender,
        z + ((Math.sin(a) + Math.sin(b)) / 2) * rFender,
      ], [0.068, Math.hypot(Math.cos(b) - Math.cos(a), Math.sin(b) - Math.sin(a)) * rFender + 0.012, 0.024], group, true);
      mesh.quaternion.setFromUnitVectors(UP, new THREE.Vector3(
        0, Math.cos(b) - Math.cos(a), Math.sin(b) - Math.sin(a),
      ).normalize());
    }
    const stayAngle = front ? 0.36 * Math.PI : -0.44 * Math.PI;
    for (const side of [-1, 1] as const) {
      tube('Fender stay', S.metal, [side * 0.032, S.wheelRadius, z],
        [side * 0.028, S.wheelRadius + Math.cos(stayAngle) * 0.342, z + Math.sin(stayAngle) * 0.342], 0.009);
    }
  }
  part('Rear reflector', '#c93b32', [0, 0.46, -0.885], [0.044, 0.056, 0.02], group, true);

  const crank: Triple = [0, 0.32, -0.1];
  const saddleStem: Triple = [0, 0.78, -0.28];
  const headset: Triple = [0, 0.83, 0.44];
  tube('Low step-through tube', frame, [0, 0.3, -0.28], [0, 0.35, 0.2], electric ? 0.115 : 0.078);
  tube('Curved step-through riser', frame, [0, 0.35, 0.2], headset, electric ? 0.125 : 0.084);
  tube('Head tube', frame, [0, 0.71, 0.465], [0, 0.86, 0.435], electric ? 0.092 : 0.068);
  tube('Seat tube', frame, crank, saddleStem, electric ? 0.098 : 0.07);
  tube('Rear frame stay', frame, [0, 0.32, -0.54], [0, 0.72, -0.28], 0.026);
  tube('Chain stay', frame, [0, 0.32, -0.54], [0, 0.32, -0.1], 0.028);
  for (const side of [-1, 1] as const) {
    tube('Front fork', frame, [side * 0.034, 0.32, 0.54], [side * 0.028, 0.71, 0.465], electric ? 0.042 : 0.034);
  }
  part('Fork crown', frame, [0, 0.715, 0.465], [0.095, 0.042, 0.055], group, true);
  disc('Chainring disc', S.metal, [0.018, 0.32, -0.1], 0.14, 0.01);
  part('Enclosed chain guard', frame, [0.012, 0.32, -0.3], [0.026, 0.14, 0.52], group, true);

  if (electric) {
    const battery = tube('Electric battery enclosure', S.battery, [0, 0.37, -0.18], [0, 0.73, -0.31], 0.145);
    battery.geometry = softBox;
    battery.scale.set(0.145, battery.scale.y, 0.145);
    part('Battery top cap', frame, [0, 0.75, -0.31], [0.165, 0.052, 0.165], group, true);
    part('Electric front light housing', S.battery, [0, 1.035, 0.805], [0.19, 0.135, 0.105], group, true);
    part('Electric front light lens', '#eff4df', [0, 1.035, 0.865], [0.155, 0.09, 0.016]);
    part('Handlebar assist display', S.battery, [0, 1.095, 0.48], [0.135, 0.052, 0.088], group, true);
    part('Plain assist indicator', S.paleBlue, [0, 1.126, 0.48], [0.09, 0.01, 0.045]);
  }
  tube('Seat post', S.metal, saddleStem, [0, 0.905, -0.28], 0.034);
  disc('Seat post collar', S.metal, saddleStem, 0.058, 0.024);
  part('Saddle', S.seat, [0, 0.93, -0.3], [0.21, 0.062, 0.185], group, true);
  part('Saddle nose', S.seat, [0, 0.925, -0.195], [0.088, 0.048, 0.13], group, true);

  tube('Upright handlebar stem', S.metal, headset, [0, 1.055, 0.495], 0.034);
  for (const side of [-1, 1] as const) {
    tube('Handlebar', S.metal, [0, 1.055, 0.495], [side * 0.17, 1.065, 0.475], 0.028);
    tube('Handlebar grip', S.tire, [side * 0.17, 1.065, 0.475], [side * (S.handlebarWidth / 2), 1.065, 0.475], 0.038);
    const lever = part('Brake lever', S.metal, [side * 0.195, 1.052, 0.505], [0.075, 0.015, 0.022], group, true);
    lever.rotation.y = side * 0.18;
  }
  part('Plain release control', S.paleBlue, [0, 0.9, -0.39], [0.07, 0.04, 0.055], group, true);
  for (const side of [-1, 1] as const) {
    const pedal = new THREE.Group();
    pedal.name = 'Pedal crank';
    pedal.position.set(side * 0.13, 0.32, -0.1);
    pedal.rotation.x = side < 0 ? 0 : Math.PI;
    group.add(pedal);
    pedals.push(pedal);
    tube('Crank arm', S.metal, [0, 0, 0], [0, -0.13, 0], 0.024, pedal);
    part('Pedal', S.seat, [side * 0.03, -0.13, 0], [0.155, 0.045, 0.115], pedal, true);
  }
  part('Basket base', S.blue, [0, 0.88, 0.65], [0.41, 0.034, 0.35], group, true);
  part('Front reflector', '#eff2f3', [0, 0.96, 0.832], [0.055, 0.042, 0.016], group, true);
  for (const side of [-1, 1] as const) {
    part('Basket upper rail', S.blue, [side * 0.205, 1.095, 0.65], [0.024, 0.032, 0.37], group, true);
    part('Basket end rail', S.blue, [0, 1.095, 0.65 + side * 0.175], [0.43, 0.032, 0.026], group, true);
    for (const dz of [-0.15, 0, 0.15]) {
      part('Open basket strut', S.blue, [side * 0.205, 0.985, 0.65 + dz], [0.018, 0.22, 0.018]);
    }
    tube('Basket stay', S.metal, [side * 0.042, 0.76, 0.46], [side * 0.165, 0.88, 0.62], 0.014);
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
  const { add, box, palette: p } = builder;
  const bollardBox = builder.roundedBox ?? box;
  const bikeShapes: SharedBikeShapes | undefined =
    builder.torus || builder.roundedBox || builder.alloy
      ? {
        cylinder: builder.cylinder,
        roundedBox: builder.roundedBox,
        torus: builder.torus,
        alloy: builder.alloy,
        rubber: builder.torus ? p.rubber : undefined,
      }
      : undefined;
  const bays: BayRig[] = [];
  const rigs: THREE.Group[] = [];
  for (const station of BIKE_SHARE_STATIONS) {
    const surfaceOffset = station.surfaceY - L.surfaceY;
    const place = (material: THREE.Material, x: number, y: number, z: number,
      width: number, height: number, depth: number, tint?: string, lean = 0, rounded = false) => {
      const point = bikeSharePoint(station, x, z);
      add(rounded ? bollardBox : box, material, [point.x, y + surfaceOffset, point.z],
        [width, height, depth], [0, station.yaw, lean], tint);
    };
    // Juniper already has continuous paving; don't overlay a coplanar duplicate slab.
    if (station.surfaceY === L.surfaceY) place(p.paving, (L.padMinX + L.padMaxX) / 2,
      -0.13, (L.padMinZ + L.padMaxZ) / 2, L.padMaxX - L.padMinX, 0.1, L.padMaxZ - L.padMinZ);
    for (let slot = 0; slot < L.slots; slot += 1) {
      const x = slot * L.slotSpacing;
      place(p.facade, x, 0.75, 1.03, 0.23, 0.43, 0.2, S.metal, 0, true);
      place(p.facade, x, 0.775, 0.91, 0.15, 0.25, 0.012, S.seat);
      place(p.facade, x, 0.96, 1.005, 0.26, 0.07, 0.27, S.metal, 0, true);
      for (const side of [-1, 1]) {
        // Split, inward-tapering cheeks leave the front tire channel physically open.
        place(p.facade, x + side * 0.115, 0.445, 0.95, 0.07, 1.04, 0.26, S.metal, side * 0.055, true);
        place(p.facade, x + side * 0.095, -0.005, 0.49, 0.035, 0.15, 0.58, S.metal, 0, true);
      }
      if (slot !== station.activeSlot) {
        place(p.facade, x, L.dockIndicatorY, L.dockIndicatorZ, 0.08, 0.04, 0.028,
          slot === L.emptySlot ? S.tire : '#70ba83');
      }
    }
    const kioskX = 8.45;
    const kioskZ = 0.5;
    place(p.roof, kioskX, 0.94, kioskZ, 0.48, 2.04, 0.3, undefined, 0, true);
    place(p.copperEdge, kioskX, 1.93, kioskZ, 0.52, 0.07, 0.34, undefined, 0, true);
    place(p.line, kioskX - station.side * 0.247, 1.45, kioskZ, 0.016, 0.43, 0.24);
    place(p.glass, kioskX - station.side * 0.26, 1.13, kioskZ, 0.018, 0.19, 0.2);
    // Original three-bar civic marker, without words, logos, prices, or adverts.
    for (let mark = 0; mark < 3; mark += 1) {
      place(blueMaterial ?? p.teal, kioskX - station.side * 0.26, 1.34 + mark * 0.105, kioskZ,
        0.02, 0.038, 0.14 - mark * 0.027);
    }
    const bike = buildSharedBike(art, blueMaterial, sharedBikeKind(station.riderId), bikeShapes);
    bike.group.name = `${station.id}: checkout bicycle`;
    const parked = new THREE.Group();
    parked.name = `${station.id}: parked bicycle`;
    for (let slot = 0; slot < L.slots; slot += 1) {
      if (slot === station.activeSlot || slot === L.emptySlot) continue;
      const dockedBike = buildSharedBike(art, blueMaterial, sharedBikeKind(`${station.id}:${slot}`), bikeShapes);
      dockedBike.group.name = `${station.id}: parked bicycle ${slot}`;
      dockedBike.group.position.x = slot * L.slotSpacing;
      parked.add(dockedBike.group);
    }
    const lockMarkers = [
      personPart(art, parked, 'Dock handling marker', '#dfac52',
        [station.activeSlot * L.slotSpacing, 0, L.dockIndicatorZ], [0.08, 0.04, 0.028]),
      personPart(art, parked, 'Dock lock confirmed', '#70ba83',
        [station.activeSlot * L.slotSpacing, 0, L.dockIndicatorZ], [0.08, 0.04, 0.028]),
    ] as const;
    const person = new THREE.Group();
    person.name = `${station.id}: neighbor checking a bicycle`;
    const profile = createPersonProfile(station.riderId, 'cyclist');
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
          marker.position.y = L.dockIndicatorY - L.surfaceY - groundLift;
        });
        person.position.set(sample.personX, floor, sample.personZ);
        person.rotation.y = sample.heading;
        person.scale.setScalar(showPerson ? 1 : 0);
        for (const wheel of bike.wheels) wheel.rotation.x = sample.displacement / S.wheelRadius;
        poseWalkerRig(rig, { distance: sample.displacement, speed: sample.speed,
          blend: Math.min(1, sample.speed / 0.2), reducedMotion });
        if (showPerson && !reducedMotion) {
          // Docked neighbors gently shift their weight so they read as resting rather
          // than frozen. Torso-only (feet stay planted); deterministic and locked to a
          // whole number of cycles per station loop so the animation still closes seamlessly,
          // and disabled under reduced motion to keep poses reproducible.
          const cyclePhase = (elapsedSeconds % L.period) / L.period;
          const sway = Math.sin(cyclePhase * 2 * Math.PI * 10 + station.x * 0.7 + station.z * 0.3);
          rig.torso.rotation.z += 0.035 * sway;
          rig.torso.position.x += 0.015 * sway;
        }
        if (!showPerson) continue;
        person.updateWorldMatrix(true, true);
        bike.group.updateWorldMatrix(true, true);
        rig.arms.forEach((arm, index) => {
          const touch = index === 0 ? sample.latchTouch : 0;
          handDirection.set((index === 0 ? -1 : 1) * 0.09 * (1 - touch),
            0.94 - 0.04 * touch, -0.28 - 0.11 * touch);
          bike.group.localToWorld(handDirection);
          arm.parent!.worldToLocal(handDirection).sub(arm.position);
          arm.scale.y = handDirection.length() / WALKER.armLen;
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
