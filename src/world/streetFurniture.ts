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
  const rbox = builder.roundedBox ?? builder.box;
  const position = (dx: number, y: number, dz: number): readonly [number, number, number] =>
    [x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y, z - dx * Math.sin(yaw) + dz * Math.cos(yaw)];
  const orient = (pitch: number, roll = 0, localYaw = 0): readonly [number, number, number] => {
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + localYaw, 0))
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, roll))),
    );
    return [euler.x, euler.y, euler.z];
  };
  return {
    position,
    orient,
    add(shape: THREE.BufferGeometry, material: THREE.Material, dx: number, y: number, dz: number,
      scale: readonly [number, number, number], faceYaw = 0) {
      builder.add(shape, material, position(dx, y, dz), scale, [0, yaw + faceYaw, 0]);
    },
    tilted(shape: THREE.BufferGeometry, material: THREE.Material, dx: number, y: number, dz: number,
      scale: readonly [number, number, number], pitch = 0, roll = 0, localYaw = 0) {
      builder.add(shape, material, position(dx, y, dz), scale, orient(pitch, roll, localYaw));
    },
    block(material: THREE.Material, dx: number, y: number, dz: number, w: number, h: number, d: number) {
      builder.block(material, ...position(dx, y, dz), w, h, d, yaw);
    },
    rounded(material: THREE.Material, dx: number, y: number, dz: number,
      w: number, h: number, d: number, pitch = 0, roll = 0) {
      builder.add(rbox, material, position(dx, y, dz), [w, h, d],
        pitch === 0 && roll === 0 ? [0, yaw, 0] : orient(pitch, roll));
    },
    cylinder(material: THREE.Material, dx: number, y: number, dz: number,
      radius: number, length: number, axle = false) {
      builder.add(builder.cylinder, material, position(dx, y, dz), [radius, length, radius],
        axle ? orient(0, Math.PI / 2) : [0, yaw, 0]);
    },
  };
}

export interface BenchBuildOptions {
  withPad?: boolean;
  yLift?: number;
}

/** Contoured multi-slat NYC bench with scrolled cast-iron side frames and center divider armrest. */
export function buildStreetBench(
  builder: StreetscapeBuilder,
  prop: StreetProp,
  width = 2.4,
  options: BenchBuildOptions = {},
): void {
  const { withPad = true, yLift = 0 } = options;
  const { block, rounded, cylinder, tilted } = placedBuilder(builder, prop);
  const p = builder.palette;
  const slatMaterial = prop.id.includes('park') ? p.wood : p.teal;
  const slatSpan = width - 0.06;
  if (withPad) block(p.paving, 0, -0.07 + yLift, 0, width + 0.25, 0.04, 0.86);

  // Ergonomically contoured seat slats (4 rounded slats with bullnose front edge).
  const seatProfile: readonly [dz: number, y: number, pitch: number, h: number, d: number][] = [
    [-0.195, 0.466, 0.09, 0.05, 0.108],
    [-0.065, 0.452, 0.02, 0.05, 0.108],
    [0.065, 0.45, -0.04, 0.05, 0.108],
    [0.2, 0.462, 0.12, 0.058, 0.114],
  ];
  for (const [dz, y, pitch, h, d] of seatProfile) {
    rounded(slatMaterial, 0, y + yLift, dz, slatSpan, h, d, pitch);
  }

  // Contoured lumbar backrest slats (3 rounded slats with taller upper crest rail).
  const backProfile: readonly [dz: number, y: number, pitch: number, h: number][] = [
    [-0.262, 0.635, -0.18, 0.094],
    [-0.292, 0.785, -0.21, 0.094],
    [-0.324, 0.945, -0.24, 0.108],
  ];
  for (const [dz, y, pitch, h] of backProfile) {
    rounded(slatMaterial, 0, y + yLift, dz, slatSpan, h, 0.052, pitch);
  }

  // Scrolled cast-iron outer side frames with scroll knuckles.
  for (const side of [-1, 1]) {
    const frameX = side * (width / 2 - 0.11);
    rounded(p.rubber, frameX, -0.028 + yLift, -0.02, 0.088, 0.036, 0.56);
    rounded(p.rubber, frameX, 0.21 + yLift, 0.185, 0.062, 0.46, 0.075, -0.14);
    rounded(p.rubber, frameX, 0.48 + yLift, -0.25, 0.064, 0.98, 0.082, -0.2);
    rounded(p.rubber, frameX, 0.415 + yLift, -0.01, 0.058, 0.054, 0.52);
    rounded(p.rubber, frameX, 0.655 + yLift, -0.02, 0.064, 0.046, 0.5, 0.04);
    cylinder(p.rubber, frameX, 0.635 + yLift, 0.235, 0.046, 0.07, true);
  }

  // Center cast-iron scrolled divider armrest.
  rounded(p.rubber, 0, 0.648 + yLift, -0.03, 0.05, 0.044, 0.46, 0.04);
  rounded(p.rubber, 0, 0.53 + yLift, 0.185, 0.044, 0.19, 0.044, 0.1);
  tilted(builder.cylinder, p.rubber, 0, 0.625 + yLift, 0.205, [0.04, 0.054, 0.04], 0, Math.PI / 2);
}

function buildFoodCart(builder: StreetscapeBuilder, prop: StreetProp, accent: THREE.Material,
  glazing: THREE.Material, lettering: THREE.BufferGeometry): void {
  const { block, rounded, cylinder, add, tilted } = placedBuilder(builder, prop);
  const p = builder.palette;
  const alloy = builder.alloy ?? p.stone;
  const cone = builder.cone ?? builder.cylinder;

  // Grounded corner paving pad.
  block(p.paving, 0, -0.09, FOOD_CART_SPACE.forwardOffset,
    FOOD_CART_SPACE.width, 0.02, FOOD_CART_SPACE.depth);

  // Undercarriage chassis skirt, cross-axles, caster forks, rubber tires & alloy hubs.
  rounded(p.roof, 0, 0.24, 0, 2.06, 0.1, 1.1);
  for (const end of [-1, 1]) {
    block(p.roof, 0, 0.11, end * 0.44, 1.98, 0.038, 0.038);
  }
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      rounded(p.roof, side * 1.02, 0.185, end * 0.44, 0.11, 0.13, 0.12);
      cylinder(p.rubber, side * 1.05, 0.11, end * 0.44, 0.185, 0.1, true);
      cylinder(alloy, side * 1.116, 0.11, end * 0.44, 0.092, 0.026, true);
      // Brushed stainless canopy corner posts.
      cylinder(alloy, side * 1.05, 1.72, end * 0.54, 0.028, 1.18);
    }
    // Lower side bumper rub-rails and rear vendor cabinet doors.
    rounded(p.roof, side * 1.132, 0.34, 0, 0.022, 0.045, 1.16);
    rounded(p.roof, side * 0.6, 0.68, -0.642, 0.74, 0.58, 0.018);
    rounded(alloy, side * 0.6, 0.68, -0.656, 0.68, 0.52, 0.014);
    rounded(p.roof, side * 0.78, 0.74, -0.67, 0.042, 0.14, 0.02);
  }

  // Brushed stainless-steel rounded lower cabinet.
  rounded(alloy, 0, 0.67, 0, 2.24, 0.84, 1.26);

  // Brushed alloy push-bar handle on the left (-dx) end, kept strictly inside canopy width.
  for (const end of [-1, 1]) {
    rounded(alloy, -1.2, 0.96, end * 0.4, 0.15, 0.034, 0.034);
  }
  tilted(builder.cylinder, alloy, -1.275, 0.96, 0, [0.024, 0.92, 0.024], Math.PI / 2);

  // Wrap-around stainless serving counter + front fold-out customer counter shelf & brackets.
  rounded(alloy, 0, 1.128, 0.04, 2.4, 0.068, 1.36);
  for (const side of [-1, 1]) {
    rounded(alloy, side * 1.175, 1.174, 0.04, 0.055, 0.032, 1.32);
  }
  rounded(alloy, 0, 1.095, 0.895, 2.38, 0.052, 0.33);
  for (const dx of [-0.84, 0, 0.84]) {
    rounded(p.roof, dx, 1.01, 0.755, 0.036, 0.12, 0.14, 0.35);
  }

  // Warm front menu board panel + corner-approach side menu board.
  rounded(accent, 0, 0.72, 0.646, 2.1, 0.48, 0.024);
  rounded(p.wood, 0, 0.72, 0.666, 1.98, 0.4, 0.012);
  rounded(p.cream, 0, 0.72, 0.679, 1.88, 0.34, 0.01);
  add(lettering, accent, 0, 0.72, 0.69, [0.58, 0.58, 1]);
  rounded(p.wood, 1.134, 1.6, -0.16, 0.02, 0.56, 0.44);
  rounded(p.cream, 1.15, 1.6, -0.16, 0.01, 0.48, 0.36);
  block(p.taxi, 1.16, 1.76, -0.16, 0.008, 0.09, 0.32);

  // Framed vehicleGlass sneeze-guard display case (-dx side) with stocked shelves.
  rounded(alloy, -0.62, 1.186, 0.15, 0.88, 0.036, 0.7);
  rounded(alloy, -0.62, 1.4, 0.15, 0.8, 0.018, 0.62);
  rounded(alloy, -0.62, 1.66, 0.15, 0.92, 0.044, 0.74);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    block(alloy, -0.62 + side * 0.41, 1.423, 0.15 + end * 0.32, 0.026, 0.44, 0.026);
  }
  block(glazing, -0.62, 1.423, 0.485, 0.8, 0.42, 0.018);
  block(glazing, -0.62, 1.423, -0.185, 0.8, 0.42, 0.018);
  for (let food = 0; food < 3; food++) {
    cylinder(p.sand, -0.82 + food * 0.2, 1.255, 0.18, 0.072, 0.22, true);
    cylinder(p.clay, -0.82 + food * 0.2, 1.455, 0.14, 0.058, 0.2, true);
  }

  // Sliding service window with alloy tracks, vertical mullion, and glazed pane.
  rounded(alloy, 0.35, 1.18, 0.52, 1.02, 0.028, 0.038);
  rounded(alloy, 0.35, 2.08, 0.52, 1.02, 0.03, 0.04);
  block(alloy, 0.34, 1.63, 0.528, 0.032, 0.87, 0.03);
  block(alloy, 0.845, 1.63, 0.528, 0.028, 0.87, 0.03);
  block(glazing, 0.595, 1.63, 0.518, 0.48, 0.86, 0.014);

  // Griddle station & tall brushed-stainless coffee urn with spigot.
  rounded(p.roof, 0.26, 1.195, 0.02, 0.74, 0.065, 0.54);
  for (let grill = 0; grill < 3; grill++) {
    block(alloy, 0.04 + grill * 0.22, 1.236, 0.02, 0.035, 0.012, 0.46);
  }
  cylinder(alloy, 0.84, 1.38, -0.18, 0.105, 0.42);
  add(cone, alloy, 0.84, 1.615, -0.18, [0.112, 0.06, 0.112]);
  cylinder(p.rubber, 0.84, 1.658, -0.18, 0.022, 0.03);
  rounded(p.rubber, 0.84, 1.29, -0.055, 0.024, 0.045, 0.05);

  // Stainless condiment caddy + 4 colorful squeeze bottles (red, yellow, green, cream).
  rounded(alloy, 0.66, 1.135, 0.895, 0.66, 0.028, 0.15);
  const condiments = [p.clay, p.taxi, p.teal, p.cream];
  for (let bottle = 0; bottle < condiments.length; bottle++) {
    const bx = 0.42 + bottle * 0.16;
    cylinder(condiments[bottle], bx, 1.255, 0.895, 0.042, 0.2);
    add(cone, p.cream, bx, 1.385, 0.895, [0.022, 0.065, 0.022]);
  }

  // Multi-panel cambered striped canopy with 4-sided perimeter valence and rooftop vent stack.
  rounded(alloy, 0, 2.275, 0, 2.58, 0.036, 1.76);
  rounded(alloy, 0, 2.416, 0, 2.58, 0.036, 0.44);
  for (let stripe = 0; stripe < 7; stripe++) {
    const color = stripe % 2 ? p.cream : accent;
    const sx = -1.14 + stripe * 0.38;
    rounded(color, sx, 2.355, 0, 0.372, 0.105, 1.81);
    for (const end of [-1, 1]) {
      rounded(color, sx, 2.22, end * 0.935, 0.372, 0.21, 0.04);
    }
  }
  for (const side of [-1, 1]) {
    for (let panel = 0; panel < 3; panel++) {
      const color = panel % 2 ? p.cream : accent;
      rounded(color, side * 1.338, 2.22, -0.58 + panel * 0.58, 0.024, 0.21, 0.568);
    }
  }
  // Low-profile brushed stainless rooftop exhaust vent hood (strictly within FOOD_CART_SPACE.height).
  rounded(alloy, 0.28, 2.452, -0.1, 0.3, 0.032, 0.3);
  cylinder(alloy, 0.28, 2.474, -0.1, 0.11, 0.016);
  cylinder(p.roof, 0.28, 2.485, -0.1, 0.14, 0.008);

  // Rear valence signage.
  rounded(p.cream, 0, 2.22, -0.966, 1.74, 0.22, 0.012);
  add(lettering, accent, 0, 2.22, -0.978, [0.45, 0.45, 1], Math.PI);
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
  const alloy = builder.alloy ?? p.stone;
  for (const prop of STREET_MAILBOXES) {
    const { block, rounded } = placedBuilder(builder, prop);
    block(p.paving, 0, -0.07, 0, 0.8, 0.04, 0.8);
    // Four flared corner legs anchored to alloy foot pads on the paving slab.
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      rounded(alloy, side * 0.265, -0.036, end * 0.215, 0.11, 0.024, 0.11);
      rounded(blue, side * 0.25, 0.16, end * 0.2, 0.072, 0.36, 0.072, end * -0.075, side * 0.075);
    }
    rounded(blue, 0, 0.365, 0, 0.6, 0.04, 0.48);
    rounded(blue, 0, 0.74, 0, 0.64, 0.7, 0.52);
    rounded(blue, 0, 0.44, 0, 0.656, 0.028, 0.534);
    // Smooth cylindrical vaulted arch hood slightly inset along depth to avoid end-cap coplanarity.
    builder.add(builder.cylinder, blue, [prop.x, 1.09, prop.z], [0.318, 0.514, 0.318],
      [Math.PI / 2, 0, -prop.yaw]);
    // Recessed USPS snorkel letter-drop hood, drip lip, dark slot, and alloy pull-handle.
    rounded(blue, 0, 1.055, 0.312, 0.5, 0.15, 0.095);
    rounded(blue, 0, 1.138, 0.326, 0.52, 0.032, 0.115, 0.08);
    rounded(p.rubber, 0, 1.05, 0.366, 0.42, 0.072, 0.012);
    rounded(alloy, 0, 1.042, 0.378, 0.38, 0.046, 0.01, 0.18);
    rounded(alloy, 0, 1.052, 0.394, 0.17, 0.022, 0.018);
    // Collection schedule frame & alloy lock escutcheon plate.
    rounded(p.cream, 0, 0.8, 0.268, 0.23, 0.165, 0.01);
    rounded(blue, 0, 0.845, 0.278, 0.19, 0.045, 0.008);
    rounded(alloy, 0, 0.585, 0.268, 0.068, 0.086, 0.01);
    rounded(p.rubber, 0, 0.585, 0.278, 0.02, 0.034, 0.008);
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
