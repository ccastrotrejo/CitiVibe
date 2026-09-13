import * as THREE from 'three';
import { BASKETBALL_COURT, PICKLEBALL_COURT, RECREATION_AREA, netHeightAt } from '../content/courts';
import { METRO_ENTRANCES, METRO_GEOMETRY, METRO_OPENINGS, type MetroEntrance } from '../content/metro';
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
  formerCourt: `block-${CENTER_COLUMN - 1}-${CENTER_ROW + 1}`,
  southeast: `block-${CENTER_COLUMN + 1}-${CENTER_ROW + 1}`,
};
const TRANSIT = { x: 63, z: -118 } as const;

/** Kept as the art-facing alias; ground cuts use the same content manifest. */
export const SUBWAY_ENTRANCES = METRO_ENTRANCES;

const SUBWAY_LETTERS = [
  { width: 3, strokes: [[3, 0, 0, 0], [0, 0, 0, 2], [0, 2, 3, 2], [3, 2, 3, 4], [3, 4, 0, 4]] },
  { width: 3, strokes: [[0, 0, 0, 4], [0, 4, 3, 4], [3, 4, 3, 0]] },
  { width: 3, strokes: [[0, 0, 0, 4], [0, 0, 3, 0], [0, 2, 3, 2], [0, 4, 3, 4], [3, 0, 3, 2], [3, 2, 3, 4]] },
  { width: 5, strokes: [[0, 0, 1, 4], [1, 4, 2.5, 2], [2.5, 2, 4, 4], [4, 4, 5, 0]] },
  { width: 3, strokes: [[0, 4, 1.5, 0], [1.5, 0, 3, 4], [0.75, 2, 2.25, 2]] },
  { width: 3, strokes: [[0, 0, 1.5, 2], [3, 0, 1.5, 2], [1.5, 2, 1.5, 4]] },
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
  // Move the ten frontage buildings intact to make room for full-size courts.
  const recreationId = `block-${CENTER_COLUMN}-${CENTER_ROW + 1}`;
  const frontage = buildings.filter(({ blockId }) => blockId === recreationId);
  for (const [index, column] of [1, 3, 5, 7].entries()) {
    Object.assign(frontage[column], {
      blockId: CORNER_BLOCKS.formerCourt, x: WEST_X + (index % 2 ? 3.8 : -3.8),
      z: SOUTH_Z + (index < 2 ? -5.5 : 5.5),
    });
  }
  for (const [index, column] of [4, 9].entries()) {
    Object.assign(frontage[column], { x: index === 0 ? 28.15 : 35.25, z: 107.5 });
  }
  for (const [row, columns] of [[0, [0, 2]], [STREET_Z.length - 2, [6, 8]]] as const) {
    const blockId = `block-${CENTER_COLUMN}-${row}`;
    const parcel = STREET_BLOCKS.find(({ id }) => id === blockId)!;
    // Shallow end buildings preserve the existing corner trees.
    const wall = [
      frontage[columns[0]],
      ...buildings.filter((building) => building.blockId === blockId).sort((a, b) => a.x - b.x),
      frontage[columns[1]],
    ];
    for (const column of columns) frontage[column].blockId = blockId;
    const span = wall.reduce((sum, building) => sum + building.width, 0) + (wall.length - 1) * 0.8;
    let cursor = parcel.x - span / 2;
    for (const [index, building] of wall.entries()) {
      building.x = cursor + building.width / 2;
      building.z = parcel.z + (index % 2 ? -0.15 : 0.15);
      cursor += building.width + 0.8;
    }
  }
  return buildings;
})();

/** Protective sheds on occupied buildings; four also carry open upper-facade scaffolding. */
export const SIDEWALK_SHEDS = [
  { building: 22, x: -69.8, scaffold: true },
  { building: 27, x: -52.2, scaffold: true },
  { building: 35, x: -69.8, scaffold: false },
  { building: 38, x: 69.8, scaffold: false },
  { building: 44, x: 52.2, scaffold: true },
  { building: 46, x: 69.8, scaffold: false },
  { building: 51, x: 69.8, scaffold: true },
].map(({ building: number, x, scaffold }) => {
  const building = STREET_BUILDINGS.find(({ id }) => id === `street-building-${number}`)!;
  return { id: `sidewalk-shed-${number}`, buildingId: building.id, x, z: building.z, length: building.depth + 0.8, scaffold };
});

/** Fail before resource allocation if facades, cornices or stoops invade sidewalks. */
export function validateStreetscape(buildings: readonly StreetBuilding[] = STREET_BUILDINGS): void {
  const ids = new Set<string>();
  const epsilon = 1e-9;
  for (const building of buildings) {
    const { id, blockId, x, z, width, depth, floors, setbackFloors } = building;
    const parcel = STREET_BLOCKS.find((block) => block.id === blockId);
    if (!parcel || !id || ids.has(id) ||
      ![x, z, width, depth, floors, setbackFloors].every(Number.isFinite) ||
      typeof building.brownstone !== 'boolean' ||
      width < 3 || depth < 3 || !Number.isInteger(floors) || floors < 3 || floors > 7 ||
      !Number.isInteger(setbackFloors) || setbackFloors < 0 || setbackFloors > 2 ||
      (floors + setbackFloors) * 2.4 + 0.8 > 23 ||
      x - width / 2 - 0.4 < parcel.minX - epsilon || x + width / 2 + 0.4 > parcel.maxX + epsilon ||
      z - depth / 2 - 0.35 < parcel.minZ - epsilon ||
      z + depth / 2 + (building.stoop ? 1.2 : 0.35) > parcel.maxZ + epsilon) {
      throw new Error(`Invalid streetscape building footprint: ${id}.`);
    }
    if (buildings.some((other) => other !== building &&
      Math.abs(other.x - x) < (other.width + width) / 2 + 0.4 - epsilon &&
      Math.abs(other.z - z) < (other.depth + depth) / 2 + 0.4 - epsilon)) {
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
    if ([CORNER_BLOCKS.construction, CORNER_BLOCKS.transit, CORNER_BLOCKS.formerCourt].includes(parcel.id)) continue;
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
  const pavingCuts = METRO_OPENINGS.map((hole, index) => {
    const { yaw } = METRO_ENTRANCES[index];
    return { ...hole, maxX: hole.maxX + Math.sin(yaw) * METRO_GEOMETRY.apronDepth,
      maxZ: hole.maxZ + Math.cos(yaw) * METRO_GEOMETRY.apronDepth };
  });
  const paving = (x: number, z: number, width: number, depth: number) => {
    let rectangles = [{ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }];
    for (const hole of pavingCuts) rectangles = rectangles.flatMap((rectangle) => {
      const left = Math.max(rectangle.minX, hole.minX);
      const right = Math.min(rectangle.maxX, hole.maxX);
      const back = Math.max(rectangle.minZ, hole.minZ);
      const front = Math.min(rectangle.maxZ, hole.maxZ);
      if (left >= right || back >= front) return [rectangle];
      return [
        { ...rectangle, maxX: left }, { ...rectangle, minX: right },
        { minX: left, maxX: right, minZ: rectangle.minZ, maxZ: back },
        { minX: left, maxX: right, minZ: front, maxZ: rectangle.maxZ },
      ].filter(({ minX, maxX, minZ, maxZ }) => maxX > minX && maxZ > minZ);
    });
    for (const { minX, maxX, minZ, maxZ } of rectangles) {
      block(p.paving, (minX + maxX) / 2, -0.025, (minZ + maxZ) / 2, maxX - minX, 0.1, maxZ - minZ);
    }
  };
  for (const x of [WEST_X, EAST_X]) for (const position of [-50.5, 0.5, 51.5]) {
    const z = position * SIDE_SCALE;
    paving(x, z, 10.8, 9 * SIDE_SCALE);
    if (x === WEST_X && position === 51.5) {
      tree(x - 4.6, z - 3.6, 0.72);
      tree(x - 1.6, z - 3.6, 0.68);
      bench(x - 4.6, z + 0.8, Math.PI / 2);
      continue;
    }
    tree(x - 3, z - 2 * SIDE_SCALE, 0.92);
    tree(x + 3, z + 2 * SIDE_SCALE, 0.85);
    bench(x, z - 2.8 * SIDE_SCALE);
  }

  const basketball = BASKETBALL_COURT;
  const pickleball = PICKLEBALL_COURT;
  const courtX = basketball.x;
  const courtZ = basketball.z;
  const courtParcel = STREET_BLOCKS.find(({ minX, maxX, minZ, maxZ }) =>
    minX === RECREATION_AREA.minX && maxX === RECREATION_AREA.maxX &&
    minZ === RECREATION_AREA.minZ && maxZ === RECREATION_AREA.maxZ)!;
  paving(courtParcel.x, courtParcel.z,
    courtParcel.maxX - courtParcel.minX - 0.4, courtParcel.maxZ - courtParcel.minZ - 0.4);
  for (const court of [basketball, pickleball]) {
    const edgeX = (court.runoffWidth - court.width) / 2;
    const edgeZ = (court.runoffDepth - court.depth) / 2;
    for (const side of [-1, 1]) {
      block(p.road, court.x + side * (court.width / 2 + edgeX / 2), court.surfaceY - 0.015,
        court.z, edgeX, 0.03, court.runoffDepth);
      block(p.road, court.x, court.surfaceY - 0.015, court.z + side * (court.depth / 2 + edgeZ / 2),
        court.width, 0.03, edgeZ);
    }
  }
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
      block(p.line, court.x + side * (court.width / 2 - court.lineWidth / 2), court.surfaceY + 0.006, court.z,
        court.lineWidth, 0.008, court.depth - court.lineWidth);
      block(p.line, court.x, court.surfaceY + 0.006, court.z + side * (court.depth / 2 - court.lineWidth / 2),
        court.width - court.lineWidth, 0.008, court.lineWidth);
    }
  }
  const courtArc = (x: number, radius: number, side: number, halfAngle: number, segments: number) => {
    for (let segment = 0; segment < segments; segment++) {
      const a = -halfAngle + segment / segments * halfAngle * 2;
      const b = -halfAngle + (segment + 1) / segments * halfAngle * 2;
      const ax = x - side * Math.cos(a) * radius;
      const az = courtZ + Math.sin(a) * radius;
      const bx = x - side * Math.cos(b) * radius;
      const bz = courtZ + Math.sin(b) * radius;
      block(p.line, (ax + bx) / 2, basketball.surfaceY + 0.006, (az + bz) / 2,
        Math.hypot(bx - ax, bz - az), 0.008, basketball.lineWidth, -Math.atan2(bz - az, bx - ax));
    }
  };
  block(p.line, courtX, basketball.surfaceY + 0.006, courtZ,
    basketball.lineWidth, 0.008, basketball.depth - basketball.lineWidth);
  courtArc(courtX, basketball.centerCircleRadius, 1, Math.PI, 48);
  for (const side of [-1, 1]) {
    const keyDepth = basketball.width / 2 - basketball.freeThrowOffset;
    block(p.line, courtX + side * basketball.freeThrowOffset, basketball.surfaceY + 0.006,
      courtZ, basketball.lineWidth, 0.008, basketball.keyWidth);
    for (const flank of [-1, 1]) block(p.line,
      courtX + side * (basketball.width / 2 - keyDepth / 2 - basketball.lineWidth / 2), basketball.surfaceY + 0.006,
      courtZ + flank * basketball.keyWidth / 2, keyDepth - basketball.lineWidth, 0.008, basketball.lineWidth);
    courtArc(courtX + side * basketball.freeThrowOffset, basketball.centerCircleRadius, side, Math.PI, 48);
    const rimX = courtX + side * basketball.hoopOffset;
    const rimY = basketball.surfaceY + basketball.hoopHeight;
    const arcAngle = Math.asin(basketball.cornerLineOffset / basketball.threePointRadius);
    const arcEnd = basketball.hoopOffset - Math.cos(arcAngle) * basketball.threePointRadius;
    courtArc(rimX, basketball.threePointRadius, side, arcAngle, 48);
    courtArc(rimX, basketball.restrictedRadius, side, Math.PI / 2, 24);
    for (const flank of [-1, 1]) block(p.line,
      courtX + side * (basketball.width / 2 + arcEnd - basketball.lineWidth / 2) / 2,
      basketball.surfaceY + 0.006, courtZ + flank * basketball.cornerLineOffset,
      basketball.width / 2 - arcEnd - basketball.lineWidth / 2, 0.008, basketball.lineWidth);
    const poleX = courtX + side * basketball.supportOffset;
    const boardX = courtX + side * basketball.backboardOffset;
    add(cylinder, p.copperEdge, [poleX, basketball.surfaceY + 2.05, courtZ], [0.11, 4.1, 0.11]);
    block(p.roof, poleX, basketball.surfaceY + 0.08, courtZ, 0.45, 0.16, 0.65);
    block(p.rubber, poleX, basketball.surfaceY + 0.9, courtZ, 0.3, 1.5, 0.35);
    block(p.paving, boardX + side * 0.02,
      basketball.surfaceY + basketball.backboardBottom + basketball.backboardHeight / 2,
      courtZ, 0.04, basketball.backboardHeight, basketball.backboardWidth);
    for (const y of [rimY, rimY + 0.4572]) block(p.roof, boardX - side * 0.012, y, courtZ, 0.012, 0.02, 0.6096);
    for (const flank of [-1, 1]) block(p.roof, boardX - side * 0.012,
      rimY + 0.2286, courtZ + flank * 0.3048, 0.012, 0.4572, 0.02);
    rod(p.copperEdge, [poleX, basketball.surfaceY + 3.95, courtZ],
      [boardX, basketball.surfaceY + 3.65, courtZ], 0.13);
    rod(p.copperEdge, [poleX, basketball.surfaceY + 3.3, courtZ],
      [boardX + side * 0.5, basketball.surfaceY + 3.65, courtZ], 0.07);
    const ringRadius = basketball.rimRadius + 0.0095;
    rod(p.copper, [boardX, rimY, courtZ], [rimX + side * ringRadius, rimY, courtZ], 0.019);
    for (let segment = 0; segment < 24; segment++) {
      const angle = segment / 24 * Math.PI * 2;
      block(p.copper, rimX + Math.cos(angle) * ringRadius, rimY, courtZ + Math.sin(angle) * ringRadius,
        2 * ringRadius * Math.tan(Math.PI / 24), 0.019, 0.019, -angle - Math.PI / 2);
      if (segment % 2 === 0) rod(p.line,
        [rimX + Math.cos(angle) * basketball.rimRadius, rimY, courtZ + Math.sin(angle) * basketball.rimRadius],
        [rimX + Math.cos(angle) * 0.13, rimY - 0.4572, courtZ + Math.sin(angle) * 0.13], 0.012);
    }
    block(p.line, pickleball.x + side * pickleball.kitchenDepth, pickleball.surfaceY + 0.006,
      pickleball.z, pickleball.lineWidth, 0.008, pickleball.depth - pickleball.lineWidth);
    block(p.line, pickleball.x + side * (pickleball.kitchenDepth + serviceWidth / 2),
      pickleball.surfaceY + 0.006, pickleball.z, serviceWidth - pickleball.lineWidth, 0.008, pickleball.lineWidth);
    add(cylinder, p.rubber,
      [pickleball.x, pickleball.surfaceY + pickleball.netHeight / 2, pickleball.z + side * pickleball.netPostOffset],
      [pickleball.netPostRadius, pickleball.netHeight, pickleball.netPostRadius]);
  }
  const netBottom = pickleball.surfaceY + 0.1;
  const netColumns = Math.ceil(pickleball.netSpan / 0.5) * 2;
  for (let thread = 0; thread <= netColumns; thread++) {
    const z = (thread / netColumns - 0.5) * pickleball.netSpan;
    const top = pickleball.surfaceY + netHeightAt(z);
    const meshHeight = top - 0.04 - netBottom;
    block(p.rubber, pickleball.x, netBottom + meshHeight / 2, pickleball.z + z, 0.015, meshHeight, 0.015);
    if (thread === netColumns) continue;
    const nextZ = ((thread + 1) / netColumns - 0.5) * pickleball.netSpan;
    const nextTop = pickleball.surfaceY + netHeightAt(nextZ);
    rod(p.line, [pickleball.x, top - 0.02, pickleball.z + z],
      [pickleball.x, nextTop - 0.02, pickleball.z + nextZ], 0.04);
    for (let row = 0; row < 4; row++) rod(p.rubber,
      [pickleball.x, netBottom + meshHeight * row / 4, pickleball.z + z],
      [pickleball.x, netBottom + (nextTop - 0.04 - netBottom) * row / 4, pickleball.z + nextZ], 0.015);
  }
  block(p.line, pickleball.x, pickleball.surfaceY + pickleball.netCenterHeight / 2,
    pickleball.z, 0.04, pickleball.netCenterHeight, 0.025);
  for (const z of [106.2, 120.8]) bench(2.6, z);
  bench(31, 121);
  for (const x of [31, 36.5]) tree(x, 117, 0.7);
  const fenceX = courtParcel.minX + 0.45;
  const fenceStart = courtZ - basketball.runoffDepth / 2 - 0.45;
  const fenceEnd = courtZ + basketball.runoffDepth / 2 + 0.45;
  const fencePosts = Math.ceil((fenceEnd - fenceStart) / 2.4);
  for (let post = 0; post <= fencePosts; post++) {
    const z = fenceStart + (fenceEnd - fenceStart) * post / fencePosts;
    rod(p.copperEdge, [fenceX, 0, z], [fenceX, 3.048, z], 0.065);
  }
  for (const y of [0.45, 1.75, 3.048]) rod(p.copperEdge,
    [fenceX, y, fenceStart], [fenceX, y, fenceEnd], 0.045);
  for (let z = fenceStart + 0.4; z < fenceEnd; z += 0.4) rod(p.rubber,
    [fenceX, 0.15, z], [fenceX, 3, z], 0.015);
  for (let y = 0.55; y < 3; y += 0.4) rod(p.rubber,
    [fenceX, y, fenceStart], [fenceX, y, fenceEnd], 0.015);

  const subway = ({ x, z, yaw }: MetroEntrance) => {
    const g = METRO_GEOMETRY;
    const mouth = g.openingDepth / 2;
    const bottom = -g.stepCount * g.stepRise;
    const local = (lx: number, y: number, lz: number): Triple =>
      [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), g.surfaceY + y,
        z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    const piece = (paint: THREE.Material, lx: number, y: number, lz: number, width: number, height: number, depth: number) => {
      const point = local(lx, y, lz);
      block(paint, point[0], point[1], point[2], width, height, depth, yaw);
    };
    const rail = (paint: THREE.Material, a: Triple, b: Triple, thickness: number) =>
      rod(paint, local(...a), local(...b), thickness);
    piece(p.rubber, 0, bottom - 0.06, -mouth + g.landingDepth / 2, g.openingWidth, 0.12, g.landingDepth);
    piece(p.paving, 0, -0.045, mouth + g.apronDepth / 2, g.openingWidth, 0.09, g.apronDepth);
    piece(p.cream, 0, bottom / 2, -mouth - g.wallThickness / 2,
      g.openingWidth + 2 * g.wallThickness, -bottom, g.wallThickness);
    piece(p.stone, 0, 0.025, -mouth - 0.06, g.openingWidth + 0.24, 0.15, 0.18);
    for (let step = 0; step < g.stepCount; step++) {
      piece(p.stone, 0, -(step + 1.5) * g.stepRise, mouth - (step + 0.5) * g.treadDepth,
        g.openingWidth, g.stepRise, g.treadDepth);
    }
    for (const side of [-1, 1]) {
      const edge = side * (g.openingWidth / 2 + g.wallThickness / 2);
      piece(p.cream, edge, bottom / 2, 0, g.wallThickness, -bottom, g.openingDepth);
      piece(p.stone, edge, 0.025, 0, 0.18, 0.15, g.openingDepth + 0.18);
      for (let index = 0; index <= 11; index++) {
        piece(p.rubber, edge, 0.61, -2.15 + index * 4.3 / 11, 0.03, 0.82, 0.03);
      }
      for (const y of [0.25, g.railingHeight]) piece(p.rubber, edge, y, 0, 0.045, 0.045, g.openingDepth);
      for (const end of [-1, 1]) {
        piece(p.rubber, edge, end < 0 ? 0.55 : 1.28, end * mouth, 0.095, end < 0 ? 1.1 : 2.56, 0.095);
        if (end < 0) piece(p.teal, edge, 1.12, -mouth, 0.13, 0.08, 0.13);
      }
      const railX = side * (g.openingWidth / 2 - 0.12);
      const topZ = mouth - g.treadDepth / 2;
      const bottomZ = mouth - (g.stepCount - 0.5) * g.treadDepth;
      rail(p.stone, [railX, -g.stepRise + 0.86, topZ], [railX, bottom + 0.86, bottomZ], 0.045);
      for (const step of [0, 5, 11]) {
        const y = -(step + 1) * g.stepRise;
        const along = mouth - (step + 0.5) * g.treadDepth;
        rail(p.stone, [railX, y, along], [railX, y + 0.86, along], 0.035);
      }
      add(crown, p.taxi, local(edge, g.globeHeight, mouth), [0.18, 0.18, 0.18]);
      add(crown, p.leaf, local(edge, g.globeHeight + 0.14, mouth), [0.18, 0.065, 0.18]);
    }
    for (const y of [0.25, g.railingHeight]) piece(p.rubber, 0, y, -mouth, g.openingWidth, 0.045, 0.045);
    for (let index = -2; index <= 2; index++) piece(p.rubber, index * 0.32, 0.61, -mouth, 0.03, 0.82, 0.03);
    piece(p.rubber, 0, g.signHeight, mouth, 2.06, 0.36, 0.07);
    for (const y of [-0.195, 0.195]) piece(p.teal, 0, g.signHeight + y, mouth, 2.06, 0.025, 0.08);
    // Original line-stroke lettering stays legible without hundreds of tiny pixel boxes.
    let column = 0;
    for (const letter of SUBWAY_LETTERS) {
      for (const [ax, ay, bx, by] of letter.strokes) for (const face of [-1, 1]) {
        rail(p.line,
          [face * (column + ax - 12.5) * 0.065, g.signHeight + (2 - ay) * 0.065, mouth + face * 0.055],
          [face * (column + bx - 12.5) * 0.065, g.signHeight + (2 - by) * 0.065, mouth + face * 0.055], 0.022);
      }
      column += letter.width + 1;
    }
  };
  const transitX = TRANSIT.x;
  const transitZ = TRANSIT.z;
  for (const entrance of METRO_ENTRANCES) subway(entrance);
  paving(transitX - 3.3, transitZ + 7.5, 2.6, 1.25);
  paving(transitX + 0.2, transitZ + 8.2, 2.6, 1.25);
  paving(transitX - 7.9, transitZ + 2.5, 2.5, 1.9);
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
  const shed = (x: number, z: number, length: number, yaw: number, minAcross = -1.35, maxAcross = 1.35) => {
    const local = (along: number, y: number, across: number): Triple =>
      [x + along * Math.cos(yaw) + across * Math.sin(yaw), y,
        z - along * Math.sin(yaw) + across * Math.cos(yaw)];
    const piece = (surface: THREE.Material, along: number, y: number, across: number, width: number, height: number, depth: number) => {
      const point = local(along, y, across);
      block(surface, point[0], point[1], point[2], width, height, depth, yaw);
    };
    const half = length / 2 - 0.2;
    for (const along of [-half, -half / 3, half / 3, half]) {
      for (const across of [-1.2, 1.2]) piece(p.roof, along, 1.28, across, 0.1, 2.84, 0.1);
      piece(p.roof, along, 2.62, (minAcross + maxAcross) / 2, 0.12, 0.16, maxAcross - minAcross - 0.15);
    }
    for (const across of [-1.2, 1.2]) {
      piece(p.roof, 0, 2.64, across, length - 0.15, 0.17, 0.14);
      piece(p.teal, 0, 2.99, across, length, 0.48, 0.12);
      for (const along of [-half, half / 3]) {
        rod(p.roof, local(along, 0.25, across), local(along + half * 2 / 3, 2.5, across), 0.065);
      }
    }
    piece(p.roof, 0, 2.78, (minAcross + maxAcross) / 2, length, 0.18, maxAcross - minAcross);
    for (const along of [-half * 2 / 3, 0, half * 2 / 3]) piece(p.line, along, 2.66, 0, 0.65, 0.06, 0.22);
  };
  shed(shedX, shedWalkZ, 7.3, 0);
  for (const site of SIDEWALK_SHEDS) {
    const building = STREET_BUILDINGS.find(({ id }) => id === site.buildingId)!;
    const outward = Math.sign(site.x - building.x);
    const face = building.x + outward * building.width / 2;
    shed(site.x, site.z, site.length, Math.PI / 2,
      Math.min(-1.35, face - site.x - 0.02), Math.max(1.35, face - site.x + 0.02));
    if (!site.scaffold) continue;
    const half = (building.depth - 0.5) / 2;
    const lifts = Math.min(3, building.floors - 1);
    const top = 2.9 + lifts * 2.1;
    for (const along of [-half, 0, half]) for (const across of [0.18, 1.02]) {
      block(p.roof, face + outward * across, (2.9 + top) / 2, site.z + along, 0.07, top - 2.9, 0.07);
    }
    for (let lift = 0; lift < lifts; lift++) {
      const bottom = 2.9 + lift * 2.1;
      const y = bottom + 2.1;
      block(p.wood, face + outward * 0.6, y, site.z, 1.05, 0.09, half * 2 + 0.3);
      for (const across of [0.18, 1.02]) block(p.roof,
        face + outward * across, y - 0.05, site.z, 0.07, 0.09, half * 2 + 0.2);
      const outer = face + outward * 1.06;
      for (const along of [-half, 0]) {
        rod(p.roof, [outer, bottom, site.z + along], [outer, y, site.z + along + half], 0.045);
        rod(p.roof, [outer, y, site.z + along], [outer, bottom, site.z + along + half], 0.045);
      }
    }
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
  for (const [x, z] of [[WEST_X, -50.5 * SIDE_SCALE], [EAST_X, 0.5 * SIDE_SCALE], [transitX + 4.8, transitZ + 7.1], [36, 120]] as const) {
    for (let index = 0; index < 3; index++) {
      const pz = z + index * 0.8;
      rod(p.copperEdge, [x - 0.45, 0, pz], [x - 0.45, 0.75, pz], 0.045);
      rod(p.copperEdge, [x + 0.45, 0, pz], [x + 0.45, 0.75, pz], 0.045);
      rod(p.copperEdge, [x - 0.45, 0.75, pz], [x + 0.45, 0.75, pz], 0.045);
    }
  }
  for (const [x, z] of [[2.5, 113.5], [transitX - 7.9, transitZ + 2.5]] as const) {
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
