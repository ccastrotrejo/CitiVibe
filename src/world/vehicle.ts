import * as THREE from 'three';
import { BIKE_SHARE_STATIONS, sharedBikeKind } from '../content/bikeShare';
import { createPersonProfile } from '../content/people';
import type { TrafficActorDefinition } from '../content/streets';
import { buildSharedBike } from './bikeShare';
import { buildEmergencyVehicle, isEmergencyVehicle } from './emergencyVehicle';
import { buildOrdinaryVehicle } from './ordinaryVehicle';
import { WALKER, poseNeutral, type VehicleRig, type WheelRig } from './locomotion';
import { personPart, type PersonArt } from './person';
import type { VehicleLamp, VehicleLightingRig } from './vehicleLighting';

type Triple = readonly [number, number, number];

/** Shared geometry and materials the scene owns; the vehicle rig only borrows them. */
export interface VehicleArt {
  box: THREE.BufferGeometry;
  cylinder: THREE.BufferGeometry;
  wheel: THREE.BufferGeometry;
  taperedShell: THREE.BufferGeometry;
  wheelArch: THREE.BufferGeometry;
  taxiLettering: THREE.BufferGeometry;
  personArt: PersonArt;
  civicBlue: THREE.Material;
  vehiclePaint: THREE.Material;
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
  group: THREE.Group, definition: TrafficActorDefinition, art: VehicleArt,
): VehicleLightingRig {
  const { palette, personArt, civicBlue, cylinder, wheel } = art;
  const emergency = isEmergencyVehicle(definition.vehicleType);
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
    spin.add(limb(cylinder, palette.stone, [Math.sign(x) * 0.06, 0, 0],
      [0.16 * radiusFactor, 0.05, 0.16 * radiusFactor], [0, 0, Math.PI / 2]));
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
  const busType = type === 'bus';
  const large = busType || type === 'truck';
  const van = type === 'van';
  const service = isEmergencyVehicle(type) ? buildEmergencyVehicle(body, type, art) : null;
  const ordinary = !service && type && type !== 'bicycle' && !isEmergencyVehicle(type)
    ? buildOrdinaryVehicle(body, definition.id, type, art) : null;
  const shape = service ?? ordinary;
  if (!shape) throw new Error(`Missing motor vehicle artwork: ${definition.id}.`);
  const { length, width, radius } = shape;
  for (const side of [-1, 1]) {
    lamp('head', side * width * 0.3, shape.lampY, length / 2 - 0.005, [0.24, 0.18, 0.065]);
    lamp('tail', side * width * 0.3, 0.75, -length / 2 + 0.005, [0.22, 0.18, 0.065]);
    const channel = side === 1 ? 'left' : 'right';
    for (const end of [-1, 1]) {
      lamp(channel, side * width * 0.43, 0.73, end * (length / 2 - 0.005), [0.12, 0.15, 0.065]);
    }
    lamp(channel, side * (width / 2 + (emergency ? 0.001 : 0.01)), 0.87, length * 0.12, [0.035, 0.09, 0.16]);
    const axle = ordinary?.axle ?? length * 0.32;
    for (const z of [-axle, axle]) {
      wheels.push(buildWheel(group, side * (width / 2 - (emergency ? 0.07 : 0.04)),
        radius, z, radius / 0.38, 0.7, z > 0));
    }
  }
  lamp('brake', 0, ordinary?.brakeY ?? (large || van ? 1.7 : 1.15),
    ordinary ? -length / 2 + 0.02 : large || van ? -length / 2 + 0.015 : -length / 2 + 0.02,
    [0.28, 0.07, 0.055]);
  const rig: VehicleRig = { kind: 'vehicle', body, wheels, wheelRadius: radius };
  group.userData.rig = rig;
  poseNeutral(rig);
  return { id: definition.id, body, length, lamps, bicycle: false };
}
