import * as THREE from 'three';
import { BASKETBALL_COURT, PICKLEBALL_COURT } from '../content/courts';
import {
  BIKE_OFFSET, CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_HALF_WIDTH,
  SIDEWALK_OFFSET, STOP_LINE_OFFSET, STREET_X, STREET_Z, TWO_WAY_BIKE_STREETS,
  TWO_WAY_BIKE_TRACK, VEHICLE_OFFSET, bikeLaneOffset,
} from '../content/streets';

type Triple = readonly [number, number, number];
type SurfaceName = 'sand' | 'stone' | 'paving' | 'road' | 'line' | 'cream' | 'clay' |
  'teal' | 'roof' | 'copper' | 'copperEdge' | 'glass' | 'wood' | 'leaf' | 'leafLight' |
  'water' | 'bus' | 'rubber' | 'skin' | 'skinLight' | 'taxi';

/** Borrowed primitives and static batches; the scene, not this module, owns them. */
export interface StreetscapeBuilder {
  block(
    surface: THREE.Material, x: number, y: number, z: number,
    width: number, height: number, depth: number, yaw?: number,
  ): void;
  add(
    shape: THREE.BufferGeometry, surface: THREE.Material, position: Triple,
    scale: Triple, rotation?: Triple,
  ): void;
  box: THREE.BufferGeometry;
  cylinder: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
  palette: Record<SurfaceName, THREE.Material>;
}

export interface StreetscapeSignalState {
  id: string;
  phase: 'north-south' | 'east-west' | 'clearance' | 'pedestrians';
}

export interface Streetscape {
  /** Only the three dynamic lamp batches; static art is submitted to the builder. */
  group: THREE.Group;
  setSignals(states: readonly StreetscapeSignalState[]): void;
  /** Disposes owned lamps/instance buffers only, never the borrowed primitives. */
  dispose(): void;
}

export interface StreetBlock {
  id: string;
  x: number;
  z: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface StreetBuilding {
  id: string;
  blockId: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  floors: number;
  skin: 'clay' | 'cream' | 'teal' | 'stone';
  roof: 'tank' | 'garden' | 'chimneys' | 'plant';
  setbackFloors: number;
  fireEscape: boolean;
  stoop: boolean;
  brownstone: boolean;
}

const CENTER_COLUMN = Math.floor((STREET_X.length - 1) / 2);
const CENTER_ROW = Math.floor((STREET_Z.length - 1) / 2);

/** Interior parcels exclude the shared sidewalks and the retained garden block. */
export const STREET_BLOCKS: readonly StreetBlock[] = STREET_Z.slice(0, -1).flatMap((south, row) =>
  STREET_X.slice(0, -1).flatMap((west, column) => {
    if (row === CENTER_ROW && column === CENTER_COLUMN) return [];
    const east = STREET_X[column + 1];
    const north = STREET_Z[row + 1];
    return [{
      id: `block-${column}-${row}`, x: (west + east) / 2, z: (south + north) / 2,
      minX: west + SIDEWALK_HALF_WIDTH, maxX: east - SIDEWALK_HALF_WIDTH,
      minZ: south + SIDEWALK_HALF_WIDTH, maxZ: north - SIDEWALK_HALF_WIDTH,
    }];
  }),
);

const WEST_X = (STREET_X[CENTER_COLUMN - 1] + STREET_X[CENTER_COLUMN]) / 2;
const EAST_X = (STREET_X[CENTER_COLUMN + 1] + STREET_X[CENTER_COLUMN + 2]) / 2;
const NORTH_Z = (STREET_Z[CENTER_ROW - 1] + STREET_Z[CENTER_ROW]) / 2;
const SOUTH_Z = (STREET_Z[CENTER_ROW + 1] + STREET_Z[CENTER_ROW + 2]) / 2;
const PARK_HALF_X = STREET_X[CENTER_COLUMN + 1] - SIDEWALK_HALF_WIDTH;
const PARK_HALF_Z = STREET_Z[CENTER_ROW + 1] - SIDEWALK_HALF_WIDTH;
const SIDE_SCALE = PARK_HALF_Z / 98;
const CORNER_BLOCKS = {
  construction: `block-${CENTER_COLUMN - 1}-${CENTER_ROW - 1}`,
  transit: `block-${CENTER_COLUMN + 1}-${CENTER_ROW - 1}`,
  court: `block-${CENTER_COLUMN - 1}-${CENTER_ROW + 1}`,
  southeast: `block-${CENTER_COLUMN + 1}-${CENTER_ROW + 1}`,
};
const TRANSIT = { x: 63, z: -118 } as const;

/** Static entrances; Crosstown uses the existing landmark rather than a new navigation mode. */
export const SUBWAY_ENTRANCES = [
  { id: 'crosstown-entrance', x: TRANSIT.x + 2, z: TRANSIT.z + 1.1 },
  { id: 'west-entrance', x: STREET_X[CENTER_COLUMN] - SIDEWALK_HALF_WIDTH - 2.1, z: 51.5 * SIDE_SCALE },
] as const;

const SUBWAY_LETTERS = [
  ['111', '100', '111', '001', '111'],
  ['101', '101', '101', '101', '111'],
  ['110', '101', '110', '101', '110'],
  ['10001', '10001', '10101', '10101', '01010'],
  ['010', '101', '111', '101', '101'],
  ['101', '101', '010', '010', '010'],
] as const;

/** Authored silhouettes repeat architectural vocabulary, not identical towers. */
export const STREET_BUILDINGS: readonly StreetBuilding[] = (() => {
  const buildings: StreetBuilding[] = [];
  const skins = ['clay', 'cream', 'teal', 'stone'] as const;
  const roofs = ['tank', 'chimneys', 'garden', 'plant'] as const;
  const add = (
    blockId: string, x: number, z: number, width: number, depth: number,
    floors: number, accent = false,
  ) => {
    const index = buildings.length;
    const brownstone = [0, 4, 10, 14, 24, 40].includes(index);
    buildings.push({
      id: `street-building-${index + 1}`, blockId, x, z,
      width: brownstone ? Math.min(width, 8.15) : width, depth,
      floors: brownstone ? Math.min(floors, 5) : floors,
      skin: brownstone ? 'clay' : skins[index % skins.length], roof: roofs[index % roofs.length],
      setbackFloors: accent ? 2 : 0, fireEscape: index % 3 === 0,
      stoop: width > 4 && index % 2 === 0, brownstone,
    });
  };
  const frontageStep = (PARK_HALF_X * 2 - 1) / 10;
  for (const side of [-1, 1]) {
    for (let column = 0; column < 10; column++) {
      add(`block-${CENTER_COLUMN}-${CENTER_ROW + side}`, (column - 4.5) * frontageStep,
        (side < 0 ? NORTH_Z : SOUTH_Z) + (column % 2 ? -0.4 : 0),
        frontageStep - 1.4 + (column % 2) * 0.3, 7.6 + (column % 3) * 0.6,
        3 + (column * 3 + side + 1) % 5, column === 5);
    }
  }
  for (const side of [-1, 1]) {
    const parcel = STREET_BLOCKS.find(({ id }) => id === `block-${CENTER_COLUMN + side}-${CENTER_ROW}`)!;
    for (let row = 0; row < 16; row++) {
      const cluster = Math.floor(row / 4);
      add(`block-${CENTER_COLUMN + side}-${CENTER_ROW}`, (side < 0 ? WEST_X : EAST_X) + (row % 2 ? -0.3 : 0.3),
        (-76 + cluster * 51 + (row % 4 - 1.5) * 10.2) * SIDE_SCALE,
        parcel.maxX - parcel.minX - 3.2 + (row % 3) * 0.35, (7.6 + (row % 2) * 0.6) * SIDE_SCALE,
        3 + (row * 2 + side + 1) % 5, row === 6 || row === 10);
    }
  }
  add(CORNER_BLOCKS.construction, WEST_X - 4, NORTH_Z, 3.2, 9, 4);
  add(CORNER_BLOCKS.construction, WEST_X + 2.2, NORTH_Z - 4.5, 6.8, 3, 3);
  add(CORNER_BLOCKS.transit, TRANSIT.x - 3.7, TRANSIT.z - 0.5, 3.8, 9.5, 5);
  add(CORNER_BLOCKS.transit, TRANSIT.x + 2, TRANSIT.z - 5, 6.8, 3, 4);
  add(CORNER_BLOCKS.southeast, EAST_X, SOUTH_Z - 3.3, 8.5, 4.2, 4);
  add(CORNER_BLOCKS.southeast, EAST_X, SOUTH_Z + 2.7, 8.5, 4.2, 6);
  for (const parcel of STREET_BLOCKS) {
    const width = parcel.maxX - parcel.minX;
    const depth = parcel.maxZ - parcel.minZ;
    const innerColumn = parcel.minX >= STREET_X[CENTER_COLUMN - 1] &&
      parcel.maxX <= STREET_X[CENTER_COLUMN + 2];
    const innerRow = parcel.minZ >= STREET_Z[CENTER_ROW - 1] &&
      parcel.maxZ <= STREET_Z[CENTER_ROW + 2];
    if (innerColumn && innerRow) continue;
    if (depth > width * 3) {
      for (let index = 0; index < 8; index++) {
        add(parcel.id, parcel.x + (index % 2 ? 0.25 : -0.25),
          parcel.z + (index - 3.5) * depth / 8,
          width - 3.4 + (index % 2) * 0.4, 15 + (index % 2) * 0.8,
          3 + (index * 2 + Math.abs(parcel.x)) % 5);
      }
    } else if (width > depth * 3) {
      for (let index = 0; index < 4; index++) {
        add(parcel.id, parcel.x + (index - 1.5) * width / 4,
          parcel.z + (index % 2 ? -0.6 : 0.6),
          width / 4 - 4.7 + (index % 2) * 0.7, depth - 5 + (index % 2) * 0.6,
          3 + (index * 2 + Math.abs(parcel.z)) % 5);
      }
    } else {
      add(parcel.id, parcel.x, parcel.z, width - 4.2, Math.min(depth - 5.2, 14.5),
        3 + Math.round(Math.abs(parcel.x) + Math.abs(parcel.z)) % 5);
    }
  }
  return buildings;
})();

/** Fail before resource allocation if facades, cornices or stoops invade sidewalks. */
export function validateStreetscape(buildings: readonly StreetBuilding[] = STREET_BUILDINGS): void {
  const ids = new Set<string>();
  for (const building of buildings) {
    const { id, blockId, x, z, width, depth, floors, setbackFloors } = building;
    const parcel = STREET_BLOCKS.find((block) => block.id === blockId);
    if (!parcel || !id || ids.has(id) ||
      ![x, z, width, depth, floors, setbackFloors].every(Number.isFinite) ||
      typeof building.brownstone !== 'boolean' ||
      width < 3 || depth < 3 || !Number.isInteger(floors) || floors < 3 || floors > 7 ||
      !Number.isInteger(setbackFloors) || setbackFloors < 0 || setbackFloors > 2 ||
      (floors + setbackFloors) * 2.4 + 0.8 > 23 ||
      x - width / 2 - 0.4 < parcel.minX || x + width / 2 + 0.4 > parcel.maxX ||
      z - depth / 2 - 0.35 < parcel.minZ ||
      z + depth / 2 + (building.stoop ? 1.2 : 0.35) > parcel.maxZ) {
      throw new Error(`Invalid streetscape building footprint: ${id}.`);
    }
    if (buildings.some((other) => other !== building &&
      Math.abs(other.x - x) < (other.width + width) / 2 + 0.4 &&
      Math.abs(other.z - z) < (other.depth + depth) / 2 + 0.4)) {
      throw new Error(`Overlapping streetscape building: ${id}.`);
    }
    ids.add(id);
  }
}

function isBrownstone(building: StreetBuilding): boolean {
  return building.brownstone;
}

/** Segments omit crossing boxes, so curbs and bike separators never block crossings. */
function streetSpans(extent: number, crossings: readonly number[], gap: number) {
  const spans: { center: number; length: number }[] = [];
  let start = -extent;
  for (const crossing of crossings) {
    const end = Math.max(start, crossing - gap);
    if (end > start) spans.push({ center: (start + end) / 2, length: end - start });
    start = Math.max(start, crossing + gap);
  }
  if (start < extent) spans.push({ center: (start + extent) / 2, length: extent - start });
  return spans;
}

/** Build original noncommercial peripheral streets; no actors, clocks or point lights. */
export function buildStreetscape(builder: StreetscapeBuilder): Streetscape {
  validateStreetscape();
  const { block, add, box, cylinder, crown, palette: p } = builder;
  const [crosstownEntrance, westEntrance] = SUBWAY_ENTRANCES;
  const rod = (surface: THREE.Material, start: Triple, end: Triple, thickness: number) => {
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), direction.clone().normalize(),
    ));
    add(box, surface,
      [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
      [thickness, direction.length(), thickness], [rotation.x, rotation.y, rotation.z]);
  };
  const tree = (x: number, z: number, size = 1) => {
    block(p.stone, x, 0.01, z, 1.45, 0.12, 1.45);
    block(p.roof, x, 0.08, z, 1.18, 0.04, 1.18);
    add(cylinder, p.wood, [x, 1.6 * size, z], [0.14, 3.2 * size, 0.14]);
    add(crown, p.leaf, [x - 0.35 * size, 3.3 * size, z], [1.35 * size, 1.6 * size, 1.25 * size]);
    add(crown, p.leafLight, [x + 0.5 * size, 3.9 * size, z + 0.1], [0.95 * size, 1.1 * size, size]);
  };
  const bench = (x: number, z: number, yaw = 0) => {
    const local = (dx: number, dz: number) =>
      [x + dx * Math.cos(yaw) + dz * Math.sin(yaw), z - dx * Math.sin(yaw) + dz * Math.cos(yaw)] as const;
    for (const dz of [-0.2, 0, 0.2]) {
      const [px, pz] = local(0, dz);
      block(p.wood, px, 0.58, pz, 2.1, 0.12, 0.16, yaw);
    }
    const [bx, bz] = local(0, -0.28);
    block(p.wood, bx, 0.99, bz, 2.1, 0.55, 0.09, yaw);
    for (const dx of [-0.8, 0.8]) {
      const [px, pz] = local(dx, 0);
      block(p.copperEdge, px, 0.28, pz, 0.12, 0.5, 0.45, yaw);
    }
  };

  // Road y=0 agrees with actor feet. Sidewalks sit below the road paint, not over it.
  for (const vertical of [true, false]) {
    const roads = vertical ? STREET_X : STREET_Z;
    const crossings = vertical ? STREET_Z : STREET_X;
    const extent = vertical ? CITY_EXTENT.z : CITY_EXTENT.x;
    const stripe = (
      surface: THREE.Material, road: number, along: number, offset: number,
      width: number, length: number, y: number, height: number,
    ) => block(surface, vertical ? road + offset : along, y, vertical ? along : road + offset,
      vertical ? width : length, height, vertical ? length : width);
    for (const road of roads) {
      const track = vertical ? undefined : TWO_WAY_BIKE_STREETS.find(({ z }) => z === road);
      stripe(p.paving, road, 0, 0, SIDEWALK_HALF_WIDTH * 2, extent * 2, -0.13, 0.1);
      stripe(p.road, road, 0, 0, ROAD_HALF_WIDTH * 2, extent * 2, vertical ? -0.065 : -0.055, 0.1);
      for (const segment of streetSpans(extent, crossings, ROAD_HALF_WIDTH)) {
        for (const side of track ? [track.side] : [-1, 1]) {
          stripe(p.teal, road, segment.center, side * (track ? TWO_WAY_BIKE_TRACK.offset : BIKE_OFFSET),
            track ? TWO_WAY_BIKE_TRACK.width : 1.28, segment.length, 0.004, 0.015);
          stripe(p.line, road, segment.center, side * (track ? TWO_WAY_BIKE_TRACK.separatorOffset - 0.08 : BIKE_OFFSET - 0.77),
            0.085, segment.length, 0.016, 0.016);
        }
      }
      for (const segment of streetSpans(extent, crossings, STOP_LINE_OFFSET)) {
        for (const side of [-1, 1]) {
          stripe(p.stone, road, segment.center, side * (ROAD_HALF_WIDTH + 0.09),
            0.18, segment.length, 0.025, 0.13);
        }
        for (const side of track ? [track.side] : [-1, 1]) {
          for (let along = segment.center - segment.length / 2 + 1; along < segment.center + segment.length / 2; along += track ? 3.4 : 5) {
            const offset = side * (track ? TWO_WAY_BIKE_TRACK.separatorOffset : 3.1);
            const x = vertical ? road + offset : along;
            const z = vertical ? along : road + offset;
            add(cylinder, p.line, [x, 0.32, z], [0.07, 0.64, 0.07]);
            if (track) add(cylinder, p.rubber, [x, 0.1, z], [0.075, 0.15, 0.075]);
            else block(p.rubber, x, 0.05, z, 0.24, 0.07, 0.24);
          }
        }
        for (let along = segment.center - segment.length / 2 + 1; along < segment.center + segment.length / 2 - 0.5; along += 4) {
          stripe(p.line, road, along, 0, 0.085, 1.5, 0.017, 0.018);
          if (track) stripe(p.taxi, road, along, track.side * TWO_WAY_BIKE_TRACK.offset, 0.065, 1.3, 0.017, 0.014);
        }
      }
    }
  }
  for (const intersection of INTERSECTIONS) {
    for (const side of [-1, 1]) {
      for (let stripe = -4.5; stripe <= 4.5; stripe += 0.9) {
        block(p.line, intersection.x + stripe, 0.021, intersection.z + side * SIDEWALK_OFFSET, 0.42, 0.024, 1.65);
        block(p.line, intersection.x + side * SIDEWALK_OFFSET, 0.021, intersection.z + stripe, 1.65, 0.024, 0.42);
      }
      // One stop bar per incoming motor lane; protected lanes have their own short bar.
      if (Math.abs(intersection.z - side * STOP_LINE_OFFSET) < CITY_EXTENT.z) {
        block(p.line, intersection.x - side * VEHICLE_OFFSET, 0.02, intersection.z - side * STOP_LINE_OFFSET, 2.65, 0.024, 0.18);
        block(p.line, intersection.x - side * bikeLaneOffset('north-south', intersection.x, side),
          0.02, intersection.z - side * STOP_LINE_OFFSET, 1.25, 0.024, 0.18);
      }
      if (Math.abs(intersection.x + side * STOP_LINE_OFFSET) < CITY_EXTENT.x) {
        block(p.line, intersection.x + side * STOP_LINE_OFFSET, 0.02, intersection.z - side * VEHICLE_OFFSET, 0.18, 0.024, 2.65);
        const track = TWO_WAY_BIKE_STREETS.some(({ z }) => z === intersection.z);
        block(p.line, intersection.x + side * STOP_LINE_OFFSET, 0.02,
          intersection.z - side * bikeLaneOffset('east-west', intersection.z, -side), 0.18, 0.024, track ? 0.88 : 1.25);
      }
    }
  }

  const facade = (building: StreetBuilding, width: number, depth: number, base: number, floors: number) => {
    const { x, z } = building;
    const height = floors * 2.4;
    const brownstone = isBrownstone(building);
    const masonry = brownstone ? p.wood : p[building.skin];
    const baySpacing = brownstone ? 1.8 : 2.2;
    const windowWidth = brownstone ? 0.79 : 0.96;
    block(masonry, x, base + height / 2, z, width, height, depth);
    for (let floor = 0; floor < floors; floor++) {
      const principal = brownstone && floor === 0;
      const y = base + floor * 2.4 + (principal ? 1.6 : 1.25);
      const windowHeight = principal ? 1.55 : 1.24;
      for (const side of [-1, 1]) {
        const front = z + side * (depth / 2 + 0.025);
        const flank = x + side * (width / 2 + 0.025);
        const columns = Math.max(1, Math.floor(width / baySpacing));
        const bays = Math.max(1, Math.floor(depth / baySpacing));
        for (let column = 0; column < columns; column++) {
          const wx = x + (column - (columns - 1) / 2) * (width - 1.25) / columns;
          if (principal && side > 0 && Math.abs(wx - (x - width * 0.26)) < 0.7) continue;
          block(p.glass, wx, y, front, windowWidth, windowHeight, 0.045);
          block(brownstone ? p.copperEdge : p.paving, wx, y - windowHeight / 2 - 0.08,
            front + side * 0.07, windowWidth + 0.23, brownstone ? 0.16 : 0.1, 0.2);
          if (brownstone && side > 0) {
            block(p.copperEdge, wx, y + windowHeight / 2 + 0.1, front + 0.08, 1.06, 0.18, 0.24);
            if (principal) {
              block(p.rubber, wx, y, front + 0.035, 0.79, 0.065, 0.065);
              block(p.glass, wx, 0.5, front + 0.15, 0.68, 0.3, 0.045);
            }
          } else if (brownstone || side > 0 || floor === 0) {
            block(brownstone ? p.rubber : masonry, wx, y + 0.05, front + side * 0.03,
              brownstone ? 0.79 : 0.07, brownstone ? 0.065 : windowHeight, 0.075);
          }
        }
        for (let bay = 0; bay < bays; bay++) {
          const wz = z + (bay - (bays - 1) / 2) * (depth - 1.25) / bays;
          block(p.glass, flank, y, wz, 0.045, windowHeight, windowWidth);
          block(brownstone ? p.copperEdge : p.paving, flank + side * 0.07,
            y - windowHeight / 2 - 0.08, wz, 0.2, brownstone ? 0.16 : 0.1, windowWidth + 0.23);
        }
      }
      block(brownstone ? p.copperEdge : p.stone, x, base + floor * 2.4 + 0.12, z,
        width + 0.08, 0.12, depth + 0.08);
    }
    block(brownstone ? p.copperEdge : p.paving, x, base + height + 0.03, z,
      width + (brownstone ? 0.65 : 0.45), brownstone ? 0.26 : 0.18, depth + 0.45);
    block(masonry, x, base + height + 0.2, z, width + 0.12, 0.2, depth + 0.12);
    if (brownstone) {
      for (const offset of [-0.36, -0.12, 0.12, 0.36]) {
        block(p.copperEdge, x + width * offset, base + height - 0.22, z + depth / 2 + 0.16,
          0.18, 0.4, 0.28);
      }
    }
    block(p.roof, x, base + height + 0.31, z, width - 0.35, 0.06, depth - 0.35);
    for (const side of [-1, 1]) {
      block(p.paving, x, base + height + 0.5, z + side * (depth / 2 - 0.04), width + 0.2, 0.32, 0.19);
      block(p.paving, x + side * (width / 2 - 0.04), base + height + 0.5, z, 0.19, 0.32, depth);
    }
  };
  for (const building of STREET_BUILDINGS) {
    const { x, z, width, depth, floors, setbackFloors } = building;
    const height = floors * 2.4 + 0.3;
    const brownstone = isBrownstone(building);
    const entryX = brownstone ? x - width * 0.26 : x;
    const iron = brownstone ? p.rubber : p.copperEdge;
    block(brownstone ? p.copperEdge : p.stone, x, brownstone ? 0.4 : 0.17, z,
      width + 0.3, brownstone ? 0.8 : 0.34, depth + 0.3);
    facade(building, width, depth, 0.3, floors);
    const roofY = height + setbackFloors * 2.4 + 0.7;
    const roofWidth = width - (setbackFloors ? 1.4 : 0);
    const roofDepth = depth - (setbackFloors ? 2.2 : 0);
    if (setbackFloors) facade(building, width - 1.4, depth - 2.2, height, setbackFloors);
    block(p.glass, entryX, brownstone ? 1.765 : 1.06, z + depth / 2 + 0.05, 0.95, 1.85, 0.06);
    block(brownstone ? p.copperEdge : p.paving, entryX, brownstone ? 2.8 : 2.2,
      z + depth / 2 + 0.17, 1.45, 0.18, 0.34);
    if (brownstone) {
      for (const side of [-1, 1]) {
        block(p.copperEdge, entryX + side * 0.62, 1.77, z + depth / 2 + 0.15, 0.16, 1.92, 0.25);
      }
    }
    if (building.stoop) {
      for (let step = 0; step < (brownstone ? 4 : 3); step++) {
        block(brownstone ? p.copperEdge : p.stone, entryX, 0.09 + step * 0.11,
          z + depth / 2 + (brownstone ? 0.98 - step * 0.24 : 0.88 - step * 0.3),
          1.45, 0.18 + step * 0.22, 0.32);
      }
      for (const side of [-1, 1]) {
        const railX = entryX + side * 0.72;
        rod(iron, [railX, brownstone ? 0.95 : 0.65, z + depth / 2 + 1],
          [railX, brownstone ? 1.62 : 1.18, z + depth / 2 + 0.08], 0.045);
        if (brownstone) {
          rod(iron, [railX, 0.18, z + depth / 2 + 1], [railX, 0.95, z + depth / 2 + 1], 0.045);
          rod(iron, [railX, 0.84, z + depth / 2 + 0.08], [railX, 1.62, z + depth / 2 + 0.08], 0.045);
        }
      }
    }
    if (building.fireEscape) {
      for (let floor = 1; floor < floors; floor++) {
        const y = floor * 2.4 + 0.42;
        const fx = x + width / 2 + 0.23;
        block(iron, fx, y, z, 0.34, 0.1, 1.6);
        rod(iron, [fx + 0.1, y + 0.65, z - 0.7], [fx + 0.1, y + 0.65, z + 0.7], 0.045);
        for (const dz of [-0.65, 0, 0.65]) {
          rod(iron, [fx + 0.1, y, z + dz], [fx + 0.1, y + 0.65, z + dz], 0.04);
        }
        for (const edge of [-1, 1]) {
          rod(iron, [fx + edge * 0.11, y, z + 0.62],
            [fx + edge * 0.11, y + 2.4, z - 0.62], 0.04);
        }
        for (let rung = 1; rung <= 7; rung++) {
          block(iron, fx, y + rung * 0.3, z + 0.62 - rung * 0.155, 0.26, 0.04, 0.06);
        }
      }
    }
    if (building.roof === 'tank' && !setbackFloors) {
      for (const dx of [-0.57, 0.57]) for (const dz of [-0.57, 0.57]) {
        rod(p.copperEdge, [x + dx, roofY, z + dz], [x + dx * 0.8, roofY + 0.95, z + dz * 0.8], 0.08);
      }
      add(cylinder, p.wood, [x, roofY + 1.7, z], [0.95, 1.55, 0.95]);
      for (const y of [roofY + 1.1, roofY + 2.25]) {
        add(cylinder, p.copperEdge, [x, y, z], [0.98, 0.1, 0.98]);
      }
      add(crown, p.roof, [x, roofY + 2.55, z], [1.03, 0.4, 1.03]);
    } else if (building.roof === 'garden') {
      for (const dz of [-1.45, 1.45]) {
        block(p.wood, x, roofY + 0.12, z + dz, roofWidth - 2, 0.28, 0.75);
        for (const dx of [-0.8, 0.8]) {
          add(crown, p.leaf, [x + dx, roofY + 0.6, z + dz], [0.6, 0.6, 0.48]);
        }
      }
      block(p.teal, x, roofY + 0.4, z, 1.4, 0.65, 1.1);
    } else {
      block(p.stone, x + 0.4, roofY + 0.35, z, 1.4, 0.7, 1.1);
      for (const dx of [-0.35, 0.35]) {
        add(cylinder, p.roof, [x + 0.4 + dx, roofY + 0.73, z], [0.22, 0.06, 0.22]);
      }
      for (const dz of [-roofDepth / 2 + 0.8, roofDepth / 2 - 0.8]) {
        block(p.clay, x - roofWidth / 2 + 0.85, roofY + 0.55, z + dz, 0.55, 1.1, 0.55);
        block(p.roof, x - roofWidth / 2 + 0.85, roofY + 1.13, z + dz, 0.68, 0.12, 0.68);
      }
    }
  }

  // Quiet courtyards interrupt the street walls; all foliage is original shared geometry.
  for (const parcel of STREET_BLOCKS) {
    if ([CORNER_BLOCKS.construction, CORNER_BLOCKS.transit, CORNER_BLOCKS.court].includes(parcel.id)) continue;
    for (const x of [parcel.minX + 1.3, parcel.maxX - 1.3]) {
      for (const z of [parcel.minZ + 1.3, parcel.maxZ - 1.3]) {
        if ((x === parcel.minX + 1.3) !== (z === parcel.minZ + 1.3)) continue;
        if (STREET_BUILDINGS.some((building) =>
          Math.abs(building.x - x) < building.width / 2 + 1.3 &&
          Math.abs(building.z - z) < building.depth / 2 + 1.3)) continue;
        tree(x, z, 0.8 + ((Math.abs(x + z) * 10) % 3) * 0.1);
      }
    }
  }
  const subwayPlaza = (x: number, z: number, width: number, depth: number, entranceX: number, entranceZ: number) => {
    const minX = x - width / 2;
    const maxX = x + width / 2;
    const minZ = z - depth / 2;
    const maxZ = z + depth / 2;
    const west = entranceX - 1.98;
    const east = entranceX + 1.98;
    const north = entranceZ - 3.2;
    const south = entranceZ + 3.2;
    block(p.paving, (minX + west) / 2, -0.025, z, west - minX, 0.1, depth);
    block(p.paving, (east + maxX) / 2, -0.025, z, maxX - east, 0.1, depth);
    block(p.paving, entranceX, -0.025, (minZ + north) / 2, east - west, 0.1, north - minZ);
    block(p.paving, entranceX, -0.025, (south + maxZ) / 2, east - west, 0.1, maxZ - south);
  };
  for (const x of [WEST_X, EAST_X]) for (const position of [-50.5, 0.5, 51.5]) {
    const z = position * SIDE_SCALE;
    if (x === WEST_X && position === 51.5) {
      subwayPlaza(x, z, STREET_X[CENTER_COLUMN] - STREET_X[CENTER_COLUMN - 1] - SIDEWALK_HALF_WIDTH * 2,
        10.6 * SIDE_SCALE, westEntrance.x, westEntrance.z);
      tree(x - 4.6, z - 3.6, 0.72);
      tree(x - 1.6, z - 3.6, 0.68);
      bench(x - 4.6, z + 0.8, Math.PI / 2);
      continue;
    }
    block(p.paving, x, -0.025, z, 10.8, 0.1, 9 * SIDE_SCALE);
    tree(x - 3, z - 2 * SIDE_SCALE, 0.92);
    tree(x + 3, z + 2 * SIDE_SCALE, 0.85);
    bench(x, z - 2.8 * SIDE_SCALE);
  }

  const basketball = BASKETBALL_COURT;
  const pickleball = PICKLEBALL_COURT;
  const courtX = basketball.x;
  const courtZ = basketball.z;
  const courtParcel = STREET_BLOCKS.find(({ id }) => id === CORNER_BLOCKS.court)!;
  const courtGapZ = (basketball.z - basketball.depth / 2 + pickleball.z + pickleball.depth / 2) / 2;
  block(p.paving, courtParcel.x, -0.025, courtParcel.z,
    courtParcel.maxX - courtParcel.minX - 0.4, 0.1, courtParcel.maxZ - courtParcel.minZ - 0.4);
  block(p.teal, courtX, basketball.surfaceY - 0.015, courtZ, basketball.width, 0.03, basketball.depth);
  const serviceWidth = pickleball.width / 2 - pickleball.kitchenDepth;
  block(p.teal, pickleball.x, pickleball.surfaceY - 0.015, pickleball.z,
    pickleball.kitchenDepth * 2, 0.03, pickleball.depth);
  for (const side of [-1, 1]) {
    block(p.roof, pickleball.x + side * (pickleball.kitchenDepth + serviceWidth / 2),
      pickleball.surfaceY - 0.015, pickleball.z, serviceWidth, 0.03, pickleball.depth);
  }
  for (const court of [basketball, pickleball]) {
    for (const side of [-1, 1]) {
      block(p.line, court.x + side * (court.width / 2 - 0.035), court.surfaceY + 0.006, court.z,
        0.07, 0.008, court.depth - 0.07);
      block(p.line, court.x, court.surfaceY + 0.006, court.z + side * (court.depth / 2 - 0.035),
        court.width - 0.07, 0.008, 0.07);
    }
  }
  block(p.line, courtX, basketball.surfaceY + 0.006, courtZ, 0.065, 0.008, basketball.depth - 0.07);
  const circleRadius = basketball.depth * 0.135;
  for (let segment = 0; segment < 24; segment++) {
    const angle = segment / 24 * Math.PI * 2;
    block(p.line, courtX + Math.cos(angle) * circleRadius, basketball.surfaceY + 0.006,
      courtZ + Math.sin(angle) * circleRadius, Math.PI * circleRadius / 12, 0.008, 0.055, -angle - Math.PI / 2);
  }
  for (const side of [-1, 1]) {
    const keyDepth = basketball.width * 0.23;
    const keyWidth = basketball.depth * 0.3;
    block(p.line, courtX + side * (basketball.width / 2 - keyDepth), basketball.surfaceY + 0.006,
      courtZ, 0.065, 0.008, keyWidth);
    for (const flank of [-1, 1]) block(p.line,
      courtX + side * (basketball.width / 2 - keyDepth / 2 - 0.035), basketball.surfaceY + 0.006,
      courtZ + flank * keyWidth / 2, keyDepth - 0.07, 0.008, 0.065);
    const rimX = courtX + side * basketball.hoopOffset;
    const rimY = basketball.surfaceY + basketball.hoopHeight;
    const poleX = rimX + side * 0.65;
    const poleHeight = basketball.hoopHeight + 0.65;
    const boardX = rimX + side * 0.35;
    add(cylinder, p.copperEdge, [poleX, basketball.surfaceY + poleHeight / 2, courtZ], [0.075, poleHeight, 0.075]);
    block(p.paving, boardX, rimY + 0.32, courtZ, 0.09, 0.9, 1.3);
    block(p.roof, boardX - side * 0.065, rimY + 0.18, courtZ, 0.035, 0.36, 0.57);
    rod(p.copperEdge, [poleX, rimY + 0.18, courtZ], [boardX, rimY + 0.18, courtZ], 0.065);
    rod(p.copper, [boardX, rimY, courtZ], [rimX + side * 0.22, rimY, courtZ], 0.035);
    for (let segment = 0; segment < 10; segment++) {
      const angle = segment / 10 * Math.PI * 2;
      block(p.copper, rimX + Math.cos(angle) * 0.22, rimY, courtZ + Math.sin(angle) * 0.22,
        0.15, 0.035, 0.035, -angle - Math.PI / 2);
    }
    block(p.line, pickleball.x + side * pickleball.kitchenDepth, pickleball.surfaceY + 0.006,
      pickleball.z, 0.055, 0.008, pickleball.depth - 0.07);
    block(p.line, pickleball.x + side * (pickleball.kitchenDepth + serviceWidth / 2),
      pickleball.surfaceY + 0.006, pickleball.z, serviceWidth - 0.07, 0.008, 0.055);
    const netPoleHeight = pickleball.netHeight + 0.12;
    add(cylinder, p.rubber,
      [pickleball.x, pickleball.surfaceY + netPoleHeight / 2, pickleball.z + side * (pickleball.depth / 2 + 0.17)],
      [0.05, netPoleHeight, 0.05]);
    rod(p.rubber,
      [pickleball.x, pickleball.surfaceY + pickleball.netHeight - 0.02, pickleball.z + side * pickleball.depth / 2],
      [pickleball.x, pickleball.surfaceY + pickleball.netHeight - 0.02, pickleball.z + side * (pickleball.depth / 2 + 0.17)],
      0.02);
  }
  const netTop = pickleball.surfaceY + pickleball.netHeight;
  const netBottom = pickleball.surfaceY + 0.1;
  const meshHeight = netTop - 0.04 - netBottom;
  block(p.line, pickleball.x, netTop - 0.02, pickleball.z, 0.045, 0.04, pickleball.depth);
  const netColumns = Math.ceil(pickleball.depth / 0.25);
  for (let thread = 0; thread <= netColumns; thread++) {
    block(p.rubber, pickleball.x, netBottom + meshHeight / 2,
      pickleball.z + (thread / netColumns - 0.5) * pickleball.depth, 0.02, meshHeight, 0.02);
  }
  for (let row = 0; row < 4; row++) block(p.rubber, pickleball.x,
    netBottom + meshHeight * row / 4, pickleball.z, 0.02, 0.02, pickleball.depth);
  for (const x of [courtX - 4.6, courtX + 4.6]) bench(x, courtGapZ + 0.5);
  bench(courtX + 1.2, courtParcel.minZ + 1.4);
  for (const x of [courtParcel.minX + 1.5, courtParcel.maxX - 1.5]) tree(x, courtParcel.minZ + 1.6, 0.7);
  const fenceX = courtParcel.minX + 0.45;
  const fenceStart = courtZ - basketball.depth / 2 - 0.1;
  const fenceEnd = courtZ + basketball.depth / 2 + 0.7;
  for (let post = 0; post <= 4; post++) {
    const z = fenceStart + (fenceEnd - fenceStart) * post / 4;
    rod(p.copperEdge, [fenceX, 0, z], [fenceX, 2.5, z], 0.055);
  }
  for (const y of [0.5, 1.5, 2.5]) rod(p.copperEdge,
    [fenceX, y, fenceStart], [fenceX, y, fenceEnd], 0.045);

  const subway = (x: number, z: number) => {
    // The shallow recess stays above the island top (-0.14); paving leaves its mouth open.
    block(p.rubber, x, -0.095, z, 3.55, 0.03, 5.98);
    block(p.cream, x, 0.225, z - 2.94, 3.5, 0.69, 0.18);
    block(p.stone, x, 0.53, z - 2.98, 3.9, 0.24, 0.32);
    for (let step = 0; step < 7; step++) {
      block(p.stone, x, 0.4275 - step * 0.085, z + 1.99 - step * 0.7, 2.9, 0.085, 0.7);
    }
    for (let step = 0; step < 4; step++) {
      const height = (step + 1) * 0.13;
      block(p.stone, x, height / 2, z + 4.13 - step * 0.38, 3.2, height, 0.38);
    }
    block(p.stone, x, 0.275, z + 2.57, 3, 0.55, 0.46);
    block(p.taxi, x, 0.558, z + 2.5, 2.9, 0.012, 0.12);
    for (const side of [-1, 1]) {
      const edgeX = x + side * 1.75;
      block(p.cream, x + side * 1.63, 0.225, z, 0.18, 0.69, 6);
      block(p.stone, edgeX, 0.53, z, 0.32, 0.24, 6.18);
      for (const y of [0.12, 0.34]) block(p.paving, x + side * 1.53, y, z, 0.025, 0.025, 5.8);
      for (let index = 0; index < 13; index++) {
        block(p.rubber, edgeX, 1, z - 2.8 + index * 0.44, 0.04, 0.75, 0.04);
      }
      for (const y of [0.75, 1.35]) block(p.rubber, edgeX, y, z, 0.065, 0.065, 5.96);
      for (const end of [-1, 1]) {
        block(p.rubber, edgeX, 1.15, z + end * 2.86, 0.16, 1.18, 0.16);
        if (end < 0) block(p.teal, edgeX, 1.79, z + end * 2.86, 0.2, 0.1, 0.2);
      }
      const railX = x + side * 1.25;
      rod(p.stone, [railX, 1.18, z + 2.34], [railX, 0.585, z - 2.56], 0.06);
      rod(p.stone, [railX, 1.18, z + 2.8], [railX, 1.18, z + 2.34], 0.06);
      rod(p.stone, [railX, 0.585, z - 2.56], [railX, 0.585, z - 2.78], 0.06);
      for (const step of [0, 3, 6]) {
        const treadY = 0.47 - step * 0.085;
        const treadZ = z + 1.99 - step * 0.7;
        rod(p.stone, [railX, treadY, treadZ], [railX, treadY + 0.6675, treadZ], 0.045);
      }
      block(p.rubber, edgeX, 1.77, z + 2.86, 0.16, 3.54, 0.16);
      block(p.teal, edgeX, 1.67, z + 2.95, 0.1, 3.2, 0.015);
      add(crown, p.taxi, [edgeX, 3.75, z + 2.86], [0.38, 0.34, 0.38]);
      add(crown, p.leaf, [edgeX, 3.99, z + 2.86], [0.38, 0.11, 0.38]);
      add(cylinder, p.paving, [edgeX, 3.46, z + 2.86], [0.18, 0.1, 0.18]);
    }
    for (const y of [0.75, 1.35]) block(p.rubber, x, y, z - 2.98, 3.5, 0.065, 0.065);
    for (let index = -3; index <= 3; index++) block(p.rubber, x + index * 0.44, 1, z - 2.98, 0.04, 0.75, 0.04);
    block(p.rubber, x, 2.95, z + 2.86, 3.7, 0.72, 0.14);
    for (const y of [2.56, 3.34]) block(p.teal, x, y, z + 2.86, 3.7, 0.05, 0.16);
    // Original block-letter SUBWAY sign, readable from either side without a font asset.
    let column = 0;
    for (const letter of SUBWAY_LETTERS) {
      letter.forEach((row, rowIndex) => [...row].forEach((pixel, cell) => {
        if (pixel !== '1') return;
        for (const face of [-1, 1]) block(p.line,
          x + face * (column + cell - 12) * 0.12, 2.95 + (2 - rowIndex) * 0.12,
          z + 2.86 + face * 0.095, 0.1, 0.1, 0.025);
      }));
      column += letter[0].length + 1;
    }
  };
  // The station canopy is omitted so the entrance and its sign stay open to the city camera.
  const transitX = TRANSIT.x;
  const transitZ = TRANSIT.z;
  subwayPlaza(transitX, transitZ + 2.1, 11.8, 17, crosstownEntrance.x, crosstownEntrance.z);
  for (const { x, z } of SUBWAY_ENTRANCES) subway(x, z);
  bench(transitX - 3.3, transitZ + 7.5);
  bench(transitX + 0.2, transitZ + 8.2);
  tree(transitX - 8.1, transitZ + 7.6, 0.72);

  // A compact construction pocket: open frame, muted safety fencing and a lattice crane.
  const siteX = WEST_X + 1.5;
  const siteZ = STREET_Z[CENTER_ROW] - SIDEWALK_OFFSET - 5.3;
  block(p.sand, siteX, 0.02, siteZ, 7.2, 0.12, 7);
  for (const x of [siteX - 2.8, siteX + 2.5]) for (const z of [siteZ - 2.5, siteZ + 2.5]) {
    block(p.stone, x, 2.1, z, 0.55, 4.2, 0.55);
  }
  for (const y of [0.25, 2.3, 4.25]) {
    block(p.stone, siteX - 0.15, y, siteZ, 6, 0.24, 5.8);
  }
  for (const z of [siteZ - 3.8, siteZ + 3.7]) block(p.teal, siteX, 0.75, z, 7.2, 1.5, 0.13);
  block(p.teal, siteX + 3.7, 0.75, siteZ, 0.13, 1.5, 7.7);
  for (const x of [siteX - 2.5, siteX - 1.5, siteX - 0.5]) {
    block(p.wood, x, 0.32, siteZ + 2.3, 0.55, 0.5, 1.4);
  }
  // The facade scaffold stays behind the separate protective sidewalk shed.
  const scaffoldX = siteX - 0.1;
  const scaffoldZ = siteZ + 2.7;
  for (const x of [scaffoldX - 3, scaffoldX, scaffoldX + 3]) {
    for (const z of [scaffoldZ - 0.4, scaffoldZ + 0.4]) {
      block(p.roof, x, 3.4, z, 0.085, 6.8, 0.085);
    }
  }
  for (const y of [2.2, 4.4, 6.6]) {
    for (const z of [scaffoldZ - 0.4, scaffoldZ + 0.4]) block(p.roof, scaffoldX, y, z, 6.3, 0.09, 0.09);
    block(p.wood, scaffoldX, y + 0.06, scaffoldZ, 6.3, 0.08, 1);
    for (const x of [scaffoldX - 3, scaffoldX]) {
      rod(p.roof, [x, y - 2.1, scaffoldZ + 0.45], [x + 3, y, scaffoldZ + 0.45], 0.055);
      rod(p.roof, [x, y, scaffoldZ + 0.45], [x + 3, y - 2.1, scaffoldZ + 0.45], 0.055);
    }
  }
  const shedWalkZ = STREET_Z[CENTER_ROW] - SIDEWALK_OFFSET;
  const shedX = WEST_X + 1.05;
  for (const x of [shedX - 3.45, shedX - 1.15, shedX + 1.15, shedX + 3.45]) {
    for (const z of [shedWalkZ - 1.25, shedWalkZ + 0.9]) {
      block(p.roof, x, 1.35, z, 0.1, 2.7, 0.1);
    }
    block(p.roof, x, 2.62, shedWalkZ - 0.175, 0.12, 0.16, 2.35);
  }
  for (const z of [shedWalkZ - 1.25, shedWalkZ + 0.9]) {
    block(p.roof, shedX, 2.64, z, 7.15, 0.17, 0.14);
    block(p.teal, shedX, 2.99, z, 7.3, 0.48, 0.12);
    for (const x of [shedX - 3.45, shedX + 1.15]) {
      rod(p.roof, [x, 0.25, z], [x + 2.3, 2.5, z], 0.065);
    }
  }
  block(p.roof, shedX, 2.78, shedWalkZ - 0.175, 7.3, 0.18, 2.5);
  for (const x of [shedX - 2.3, shedX, shedX + 2.3]) {
    block(p.line, x, 2.66, shedWalkZ - 0.175, 0.65, 0.06, 0.22);
  }
  const craneX = WEST_X + 1.2;
  const craneZ = siteZ - 0.2;
  for (const dx of [-0.4, 0.4]) for (const dz of [-0.4, 0.4]) {
    rod(p.copper, [craneX + dx, 0, craneZ + dz], [craneX + dx, 18, craneZ + dz], 0.1);
  }
  for (let y = 1; y < 18; y += 1.5) {
    for (const dz of [-0.4, 0.4]) {
      rod(p.copper, [craneX - 0.4, y, craneZ + dz], [craneX + 0.4, y + 1.2, craneZ + dz], 0.055);
    }
    block(p.copper, craneX, y, craneZ, 0.9, 0.09, 0.9);
  }
  for (const y of [17.8, 18.5]) block(p.copper, WEST_X - 0.5, y, craneZ, 10.3, 0.12, 0.4);
  for (let x = WEST_X - 5; x < WEST_X + 4; x++) {
    rod(p.copper, [x, 17.8, craneZ], [x + 0.8, 18.5, craneZ], 0.065);
  }
  block(p.teal, craneX - 1.1, 17.1, craneZ, 1.1, 1.1, 1.1);
  block(p.glass, craneX - 1.1, 17.25, craneZ + 0.56, 0.8, 0.55, 0.035);
  block(p.stone, WEST_X - 4.5, 17.35, craneZ, 1.6, 0.8, 1);
  rod(p.copperEdge, [WEST_X + 4.4, 17.8, craneZ], [WEST_X + 4.4, 6, craneZ], 0.035);
  block(p.copperEdge, WEST_X + 4.4, 5.8, craneZ, 0.3, 0.4, 0.2);

  for (const x of STREET_X) {
    for (const z of [NORTH_Z, -74, -24, 24, 74, SOUTH_Z]) {
      const side = x < 0 ? -1 : 1;
      const px = x + side * 5.5;
      add(cylinder, p.clay, [px, 0.42, z], [0.16, 0.7, 0.16]);
      add(crown, p.clay, [px, 0.79, z], [0.2, 0.14, 0.2]);
      block(p.copperEdge, px, 0.52, z, 0.5, 0.14, 0.15);
    }
  }
  for (const [x, z] of [[WEST_X, -50.5 * SIDE_SCALE], [EAST_X, 0.5 * SIDE_SCALE], [transitX + 4.8, transitZ + 7.1], [courtParcel.maxX - 1.05, courtGapZ - 1.05]] as const) {
    for (let index = 0; index < 3; index++) {
      const pz = z + index * 0.8;
      rod(p.copperEdge, [x - 0.45, 0, pz], [x - 0.45, 0.75, pz], 0.045);
      rod(p.copperEdge, [x + 0.45, 0, pz], [x + 0.45, 0.75, pz], 0.045);
      rod(p.copperEdge, [x - 0.45, 0.75, pz], [x + 0.45, 0.75, pz], 0.045);
    }
  }
  for (const [x, z] of [[courtX - 3.7, courtParcel.minZ + 1.65], [transitX - 7.9, transitZ + 2.5]] as const) {
    block(p.paving, x, 0.68, z, 1.65, 0.8, 0.85);
    block(p.copper, x, 1.11, z, 1.8, 0.1, 1);
    for (const side of [-1, 1]) {
      add(cylinder, p.rubber, [x + side * 0.58, 0.24, z], [0.22, 0.13, 0.22], [Math.PI / 2, 0, 0]);
      rod(p.copperEdge, [x + side * 0.8, 1.13, z], [x + side * 0.8, 2.1, z], 0.045);
    }
    block(p.teal, x, 2.15, z, 2.1, 0.16, 1.5);
    block(p.cream, x, 2.09, z + 0.65, 2.1, 0.24, 0.14);
    add(cylinder, p.stone, [x + 0.4, 1.29, z], [0.19, 0.25, 0.19]);
  }

  return buildSignalLights(builder);
}

type LampColor = 'red' | 'amber' | 'green';
interface SignalHead {
  id: string;
  axis: 'north-south' | 'east-west' | 'pedestrians';
  lamps: Partial<Record<LampColor, THREE.Matrix4>>;
}

function buildSignalLights({ block, add, box, cylinder, palette: p }: StreetscapeBuilder): Streetscape {
  const group = new THREE.Group();
  group.name = 'Neighborhood traffic signals';
  const heads: SignalHead[] = [];
  const transform = new THREE.Object3D();
  const approach = STOP_LINE_OFFSET + 0.5;
  for (const intersection of INTERSECTIONS) {
    for (const vertical of [true, false]) {
      for (const side of [-1, 1]) {
        const px = intersection.x + (vertical ? side * 5.5 : side * approach);
        let pz = intersection.z + (vertical ? side * approach : -side * 5.5);
        if (Math.abs(px) < PARK_HALF_X && Math.abs(pz) < PARK_HALF_Z) pz = 2 * intersection.z - pz;
        const hx = intersection.x + (vertical ? side * VEHICLE_OFFSET : side * approach);
        const hz = intersection.z + (vertical ? side * approach : -side * VEHICLE_OFFSET);
        if (Math.abs(px) > CITY_EXTENT.x - 0.5 || Math.abs(pz) > CITY_EXTENT.z - 0.5) continue;
        const yaw = vertical ? (side < 0 ? Math.PI : 0) : side * Math.PI / 2;
        add(cylinder, p.copperEdge, [px, 2.5, pz], [0.075, 5, 0.075]);
        block(p.copperEdge, (px + hx) / 2, 4.4, (pz + hz) / 2,
          vertical ? Math.abs(px - hx) + 0.12 : 0.12, 0.12, vertical ? 0.12 : Math.abs(pz - hz) + 0.12);
        const brace = new THREE.Vector3((hx - px) * 0.64, -0.5, (hz - pz) * 0.64);
        transform.position.set(px + brace.x / 2, 4.65, pz + brace.z / 2);
        transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), brace.clone().normalize());
        transform.scale.set(0.055, brace.length(), 0.055);
        add(box, p.copperEdge, transform.position.toArray(), transform.scale.toArray(),
          [transform.rotation.x, transform.rotation.y, transform.rotation.z]);
        const makeHead = (axis: SignalHead['axis'], x: number, y: number, z: number, angle: number) => {
          const pedestrian = axis === 'pedestrians';
          block(pedestrian ? p.rubber : p.taxi, x, y, z, pedestrian ? 0.53 : 0.65, pedestrian ? 0.8 : 1.42, 0.3, angle);
          if (pedestrian) block(p.rubber, x, y + 0.43, z, 0.65, 0.07, 0.5, angle);
          const lamps: SignalHead['lamps'] = {};
          const colors: LampColor[] = pedestrian ? ['red', 'green'] : ['red', 'amber', 'green'];
          colors.forEach((color, index) => {
            if (!pedestrian) {
              block(p.rubber, x + Math.sin(angle) * 0.3,
                y + 0.38 - index * 0.38 + 0.19, z + Math.cos(angle) * 0.3, 0.4, 0.07, 0.42, angle);
            }
            transform.position.set(x + Math.sin(angle) * 0.18, y + (colors.length - 1) * 0.19 - index * 0.38,
              z + Math.cos(angle) * 0.18);
            transform.rotation.set(Math.PI / 2, 0, -angle);
            transform.scale.set(0.15, 0.045, 0.15);
            transform.updateMatrix();
            add(cylinder, p.rubber, transform.position.toArray(), transform.scale.toArray(),
              [transform.rotation.x, transform.rotation.y, transform.rotation.z]);
            transform.position.x += Math.sin(angle) * 0.03;
            transform.position.z += Math.cos(angle) * 0.03;
            transform.updateMatrix();
            lamps[color] = transform.matrix.clone();
          });
          heads.push({ id: intersection.id, axis, lamps });
        };
        makeHead(vertical ? 'north-south' : 'east-west', hx, 3.75, hz, yaw);
        makeHead('pedestrians', px, 2.35, pz, yaw + Math.PI / 2);
      }
    }
  }
  const colors = { red: '#e77464', amber: '#e3b75f', green: '#9acb92' } as const;
  const paints = Object.fromEntries(Object.entries(colors).map(([name, color]) => [
    name, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.75, roughness: 0.65 }),
  ])) as Record<LampColor, THREE.MeshStandardMaterial>;
  const batches = Object.fromEntries(Object.entries(paints).map(([name, material]) => {
    const mesh = new THREE.InstancedMesh(cylinder, material, heads.length);
    mesh.name = `Neighborhood ${name} lamps`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    group.add(mesh);
    return [name, mesh];
  })) as Record<LampColor, THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>;
  const phases = new Map<string, StreetscapeSignalState['phase']>();
  let disposed = false;
  const setSignals = (states: readonly StreetscapeSignalState[]) => {
    if (disposed) return;
    let changed = phases.size === 0;
    for (const state of states) {
      if (!INTERSECTIONS.some(({ id }) => id === state.id)) continue;
      if (phases.get(state.id) !== state.phase) changed = true;
      phases.set(state.id, state.phase);
    }
    if (!changed) return;
    const counts = { red: 0, amber: 0, green: 0 };
    for (const head of heads) {
      const phase = phases.get(head.id) ?? 'clearance';
      const color: LampColor = phase === head.axis ? 'green' : 'red';
      const matrix = head.lamps[color];
      if (matrix) batches[color].setMatrixAt(counts[color]++, matrix);
    }
    for (const color of Object.keys(batches) as LampColor[]) {
      batches[color].count = counts[color];
      batches[color].instanceMatrix.needsUpdate = true;
    }
  };
  setSignals(INTERSECTIONS.map(({ id }) => ({ id, phase: 'clearance' })));
  return {
    group,
    setSignals,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const color of Object.keys(batches) as LampColor[]) {
        batches[color].dispose();
        paints[color].dispose();
      }
      phases.clear();
      group.clear();
      group.removeFromParent();
    },
  };
}
