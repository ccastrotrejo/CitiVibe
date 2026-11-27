import * as THREE from 'three';
import { facadeSample } from '../content/facades';
import type { VehicleArt } from './vehicle';

type Triple = readonly [number, number, number];
type OrdinaryType = 'sedan' | 'taxi' | 'van' | 'truck' | 'bus';
export type PassengerVariant = 'sedan' | 'hatch' | 'crossover' | 'minivan';

const COLORS = ['#527d79', '#975f4e', '#d5d4c7', '#455c73', '#73797c'];
const DARK = '#293b40';
const SILVER = '#b9c5c6';

/** Appearance-only keyed samples never consume the traffic simulation's random stream. */
export function passengerVariant(id: string, taxi = false): PassengerVariant {
  const sample = facadeSample(id, 'vehicle-shape');
  return taxi ? (sample < 0.5 ? 'sedan' : 'minivan') :
    (['sedan', 'hatch', 'crossover'] as const)[Math.floor(sample * 3)];
}

type ShapeKind = 'rounded' | 'tapered' | 'sharp';

function parts(body: THREE.Object3D, art: VehicleArt) {
  const rbox = art.roundedBox ?? art.box;
  const alloyMat = art.alloy ?? art.palette.stone;
  const shapeFor = (kind: ShapeKind) =>
    kind === 'tapered' ? art.taperedShell : kind === 'rounded' ? rbox : art.box;
  const add = (name: string, color: string, p: Triple, size: Triple, kind: ShapeKind = 'rounded') => {
    const mesh = new THREE.Mesh(shapeFor(kind), art.vehiclePaint);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...size);
    mesh.userData.instanceColor = new THREE.Color(color);
    body.add(mesh);
    return mesh;
  };
  const glass = (name: string, p: Triple, size: Triple, kind: ShapeKind = 'sharp') => {
    const mesh = new THREE.Mesh(shapeFor(kind), art.vehicleGlass);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...size);
    body.add(mesh);
    return mesh;
  };
  const metal = (name: string, p: Triple, size: Triple, rounded = false) => {
    const mesh = new THREE.Mesh(rounded ? rbox : art.box, alloyMat);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...size);
    body.add(mesh);
    return mesh;
  };
  const surface = (name: string, mat: THREE.Material, p: Triple, size: Triple, rounded = false) => {
    const mesh = new THREE.Mesh(rounded ? rbox : art.box, mat);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...size);
    body.add(mesh);
    return mesh;
  };
  const tube = (name: string, mat: THREE.Material, p: Triple, scale: Triple, rotation: Triple = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(art.cylinder, mat);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    body.add(mesh);
    return mesh;
  };
  const licensePlate = (z: number, y: number, forward: 1 | -1) => {
    surface('License plate holder', art.palette.rubber, [0, y, z], [0.27, 0.13, 0.016]);
    surface('License plate', art.palette.cream, [0, y, z + forward * 0.007], [0.23, 0.095, 0.014]);
  };
  return { add, glass, metal, surface, tube, licensePlate, alloyMat };
}

/** Shared moving/parked passenger body; tires remain in the common grounded rig path. */
export function buildPassengerVehicle(body: THREE.Object3D, id: string, taxi: boolean, art: VehicleArt) {
  const variant = passengerVariant(id, taxi);
  body.userData.passengerVariant = variant;
  const tall = variant === 'crossover' || variant === 'minivan';
  const sedan = variant === 'sedan';
  const minivan = variant === 'minivan';
  const length = 2.7, width = 1.45, radius = tall ? 0.3 : 0.28;
  const roof = minivan ? 1.65 : tall ? 1.52 : sedan ? 1.28 : 1.38;
  const belt = tall ? 0.94 : 0.83;
  const cabinLength = sedan ? 1.42 : 1.86;
  const cabinZ = sedan ? -0.1 : -0.24;
  const cabinHeight = roof - belt;
  const color = taxi ? '#e7b94d' : COLORS[Math.floor(facadeSample(id, 'vehicle-paint') * COLORS.length)];
  const { add, glass, metal, surface, tube, licensePlate, alloyMat } = parts(body, art);

  add('Recessed chassis', DARK, [0, 0.36, 0], [width - 0.28, 0.17, 2.46]);
  // High sculpted shoulder and between-wheel sill leave actual open space around the tires.
  add('Passenger shoulder', color, [0, (belt + 0.61) / 2, 0], [width, belt - 0.61, 2.6], 'tapered');
  add('Between-wheel body', color, [0, 0.5, 0], [width - 0.04, 0.28, 1.08]);
  add('Rocker sill', DARK, [0, 0.355, 0], [width - 0.08, 0.055, 1.04]);
  for (const end of [-1, 1] as const) {
    add('Bumper', DARK, [0, 0.48, end * 1.295], [width - 0.03, 0.15, 0.085]);
  }
  add('Front splitter', DARK, [0, 0.39, 1.285], [width - 0.12, 0.05, 0.095]);
  surface('Lower air dam', art.palette.rubber, [0, 0.445, 1.334], [0.64, 0.068, 0.016]);
  add('Rear diffuser', DARK, [0, 0.395, -1.285], [width - 0.14, 0.065, 0.09]);
  tube('Exhaust tip', alloyMat, [0.38, 0.355, -1.315], [0.03, 0.065, 0.03], [Math.PI / 2, 0, 0]);

  add('Sloping hood', color, [0, belt - 0.03, 1.0], [width - 0.07, 0.15, 0.62], 'tapered');
  if (sedan) {
    add('Trunk lid', color, [0, belt + 0.025, -1.06], [width - 0.06, 0.135, 0.52], 'tapered');
    add('Trunk lip', color, [0, belt + 0.092, -1.28], [width - 0.16, 0.038, 0.07]);
  } else {
    add('Passenger hatch', color, [0, belt - 0.025, -1.25], [width - 0.08, 0.35, 0.11]);
    add('Roof spoiler', color, [0, roof + 0.02, cabinZ - cabinLength * 0.44], [width - 0.26, 0.048, 0.1]);
  }

  glass('Passenger glazing', [0, belt + cabinHeight / 2, cabinZ - cabinLength * 0.05],
    [width - 0.14, cabinHeight, cabinLength * 0.9], 'tapered');
  const frontZ = cabinZ + cabinLength * 0.44;
  const rake = Math.atan2(cabinLength * 0.15, cabinHeight);
  glass('Front windshield', [0, belt + cabinHeight / 2, frontZ],
    [width - 0.24, Math.hypot(cabinHeight, cabinLength * 0.15), 0.018])
    .rotation.x = -rake;
  for (const x of [-0.21, 0.17]) {
    const wiper = surface('Windshield wiper', art.palette.rubber,
      [x, belt + 0.026, frontZ + cabinLength * 0.072 + 0.018], [0.29, 0.014, 0.016]);
    wiper.rotation.z = -0.07;
  }

  add('Passenger roof', color, [0, roof + 0.035, cabinZ - cabinLength * 0.07],
    [width - 0.24, 0.075, cabinLength * 0.78], 'tapered');

  add('Front grille', DARK, [0, 0.67, 1.308], [0.66, 0.155, 0.048]);
  for (const dy of [-0.034, 0.012]) {
    surface('Grille slat', art.palette.rubber, [0, 0.67 + dy, 1.331], [0.58, 0.016, 0.016]);
  }
  metal('Grille trim bar', [0, 0.724, 1.332], [0.6, 0.02, 0.016]);
  metal('Grille badge plaque', [0, 0.675, 1.336], [0.075, 0.048, 0.016], true);
  licensePlate(1.334, 0.495, 1);
  licensePlate(sedan ? -1.305 : -1.298, 0.64, -1);
  metal('Rear plate garnish', [0, 0.716, sedan ? -1.308 : -1.301], [0.32, 0.018, 0.018]);

  for (const side of [-1, 1] as const) {
    for (const z of [-length * 0.32, length * 0.32]) {
      const arch = add('Open wheel arch trim', tall ? DARK : color,
        [side * (width / 2 + 0.032), radius, z], [1, radius, radius], 'sharp');
      arch.geometry = art.wheelArch;
      arch.rotation.y = side > 0 ? 0 : Math.PI;
    }
    const pillar = add('Sloping windshield pillar', color,
      [side * (width - 0.14) * 0.475, belt + cabinHeight / 2, frontZ],
      [0.042, Math.hypot(cabinHeight, cabinLength * 0.15), 0.048]);
    pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-side * (width - 0.14) * 0.05, cabinHeight, -cabinLength * 0.15).normalize());
    add('Window pillar', DARK, [side * 0.632, belt + cabinHeight / 2, -0.18],
      [0.035, cabinHeight, 0.07], 'sharp');
    add('Mirror stalk', DARK, [side * 0.716, belt + 0.055, 0.6], [0.068, 0.032, 0.055]);
    add('Door mirror', color, [side * 0.762, belt + 0.09, 0.59], [0.105, 0.088, 0.145]);
    glass('Mirror face', [side * 0.762, belt + 0.09, 0.516], [0.082, 0.066, 0.014]);
    for (const z of [0.14, -0.38]) {
      metal('Door handle', [side * 0.724, belt - 0.055, z], [0.024, 0.032, 0.145], true);
    }
    if (tall) {
      add('Rear passenger pillar', color, [side * 0.632, belt + cabinHeight / 2, -0.89],
        [0.035, cabinHeight, 0.1], 'sharp');
      metal('Roof side rail', [side * 0.47, roof + 0.092, cabinZ - 0.08],
        [0.036, 0.036, cabinLength * 0.62], true);
      for (const end of [-1, 1] as const) {
        add('Roof rail foot', DARK, [side * 0.47, roof + 0.068, cabinZ - 0.08 + end * cabinLength * 0.24],
          [0.04, 0.034, 0.068]);
      }
    }
  }
  if (taxi) {
    add('Taxi roof mount', DARK, [0, roof + 0.102, -0.17], [0.66, 0.048, 0.29]);
    metal('Taxi roof crown', [0, roof + 0.134, -0.17], [0.62, 0.024, 0.25], true);
    const sign = add('Unbranded taxi roof light', '#ffffff', [0, roof + 0.245, -0.17], [0.6, 0.19, 0.215]);
    sign.material = art.lampGlow;
    for (const side of [-1, 1] as const) {
      add('Taxi roof endcap', DARK, [side * 0.305, roof + 0.245, -0.17], [0.038, 0.17, 0.195]);
      const lettering = new THREE.Mesh(art.taxiLettering, art.palette.rubber);
      lettering.name = 'Original TAXI lettering';
      lettering.position.set(0, roof + 0.245, -0.17 + side * 0.113);
      lettering.rotation.y = side === 1 ? 0 : Math.PI;
      body.add(lettering);
    }
  }
  return { length, width, radius, lampY: 0.71, brakeY: belt + 0.04, axle: length * 0.32 };
}

/** Distinct compressed commercial silhouettes; no cargo/passenger or transit behavior is added. */
export function buildOrdinaryVehicle(body: THREE.Object3D, id: string, type: OrdinaryType, art: VehicleArt) {
  if (type === 'sedan' || type === 'taxi') return buildPassengerVehicle(body, id, type === 'taxi', art);
  const bus = type === 'bus', truck = type === 'truck';
  const length = bus ? 4.6 : truck ? 4.5 : 3.3;
  const width = bus ? 1.9 : truck ? 1.7 : 1.5;
  const radius = bus || truck ? 0.36 : 0.3;
  const half = length / 2;
  const high = facadeSample(id, 'vehicle-roof') >= 0.5;
  const top = bus ? 2.08 : truck ? 2.18 : high ? 1.98 : 1.72;
  const color = bus ? '#dddccf' : COLORS[Math.floor(facadeSample(id, 'vehicle-paint') * COLORS.length)];
  const { add, glass, metal, surface, tube, licensePlate, alloyMat } = parts(body, art);
  body.userData.commercialVariant = bus ? 'city-bus' : truck ? 'cab-forward' : high ? 'high-roof' : 'low-roof';

  add('Recessed chassis', DARK, [0, 0.42, 0], [width - 0.22, 0.22, length - 0.24]);
  add('Body shoulder', color, [0, 0.85, 0], [width - 0.04, 0.3, length - 0.1]);
  for (const end of [-1, 1] as const) {
    add('Bumper', DARK, [0, 0.48, end * (half - 0.055)], [width - 0.03, 0.17, 0.095]);
  }
  licensePlate(half - 0.018, 0.48, 1);

  if (bus) {
    glass('Bus window band', [0, 1.48, -0.05], [width - 0.1, 0.65, length - 0.26], 'rounded');
    glass('Front windshield', [0, 1.48, half - 0.044], [width - 0.2, 0.62, 0.022]);
    for (const x of [-0.34, 0.34]) {
      const wiper = surface('Windshield wiper', art.palette.rubber,
        [x, 1.205, half - 0.024], [0.36, 0.016, 0.016]);
      wiper.rotation.z = -0.05;
    }
    add('Bus roof', color, [0, top, 0], [width, 0.15, length - 0.05]);
    add('Bus lower skirt', '#527d79', [0, 0.99, 0], [width, 0.29, length - 0.08]);
    surface('Bus beltline stripe', art.palette.cream, [0, 1.148, 0], [width + 0.012, 0.042, length - 0.12]);
    for (const z of [-1.6, -0.7, 0.2, 1.1]) {
      add('Bus window pillar', color, [0, 1.5, z], [width - 0.03, 0.7, 0.07]);
    }
    // In this +Z-forward rig local -X is the curb/right side.
    for (const z of [1.64, -0.55]) {
      add('Curbside passenger door frame', DARK, [-width / 2 + 0.004, 1.08, z], [0.034, 1.34, 0.54]);
      for (const leaf of [-0.11, 0.11]) {
        glass('Curbside passenger door', [-width / 2 - 0.016, 1.14, z + leaf], [0.02, 1.16, 0.2]);
      }
      metal('Passenger door divider', [-width / 2 - 0.028, 1.14, z], [0.016, 1.18, 0.028]);
      metal('Passenger door threshold', [-width / 2 - 0.012, 0.42, z], [0.04, 0.045, 0.5]);
    }
    add('Bus rear ventilation grille', DARK, [0, 1.01, -half + 0.026], [1.16, 0.32, 0.03]);
    for (const dy of [-0.08, 0, 0.08]) {
      metal('Rear engine louver', [0, 1.01 + dy, -half + 0.008], [1.04, 0.02, 0.014]);
    }
    licensePlate(-half + 0.018, 0.62, -1);
    tube('Exhaust tip', alloyMat, [0.58, 0.36, -half + 0.035], [0.038, 0.07, 0.038], [Math.PI / 2, 0, 0]);
    for (const [z, podLen] of [[0.72, 0.92], [-0.74, 1.14]] as const) {
      add('Bus roof equipment', SILVER, [0, top + 0.135, z], [1.08, 0.15, podLen]);
      surface('Roof AC louver', art.palette.rubber, [0, top + 0.214, z], [0.76, 0.016, podLen * 0.68]);
    }
    add('Front header', DARK, [0, 1.93, half - 0.042], [width - 0.08, 0.17, 0.08]);
    surface('Destination board', art.lampGlow, [0, 1.93, half + 0.001], [width * 0.56, 0.09, 0.014]);
  } else {
    const cargoFront = truck ? half - 1.38 : half - 1.04;
    const cargoRear = -half + 0.11;
    const cargoLength = cargoFront - cargoRear;
    const cargoZ = (cargoFront + cargoRear) / 2;
    const cabTop = truck ? 1.73 : 1.56;
    const cabFront = half - (truck ? 0.08 : 0.31);
    const cabBack = cargoFront + (truck ? 0.1 : 0.015);
    const cabLength = cabFront - cabBack;
    const cabMid = (cabFront + cabBack) / 2;

    add(truck ? 'Separate cargo box' : 'Opaque cargo compartment', truck ? '#dfded2' : color,
      [0, (top + 0.72) / 2, cargoZ], [width, top - 0.72, cargoLength]);
    add('Commercial cab', color, [0, 0.92, cabMid],
      [width - 0.14, 0.43, cabLength], truck ? 'rounded' : 'tapered');
    glass('Cab glazing', [0, 1.38, cabMid - 0.04],
      [width - 0.24, 0.45, cabLength - 0.14], truck ? 'rounded' : 'tapered');
    const wsZ = cabFront - (truck ? 0 : cabLength * 0.06);
    glass('Front windshield', [0, 1.38, wsZ],
      [width - 0.28, 0.46, 0.025]).rotation.x = truck ? -0.04 : -0.24;
    for (const x of [-0.24, 0.22]) {
      const wiper = surface('Windshield wiper', art.palette.rubber,
        [x, 1.175, wsZ + (truck ? 0.018 : 0.055)], [0.28, 0.014, 0.016]);
      wiper.rotation.z = -0.06;
    }
    add('Cab roof', color, [0, cabTop, cabMid - 0.05],
      [width - 0.12, 0.1, cabLength - 0.14], truck ? 'rounded' : 'tapered');
    if (!truck) add('Short sloping nose', color, [0, 1.02, half - 0.18], [width - 0.15, 0.22, 0.3], 'tapered');
    add('Front grille', DARK, [0, 0.92, half - 0.032], [width * 0.5, 0.21, 0.044]);
    for (const dy of [-0.045, 0.005, 0.055]) {
      metal('Grille slat', [0, 0.92 + dy, half - 0.007], [width * 0.43, 0.018, 0.014]);
    }
    metal('Grille badge plaque', [0, 0.925, half - 0.002], [0.08, 0.05, 0.016], true);

    if (truck) {
      for (const side of [-1, 1] as const) {
        for (const y of [0.95, 1.42, 1.88]) {
          metal('Cargo side rib', [side * (width / 2 + 0.006), y, cargoZ], [0.02, 0.038, cargoLength - 0.08]);
        }
        metal('Cab entry step', [side * (width / 2 - 0.04), 0.47, cabMid + 0.06], [0.09, 0.04, 0.36], true);
        surface('Rear mudflap', art.palette.rubber,
          [side * (width / 2 - 0.12), 0.29, -length * 0.32 - radius - 0.06], [0.22, 0.3, 0.02]);
      }
      add('Rear roll-up surround', DARK, [0, 1.43, cargoRear - 0.008], [width - 0.12, 1.28, 0.028]);
      add('Rear roll-up door', SILVER, [0, 1.43, cargoRear - 0.028], [width - 0.23, 1.18, 0.024], 'sharp');
      for (const y of [0.99, 1.22, 1.45, 1.68, 1.91]) {
        add('Roll-up seam', DARK, [0, y, cargoRear - 0.043], [width - 0.27, 0.015, 0.014], 'sharp');
      }
      metal('Roll-up latch', [0, 0.91, cargoRear - 0.048], [0.26, 0.045, 0.024], true);
    } else {
      for (const side of [-1, 1] as const) {
        add('Rear cargo door', color, [side * 0.36, 1.21, cargoRear - 0.016], [0.68, 0.94, 0.028]);
        metal('Cab door handle', [side * (width / 2 - 0.055), 1.06, cabMid - 0.1], [0.024, 0.032, 0.14], true);
      }
      add('Rear double-door seam', DARK, [0, 1.26, cargoRear - 0.034], [0.025, top - 0.79, 0.018], 'sharp');
      metal('Rear cargo latch', [0.08, 1.17, cargoRear - 0.047], [0.05, 0.16, 0.022], true);
      add('Sliding-door track', DARK, [-width / 2 - 0.006, 1.46, cargoZ + 0.25], [0.022, 0.028, 1.12]);
      metal('Sliding-door handle', [-width / 2 - 0.008, 1.08, cargoFront - 0.72], [0.024, 0.034, 0.15], true);
      add('Sliding-door seam', DARK, [-width / 2 - 0.006, 1.21, cargoFront - 0.87],
        [0.02, 0.86, 0.02], 'sharp');
    }
    metal('Rear loading step', [0, 0.45, -half + 0.04], [width - 0.14, 0.095, 0.15], true);
    surface('Rear step tread', art.palette.rubber, [0, 0.502, -half + 0.04], [width - 0.2, 0.016, 0.12]);
    licensePlate(-half + 0.018, 0.62, -1);
    tube('Exhaust tip', alloyMat, [0.46, 0.35, -half + 0.04], [0.032, 0.065, 0.032], [Math.PI / 2, 0, 0]);
  }
  for (const side of [-1, 1] as const) {
    const mirrorOut = side * (width / 2 + 0.01);
    add('Mirror arm', DARK, [side * (width / 2 - 0.012), 1.4, half - 0.24], [0.056, 0.032, 0.05]);
    add('Door mirror', DARK, [mirrorOut, 1.43, half - 0.25], [0.056, 0.175, 0.145]);
    glass('Mirror face', [mirrorOut, 1.43, half - 0.325], [0.044, 0.145, 0.014]);
  }
  return { length, width, radius, lampY: bus ? 0.78 : 0.77, brakeY: top - 0.13,
    axle: length * (bus ? 0.29 : 0.32) };
}
