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

function parts(body: THREE.Object3D, art: VehicleArt) {
  const add = (name: string, color: string, p: Triple, size: Triple, tapered = false) => {
    const mesh = new THREE.Mesh(tapered ? art.taperedShell : art.box, art.vehiclePaint);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...size);
    mesh.userData.instanceColor = new THREE.Color(color);
    body.add(mesh);
    return mesh;
  };
  const glass = (name: string, p: Triple, size: Triple, tapered = false) => {
    const mesh = add(name, '#ffffff', p, size, tapered);
    mesh.material = art.vehicleGlass;
    return mesh;
  };
  return { add, glass };
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
  const { add, glass } = parts(body, art);
  add('Recessed chassis', DARK, [0, 0.36, 0], [width - 0.3, 0.17, 2.48]);
  // A high shoulder and short center sill leave actual open space around the tires.
  add('Passenger shoulder', color, [0, (belt + 0.62) / 2, 0], [width, belt - 0.62, 2.6], true);
  add('Between-wheel body', color, [0, 0.5, 0], [width - 0.05, 0.28, 1.08]);
  for (const end of [-1, 1]) {
    add('Bumper', DARK, [0, 0.48, end * 1.315], [width - 0.04, 0.14, 0.07]);
  }
  add('Sloping hood', color, [0, belt - 0.03, 1.01], [width - 0.08, 0.15, 0.6], true);
  if (sedan) add('Trunk lid', color, [0, belt + 0.025, -1.07], [width - 0.06, 0.13, 0.5], true);
  else add('Passenger hatch', color, [0, belt - 0.04, -1.28], [width - 0.1, 0.32, 0.06]);
  glass('Passenger glazing', [0, belt + cabinHeight / 2, cabinZ],
    [width - 0.14, cabinHeight, cabinLength], true);
  // The front plane follows the shared taper; its existing rear face forms the sloping backlight.
  const frontZ = cabinZ + cabinLength * 0.42;
  glass('Front windshield', [0, belt + cabinHeight / 2, frontZ + 0.008],
    [width - 0.25, Math.hypot(cabinHeight, cabinLength * 0.16), 0.015])
    .rotation.x = -Math.atan2(cabinLength * 0.16, cabinHeight);
  add('Passenger roof', color, [0, roof + 0.035, cabinZ - cabinLength * 0.06],
    [width - 0.25, 0.07, cabinLength * 0.8], true);
  add('Front grille', DARK, [0, 0.67, 1.314], [0.64, 0.15, 0.04]);
  for (const side of [-1, 1]) {
    for (const z of [-length * 0.32, length * 0.32]) {
      const arch = add('Open wheel arch trim', tall ? DARK : color,
        [side * (width / 2 + 0.032), radius, z], [1, radius, radius]);
      arch.geometry = art.wheelArch;
      arch.rotation.y = side > 0 ? 0 : Math.PI;
    }
    const pillar = add('Sloping windshield pillar', color,
      [side * (width - 0.14) * 0.475, belt + cabinHeight / 2, frontZ + 0.008],
      [0.04, Math.hypot(cabinHeight, cabinLength * 0.16), 0.045]);
    pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-side * (width - 0.14) * 0.05, cabinHeight, -cabinLength * 0.16).normalize());
    add('Window pillar', DARK, [side * 0.632, belt + cabinHeight / 2, -0.18],
      [0.035, cabinHeight, 0.07]);
    add('Door mirror', DARK, [side * 0.765, belt + 0.095, 0.61], [0.11, 0.1, 0.17]);
    add('Door handle', SILVER, [side * 0.72, belt - 0.06, 0.04], [0.022, 0.035, 0.16]);
    if (tall) add('Rear passenger pillar', color, [side * 0.632, belt + cabinHeight / 2, -0.89],
      [0.035, cabinHeight, 0.1]);
  }
  if (taxi) {
    add('Taxi roof mount', DARK, [0, roof + 0.12, -0.17], [0.63, 0.06, 0.27]);
    const sign = add('Unbranded taxi roof light', '#ffffff', [0, roof + 0.245, -0.17], [0.6, 0.19, 0.22]);
    sign.material = art.lampGlow;
    for (const side of [-1, 1]) {
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
  const { add, glass } = parts(body, art);
  body.userData.commercialVariant = bus ? 'city-bus' : truck ? 'cab-forward' : high ? 'high-roof' : 'low-roof';
  add('Recessed chassis', DARK, [0, 0.42, 0], [width - 0.22, 0.22, length - 0.24]);
  add('Body shoulder', color, [0, 0.85, 0], [width - 0.05, 0.3, length - 0.12]);
  for (const end of [-1, 1]) add('Bumper', DARK, [0, 0.48, end * (half - 0.045)], [width - 0.04, 0.17, 0.1]);
  if (bus) {
    glass('Bus window band', [0, 1.48, 0], [width - 0.12, 0.65, length - 0.16]);
    glass('Front windshield', [0, 1.48, half - 0.044], [width - 0.2, 0.62, 0.02]);
    add('Bus roof', color, [0, top, 0], [width, 0.14, length - 0.06]);
    add('Bus lower skirt', '#527d79', [0, 0.99, 0], [width, 0.28, length - 0.1]);
    for (const z of [-1.6, -0.7, 0.2, 1.1]) {
      add('Bus window pillar', color, [0, 1.5, z], [width - 0.04, 0.7, 0.07]);
    }
    // In this +Z-forward rig local -X is the curb/right side.
    for (const z of [1.64, -0.55]) {
      add('Curbside passenger door frame', DARK, [-width / 2, 1.08, z], [0.03, 1.34, 0.53]);
      glass('Curbside passenger door', [-width / 2 - 0.02, 1.14, z], [0.02, 1.16, 0.44]);
      add('Passenger door divider', SILVER, [-width / 2 - 0.034, 1.14, z], [0.015, 1.18, 0.028]);
    }
    add('Bus rear ventilation grille', DARK, [0, 1.01, -half + 0.024], [1.15, 0.31, 0.025]);
    add('Bus roof equipment', SILVER, [0, top + 0.14, -0.56], [1.06, 0.16, 1.08]);
    add('Front header', DARK, [0, 1.94, half - 0.024], [width - 0.12, 0.14, 0.03]);
  } else {
    const cargoFront = truck ? half - 1.38 : half - 1.04;
    const cargoRear = -half + 0.11;
    const cargoLength = cargoFront - cargoRear;
    const cargoZ = (cargoFront + cargoRear) / 2;
    const cabTop = truck ? 1.73 : 1.56;
    const cabFront = half - (truck ? 0.08 : 0.31);
    const cabBack = cargoFront + (truck ? 0.1 : 0.015);
    const cabLength = cabFront - cabBack;
    add(truck ? 'Separate cargo box' : 'Opaque cargo compartment', truck ? '#dfded2' : color,
      [0, (top + 0.72) / 2, cargoZ], [width, top - 0.72, cargoLength]);
    add('Commercial cab', color, [0, 0.92, (cabFront + cabBack) / 2],
      [width - 0.15, 0.42, cabLength], !truck);
    glass('Cab glazing', [0, 1.38, (cabFront + cabBack) / 2],
      [width - 0.24, 0.45, cabLength - 0.03], !truck);
    glass('Front windshield', [0, 1.38, cabFront - (truck ? 0 : cabLength * 0.08)],
      [width - 0.28, 0.46, 0.025]).rotation.x = truck ? -0.04 : -0.24;
    add('Cab roof', color, [0, cabTop, (cabFront + cabBack) / 2 - 0.04],
      [width - 0.12, 0.1, cabLength - 0.08], !truck);
    if (!truck) add('Short sloping nose', color, [0, 1.02, half - 0.18], [width - 0.16, 0.22, 0.29], true);
    add('Front grille', DARK, [0, 0.92, half - 0.025], [width * 0.48, 0.2, 0.035]);
    if (truck) {
      add('Rear roll-up surround', DARK, [0, 1.43, cargoRear - 0.01], [width - 0.12, 1.28, 0.025]);
      add('Rear roll-up door', SILVER, [0, 1.43, cargoRear - 0.03], [width - 0.23, 1.18, 0.02]);
      for (const y of [0.99, 1.22, 1.45, 1.68, 1.91]) {
        add('Roll-up seam', DARK, [0, y, cargoRear - 0.044], [width - 0.27, 0.015, 0.01]);
      }
    } else {
      for (const side of [-1, 1]) {
        add('Rear cargo door', color, [side * 0.36, 1.21, cargoRear - 0.016], [0.68, 0.94, 0.025]);
      }
      add('Rear double-door seam', DARK, [0, 1.26, cargoRear - 0.034], [0.025, top - 0.79, 0.018]);
      add('Rear cargo latch', SILVER, [0.08, 1.17, cargoRear - 0.047], [0.05, 0.16, 0.02]);
      add('Sliding-door track', DARK, [-width / 2 - 0.01, 1.46, cargoZ + 0.25], [0.018, 0.025, 1.1]);
      add('Sliding-door seam', DARK, [-width / 2 - 0.01, 1.21, cargoFront - 0.87],
        [0.018, 0.86, 0.02]);
    }
    add('Rear loading step', SILVER, [0, 0.45, -half + 0.035], [width - 0.16, 0.1, 0.15]);
  }
  for (const side of [-1, 1]) {
    add('Door mirror', DARK, [side * (width / 2 + 0.005), 1.42, half - 0.25], [0.08, 0.17, 0.16]);
  }
  return { length, width, radius, lampY: bus ? 0.78 : 0.77, brakeY: top - 0.13,
    axle: length * (bus ? 0.29 : 0.32) };
}
