import * as THREE from 'three';
import type { TrafficVehicleType } from '../content/streets';
import type { VehicleArt } from './vehicle';

type EmergencyType = 'policeSuv' | 'ambulanceBox' | 'ambulanceVan' | 'firetruck' | 'fireSuv';
type Triple = readonly [number, number, number];

const SHAPES = {
  policeSuv: { length: 2.7, width: 1.6, radius: 0.3, lampY: 0.69 },
  fireSuv: { length: 2.7, width: 1.6, radius: 0.3, lampY: 0.69 },
  ambulanceBox: { length: 4.5, width: 1.76, radius: 0.34, lampY: 0.75 },
  ambulanceVan: { length: 3.4, width: 1.55, radius: 0.3, lampY: 0.75 },
  firetruck: { length: 4.5, width: 1.76, radius: 0.38, lampY: 0.79 },
} as const;

const PAINT = {
  white: '#e9eeec', red: '#b93632', blue: '#245a91', dark: '#26363d',
  silver: '#b9c5c6', yellow: '#eac16b', hose: '#958477',
} as const;

/** Narrow the ordinary traffic type without changing routes or service behavior. */
export function isEmergencyVehicle(type: TrafficVehicleType | undefined): type is EmergencyType {
  return type !== undefined && Object.hasOwn(SHAPES, type);
}

/**
 * Original service bodywork, borrowing scene-owned primitives and the existing tint batch.
 * Shapes are compressed miniature proportions, not full-scale fleet specifications.
 */
export function buildEmergencyVehicle(body: THREE.Object3D, type: EmergencyType, art: VehicleArt) {
  const shape = SHAPES[type];
  const { length, width } = shape;
  const half = length / 2;
  const suv = type === 'policeSuv' || type === 'fireSuv';
  const police = type === 'policeSuv';
  const engine = type === 'firetruck';
  const boxAmbulance = type === 'ambulanceBox';
  const paint = police ? PAINT.white : PAINT.red;
  const add = (name: string, color: string, p: Triple, size: Triple) => {
    const mesh = new THREE.Mesh(art.box, art.vehiclePaint);
    mesh.name = name;
    mesh.position.set(...p);
    mesh.scale.set(...size);
    mesh.userData.instanceColor = new THREE.Color(color);
    body.add(mesh);
    return mesh;
  };
  const glass = (name: string, p: Triple, size: Triple, tilt = 0) => {
    const mesh = add(name, PAINT.white, p, size);
    mesh.material = art.vehicleGlass;
    mesh.rotation.x = tilt;
    return mesh;
  };
  const beacon = (p: Triple, size: Triple, blue = false) => {
    const mesh = add('Emergency beacon', PAINT.white, p, size);
    mesh.material = blue ? art.beaconBlue : art.beaconRed;
  };
  const lightbar = (y: number, z: number) => {
    add('Lightbar mounting bridge', PAINT.dark, [0, y, z], [width * 0.74, 0.05, 0.2]);
    for (const side of [-1, 1]) beacon([side * width * 0.24, y + 0.07, z],
      [width * 0.24, 0.1, 0.17], police && side > 0);
    add('Lightbar center divider', PAINT.silver, [0, y + 0.06, z], [width * 0.2, 0.07, 0.17]);
  };
  const mirror = (side: number, y: number, z: number, cabWidth: number) => {
    add('Mirror arm', PAINT.dark, [side * (cabWidth / 2 + 0.045), y, z], [0.13, 0.045, 0.07]);
    add('Door mirror', PAINT.dark, [side * (cabWidth / 2 + 0.07), y + 0.045, z], [0.07, 0.13, 0.13]);
  };
  const grille = (y: number, w: number) => {
    add('Front grille', PAINT.dark, [0, y, half - 0.025], [w, 0.27, 0.035]);
    for (const offset of [-0.075, 0.075]) {
      add('Grille slat', PAINT.silver, [0, y + offset, half - 0.003], [w * 0.94, 0.026, 0.016]);
    }
  };
  const medical = (side: number, y: number, z: number) => {
    for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
      add('Medical identifier', PAINT.blue, [side * (width / 2 + 0.011), y, z],
        [0.016, 0.36, 0.095]).rotation.x = angle;
    }
  };
  const rearDoors = (top: number, rear: number) => {
    add('Rear door surround', PAINT.dark, [0, (top + 0.57) / 2, rear], [width - 0.2, top - 0.57, 0.045]);
    for (const side of [-1, 1]) {
      const x = side * (width - 0.23) / 4;
      add('Rear patient door', PAINT.white, [x, (top + 0.6) / 2, rear - 0.028],
        [(width - 0.27) / 2, top - 0.64, 0.025]);
      glass('Rear patient window', [x, top - 0.35, rear - 0.047], [(width - 0.5) / 2, 0.39, 0.018]);
      add('Rear door red band', PAINT.red, [x, 1.03, rear - 0.047], [(width - 0.27) / 2, 0.24, 0.018]);
      add('Rear door handle', PAINT.dark, [side * 0.08, 1.32, rear - 0.055], [0.035, 0.15, 0.025]);
      beacon([side * (width / 2 - 0.13), top - 0.16, rear - 0.04], [0.12, 0.17, 0.025]);
    }
    add('Rear access step', PAINT.silver, [0, 0.4, rear - 0.035], [width - 0.12, 0.12, 0.17]);
  };

  add('Underbody', PAINT.dark, [0, 0.38, 0], [width - 0.22, 0.22, length - 0.22]);
  add('Lower body', paint, [0, 0.76, 0], [width - 0.06, 0.56, length - 0.14]);
  add('Front bumper', engine ? PAINT.silver : PAINT.dark, [0, 0.49, half - 0.055], [width - 0.02, 0.16, 0.13]);
  add('Rear bumper', PAINT.silver, [0, 0.43, -half + 0.055], [width - 0.02, 0.13, 0.13]);

  if (suv) {
    add('SUV shoulder', paint, [0, 1.01, -0.05], [width - 0.12, 0.16, length - 0.3]);
    add('Hood', paint, [0, 1.06, 0.94], [width - 0.15, 0.12, 0.63]).geometry = art.taperedShell;
    glass('Cab glazing', [0, 1.33, -0.2], [width - 0.28, 0.48, 1.53]).geometry = art.taperedShell;
    glass('Front windshield', [0, 1.33, 0.46], [width - 0.4, 0.52, 0.03], -0.472);
    add('SUV roof', PAINT.white, [0, 1.6, -0.29], [width - 0.37, 0.12, 1.37]).geometry = art.taperedShell;
    glass('Rear hatch window', [0, 1.32, -0.94], [width - 0.4, 0.39, 0.035], 0.12);
    for (const side of [-1, 1]) {
      add(police ? 'Patrol blue belt' : 'Command white belt', police ? PAINT.blue : PAINT.white,
        [side * (width / 2 - 0.019), 0.85, -0.06], [0.026, 0.18, length - 0.4]);
      for (const z of [-0.7, -0.12]) {
        add('SUV window pillar', paint, [side * (width / 2 - 0.13), 1.33, z], [0.045, 0.48, 0.065]);
      }
      const pillar = add('Sloping windshield pillar', paint, [side * 0.627, 1.33, 0.46], [0.05, 0.54, 0.055]);
      pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-side * 0.066, 0.48, -0.245).normalize());
      for (const z of [-0.38, 0.28]) {
        add('Door handle', PAINT.silver, [side * (width / 2 - 0.015), 1.03, z], [0.035, 0.035, 0.17]);
      }
      add('Rocker protection', PAINT.dark, [side * (width / 2 - 0.02), 0.42, 0], [0.06, 0.09, 1.25]);
      mirror(side, 1.18, 0.5, width - 0.13);
      if (police) {
        add('Patrol push bumper', PAINT.dark, [side * 0.35, 0.69, half + 0.006], [0.055, 0.47, 0.065]);
      } else {
        add('Command roof rail', PAINT.dark, [side * 0.49, 1.7, -0.37], [0.055, 0.065, 1.05]);
      }
    }
    add('Hatch trim', police ? PAINT.blue : PAINT.white, [0, 0.98, -half + 0.052], [width - 0.14, 0.15, 0.025]);
    grille(0.78, 0.72);
    lightbar(1.73, 0.16);
  } else if (engine) {
    add('Crew cab lower shell', PAINT.red, [0, 1.03, 1.39], [width - 0.06, 0.55, 1.55]);
    glass('Cab glazing', [0, 1.57, 1.39], [width - 0.21, 0.52, 1.44]);
    glass('Front windshield', [0, 1.57, half - 0.066], [width - 0.23, 0.48, 0.025]);
    add('Split windshield mullion', PAINT.white, [0, 1.57, half - 0.04], [0.045, 0.53, 0.025]);
    add('White crew cab roof', PAINT.white, [0, 1.91, 1.39], [width - 0.04, 0.15, 1.61]);
    add('Cab rear wall', PAINT.red, [0, 1.43, 0.61], [width - 0.05, 0.89, 0.06]);
    grille(0.96, 0.84);
    for (const side of [-1, 1]) {
      add('Crew door pillar', PAINT.white, [side * (width / 2 - 0.08), 1.57, 1.31], [0.06, 0.55, 0.08]);
      glass('Crew cab window', [side * (width / 2 - 0.07), 1.57, 0.92], [0.025, 0.42, 0.44]);
      mirror(side, 1.5, 1.95, width - 0.22);
      add('Cab safety stripe', PAINT.white, [side * (width / 2 - 0.014), 1.05, 1.39], [0.02, 0.13, 1.55]);
      add('Crew access step', PAINT.silver, [side * 0.65, 0.42, 0.86], [0.41, 0.1, 0.5]);
      add('Equipment body', PAINT.red, [side * 0.66, 1.29, -1.03], [0.42, 1.03, 2.25]);
      add('Pump control panel', PAINT.silver, [side * 0.878, 1.2, 0.22], [0.016, 0.65, 0.53]);
      for (const z of [0.07, 0.32]) {
        const outlet = new THREE.Mesh(art.cylinder, art.palette.stone);
        outlet.name = 'Pump outlet';
        outlet.position.set(side * 0.881, 1.07, z);
        outlet.scale.set(0.071, 0.028, 0.071);
        outlet.rotation.z = Math.PI / 2;
        body.add(outlet);
        add('Pump gauge', PAINT.white, [side * 0.89, 1.39, z], [0.015, 0.085, 0.085]);
      }
      for (const z of [-1.65, -0.84]) {
        add('Side equipment shutter', PAINT.silver, [side * 0.879, 1.36, z], [0.02, 0.59, 0.72]);
        for (const y of [1.18, 1.36, 1.54]) {
          add('Shutter seam', PAINT.dark, [side * 0.891, y, z], [0.012, 0.013, 0.68]);
        }
      }
      add('Ground ladder rail', PAINT.silver, [side * 0.79, 1.92, -0.98], [0.065, 0.065, 2.36]);
      add('Ground ladder rail', PAINT.silver, [side * 0.52, 1.92, -0.98], [0.065, 0.065, 2.36]);
      for (const z of [-1.92, -1.46, -1, -0.54, -0.08]) {
        add('Ground ladder rung', PAINT.silver, [side * 0.655, 1.92, z], [0.28, 0.045, 0.04]);
      }
      beacon([side * 0.73, 1.93, -2.01], [0.17, 0.13, 0.17]);
    }
    add('Open hose bed', PAINT.dark, [0, 1.27, -1.03], [0.87, 0.1, 2.23]);
    for (const x of [-0.29, 0, 0.29]) {
      add('Hose load', PAINT.hose, [x, 1.43, -1.06], [0.23, 0.24, 1.98]);
    }
    add('Rear equipment panel', PAINT.red, [0, 1.22, -half + 0.06], [width - 0.08, 1.12, 0.06]);
    for (const side of [-1, 1]) for (const y of [0.9, 1.22, 1.54]) {
      add('Rear safety chevron', PAINT.yellow, [side * 0.39, y, -half + 0.019],
        [0.73, 0.115, 0.018]).rotation.z = side * 0.38;
    }
    lightbar(2.06, 1.67);
  } else {
    const top = boxAmbulance ? 2.25 : 1.94;
    const cabWidth = boxAmbulance ? width - 0.24 : width - 0.12;
    const moduleLength = length - (boxAmbulance ? 1.58 : 1.16);
    const moduleZ = -half + moduleLength / 2 + 0.1;
    add(boxAmbulance ? 'Patient module' : 'High van roof', PAINT.white,
      [0, (top + 0.66) / 2, moduleZ], [width, top - 0.66, moduleLength]);
    add('Cab shoulder', PAINT.red, [0, 1.05, half - 0.69], [cabWidth, 0.17, 1.24]);
    add('Ambulance hood', PAINT.red, [0, 1.13, half - 0.27], [cabWidth, 0.13, 0.44]);
    glass('Cab glazing', [0, 1.42, half - 0.94], [cabWidth - 0.1, 0.48, 0.54]);
    glass('Front windshield', [0, 1.43, half - 0.615], [cabWidth - 0.12, 0.44, 0.035], -0.22);
    add('Ambulance cab roof', PAINT.white, [0, 1.73, half - 0.96], [cabWidth + 0.025, 0.12, 0.66]);
    if (!boxAmbulance) add('Raised cab cap', PAINT.white, [0, 1.85, half - 1.04], [cabWidth, 0.18, 0.49]);
    for (const side of [-1, 1]) {
      add('Ambulance red belt', PAINT.red, [side * (width / 2 + 0.005), 0.96, moduleZ],
        [0.016, 0.47, moduleLength - 0.02]);
      add('Ambulance belt inset', PAINT.white, [side * (width / 2 + 0.014), 0.96, moduleZ],
        [0.009, 0.04, moduleLength - 0.1]);
      add('Module rub rail', PAINT.silver, [side * (width / 2 + 0.007), 0.67, moduleZ],
        [0.012, 0.09, moduleLength - 0.03]);
      add('Cab door pillar', PAINT.white, [side * (cabWidth / 2 - 0.015), 1.44, half - 1.2], [0.045, 0.5, 0.075]);
      add('Cab door handle', PAINT.silver, [side * (cabWidth / 2 + 0.01), 1.09, half - 1.03], [0.02, 0.035, 0.15]);
      mirror(side, 1.33, half - 0.68, cabWidth);
      medical(side, 1.65, moduleZ - 0.3);
      add('Side compartment outline', PAINT.silver, [side * (width / 2 + 0.008), 1.55, moduleZ + 0.62],
        [0.015, 0.77, boxAmbulance ? 0.54 : 0.36]);
      add('Side compartment door', PAINT.white, [side * (width / 2 + 0.014), 1.55, moduleZ + 0.62],
        [0.01, 0.71, boxAmbulance ? 0.48 : 0.3]);
      for (const z of [moduleZ - moduleLength / 2 + 0.17, moduleZ + moduleLength / 2 - 0.17]) {
        beacon([side * (width / 2 + 0.008), top - 0.14, z], [0.018, 0.12, 0.22]);
      }
    }
    add('Roof ventilation housing', PAINT.silver, [0, top + 0.065, moduleZ - 0.12], [0.6, 0.13, 0.64]);
    rearDoors(top - 0.06, -half + 0.081);
    grille(0.84, 0.73);
    lightbar(boxAmbulance ? top + 0.04 : 2.015, moduleZ + moduleLength / 2 - 0.2);
  }

  for (const side of [-1, 1]) for (const z of [-length * 0.32, length * 0.32]) {
    add('Wheel arch shadow', PAINT.dark, [side * (width / 2 - 0.06), shape.radius + 0.1, z],
      [0.033, shape.radius * 1.68, shape.radius * 2.18]);
    add('Wheel arch crown', suv ? PAINT.dark : PAINT.silver,
      [side * (width / 2 - 0.012), shape.radius * 1.98, z], [0.041, 0.065, shape.radius * 2.26]);
  }
  return shape;
}
