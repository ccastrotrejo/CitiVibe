import * as THREE from 'three';
import {
  BIKE_OFFSET, CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_HALF_WIDTH,
  SIDEWALK_OFFSET, STOP_LINE_OFFSET, STREET_X, STREET_Z, VEHICLE_OFFSET,
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
}

/** Interior parcels exclude the shared sidewalks and the retained garden block. */
export const STREET_BLOCKS: readonly StreetBlock[] = STREET_Z.slice(0, -1).flatMap((south, row) =>
  STREET_X.slice(0, -1).flatMap((west, column) => {
    if (row === 1 && column === 1) return [];
    const east = STREET_X[column + 1];
    const north = STREET_Z[row + 1];
    return [{
      id: `block-${column}-${row}`, x: (west + east) / 2, z: (south + north) / 2,
      minX: west + SIDEWALK_HALF_WIDTH, maxX: east - SIDEWALK_HALF_WIDTH,
      minZ: south + SIDEWALK_HALF_WIDTH, maxZ: north - SIDEWALK_HALF_WIDTH,
    }];
  }),
);

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
    buildings.push({
      id: `street-building-${index + 1}`, blockId, x, z, width, depth, floors,
      skin: skins[index % skins.length], roof: roofs[index % roofs.length],
      setbackFloors: accent ? 2 : 0, fireEscape: index % 3 === 0,
      stoop: width > 4 && index % 2 === 0,
    });
  };
  for (const row of [0, 2]) {
    for (let column = 0; column < 7; column++) {
      add(`block-1-${row}`, -19.5 + column * 6.5, (row === 0 ? -40 : 40) + (column % 2 ? -0.8 : 0.6),
        5.5 + (column % 2) * 0.3, 7.5 + (column % 3) * 0.7,
        3 + (column * 3 + row) % 5, column === 3);
    }
  }
  for (const column of [0, 2]) {
    for (let row = 0; row < 3; row++) {
      for (const side of [-1, 1]) {
        add(`block-${column}-1`, (column === 0 ? -45 : 45) + side * 4.3,
          -12.5 + row * 12.5, 5.8, 8.8 + (row % 2) * 0.8,
          3 + (row + column + side + 1) % 5, row === 1 && side === 1);
      }
    }
  }
  add('block-0-0', -50, -40, 4.6, 9.5, 4);
  add('block-0-0', -42, -44.2, 6.5, 3.5, 3);
  add('block-2-0', 39.5, -40, 3.8, 9.5, 5);
  add('block-2-0', 48.2, -44.5, 8.2, 4, 4);
  add('block-2-2', 40.4, 40.2, 5.8, 9.3, 4);
  add('block-2-2', 49.4, 39.5, 5.8, 9.4, 6);
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
  return building.skin === 'clay' && building.stoop && building.floors <= 5;
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
      stripe(p.paving, road, 0, 0, SIDEWALK_HALF_WIDTH * 2, extent * 2, -0.13, 0.1);
      stripe(p.road, road, 0, 0, ROAD_HALF_WIDTH * 2, extent * 2, vertical ? -0.065 : -0.055, 0.1);
      for (const segment of streetSpans(extent, crossings, ROAD_HALF_WIDTH)) {
        for (const side of [-1, 1]) {
          stripe(p.teal, road, segment.center, side * BIKE_OFFSET, 1.28, segment.length, 0.004, 0.015);
          stripe(p.line, road, segment.center, side * (BIKE_OFFSET - 0.77),
            0.085, segment.length, 0.016, 0.016);
        }
      }
      for (const segment of streetSpans(extent, crossings, STOP_LINE_OFFSET)) {
        for (const side of [-1, 1]) {
          stripe(p.stone, road, segment.center, side * (ROAD_HALF_WIDTH + 0.09),
            0.18, segment.length, 0.025, 0.13);
          for (let along = segment.center - segment.length / 2 + 1; along < segment.center + segment.length / 2; along += 3.4) {
            const x = vertical ? road + side * 3.1 : along;
            const z = vertical ? along : road + side * 3.1;
            add(cylinder, p.line, [x, 0.32, z], [0.07, 0.64, 0.07]);
            add(cylinder, p.rubber, [x, 0.1, z], [0.12, 0.15, 0.12]);
          }
        }
        for (let along = segment.center - segment.length / 2 + 1; along < segment.center + segment.length / 2 - 0.5; along += 4) {
          stripe(p.line, road, along, 0, 0.085, 1.5, 0.017, 0.018);
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
        block(p.line, intersection.x - side * BIKE_OFFSET, 0.02, intersection.z - side * STOP_LINE_OFFSET, 1.25, 0.024, 0.18);
      }
      if (Math.abs(intersection.x + side * STOP_LINE_OFFSET) < CITY_EXTENT.x) {
        block(p.line, intersection.x + side * STOP_LINE_OFFSET, 0.02, intersection.z - side * VEHICLE_OFFSET, 0.18, 0.024, 2.65);
        block(p.line, intersection.x + side * STOP_LINE_OFFSET, 0.02, intersection.z - side * BIKE_OFFSET, 0.18, 0.024, 1.25);
      }
    }
  }

  const facade = (building: StreetBuilding, width: number, depth: number, base: number, floors: number) => {
    const { x, z } = building;
    const height = floors * 2.4;
    const brownstone = isBrownstone(building);
    const masonry = brownstone ? p.wood : p[building.skin];
    block(masonry, x, base + height / 2, z, width, height, depth);
    for (let floor = 0; floor < floors; floor++) {
      const principal = brownstone && floor === 0;
      const y = base + floor * 2.4 + (principal ? 1.6 : 1.25);
      const windowHeight = principal ? 1.55 : 1.24;
      for (const side of [-1, 1]) {
        const front = z + side * (depth / 2 + 0.025);
        const flank = x + side * (width / 2 + 0.025);
        const columns = Math.max(1, Math.floor(width / 1.8));
        const bays = Math.max(1, Math.floor(depth / 1.8));
        for (let column = 0; column < columns; column++) {
          const wx = x + (column - (columns - 1) / 2) * (width - 1.25) / columns;
          if (principal && side > 0 && Math.abs(wx - (x - width * 0.26)) < 0.7) continue;
          block(p.glass, wx, y, front, 0.79, windowHeight, 0.045);
          block(brownstone ? p.copperEdge : p.paving, wx, y - windowHeight / 2 - 0.08,
            front + side * 0.07, 1.02, brownstone ? 0.16 : 0.1, 0.2);
          if (brownstone && side > 0) {
            block(p.copperEdge, wx, y + windowHeight / 2 + 0.1, front + 0.08, 1.06, 0.18, 0.24);
            if (principal) {
              block(p.rubber, wx, y, front + 0.035, 0.79, 0.065, 0.065);
              block(p.glass, wx, 0.5, front + 0.15, 0.68, 0.3, 0.045);
            }
          } else {
            block(brownstone ? p.rubber : masonry, wx, y + 0.05, front + side * 0.03,
              brownstone ? 0.79 : 0.07, brownstone ? 0.065 : windowHeight, 0.075);
          }
        }
        for (let bay = 0; bay < bays; bay++) {
          const wz = z + (bay - (bays - 1) / 2) * (depth - 1.25) / bays;
          block(p.glass, flank, y, wz, 0.045, windowHeight, 0.79);
          block(brownstone ? p.copperEdge : p.paving, flank + side * 0.07,
            y - windowHeight / 2 - 0.08, wz, 0.2, brownstone ? 0.16 : 0.1, 1.02);
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
    for (const x of [parcel.minX + 1.3, parcel.maxX - 1.3]) {
      for (const z of [parcel.minZ + 1.3, parcel.maxZ - 1.3]) {
        if (STREET_BUILDINGS.some((building) =>
          Math.abs(building.x - x) < building.width / 2 + 1.3 &&
          Math.abs(building.z - z) < building.depth / 2 + 1.3)) continue;
        tree(x, z, 0.8 + ((Math.abs(x + z) * 10) % 3) * 0.1);
      }
    }
  }
  for (const x of [-45, 45]) for (const z of [-6.25, 6.25]) {
    tree(x, z, 0.92);
    bench(x, z + 1.8);
  }
  for (const x of [-15, -2, 15]) {
    tree(x, -34.3, 0.8);
    tree(x, 45.2, 0.8);
  }

  // Juniper Court: a modest half-court and open planted sitting edge, not a full arena.
  block(p.paving, -45, -0.015, 40, 15.8, 0.12, 13.8);
  block(p.teal, -44.5, 0.063, 40, 9.4, 0.035, 10.8);
  for (const side of [-1, 1]) {
    block(p.line, -44.5 + side * 4.35, 0.085, 40, 0.07, 0.02, 10.2);
    block(p.line, -44.5, 0.085, 40 + side * 5.1, 8.7, 0.02, 0.07);
  }
  block(p.line, -44.5, 0.085, 40, 8.7, 0.02, 0.06);
  for (let segment = 0; segment < 24; segment++) {
    const angle = segment / 24 * Math.PI * 2;
    block(p.line, -44.5 + Math.cos(angle) * 1.5, 0.085, 40 + Math.sin(angle) * 1.5,
      0.4, 0.02, 0.06, -angle - Math.PI / 2);
  }
  for (const side of [-1, 1]) {
    const z = 40 + side * 4.65;
    add(cylinder, p.copperEdge, [-44.5, 1.6, z], [0.075, 3.2, 0.075]);
    block(p.paving, -44.5, 2.92, z - side * 0.28, 1.3, 0.9, 0.09);
    block(p.roof, -44.5, 2.93, z - side * 0.34, 0.57, 0.36, 0.035);
    const rimZ = z - side * 0.65;
    for (let segment = 0; segment < 10; segment++) {
      const angle = segment / 10 * Math.PI * 2;
      block(p.copper, -44.5 + Math.cos(angle) * 0.22, 2.65, rimZ + Math.sin(angle) * 0.22,
        0.15, 0.035, 0.035, -angle - Math.PI / 2);
    }
  }
  for (const z of [35.8, 40, 44.2]) bench(-51.2, z, Math.PI / 2);
  for (const z of [34.5, 45.5]) tree(-38.5, z, 0.8);
  for (let z = 34; z <= 46; z += 2) {
    rod(p.copperEdge, [-49.8, 0, z], [-49.8, 2.5, z], 0.055);
  }
  for (const y of [0.5, 1.5, 2.5]) rod(p.copperEdge, [-49.8, y, 34], [-49.8, y, 46], 0.045);

  const subway = (x: number, z: number) => {
    block(p.roof, x, 0.065, z, 2.2, 0.15, 4.2);
    for (let step = 0; step < 6; step++) {
      block(p.stone, x, 0.17 - step * 0.018, z + 1.7 - step * 0.56, 1.85, 0.06, 0.24);
    }
    for (const side of [-1, 1]) {
      for (let index = 0; index < 6; index++) {
        add(cylinder, p.copperEdge, [x + side * 1.05, 0.66, z - 2 + index * 0.7], [0.035, 1.25, 0.035]);
      }
      rod(p.copperEdge, [x + side * 1.05, 1.26, z - 2], [x + side * 1.05, 1.26, z + 1.6], 0.065);
      add(cylinder, p.copperEdge, [x + side * 1.05, 1.28, z + 2], [0.065, 2.56, 0.065]);
      add(crown, p.leafLight, [x + side * 1.05, 2.63, z + 2], [0.25, 0.25, 0.25]);
      add(cylinder, p.paving, [x + side * 1.05, 2.62, z + 2], [0.26, 0.1, 0.26]);
    }
    rod(p.copperEdge, [x - 1.05, 1.26, z - 2], [x + 1.05, 1.26, z - 2], 0.065);
  };
  // Crosstown Steps retains generous circulation beside a small unbranded shelter.
  block(p.paving, 46.8, -0.025, -38.3, 11.7, 0.1, 10.3);
  subway(49, -39);
  subway(-44.9, 13.5);
  for (const x of [42.5, 46.5]) {
    add(cylinder, p.copperEdge, [x, 1.4, -34.9], [0.065, 2.8, 0.065]);
  }
  block(p.teal, 44.5, 2.83, -34.9, 5.2, 0.18, 2.2);
  block(p.paving, 44.5, 2.95, -34.9, 5.45, 0.08, 2.4);
  bench(44.5, -35);
  bench(51.4, -34.4);
  tree(42.5, -38.5, 0.8);

  // A compact construction pocket: open frame, muted safety fencing and a lattice crane.
  block(p.sand, -43, 0.02, -37.6, 9.1, 0.12, 7.8);
  for (const x of [-46.3, -40]) for (const z of [-40.1, -35.1]) {
    block(p.stone, x, 2.1, z, 0.55, 4.2, 0.55);
  }
  for (const y of [0.25, 2.3, 4.25]) {
    block(p.stone, -43.15, y, -37.6, 7.2, 0.24, 5.8);
  }
  for (const z of [-41.5, -33.9]) block(p.teal, -43, 0.75, z, 9.1, 1.5, 0.13);
  block(p.teal, -38.4, 0.75, -37.7, 0.13, 1.5, 7.7);
  for (const x of [-46.8, -45.8, -44.8]) {
    block(p.wood, x, 0.32, -35, 0.55, 0.5, 1.4);
  }
  // The facade scaffold stays behind the separate protective sidewalk shed.
  for (const x of [-46.8, -43.2, -39.6]) {
    for (const z of [-35.15, -34.35]) {
      block(p.roof, x, 3.4, z, 0.085, 6.8, 0.085);
    }
  }
  for (const y of [2.2, 4.4, 6.6]) {
    for (const z of [-35.15, -34.35]) block(p.roof, -43.2, y, z, 7.3, 0.09, 0.09);
    block(p.wood, -43.2, y + 0.06, -34.75, 7.3, 0.08, 1);
    for (const x of [-46.8, -43.2]) {
      rod(p.roof, [x, y - 2.1, -34.3], [x + 3.6, y, -34.3], 0.055);
      rod(p.roof, [x, y, -34.3], [x + 3.6, y - 2.1, -34.3], 0.055);
    }
  }
  const shedWalkZ = STREET_Z[1] - SIDEWALK_OFFSET;
  for (const x of [-47, -44.2, -41.4, -38.6]) {
    for (const z of [shedWalkZ - 1.25, shedWalkZ + 0.9]) {
      block(p.roof, x, 1.35, z, 0.1, 2.7, 0.1);
    }
    block(p.roof, x, 2.62, shedWalkZ - 0.175, 0.12, 0.16, 2.35);
  }
  for (const z of [shedWalkZ - 1.25, shedWalkZ + 0.9]) {
    block(p.roof, -42.8, 2.64, z, 8.65, 0.17, 0.14);
    block(p.teal, -42.8, 2.99, z, 8.8, 0.48, 0.12);
    for (const x of [-47, -41.4]) {
      rod(p.roof, [x, 0.25, z], [x + 2.8, 2.5, z], 0.065);
    }
  }
  block(p.roof, -42.8, 2.78, shedWalkZ - 0.175, 8.8, 0.18, 2.5);
  for (const x of [-45.6, -42.8, -40]) {
    block(p.line, x, 2.66, shedWalkZ - 0.175, 0.65, 0.06, 0.22);
  }
  const craneX = -43;
  const craneZ = -38.5;
  for (const dx of [-0.4, 0.4]) for (const dz of [-0.4, 0.4]) {
    rod(p.copper, [craneX + dx, 0, craneZ + dz], [craneX + dx, 18, craneZ + dz], 0.1);
  }
  for (let y = 1; y < 18; y += 1.5) {
    for (const dz of [-0.4, 0.4]) {
      rod(p.copper, [craneX - 0.4, y, craneZ + dz], [craneX + 0.4, y + 1.2, craneZ + dz], 0.055);
    }
    block(p.copper, craneX, y, craneZ, 0.9, 0.09, 0.9);
  }
  for (const y of [17.8, 18.5]) block(p.copper, -44, y, craneZ, 13.2, 0.12, 0.4);
  for (let x = -50; x < -38; x++) {
    rod(p.copper, [x, 17.8, craneZ], [x + 0.8, 18.5, craneZ], 0.065);
  }
  block(p.teal, -44.1, 17.1, craneZ, 1.1, 1.1, 1.1);
  block(p.glass, -44.1, 17.25, craneZ + 0.56, 0.8, 0.55, 0.035);
  block(p.stone, -49.5, 17.35, craneZ, 1.6, 0.8, 1);
  rod(p.copperEdge, [-38.5, 17.8, craneZ], [-38.5, 6, craneZ], 0.035);
  block(p.copperEdge, -38.5, 5.8, craneZ, 0.3, 0.4, 0.2);

  for (const x of [-60, -30, 30, 60]) {
    for (const z of [-39, 1, 39]) {
      const side = x < 0 ? -1 : 1;
      const px = x + side * 5.5;
      add(cylinder, p.clay, [px, 0.42, z], [0.16, 0.7, 0.16]);
      add(crown, p.clay, [px, 0.79, z], [0.2, 0.14, 0.2]);
      block(p.copperEdge, px, 0.52, z, 0.5, 0.14, 0.15);
    }
  }
  for (const [x, z] of [[-44.8, -14], [44.8, 14], [51.2, -36.4], [-38.4, 39.5]] as const) {
    for (let index = 0; index < 3; index++) {
      const pz = z + index * 0.8;
      rod(p.copperEdge, [x - 0.45, 0, pz], [x - 0.45, 0.75, pz], 0.045);
      rod(p.copperEdge, [x + 0.45, 0, pz], [x + 0.45, 0.75, pz], 0.045);
      rod(p.copperEdge, [x - 0.45, 0.75, pz], [x + 0.45, 0.75, pz], 0.045);
    }
  }
  for (const [x, z] of [[-51.1, 37.6], [44.2, -41]] as const) {
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
        if (Math.abs(px) < 24 && Math.abs(pz) < 21) pz = 2 * intersection.z - pz;
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
