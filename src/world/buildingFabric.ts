import { BIKE_SHARE_POCKETS } from '../content/bikeShare';
import type * as THREE from 'three';
import type { StreetBlock, StreetBuilding, StreetscapeBuilder } from './streetscape';

export type BuildingFace = 'west' | 'east' | 'north' | 'south';
type FacadePiece = (surface: THREE.Material, along: number, y: number, outward: number,
  width: number, height: number, depth: number) => void;
type FacadeRod = (
  surface: THREE.Material,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  thickness: number,
) => void;
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
    : { x: building.x + side * along, z: building.z + side * (building.depth / 2 + outward) };
}

/** Wrap only street-adjacent exposed ends, never a mural or an attached lot line. */
export function assignBuildingCorners(buildings: StreetBuilding[], parcels: readonly StreetBlock[]): void {
  for (const building of buildings) {
    if (building.use === 'residential') continue;
    const parcel = parcels.find(({ id }) => id === building.blockId)!;
    const axis = building.front.axis === 'x' ? 'z' : 'x';
    const half = (axis === 'x' ? building.width : building.depth) / 2;
    const lower = axis === 'x' ? parcel.minX : parcel.minZ;
    const upper = axis === 'x' ? parcel.maxX : parcel.maxZ;
    for (const side of [-1, 1] as const) {
      const gap = side < 0 ? building[axis] - half - lower : upper - building[axis] - half;
      if (gap > 5 || building.attached.includes(faceName(axis, side)) ||
        (building.partyWall?.axis === axis && building.partyWall.side === side)) continue;
      building.corner = { axis, side };
      break;
    }
  }
}

export function buildingFrontSpan(building: StreetBuilding): number {
  return building.front.axis === 'x' ? building.depth : building.width;
}

export function faceName(axis: 'x' | 'z', side: number): BuildingFace {
  return axis === 'x' ? (side < 0 ? 'west' : 'east') : (side < 0 ? 'north' : 'south');
}

/** Projected metal crowns belong to street elevations, never shared lot-line walls. */
export function buildStreetCornice(
  building: StreetBuilding, p: StreetscapeBuilder['palette'], piece: FacadePiece,
): void {
  if (building.fabricType !== 'tenement' && building.fabricType !== 'metal-loft') return;
  const span = buildingFrontSpan(building);
  const top = 0.3 + building.floors * building.architecture.floorHeight;
  piece(p.rubber, 0, top - 0.08, 0.1, span - 0.12, 0.12, 0.18);
  piece(p.rubber, 0, top + 0.015, 0.175, span - 0.08, 0.075, 0.31);
  const brackets = Math.max(2, Math.floor(span / 2.4));
  for (let index = 0; index < brackets; index++) {
    const along = (index - (brackets - 1) / 2) * (span - 0.65) / brackets;
    piece(p.rubber, along, top - 0.08, 0.16, 0.14, 0.24, 0.28);
  }
  for (const side of [-1, 1]) {
    piece(p.rubber, side * (span / 2 - 0.18), top - 0.09, 0.17, 0.17, 0.29, 0.3);
  }
}

/** Original transomed market, recessed cafe, quieter bookshop and broad office lobby. */
export function buildCommercialFront(
  building: StreetBuilding,
  p: StreetscapeBuilder['palette'],
  piece: FacadePiece,
  alloy: THREE.Material = p.stone,
  rod?: FacadeRod,
): void {
  const span = buildingFrontSpan(building);
  const shop = building.storefront;
  const accent = shop === 'market' ? p.teal : shop === 'books' ? p.copperEdge : p.clay;
  const sill = shop === 'market' ? 0.48 : shop === 'books' ? 0.62 : 0.38;
  const displayHeight = 2.02 - sill;
  for (const side of [-1, 1]) {
    const outer = span / 2 - (shop && side < 0 ? 1.2 : 0.4);
    const bayWidth = outer - 0.65;
    const along = side * (0.65 + bayWidth / 2);
    piece(p.glass, along, sill + displayHeight / 2, 0.04, bayWidth, displayHeight, 0.06);
    piece(shop ? p.wood : p.stone, along, sill / 2 + 0.04, 0.08, bayWidth, sill - 0.08, 0.18);
    piece(p.glass, along, 2.16, 0.035, bayWidth, 0.22, 0.05);
    piece(p.rubber, along, 2.02, 0.09, bayWidth, 0.055, 0.06);
    if (shop) {
      if (shop === 'books') {
        for (const y of [0.9, 1.43]) {
          piece(p.wood, along, y, 0.1, bayWidth - 0.16, 0.08, 0.22);
          for (const item of [-1, 0, 1]) piece(item ? p.cream : p.clay,
            along + item * bayWidth / 4, y + 0.19, 0.11, 0.16, 0.3, 0.14);
        }
      } else {
        piece(p.wood, along, shop === 'market' ? 0.73 : 0.86, 0.11, bayWidth - 0.16, 0.09, 0.24);
        for (const item of [-1, 1]) {
          piece(shop === 'market' ? p.taxi : p.cream, along + item * bayWidth / 4,
            shop === 'market' ? 0.9 : 1, 0.12, shop === 'market' ? 0.36 : 0.16,
            0.22, 0.16);
        }
      }
    }
  }
  // The ground-floor core is cut back: this door and its side cheeks form a real shallow recess.
  const doorOut = shop === 'cafe' ? -0.16 : -0.08;
  piece(p.glass, 0, 1.06, doorOut, 0.95, 1.85, 0.06);
  if (shop) {
    piece(alloy, 0, 0.225, doorOut + 0.046, 0.86, 0.16, 0.016);
    piece(alloy, 0, 1.01, doorOut + 0.062, 0.74, 0.034, 0.024);
    piece(alloy, 0.32, 1.08, doorOut + 0.068, 0.032, 0.32, 0.032);
  } else {
    piece(alloy, 0, 0.225, doorOut + 0.046, 0.86, 0.16, 0.016);
    piece(alloy, 0, 0.96, doorOut + 0.052, 0.82, 0.03, 0.018);
    for (const side of [-1, 1]) {
      piece(alloy, side * 0.11, 1.07, doorOut + 0.066, 0.032, 0.42, 0.032);
    }
  }
  for (const side of [-1, 1]) {
    piece(shop ? p.wood : p.stone, side * 0.56, 1.18, -0.04, 0.12, 2.2, 0.32);
  }
  piece(p.stone, 0, 0.05, -0.04, 1.08, 0.08, 0.32);
  if (shop) {
    // Separate street access to the upper floors, beside rather than through the shop.
    piece(p.glass, -span / 2 + 0.55, 1.06, 0.05, 0.65, 1.85, 0.06);
    piece(alloy, -span / 2 + 0.55, 0.22, 0.096, 0.56, 0.15, 0.016);
    piece(alloy, -span / 2 + 0.73, 1.04, 0.108, 0.03, 0.24, 0.03);
    piece(p.paving, -span / 2 + 0.55, 2.12, 0.1, 0.9, 0.16, 0.2);
  }
  piece(shop ? accent : p.stone, 0, 2.42, 0.1, span - 0.12, 0.32, 0.2);
  if (shop !== 'books') {
    const canopyWidth = shop === 'market' ? span - 0.15 : shop === 'cafe' ? span * 0.62 : 2.4;
    piece(shop ? accent : p.paving, 0, 2.68, 0.27, canopyWidth, 0.12, shop ? 0.85 : 0.65);
    if (shop) {
      piece(accent, 0, 2.775, 0.17, canopyWidth - 0.04, 0.11, 0.48);
      piece(accent, 0, 2.55, 0.68, canopyWidth, 0.2, 0.045);
      piece(p.cream, 0, 2.442, 0.692, canopyWidth - 0.04, 0.032, 0.032);
      for (const side of [-1, 1]) {
        piece(alloy, side * (canopyWidth / 2 - 0.14), 2.56, 0.35, 0.034, 0.038, 0.54);
      }
    } else {
      piece(p.stone, 0, 2.755, 0.145, 2.32, 0.08, 0.34);
      piece(alloy, 0, 2.68, 0.614, 2.44, 0.085, 0.028);
      if (rod) {
        for (const side of [-1, 1]) {
          rod(alloy, [side * 0.92, 2.74, 0.5], [side * 0.92, 3.08, 0.04], 0.028);
        }
      }
    }
  } else {
    piece(alloy, 0, 2.605, 0.075, span - 0.22, 0.045, 0.12);
  }
  if (shop === 'market') {
    const stripes = Math.floor(span / 1.2);
    for (let stripe = 0; stripe < stripes; stripe++) {
      const stripeX = (stripe - (stripes - 1) / 2) * 1.2;
      piece(p.cream, stripeX, 2.746, 0.27, 0.28, 0.012, 0.82);
    }
  } else if (!shop) {
    piece(p.rubber, 0, 1.1, 0.1, 0.055, 1.85, 0.05);
    for (const side of [-1, 1]) {
      piece(p.stone, side * (span / 2 - 0.18), 1.4, 0.11, 0.26, 2.8, 0.22);
    }
  }
}
