import { BIKE_SHARE_POCKETS } from '../content/bikeShare';
import type * as THREE from 'three';
import type { StreetBuilding, StreetscapeBuilder } from './streetscape';

export type BuildingFace = 'west' | 'east' | 'north' | 'south';
export const PARTY_WALL_JOINT = 0.06;
/** Retain the diagonal view into the east-south stairwell, as well as actual bicycle access. */
export const STREET_WALL_OPENINGS = [
  ...Object.values(BIKE_SHARE_POCKETS),
  { minX: 83.8, maxX: 94.2, minZ: 62, maxZ: 68 },
];

/** A construction joint, not a pedestrian alley; civic pockets keep their original openings. */
export function closeStreetWallGaps(buildings: StreetBuilding[]): void {
  for (const building of buildings) {
    const axis = building.front.axis === 'x' ? 'z' : 'x';
    const across = axis === 'x' ? 'z' : 'x';
    const size = axis === 'x' ? 'width' : 'depth';
    const snapshot = building.plantingFootprint;
    const neighbor = buildings.filter((other) =>
      other !== building && other.blockId === building.blockId &&
      other.front.axis === building.front.axis &&
      Math.abs(other.plantingFootprint[across] - snapshot[across]) < 1 &&
      other.plantingFootprint[axis] > snapshot[axis])
      .sort((a, b) => a.plantingFootprint[axis] - b.plantingFootprint[axis])[0];
    if (!neighbor) continue;
    const end = snapshot[axis] + snapshot[size] / 2;
    const start = neighbor.plantingFootprint[axis] - neighbor.plantingFootprint[size] / 2;
    // The larger breaks contain the existing planted plazas and subway approaches.
    if (start - end > 8 || start <= end) continue;
    if (STREET_WALL_OPENINGS.some((pocket) =>
      axis === 'z'
        ? pocket.minZ < start && pocket.maxZ > end &&
          pocket.minX < building.x + building.width / 2 && pocket.maxX > building.x - building.width / 2
        : pocket.minX < start && pocket.maxX > end &&
          pocket.minZ < building.z + building.depth / 2 && pocket.maxZ > building.z - building.depth / 2)) continue;
    const joint = (end + start) / 2;
    const lower = building[axis] - building[size] / 2;
    const upper = neighbor[axis] + neighbor[size] / 2;
    building[size] = joint - PARTY_WALL_JOINT / 2 - lower;
    building[axis] = (lower + joint - PARTY_WALL_JOINT / 2) / 2;
    neighbor[size] = upper - joint - PARTY_WALL_JOINT / 2;
    neighbor[axis] = (upper + joint + PARTY_WALL_JOINT / 2) / 2;
    building.attached.push(axis === 'x' ? 'east' : 'south');
    neighbor.attached.push(axis === 'x' ? 'west' : 'north');
  }
  for (const building of buildings) {
    building.reservedWidth = building.width;
    building.reservedDepth = building.depth;
  }
}

/** Map facade-local horizontal/outward coordinates to the street-facing elevation. */
export function buildingFrontPoint(building: StreetBuilding, along: number, outward: number) {
  const { axis, side } = building.front;
  return axis === 'x'
    ? { x: building.x + side * (building.width / 2 + outward), z: building.z - side * along }
    : { x: building.x + along, z: building.z + building.depth / 2 + outward };
}

export function buildingFrontSpan(building: StreetBuilding): number {
  return building.front.axis === 'x' ? building.depth : building.width;
}

export function faceName(axis: 'x' | 'z', side: number): BuildingFace {
  return axis === 'x' ? (side < 0 ? 'west' : 'east') : (side < 0 ? 'north' : 'south');
}

/** Original shallow shop displays and office lobbies, using only the scene's shared boxes. */
export function buildCommercialFront(
  building: StreetBuilding,
  p: StreetscapeBuilder['palette'],
  piece: (surface: THREE.Material, along: number, y: number, outward: number,
    width: number, height: number, depth: number) => void,
): void {
  const span = buildingFrontSpan(building);
  const shop = building.storefront;
  const accent = shop === 'market' ? p.teal : shop === 'books' ? p.copperEdge : p.clay;
  for (const side of [-1, 1]) {
    const outer = span / 2 - (shop && side < 0 ? 1.2 : 0.4);
    const bayWidth = outer - 0.65;
    const along = side * (0.65 + bayWidth / 2);
    piece(p.glass, along, 1.23, 0.04, bayWidth, 1.9, 0.06);
    piece(p.paving, along, 0.22, 0.1, bayWidth, 0.22, 0.2);
    piece(p.rubber, along, 2.04, 0.09, bayWidth, 0.055, 0.06);
    if (shop) {
      piece(p.wood, along, 0.72, 0.11, bayWidth - 0.16, 0.09, 0.24);
      for (let item = 0; item < 3; item++) {
        const u = along + (item - 1) * (bayWidth - 0.4) / 3;
        piece(shop === 'market' ? p.taxi : item % 2 ? p.clay : p.cream,
          u, shop === 'books' ? 1.02 : 0.88, 0.12, shop === 'books' ? 0.16 : 0.3,
          shop === 'books' ? 0.5 : 0.24, 0.16);
      }
    }
  }
  if (shop) {
    // Separate street access to the upper floors, beside rather than through the shop.
    piece(p.glass, -span / 2 + 0.55, 1.06, 0.05, 0.65, 1.85, 0.06);
    piece(p.paving, -span / 2 + 0.55, 2.12, 0.1, 0.9, 0.16, 0.2);
  }
  piece(shop ? accent : p.stone, 0, 2.42, 0.1, span - 0.12, 0.32, 0.2);
  // Canopies stay above head height and inside the lot, not in the walking channel.
  piece(shop ? accent : p.paving, 0, 2.68, 0.27, span - 0.15, 0.12, shop ? 0.85 : 0.65);
  if (shop) {
    piece(accent, 0, 2.55, 0.68, span - 0.15, 0.2, 0.045);
    const stripes = Math.floor(span / 0.8);
    for (let stripe = 0; stripe < stripes; stripe++) {
      piece(p.cream, (stripe - (stripes - 1) / 2) * 0.8, 2.746, 0.27, 0.25, 0.012, 0.82);
    }
  } else {
    piece(p.rubber, 0, 1.1, 0.1, 0.055, 1.85, 0.05);
    for (const side of [-1, 1]) {
      piece(p.stone, side * (span / 2 - 0.18), 1.4, 0.11, 0.26, 2.8, 0.22);
    }
  }
}
