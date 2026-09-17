import type * as THREE from 'three';
import type { CivicService } from '../content/civicServices';
import { buildingFrontSpan } from './buildingFabric';
import { buildSignLettering } from './signLettering';
import type { StreetBuilding, StreetscapeBuilder } from './streetscape';

/** Three original civic conversions with closed scenic doors, not simulated interiors. */
export function buildCivicFront(
  building: StreetBuilding,
  service: CivicService,
  p: StreetscapeBuilder['palette'],
  piece: (surface: THREE.Material, along: number, y: number, outward: number,
    width: number, height: number, depth: number) => void,
  rod: (surface: THREE.Material, from: readonly [number, number, number],
    to: readonly [number, number, number], thickness: number) => void,
): void {
  const span = buildingFrontSpan(building);
  const fire = service.kind === 'fire-station';
  const hospital = service.kind === 'hospital';
  const entry = service.entry.along;
  const doorWidth = service.entry.width;
  const signY = fire ? 2.72 : 2.47;
  piece(fire ? p.clay : p.teal, 0, signY, 0.1, span - 0.12, fire ? 0.26 : 0.38, 0.24);
  piece(p.glass, entry, 1.15, -0.12, doorWidth, 2.06, 0.06);
  piece(p.stone, entry, 0.07, -0.02, doorWidth + 0.2, 0.1, 0.36);
  for (const side of [-1, 1]) {
    piece(p.stone, entry + side * (doorWidth / 2 + 0.13), 1.2, 0.03, 0.16, 2.3, 0.28);
  }
  piece(p.stone, entry, 2.29, 0.04, doorWidth + 0.42, 0.16, 0.28);
  if (hospital) {
    piece(p.rubber, entry, 1.15, -0.08, 0.065, 2.06, 0.045);
    piece(p.paving, entry, 2.76, 0.26, doorWidth + 1.1, 0.12, 0.82);
    const symbolAlong = -span / 2 + 0.85;
    piece(p.teal, symbolAlong, signY, 0.26, 1.1, 0.7, 0.04);
    const pulse = [[-0.44, 0], [-0.2, 0], [-0.07, 0.21], [0.1, -0.18], [0.22, 0], [0.44, 0]] as const;
    for (let index = 1; index < pulse.length; index++) {
      const from = pulse[index - 1];
      const to = pulse[index];
      rod(p.line, [symbolAlong + from[0], signY + from[1], 0.3],
        [symbolAlong + to[0], signY + to[1], 0.3], 0.04);
    }
    for (const side of [-1, 1]) {
      const bayWidth = Math.max(0.6, span / 2 - doorWidth / 2 - 0.7);
      const along = side * (doorWidth / 2 + 0.45 + bayWidth / 2);
      piece(p.glass, along, 1.35, 0.04, bayWidth, 1.65, 0.06);
      piece(p.stone, along, 0.41, 0.08, bayWidth, 0.22, 0.2);
      piece(p.paving, along, 1.75, 0.08, bayWidth, 0.08, 0.04);
    }
  } else if (fire) {
    const garageWidth = Math.min(4.4, span * 0.48);
    const garageAlong = -span * 0.2;
    piece(p.roof, garageAlong, 1.36, -0.1, garageWidth, 2.42, 0.08);
    for (let panel = 0; panel < 8; panel++) {
      piece(p.paving, garageAlong, 0.32 + panel * 0.28, -0.045, garageWidth - 0.12, 0.035, 0.03);
    }
    for (const side of [-1, 1]) {
      piece(p.stone, garageAlong + side * (garageWidth / 2 + 0.12), 1.4, 0.06, 0.2, 2.7, 0.3);
    }
    piece(p.stone, garageAlong, 2.61, 0.05, garageWidth + 0.4, 0.18, 0.3);
    piece(p.paving, garageAlong, 0.05, -0.02, garageWidth + 0.35, 0.08, 0.34);
  } else {
    piece(p.paving, entry, 2.73, 0.24, doorWidth + 0.8, 0.12, 0.72);
    for (const side of [-1, 1]) {
      const along = entry + side * (doorWidth / 2 + 0.43);
      piece(p.roof, along, 1.8, 0.1, 0.16, 0.36, 0.16);
      piece(p.cream, along, 1.83, 0.2, 0.12, 0.21, 0.12);
      piece(p.glass, side * span * 0.32, 1.45, 0.04, span * 0.18, 1.4, 0.06);
    }
  }
  const text = buildSignLettering(service.label.toUpperCase(), Math.min(span - 0.6, 8.5), fire ? 0.18 : 0.24);
  const vertices = text.getAttribute('position');
  for (let index = 0; index < vertices.count; index += 4) {
    const ax = (vertices.getX(index) + vertices.getX(index + 3)) / 2;
    const ay = (vertices.getY(index) + vertices.getY(index + 3)) / 2;
    const bx = (vertices.getX(index + 1) + vertices.getX(index + 2)) / 2;
    const by = (vertices.getY(index + 1) + vertices.getY(index + 2)) / 2;
    const thickness = Math.hypot(vertices.getX(index) - vertices.getX(index + 3),
      vertices.getY(index) - vertices.getY(index + 3));
    rod(p.line, [ax, signY + ay, 0.232], [bx, signY + by, 0.232], thickness);
  }
  text.dispose();
}
