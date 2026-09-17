import * as THREE from 'three';
import {
  CURB_RUN_ENDS, CURB_VEHICLES, EXTRA_PARK_BENCHES, FOOD_CARTS, FOOD_CART_SPACE, PARKING_BAYS, PARKING_SIGNS, PARK_READING_POCKET,
  STREET_BENCHES, STREET_FURNITURE_APRONS, STREET_MAILBOXES, type CurbVehicle, type StreetProp,
} from '../content/streetFurniture';
import type { StreetscapeBuilder } from './streetscape';
import { buildCivicUtilities } from './civicUtilities';
import { buildVehicleRig, type VehicleArt } from './vehicle';

/** Bake the same passenger shell and grounded wheels as traffic; parked engines/lamps stay off. */
export function buildParkedCar(prop: CurbVehicle, art: VehicleArt): THREE.Group {
  const group = new THREE.Group();
  group.name = prop.id;
  const rig = buildVehicleRig(group, { id: prop.id, kind: 'car', vehicleType: 'sedan' }, art);
  for (const lamp of rig.lamps.filter(({ channel }) => channel === 'head' || channel === 'tail')) {
    const lens = new THREE.Mesh(art.box, lamp.channel === 'head' ? art.palette.line : art.palette.clay);
    lens.name = 'Unlit parked lamp';
    lens.position.copy(lamp.mount.position);
    lens.scale.set(...lamp.size);
    rig.body.add(lens);
  }
  group.position.set(prop.x, 0, prop.z);
  group.rotation.y = prop.yaw;
  return group;
}

function placedBuilder(builder: StreetscapeBuilder, prop: StreetProp) {
  const { x, z, yaw } = prop;
  const position = (dx: number, y: number, dz: number): readonly [number, number, number] =>
    [x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y, z - dx * Math.sin(yaw) + dz * Math.cos(yaw)];
  return {
    position,
    add(shape: THREE.BufferGeometry, material: THREE.Material, dx: number, y: number, dz: number,
      scale: readonly [number, number, number], faceYaw = 0) {
      builder.add(shape, material, position(dx, y, dz), scale, [0, yaw + faceYaw, 0]);
    },
    block(material: THREE.Material, dx: number, y: number, dz: number, w: number, h: number, d: number) {
      builder.block(material, ...position(dx, y, dz), w, h, d, yaw);
    },
    cylinder(material: THREE.Material, dx: number, y: number, dz: number,
      radius: number, length: number, axle = false) {
      builder.add(builder.cylinder, material, position(dx, y, dz), [radius, length, radius],
        axle ? [0, yaw, Math.PI / 2] : [0, yaw, 0]);
    },
  };
}

/** Slatted, park-green seating on pale concrete supports, with no new resources. */
export function buildStreetBench(builder: StreetscapeBuilder, prop: StreetProp, width = 2.4): void {
  const { block } = placedBuilder(builder, prop);
  const p = builder.palette;
  block(p.paving, 0, -0.07, 0, width + 0.25, 0.04, 0.86);
  for (let index = 0; index < 4; index++) {
    block(p.teal, 0, 0.48, -0.21 + index * 0.14, width, 0.075, 0.11);
  }
  for (let index = 0; index < 3; index++) {
    block(p.teal, 0, 0.7 + index * 0.16, -0.27, width, 0.11, 0.065);
  }
  for (const side of [-1, 1]) {
    block(p.stone, side * width * 0.33, 0.2, 0, 0.19, 0.49, 0.52);
    block(p.stone, side * width * 0.33, 0.69, -0.3, 0.15, 0.68, 0.12);
    block(p.roof, side * (width / 2 - 0.1), 0.68, 0, 0.065, 0.065, 0.52);
    block(p.roof, side * (width / 2 - 0.1), 0.56, 0.2, 0.055, 0.23, 0.055);
  }
}

function buildFoodCart(builder: StreetscapeBuilder, prop: StreetProp, accent: THREE.Material,
  glazing: THREE.Material, lettering: THREE.BufferGeometry): void {
  const { block, cylinder, add } = placedBuilder(builder, prop);
  const p = builder.palette;
  block(p.paving, 0, -0.09, FOOD_CART_SPACE.forwardOffset,
    FOOD_CART_SPACE.width, 0.02, FOOD_CART_SPACE.depth);
  block(p.stone, 0, 0.67, 0, 2.3, 0.88, 1.3);
  block(p.roof, 0, 0.28, 0, 2.15, 0.09, 1.16);
  block(p.copperEdge, 0, 1.13, 0.1, 2.45, 0.08, 1.55);
  block(p.stone, 0, 1.12, 0.88, 2.45, 0.075, 0.43);
  block(accent, 0, 0.8, 0.659, 2.15, 0.44, 0.025);
  block(p.cream, 0, 0.8, 0.677, 1.95, 0.37, 0.012);
  add(lettering, accent, 0, 0.8, 0.689, [0.6, 0.6, 1]);
  for (const side of [-1, 1]) {
    block(p.roof, side * 1.161, 0.65, 0, 0.02, 0.025, 1.1);
    block(p.roof, side * 0.63, 0.7, -0.659, 0.75, 0.62, 0.018);
    block(p.stone, side * 0.63, 0.7, -0.674, 0.7, 0.57, 0.015);
    block(p.roof, side * 0.8, 0.78, -0.689, 0.05, 0.15, 0.025);
    for (const end of [-1, 1]) {
      cylinder(p.rubber, side * 1.06, 0.1, end * 0.45, 0.18, 0.1, true);
      cylinder(p.stone, side * 1.12, 0.1, end * 0.45, 0.085, 0.025, true);
      block(p.stone, side * 1.07, 1.74, end * 0.56, 0.055, 1.3, 0.055);
    }
  }
  block(glazing, -0.64, 1.43, -0.255, 0.86, 0.5, 0.025);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    block(p.stone, -0.64 + side * 0.42, 1.43, 0.12 + end * 0.37, 0.025, 0.5, 0.025);
  }
  block(p.stone, -0.64, 1.71, 0.12, 0.94, 0.065, 0.84);
  block(p.cream, -0.64, 1.2, 0.12, 0.78, 0.04, 0.67);
  block(p.roof, 0.47, 1.2, 0.08, 0.85, 0.08, 0.62);
  for (let food = 0; food < 3; food++) {
    cylinder(p.cream, -0.85 + food * 0.21, 1.29, 0.18, 0.08, 0.26, true);
    cylinder(p.clay, -0.85 + food * 0.21, 1.32, 0.18, 0.04, 0.24, true);
    block(p.stone, 0.22 + food * 0.23, 1.249, 0.08, 0.04, 0.012, 0.54);
  }
  for (let bottle = 0; bottle < 3; bottle++) {
    cylinder(bottle % 2 ? p.taxi : p.clay, 0.55 + bottle * 0.2, 1.3, 0.9, 0.052, 0.25);
    cylinder(p.cream, 0.55 + bottle * 0.2, 1.45, 0.9, 0.025, 0.055);
  }
  for (let stripe = 0; stripe < 7; stripe++) {
    const color = stripe % 2 ? p.cream : accent;
    block(color, -1.17 + stripe * 0.39, 2.43, 0, 0.39, 0.12, 1.9);
    for (const end of [-1, 1]) block(color, -1.17 + stripe * 0.39, 2.28, end * 0.94, 0.39, 0.22, 0.04);
  }
  block(p.cream, 0, 2.28, -0.965, 1.75, 0.24, 0.012);
  add(lettering, accent, 0, 2.28, -0.978, [0.45, 0.45, 1], Math.PI);
}

/** Original curbside props share the scene's static batches and resource ownership. */
export function buildStreetFurniture(
  builder: StreetscapeBuilder, blue: THREE.Material, glazing: THREE.Material,
  lettering: { food: THREE.BufferGeometry; parking: THREE.BufferGeometry },
  vehicleArt: VehicleArt,
): void {
  const p = builder.palette;
  for (const bay of PARKING_BAYS) {
    const { block } = placedBuilder(builder, bay);
    block(p.line, -bay.width / 2, 0.025, 0, 0.085, 0.02, bay.length);
    for (const end of [-1, 1]) {
      block(p.line, 0, 0.025, end * bay.length / 2, bay.width, 0.02, 0.085);
    }
  }
  for (const end of CURB_RUN_ENDS) {
    builder.block(p.line, end.x, 0.093, end.z, 0.2, 0.006, 0.13);
  }
  for (const sign of PARKING_SIGNS) {
    const { block, cylinder } = placedBuilder(builder, sign);
    cylinder(p.stone, 0, 1.4, 0, 0.04, 2.8);
    block(p.teal, 0, 2.47, 0, 0.64, 0.7, 0.055);
    for (const side of [-1, 1]) {
      block(p.cream, 0, 2.47, side * 0.035, 0.56, 0.62, 0.012);
      // A curb/car pictogram locates the reserved curb, without inventing parking permissions.
      block(p.teal, 0, 2.55, side * 0.046, 0.35, 0.085, 0.012);
      block(p.teal, 0, 2.63, side * 0.046, 0.23, 0.075, 0.012);
      for (const end of [-1, 1]) block(p.teal, end * 0.115, 2.49, side * 0.046, 0.05, 0.05, 0.012);
      block(p.teal, 0, 2.32, side * 0.046, 0.4, 0.025, 0.012);
    }
  }
  for (const apron of STREET_FURNITURE_APRONS) {
    builder.block(p.paving, (apron.minX + apron.maxX) / 2, -0.11, (apron.minZ + apron.maxZ) / 2,
      apron.maxX - apron.minX, 0.06, apron.maxZ - apron.minZ);
  }
  buildCivicUtilities(builder);
  for (const prop of [...STREET_BENCHES, ...EXTRA_PARK_BENCHES]) buildStreetBench(builder, prop);
  const reading = PARK_READING_POCKET;
  builder.block(p.paving, (reading.minX + reading.maxX) / 2, -0.041, (reading.minZ + reading.maxZ) / 2,
    reading.maxX - reading.minX, 0.058, reading.maxZ - reading.minZ);
  for (const prop of STREET_MAILBOXES) {
    const { block } = placedBuilder(builder, prop);
    block(p.paving, 0, -0.07, 0, 0.8, 0.04, 0.8);
    block(blue, 0, 0.72, 0, 0.64, 0.76, 0.52);
    // The horizontal cylinder overlaps the body to form a rounded collection-box hood.
    builder.add(builder.cylinder, blue, [prop.x, 1.1, prop.z], [0.32, 0.52, 0.32],
      [Math.PI / 2, 0, -prop.yaw]);
    block(p.rubber, 0, 1.13, 0.268, 0.45, 0.09, 0.025);
    block(blue, 0, 1.03, 0.3, 0.5, 0.055, 0.12);
    block(p.cream, 0, 0.78, 0.269, 0.22, 0.18, 0.012);
    block(blue, 0, 0.78, 0.278, 0.17, 0.09, 0.008);
    block(p.cream, 0, 0.8, 0.284, 0.14, 0.012, 0.006);
    block(p.roof, 0, 0.49, 0.268, 0.52, 0.025, 0.02);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      block(blue, side * 0.25, 0.14, end * 0.2, 0.065, 0.44, 0.065);
      block(p.roof, side * 0.25, -0.065, end * 0.2, 0.12, 0.03, 0.12);
    }
  }
  FOOD_CARTS.forEach((cart, index) => buildFoodCart(builder, cart, index % 2 ? blue : p.bus, glazing, lettering.food));
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), rotation = new THREE.Euler();
  for (const prop of CURB_VEHICLES) {
    const car = buildParkedCar(prop, vehicleArt);
    car.updateWorldMatrix(true, true);
    car.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      object.matrixWorld.decompose(position, quaternion, scale);
      rotation.setFromQuaternion(quaternion);
      builder.add(object.geometry, object.material, position.toArray(), scale.toArray(),
        [rotation.x, rotation.y, rotation.z], object.userData.instanceColor?.getStyle());
    });
  }
}
