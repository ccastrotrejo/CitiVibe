import * as THREE from 'three';
import { BIKE_SHARE_STATIONS, sharedBikeKind } from '../content/bikeShare';
import { createPersonProfile } from '../content/people';
import type { TrafficActorDefinition } from '../content/streets';
import { buildSharedBike } from './bikeShare';
import { WALKER, poseNeutral, type VehicleRig, type WheelRig } from './locomotion';
import { personPart, type PersonArt } from './person';
import type { VehicleLamp, VehicleLightingRig } from './vehicleLighting';

type Triple = readonly [number, number, number];

/** Shared geometry and materials the scene owns; the vehicle rig only borrows them. */
export interface VehicleArt {
  box: THREE.BufferGeometry;
  cylinder: THREE.BufferGeometry;
  wheel: THREE.BufferGeometry;
  personArt: PersonArt;
  civicBlue: THREE.Material;
  vehicleGlass: THREE.Material;
  lampGlow: THREE.Material;
  beaconRed: THREE.Material;
  beaconBlue: THREE.Material;
  palette: Record<'taxi' | 'cream' | 'teal' | 'clay' | 'stone' | 'rubber' | 'paving' | 'copper' | 'line', THREE.Material>;
}

function limb(
  shape: THREE.BufferGeometry, surface: THREE.Material, position: Triple, scale: Triple,
  rotation: Triple = [0, 0, 0],
): THREE.Mesh {
  const object = new THREE.Mesh(shape, surface);
  object.position.set(...position);
  object.scale.set(...scale);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

/**
 * Build one posable vehicle rig (car, taxi, bus, van, truck or shared-bike cyclist) into `group`,
 * mirroring `buildPersonRig`: static shell parts plus named pivots the locomotion layer drives.
 * The scene keeps ownership of the returned lamp rig; this module never batches or disposes.
 */
export function buildVehicleRig(
  group: THREE.Group, definition: TrafficActorDefinition, index: number, art: VehicleArt,
): VehicleLightingRig {
  const { palette, personArt, civicBlue, vehicleGlass, lampGlow, box, cylinder, wheel, beaconRed, beaconBlue } = art;
  const body = new THREE.Object3D();
  group.add(body);
  const lamps: VehicleLamp[] = [];
  const lamp = (channel: VehicleLamp['channel'], x: number, y: number, z: number,
    size: VehicleLamp['size']) => {
    const mount = new THREE.Object3D();
    mount.name = `${channel} lamp socket`;
    mount.position.set(x, y, z);
    body.add(mount);
    lamps.push({ mount, channel, size });
  };
  const part = (surface: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const object = limb(box, surface, [x, y, z], [w, h, d]);
    body.add(object);
    return object;
  };
  const buildWheel = (
    parent: THREE.Object3D, x: number, y: number, z: number,
    radiusFactor: number, thicknessFactor: number, front: boolean,
  ): WheelRig => {
    const steer = new THREE.Object3D();
    steer.position.set(x, y, z);
    parent.add(steer);
    const spin = new THREE.Object3D();
    steer.add(spin);
    spin.add(limb(wheel, palette.rubber, [0, 0, 0], [radiusFactor, thicknessFactor, radiusFactor], [0, 0, Math.PI / 2]));
    spin.add(limb(cylinder, palette.stone, [Math.sign(x) * 0.1, 0, 0], [0.16 * radiusFactor, 0.05, 0.16 * radiusFactor], [0, 0, Math.PI / 2]));
    return { steer, spin, front };
  };
  const wheels: WheelRig[] = [];
  if (definition.kind === 'cyclist') {
    const stationRider = BIKE_SHARE_STATIONS.some((station) => station.riderId === definition.id);
    const person = createPersonProfile(definition.id, 'cyclist');
    if (!stationRider) group.userData.person = person;
    const riderPart = (name: string, color: string, p: Triple, size: Triple, rounded = false) =>
      personPart(personArt, body, name, color, p, size, rounded);
    const bikeKind = sharedBikeKind(definition.id);
    const bicycle = buildSharedBike(personArt, civicBlue, bikeKind);
    group.userData.bikeKind = bikeKind;
    body.add(bicycle.group);
    for (const wheelRig of bicycle.wheelRigs) group.add(wheelRig.steer);
    wheels.push(...bicycle.wheelRigs);
    riderPart('Cycling jacket', person.top, [0, 1.42, -0.05], [0.35 * person.build, 0.52, 0.24]);
    riderPart('Seated cycling trousers', person.bottom, [0, 1.075, -0.28], [0.36, 0.22, 0.25]);
    riderPart('Cyclist face', person.skin, [0, 1.82, 0.05], [0.18, 0.2, 0.18], true);
    riderPart('Cycle helmet', person.accent, [0, 1.95, 0.05], [0.21, 0.12, 0.22], true);
    riderPart('Helmet stripe', '#e9e7d9', [0, 2.05, 0.05], [0.065, 0.035, 0.3]);
    if (person.bag !== 'none') riderPart('Cyclist backpack', person.accent, [0, 1.45, -0.26], [0.28, 0.36, 0.19]);
    for (const side of [-1, 1]) {
      riderPart('Cyclist sleeve', person.top, [side * 0.22, 1.3325, 0.255],
        [0.11, Math.hypot(0.535, 0.45), 0.11]).rotation.x = Math.atan2(0.45, -0.535);
      riderPart('Cyclist hand', person.skin, [side * 0.22, 1.065, 0.48], [0.09, 0.09, 0.1]);
    }
    const cyclingLegs = bicycle.pedals.map((crank, legIndex) => {
      const pedal = crank.getObjectByName('Pedal');
      if (!pedal) throw new Error('Shared bicycle is missing its pedal platform.');
      const hip = new THREE.Object3D();
      const knee = new THREE.Object3D();
      const ankle = new THREE.Object3D();
      hip.position.set(legIndex === 0 ? -0.16 : 0.16, 1, -0.28);
      knee.position.y = -WALKER.thigh;
      ankle.position.y = -WALKER.shank;
      body.add(hip); hip.add(knee); knee.add(ankle);
      personPart(personArt, hip, 'Cyclist trouser thigh', person.bottom,
        [0, -WALKER.thigh / 2, 0], [0.12, WALKER.thigh, 0.13]);
      personPart(personArt, knee, 'Cyclist trouser shin', person.bottom,
        [0, -WALKER.shank / 2, 0], [0.11, WALKER.shank, 0.12]);
      personPart(personArt, ankle, 'Cyclist shoe', person.shoes, [0, 0.045, 0.05], [0.15, 0.09, 0.26]);
      return { joints: { hip, knee, ankle }, crank, pedal };
    });
    const rig: VehicleRig = { kind: 'vehicle', body, wheels, wheelRadius: 0.32, pedals: bicycle.pedals, cyclingLegs };
    lamp('head', 0, 1.04, bikeKind === 'electric' ? 0.88 : 0.79,
      bikeKind === 'electric' ? [0.16, 0.095, 0.09] : [0.12, 0.1, 0.09]);
    lamp('tail', 0, 0.93, -0.76, [0.1, 0.1, 0.07]);
    group.userData.rig = rig;
    poseNeutral(rig);
    if (stationRider) group.scale.setScalar(0);
    return { id: definition.id, body, length: 2, lamps, bicycle: true };
  }
  const type = definition.vehicleType;
  const taxi = type === 'taxi';
  const busType = type === 'bus';
  const large = busType || type === 'truck';
  const van = type === 'van';
  const ambulanceVan = type === 'ambulanceVan';
  const ambulanceBox = type === 'ambulanceBox';
  const firetruck = type === 'firetruck';
  const fireSuv = type === 'fireSuv';
  const ambulance = ambulanceVan || ambulanceBox;
  const fire = firetruck || fireSuv;
  const emergency = ambulance || fire;
  const length = busType ? 4.6 : type === 'truck' ? 4.5 : van ? 3.3
    : ambulanceBox ? 4.5 : ambulanceVan ? 3.4 : firetruck ? 4.6 : fireSuv ? 2.7 : 2.7;
  const width = busType ? 1.9 : large ? 1.7 : van ? 1.5
    : ambulanceBox ? 1.76 : ambulanceVan ? 1.55 : firetruck ? 1.78 : fireSuv ? 1.6 : 1.45;
  const radius = firetruck ? 0.38 : ambulanceBox ? 0.34 : ambulanceVan || fireSuv ? 0.3 : large ? 0.36 : 0.26;
  const color = fire ? palette.clay : ambulance ? palette.paving : taxi ? palette.taxi : busType ? palette.cream :
    [palette.teal, palette.clay, palette.cream][index % 3];
  if (!emergency) {
    part(color, 0, taxi ? 0.63 : 0.7, 0, width, taxi ? 0.66 : 0.8, length - 0.1);
    part(vehicleGlass, 0, taxi ? 1.13 : 1.24, large || van ? 0 : -0.15,
      width - 0.17, taxi ? 0.47 : 0.6, large || van ? length - 0.3 : 1.45);
    part(color, 0, taxi ? 1.39 : 1.6, large || van ? 0 : -0.15,
      taxi ? width - 0.09 : width, taxi ? 0.1 : 0.15, large || van ? length : 1.5);
  }
  if (busType) {
    part(palette.teal, 0, 0.82, 0, width + 0.03, 0.24, length);
    for (let z = -1.8; z <= 1.8; z += 0.85) part(color, 0, 1.26, z, width, 0.66, 0.12);
  } else if (large || van) {
    part(color, 0, 1.25, -0.55, width, 1.24, length - 1.2);
    part(palette.cream, 0, 1.93, -0.55, width + 0.02, 0.1, length - 1.2);
    for (const side of [-1, 1]) part(palette.stone, side * width / 2, 1.22, -0.6, 0.03, 0.04, length - 1.5);
  } else if (taxi) {
    part(palette.rubber, 0, 1.46, -0.15, 0.66, 0.05, 0.3);
    part(lampGlow, 0, 1.58, -0.15, 0.62, 0.22, 0.23).name = 'Unbranded taxi roof light';
    part(palette.rubber, 0, 0.65, 1.32, 0.64, 0.18, 0.045).name = 'Taxi front grille';
    part(palette.taxi, 0, 0.43, 1.32, 0.26, 0.1, 0.045);
    for (const side of [-1, 1]) {
      part(color, side * 0.675, 1.15, -0.13, 0.055, 0.45, 0.085);
      part(palette.rubber, side * 0.716, 0.57, 0, 0.014, 0.045, 1.8);
      for (const z of [-0.51, 0.16]) {
        part(palette.stone, side * 0.718, 0.9, z, 0.012, 0.035, 0.16);
      }
      part(palette.rubber, side * 0.709, 0.68, -0.48, 0.018, 0.22, 0.25)
        .name = 'Generic taxi door medallion';
      part(palette.taxi, side * 0.72, 0.68, -0.48, 0.006, 0.12, 0.15);
    }
    // A tiny original geometric TAXI stencil, without company logos or roof advertising.
    const letters = [
      ['111', '010', '010', '010', '010'],
      ['010', '101', '111', '101', '101'],
      ['101', '101', '010', '101', '101'],
      ['111', '010', '010', '010', '111'],
    ];
    for (const side of [-1, 1]) letters.forEach((letter, column) => {
      letter.forEach((row, y) => [...row].forEach((pixel, x) => {
        if (pixel === '1') part(palette.rubber, side * (-0.255 + column * 0.14 + x * 0.035),
          1.65 - y * 0.035, -0.15 + side * 0.119, 0.031, 0.031, 0.006);
      }));
    });
  } else if (emergency) {
    const beaconY = ambulanceBox ? 2.55 : ambulance ? 2.06 : firetruck ? 2.12 : 1.82;
    const beaconZ = fireSuv ? 0.1 : length / 2 - 0.55;
    if (ambulance) {
      const moduleLength = length - (ambulanceBox ? 1.55 : 1.35);
      const moduleZ = -length / 2 + moduleLength / 2 + 0.05;
      const moduleTop = ambulanceBox ? 2.42 : 1.98;
      part(color, 0, 0.78, 0, width, 1, length - 0.1);
      part(color, 0, moduleTop / 2 + 0.5, moduleZ, width + 0.02, moduleTop - 0.5, moduleLength);
      part(palette.cream, 0, moduleTop + 0.06, moduleZ, width + 0.04, 0.12, moduleLength);
      part(vehicleGlass, 0, 1.5, length / 2 - 0.72, width - 0.26, 0.5, 0.12);
      part(color, 0, 1.78, length / 2 - 0.5, width, 0.5, 1);
      for (const side of [-1, 1]) {
        part(vehicleGlass, side * (width / 2 - 0.02), 1.48, length / 2 - 0.78, 0.05, 0.42, 0.66);
        part(vehicleGlass, side * (width / 2 + 0.005), 1.72, moduleZ + moduleLength * 0.2, 0.02, 0.36, moduleLength * 0.42);
      }
      for (const face of [-1, 1]) {
        part(palette.copper, 0, 1.08, face * (length / 2 - 0.02), width + 0.02, 0.22, 0.03);
      }
      for (const side of [-1, 1]) {
        part(palette.copper, side * (width / 2 + 0.012), 1.08, 0, 0.02, 0.22, length - 0.12);
        part(civicBlue, side * (width / 2 + 0.02), 1.7, moduleZ, 0.02, 0.4, 0.12);
        part(civicBlue, side * (width / 2 + 0.02), 1.7, moduleZ, 0.02, 0.12, 0.4);
      }
      part(civicBlue, 0, 1.66, -length / 2 - 0.01, 0.4, 0.12, 0.02);
      part(civicBlue, 0, 1.66, -length / 2 - 0.01, 0.12, 0.4, 0.02);
    } else if (firetruck) {
      const bodyZ = -length / 2 + (length - 1.7) / 2 + 0.1;
      part(color, 0, 0.82, 0, width, 1.05, length - 0.1);
      part(color, 0, 1.5, bodyZ, width + 0.02, 1, length - 1.7);
      part(vehicleGlass, 0, 1.55, length / 2 - 0.7, width - 0.28, 0.5, 0.12);
      part(color, 0, 1.82, length / 2 - 0.5, width, 0.55, 1.05);
      part(palette.stone, 0, 0.62, length / 2 - 0.02, width - 0.2, 0.34, 0.08).name = 'Fire engine bumper';
      for (const side of [-1, 1]) {
        part(vehicleGlass, side * (width / 2 - 0.02), 1.52, length / 2 - 0.75, 0.05, 0.44, 0.66);
        part(palette.stone, side * (width / 2 + 0.012), 1.25, bodyZ, 0.03, 0.62, length - 2);
        part(palette.copper, side * (width / 2 + 0.016), 0.82, 0, 0.02, 0.16, length - 0.3);
        part(palette.stone, side * 0.3, 2.05, bodyZ, 0.06, 0.08, length - 1.4);
      }
      for (let z = bodyZ - (length - 1.4) / 2 + 0.2; z <= bodyZ + (length - 1.4) / 2 - 0.2; z += 0.42) {
        part(palette.stone, 0, 2.05, z, 0.66, 0.05, 0.05);
      }
    } else {
      part(color, 0, 0.7, 0, width, 0.86, length - 0.1);
      part(vehicleGlass, 0, 1.3, -0.05, width - 0.22, 0.56, 1.5);
      part(color, 0, 1.64, 0, width, 0.16, 1.7);
      for (const side of [-1, 1]) part(palette.line, side * (width / 2 + 0.008), 0.72, 0, 0.02, 0.24, length - 0.7);
    }
    part(palette.rubber, 0, beaconY, beaconZ, width - 0.2, 0.06, 0.24);
    part(beaconRed, -width * 0.22, beaconY + 0.09, beaconZ, width * 0.34, 0.12, 0.2).name = 'Emergency beacon';
    part(beaconBlue, width * 0.22, beaconY + 0.09, beaconZ, width * 0.34, 0.12, 0.2).name = 'Emergency beacon';
  }
  for (const side of [-1, 1]) {
    lamp('head', side * width * 0.3, 0.75, length / 2 - 0.005, [0.24, 0.18, 0.065]);
    lamp('tail', side * width * 0.3, 0.75, -length / 2 + 0.005, [0.22, 0.18, 0.065]);
    const channel = side === 1 ? 'left' : 'right';
    for (const end of [-1, 1]) {
      lamp(channel, side * width * 0.43, 0.73, end * (length / 2 - 0.005), [0.12, 0.15, 0.065]);
    }
    lamp(channel, side * (width / 2 + 0.01), 0.87, length * 0.12, [0.035, 0.09, 0.16]);
    for (const z of [-length * 0.32, length * 0.32]) {
      wheels.push(buildWheel(group, side * (width / 2 - 0.13), radius, z, radius / 0.38, 0.7, z > 0));
    }
  }
  lamp('brake', 0, large || van ? 1.7 : emergency ? 1.15 : 1.23,
    large || van ? -length / 2 + 0.015 : emergency ? -length / 2 + 0.02 : -0.9, [0.28, 0.07, 0.055]);
  const rig: VehicleRig = { kind: 'vehicle', body, wheels, wheelRadius: radius };
  group.userData.rig = rig;
  poseNeutral(rig);
  return { id: definition.id, body, length, lamps, bicycle: false };
}
