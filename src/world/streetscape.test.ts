import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BASKETBALL_COURT, PICKLEBALL_COURT } from '../content/courts';
import {
  BIKE_OFFSET, CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_HALF_WIDTH, SIDEWALK_OFFSET,
  STOP_LINE_OFFSET, STREET_X, STREET_Z, TWO_WAY_BIKE_STREETS, TWO_WAY_BIKE_TRACK,
  VEHICLE_OFFSET, bikeLaneOffset,
} from '../content/streets';
import {
  buildStreetscape, STREET_BLOCKS, STREET_BUILDINGS, validateStreetscape,
  type Streetscape, type StreetscapeBuilder, type StreetscapeSignalState,
} from './streetscape';

interface Part {
  shape: THREE.BufferGeometry;
  surface: THREE.Material;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotation: readonly [number, number, number];
  matrix: THREE.Matrix4;
  bounds: THREE.Box3;
}

const cleanups: (() => void)[] = [];
const centerColumn = Math.floor((STREET_X.length - 1) / 2);
const centerRow = Math.floor((STREET_Z.length - 1) / 2);
const westX = (STREET_X[centerColumn - 1] + STREET_X[centerColumn]) / 2;
const parkHalfX = STREET_X[centerColumn + 1] - SIDEWALK_HALF_WIDTH;
const parkHalfZ = STREET_Z[centerRow + 1] - SIDEWALK_HALF_WIDTH;
const sideScale = parkHalfZ / 98;
const approachCount = INTERSECTIONS.length * 4 - 2 * (STREET_X.length + STREET_Z.length);

function createArt(build = buildStreetscape) {
  const box = new THREE.BoxGeometry();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const crown = new THREE.DodecahedronGeometry(1);
  const names = [
    'sand', 'stone', 'paving', 'road', 'line', 'cream', 'clay', 'teal', 'roof', 'copper',
    'copperEdge', 'glass', 'wood', 'leaf', 'leafLight', 'water', 'bus', 'rubber', 'skin', 'skinLight', 'taxi',
  ] as const;
  const palette = Object.fromEntries(names.map((name) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = name;
    return [name, material];
  })) as Record<(typeof names)[number], THREE.MeshStandardMaterial>;
  const parts: Part[] = [];
  const transform = new THREE.Object3D();
  const add: StreetscapeBuilder['add'] = (shape, surface, position, scale, rotation = [0, 0, 0]) => {
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(...rotation);
    transform.updateMatrix();
    if (!shape.boundingBox) shape.computeBoundingBox();
    parts.push({
      shape, surface, position, scale, rotation, matrix: transform.matrix.clone(),
      bounds: shape.boundingBox!.clone().applyMatrix4(transform.matrix),
    });
  };
  const builder: StreetscapeBuilder = {
    box, cylinder, crown, palette, add,
    block: (surface, x, y, z, width, height, depth, yaw = 0) =>
      add(box, surface, [x, y, z], [width, height, depth], [0, yaw, 0]),
  };
  const art = build(builder);
  cleanups.push(() => {
    art.dispose();
    [box, cylinder, crown].forEach((geometry) => geometry.dispose());
    Object.values(palette).forEach((material) => material.dispose());
  });
  return { art, builder, parts };
}

function lamps(art: Streetscape, color: 'red' | 'amber' | 'green') {
  return art.group.getObjectByName(`Neighborhood ${color} lamps`) as THREE.InstancedMesh;
}

function allSignals(phase: StreetscapeSignalState['phase']) {
  return INTERSECTIONS.map(({ id }) => ({ id, phase }));
}

function positions(mesh: THREE.InstancedMesh) {
  const result: THREE.Vector3[] = [];
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < mesh.count; index++) {
    mesh.getMatrixAt(index, matrix);
    result.push(new THREE.Vector3().setFromMatrixPosition(matrix));
  }
  return result;
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

describe('original connected-city streetscape', () => {
  it('keeps the prior four-street input buildable without moving the public anchors', async () => {
    vi.resetModules();
    vi.doMock('../content/streets', async () => {
      const actual = await vi.importActual<typeof import('../content/streets')>('../content/streets');
      const x = [-76, -46, 46, 76] as const;
      const z = [-132, -95, 95, 132] as const;
      return {
        ...actual, STREET_X: x, STREET_Z: z, CITY_EXTENT: { x: 84, z: 140 },
        TWO_WAY_BIKE_STREETS: [{ z: -95, side: 1 }, { z: 95, side: -1 }],
        INTERSECTIONS: z.flatMap((roadZ, row) => x.map((roadX, column) =>
          ({ id: `intersection-${column}-${row}`, x: roadX, z: roadZ }))),
      };
    });
    try {
      const finalGrid = await import('./streetscape');
      expect(finalGrid.STREET_BLOCKS).toHaveLength(8);
      expect(finalGrid.STREET_BUILDINGS).toHaveLength(58);
      expect(() => finalGrid.validateStreetscape()).not.toThrow();
      const { parts, builder } = createArt(finalGrid.buildStreetscape);
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.teal &&
        position[0] === BASKETBALL_COURT.x && position[2] === BASKETBALL_COURT.z &&
        scale[0] === BASKETBALL_COURT.width)).toBe(true);
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.rubber &&
        position[0] === 65 && position[2] === -117.8 && scale[0] === 2.14)).toBe(true);
      expect(parts.every(({ bounds }) => bounds.min.x >= -84 && bounds.max.x <= 84 &&
        bounds.min.z >= -140 && bounds.max.z <= 140)).toBe(true);
      expect(parts.filter(({ bounds }) => bounds.max.y > 0.05 && bounds.max.x > -39 &&
        bounds.min.x < 39 && bounds.max.z > -88 && bounds.min.z < 88)
        .map(({ surface, position }) => `${surface.name} at ${position.join(',')}`)).toEqual([]);
    } finally {
      vi.doUnmock('../content/streets');
      vi.resetModules();
    }
  });

  it('fits a bounded inner-ring neighborhood into the shared parcels without touching the park', () => {
    expect(SIDEWALK_OFFSET).toBe(6.2);
    expect(STOP_LINE_OFFSET).toBe(8.5);
    expect(STREET_BLOCKS).toHaveLength((STREET_X.length - 1) * (STREET_Z.length - 1) - 1);
    expect(STREET_BUILDINGS).toHaveLength(94);
    expect(new Set(STREET_BUILDINGS.map(({ skin }) => skin)).size).toBe(4);
    expect(new Set(STREET_BUILDINGS.map(({ floors }) => floors)).size).toBe(5);
    expect(new Set(STREET_BUILDINGS.map(({ roof }) => roof)).size).toBe(4);
    expect(STREET_BUILDINGS.filter(({ setbackFloors }) => setbackFloors > 0)).toHaveLength(6);
    expect(() => validateStreetscape()).not.toThrow();
    for (const building of STREET_BUILDINGS) {
      expect(Math.abs(building.x) - building.width / 2 > parkHalfX ||
        Math.abs(building.z) - building.depth / 2 > parkHalfZ).toBe(true);
    }
    for (const id of [`block-${centerColumn - 1}-${centerRow}`, `block-${centerColumn + 1}-${centerRow}`]) {
      const wall = STREET_BUILDINGS.filter(({ blockId }) => blockId === id);
      expect(wall).toHaveLength(16);
      for (const z of [-76, -25, 26, 77]) {
        expect(wall.filter((building) => Math.abs(building.z - z * sideScale) < 16 * sideScale)).toHaveLength(4);
      }
    }
  });

  it('populates every outer block and widens the inner masonry street walls', () => {
    let outerBuildings = 0;
    for (const parcel of STREET_BLOCKS) {
      const innerColumn = parcel.minX >= STREET_X[centerColumn - 1] &&
        parcel.maxX <= STREET_X[centerColumn + 2];
      const innerRow = parcel.minZ >= STREET_Z[centerRow - 1] &&
        parcel.maxZ <= STREET_Z[centerRow + 2];
      if (innerColumn && innerRow) continue;
      const buildings = STREET_BUILDINGS.filter(({ blockId }) => blockId === parcel.id);
      const width = parcel.maxX - parcel.minX;
      const depth = parcel.maxZ - parcel.minZ;
      expect(buildings).toHaveLength(depth > width * 3 ? 8 : width > depth * 3 ? 4 : 1);
      outerBuildings += buildings.length;
    }
    expect(outerBuildings).toBe(36);
    for (const side of [-1, 1]) {
      const masonry = STREET_BUILDINGS.filter(({ blockId, brownstone }) => !brownstone &&
        blockId === `block-${centerColumn + side}-${centerRow}`);
      expect(masonry.every(({ width }) => width >= 12.8)).toBe(true);
    }
  });

  it('rejects invalid dimensions, duplicate IDs, overlapping parcels and blocked sidewalks', () => {
    const first = STREET_BUILDINGS[0];
    for (const buildings of [
      [first, first],
      [{ ...first, x: 0, z: 0 }],
      [{ ...first, width: Infinity }],
      [{ ...first, floors: 2.5 }],
      [{ ...first, floors: 9 }],
      [{ ...first, setbackFloors: 5 }],
      [{ ...first, blockId: 'not-a-parcel' }],
      [{ ...first, z: -33, stoop: true }],
      [first, { ...first, id: 'overlapping-neighbor' }],
    ]) expect(() => validateStreetscape(buildings)).toThrow();
  });

  it('draws glazing at every authored floor on all four facades, including setbacks', () => {
    const { parts, builder } = createArt();
    const windows = parts.filter(({ surface }) => surface === builder.palette.glass);
    for (const building of STREET_BUILDINGS) {
      for (let floor = 0; floor < building.floors + building.setbackFloors; floor++) {
        const inset = floor >= building.floors;
        const width = building.width - (inset ? 1.4 : 0);
        const depth = building.depth - (inset ? 2.2 : 0);
        const principal = building.brownstone && floor === 0;
        const y = 0.3 + floor * 2.4 + (principal ? 1.6 : 1.25);
        for (const side of [-1, 1]) {
          expect(windows.some(({ position: [x, wy, z] }) =>
            Math.abs(wy - y) < 0.001 && Math.abs(x - building.x) < width / 2 &&
            Math.abs(z - building.z - side * (depth / 2 + 0.025)) < 0.001)).toBe(true);
          expect(windows.some(({ position: [x, wy, z] }) =>
            Math.abs(wy - y) < 0.001 && Math.abs(z - building.z) < depth / 2 &&
            Math.abs(x - building.x - side * (width / 2 + 0.025)) < 0.001)).toBe(true);
        }
      }
    }
  });

  it('gives brownstones raised side entries, taller principal windows, iron rails and bracketed cornices', () => {
    const { parts, builder } = createArt();
    const brownstones = STREET_BUILDINGS.filter(({ brownstone }) => brownstone);
    expect(brownstones).toHaveLength(6);
    for (const building of brownstones) {
      const entryX = building.x - building.width * 0.26;
      const front = building.z + building.depth / 2;
      const door = parts.find(({ surface, position, scale }) => surface === builder.palette.glass &&
        position[0] === entryX && position[2] === front + 0.05 && scale[0] === 0.95)!;
      expect(door.bounds.min.y).toBeCloseTo(0.84);
      const steps = parts.filter(({ surface, position, scale }) => surface === builder.palette.copperEdge &&
        position[0] === entryX && position[2] > front && position[2] < front + 1.2 &&
        position[1] < 0.6 && scale[0] === 1.45);
      expect(steps).toHaveLength(4);
      expect(Math.max(...steps.map(({ bounds }) => bounds.max.y))).toBeCloseTo(door.bounds.min.y);
      const principalWindows = parts.filter(({ surface, position, scale }) =>
        surface === builder.palette.glass && Math.abs(position[0] - building.x) < building.width / 2 &&
        Math.abs(position[2] - front - 0.025) < 0.001 && scale[1] === 1.55);
      expect(principalWindows).toHaveLength(Math.floor(building.width / 1.8) - 1);
      principalWindows.forEach(({ position }) => {
        expect(parts.some(({ surface, position: lintel, scale }) =>
          surface === builder.palette.copperEdge && lintel[0] === position[0] &&
          Math.abs(lintel[1] - position[1] - 0.875) < 0.001 && scale[0] === 1.06)).toBe(true);
      });
      const rails = parts.filter(({ surface, position, scale }) => surface === builder.palette.rubber &&
        Math.abs(Math.abs(position[0] - entryX) - 0.72) < 0.001 &&
        position[2] > front && position[2] < front + 1.1 && scale[0] === 0.045);
      expect(rails).toHaveLength(6);
      const corniceY = building.floors * 2.4 + 0.3;
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.copperEdge &&
        position[0] === building.x && Math.abs(position[1] - corniceY - 0.03) < 0.001 &&
        scale[0] === building.width + 0.65 && scale[1] === 0.26)).toBe(true);
      expect(parts.filter(({ surface, position, scale }) => surface === builder.palette.copperEdge &&
        Math.abs(position[0] - building.x) < building.width / 2 && position[2] === front + 0.16 &&
        Math.abs(position[1] - corniceY + 0.22) < 0.001 && scale[0] === 0.18)).toHaveLength(4);
    }
  });

  it('keeps all static artwork within the island and the highest roof accents below 24 m', () => {
    const { parts } = createArt();
    for (const part of parts) {
      expect(part.bounds.min.x, `minX ${part.surface.name} ${part.position}`).toBeGreaterThanOrEqual(-CITY_EXTENT.x - 0.001);
      expect(part.bounds.max.x, `maxX ${part.surface.name} ${part.position}`).toBeLessThanOrEqual(CITY_EXTENT.x + 0.001);
      expect(part.bounds.min.z, `minZ ${part.surface.name} ${part.position}`).toBeGreaterThanOrEqual(-CITY_EXTENT.z - 0.001);
      expect(part.bounds.max.z, `maxZ ${part.surface.name} ${part.position}`).toBeLessThanOrEqual(CITY_EXTENT.z + 0.001);
      expect(part.bounds.max.y).toBeLessThanOrEqual(24);
      expect(part.scale.every((scale) => Number.isFinite(scale) && scale > 0)).toBe(true);
    }
    expect(Math.max(...parts.map(({ bounds }) => bounds.max.y))).toBeGreaterThan(20);
  });

  it('paints bike strips beside lanes and interrupts separators before every zebra crossing', () => {
    const { parts, builder } = createArt();
    const bikeStrips = parts.filter(({ surface, position, scale }) =>
      surface === builder.palette.teal && position[1] === 0.004 &&
      (scale[0] === 1.28 || scale[2] === 1.28));
    expect(bikeStrips.length).toBeGreaterThan(40);
    for (const strip of bikeStrips) {
      const vertical = strip.scale[0] === 1.28;
      const roads = vertical ? STREET_X : STREET_Z;
      const across = vertical ? strip.position[0] : strip.position[2];
      expect(roads.some((road) => Math.abs(Math.abs(across - road) - BIKE_OFFSET) < 0.001)).toBe(true);
      for (const building of STREET_BUILDINGS) {
        const footprint = new THREE.Box3(
          new THREE.Vector3(building.x - building.width / 2, -1, building.z - building.depth / 2),
          new THREE.Vector3(building.x + building.width / 2, 25, building.z + building.depth / 2),
        );
        expect(strip.bounds.intersectsBox(footprint)).toBe(false);
      }
    }
    const bollards = parts.filter(({ shape, surface, scale }) =>
      shape === builder.cylinder && surface === builder.palette.line && scale[1] === 0.64);
    expect(bollards.length).toBeGreaterThan(150);
    for (const { position: [x, , z] } of bollards) {
      const vertical = STREET_X.some((road) => Math.abs(Math.abs(x - road) - 3.1) < 0.001);
      const perpendicular = vertical ? STREET_Z : STREET_X;
      const along = vertical ? z : x;
      expect(perpendicular.every((crossing) => Math.abs(along - crossing) > STOP_LINE_OFFSET)).toBe(true);
    }
  });

  it('aligns full-width zebra stripes with pedestrian corridors and motor stop bars at 8.5 m', () => {
    const { parts, builder } = createArt();
    const lines = parts.filter(({ surface }) => surface === builder.palette.line);
    for (const intersection of INTERSECTIONS) {
      for (const side of [-1, 1]) {
        const horizontal = lines.filter(({ position, scale }) =>
          Math.abs(position[2] - intersection.z - side * SIDEWALK_OFFSET) < 0.001 &&
          Math.abs(position[0] - intersection.x) <= ROAD_HALF_WIDTH && scale[2] === 1.65);
        const vertical = lines.filter(({ position, scale }) =>
          Math.abs(position[0] - intersection.x - side * SIDEWALK_OFFSET) < 0.001 &&
          Math.abs(position[2] - intersection.z) <= ROAD_HALF_WIDTH && scale[0] === 1.65);
        expect(horizontal).toHaveLength(11);
        expect(vertical).toHaveLength(11);
        if (Math.abs(intersection.z - side * STOP_LINE_OFFSET) < CITY_EXTENT.z) {
          expect(lines.some(({ position, scale }) =>
            position[0] === intersection.x - side * VEHICLE_OFFSET &&
            position[2] === intersection.z - side * STOP_LINE_OFFSET && scale[0] === 2.65)).toBe(true);
        }
      }
    }
  });

  it('builds real park-side two-way tracks with shared lane positions and safe single separator rows', () => {
    const { parts, builder } = createArt();
    for (const { z: road, side } of TWO_WAY_BIKE_STREETS) {
      const center = road + side * TWO_WAY_BIKE_TRACK.offset;
      const strips = parts.filter(({ surface, position }) => surface === builder.palette.teal &&
        position[1] === 0.004 && Math.abs(position[2] - road) < ROAD_HALF_WIDTH);
      expect(strips).toHaveLength(STREET_X.length + 1);
      strips.forEach(({ position, scale, bounds }) => {
        expect(position[2]).toBeCloseTo(center);
        expect(scale[2]).toBe(TWO_WAY_BIKE_TRACK.width);
        expect(bounds.max.y).toBeCloseTo(0.0115);
        expect(Math.abs(bounds.min.z - road)).toBeLessThanOrEqual(5);
        expect(Math.abs(bounds.max.z - road)).toBeLessThanOrEqual(5);
      });
      const dividers = parts.filter(({ surface, position, scale }) => surface === builder.palette.taxi &&
        Math.abs(position[2] - center) < 0.001 && scale[2] === 0.065);
      expect(dividers.length).toBeGreaterThan(10);
      dividers.forEach(({ position, scale }) => {
        expect(scale[0]).toBe(1.3);
        expect(STREET_X.every((x) => Math.abs(position[0] - x) > STOP_LINE_OFFSET)).toBe(true);
      });
      const posts = parts.filter(({ shape, surface, position, scale }) => shape === builder.cylinder &&
        surface === builder.palette.line && scale[1] === 0.64 && Math.abs(position[2] - road) < ROAD_HALF_WIDTH);
      expect(posts.length).toBeGreaterThan(10);
      posts.forEach(({ position }) => {
        expect(side * (position[2] - road)).toBeCloseTo(TWO_WAY_BIKE_TRACK.separatorOffset);
        const base = parts.find(({ shape, surface, position: basePosition }) => shape === builder.cylinder &&
          surface === builder.palette.rubber && basePosition[0] === position[0] &&
          basePosition[2] === position[2] && basePosition[1] === 0.1)!;
        expect(base).toBeDefined();
        expect(base.scale[0]).toBeLessThanOrEqual(0.08);
        const inward = side * (position[2] - road);
        expect(inward - base.scale[0]).toBeGreaterThan(2.7);
        expect(inward + base.scale[0]).toBeLessThan(3.05);
      });
      const lanePositions = [-1, 1].map((direction) =>
        side * direction * bikeLaneOffset('east-west', road, direction)).sort((a, b) => a - b);
      expect(lanePositions).toEqual([3.45, 4.45]);
      for (const direction of [-1, 1]) {
        const lane = direction * bikeLaneOffset('east-west', road, direction);
        expect(Math.abs(lane - side * TWO_WAY_BIKE_TRACK.offset)).toBeCloseTo(0.5);
        for (const intersection of INTERSECTIONS.filter(({ z }) => z === road)) {
          const stopX = intersection.x - direction * STOP_LINE_OFFSET;
          if (Math.abs(stopX) >= CITY_EXTENT.x) continue;
          expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
            position[0] === stopX && Math.abs(position[2] - road - lane) < 0.001 &&
            scale[0] === 0.18 && scale[2] === 0.88)).toBe(true);
        }
      }
    }
  });

  it('leaves sidewalk centerlines and the central garden free of ground-level obstacles', () => {
    const { parts } = createArt();
    const describe = ({ surface, position }: Part) => `${surface.name} at ${position.join(',')}`;
    expect(parts.filter(({ bounds }) => bounds.max.y > 0.05 &&
      bounds.max.x > -parkHalfX && bounds.min.x < parkHalfX &&
      bounds.max.z > -parkHalfZ && bounds.min.z < parkHalfZ)
      .map(describe), 'Park intrusions').toEqual([]);
    const obstacles = parts.filter(({ bounds }) => bounds.max.y > 0.35 && bounds.min.y < 1.8);
    for (const x of STREET_X) {
      for (const side of [-1, 1]) {
        const path = x + side * SIDEWALK_OFFSET;
        expect(obstacles.filter(({ bounds }) => bounds.max.x >= path - 0.35 && bounds.min.x <= path + 0.35)
          .map(describe), `Avenue walkway ${path}`).toEqual([]);
      }
    }
    for (const z of STREET_Z) {
      for (const side of [-1, 1]) {
        const path = z + side * SIDEWALK_OFFSET;
        expect(obstacles.filter(({ bounds }) => bounds.max.z >= path - 0.35 && bounds.min.z <= path + 0.35)
          .map(describe), `Cross-street walkway ${path}`).toEqual([]);
        for (const { x, z } of INTERSECTIONS) {
          for (const side of [-1, 1]) {
            const northSouth = new THREE.Box3(
              new THREE.Vector3(x - 5, 0.1, z + side * SIDEWALK_OFFSET - 0.825),
              new THREE.Vector3(x + 5, 1.8, z + side * SIDEWALK_OFFSET + 0.825),
            );
            const eastWest = new THREE.Box3(
              new THREE.Vector3(x + side * SIDEWALK_OFFSET - 0.825, 0.1, z - 5),
              new THREE.Vector3(x + side * SIDEWALK_OFFSET + 0.825, 1.8, z + 5),
            );
            expect(obstacles.filter(({ bounds }) => bounds.intersectsBox(northSouth) || bounds.intersectsBox(eastWest))
              .map(describe), `Intersection walkway ${x},${z},${side}`).toEqual([]);
          }
        }
      }
    }
  });

  it('keeps original public-space anchors open with court, transit, crane and unbranded props', () => {
    const { parts, builder } = createArt();
    expect(parts.some(({ position, scale, surface }) =>
      position[0] === BASKETBALL_COURT.x && position[2] === BASKETBALL_COURT.z &&
      scale[0] === BASKETBALL_COURT.width && surface === builder.palette.teal)).toBe(true);
    expect(parts.some(({ position, scale }) => position[0] === 65 &&
      position[2] === -118 + 4.3 && scale[0] === 5.2)).toBe(true);
    expect(parts.some(({ position, scale }) => position[0] === westX - 0.5 && position[1] === 18.5 && scale[0] === 10.3)).toBe(true);
    for (const [x, z] of [[-63, 118], [63, -118]]) {
      expect(STREET_BUILDINGS.every((building) => Math.abs(x - building.x) > building.width / 2 ||
        Math.abs(z - building.z) > building.depth / 2)).toBe(true);
    }
    expect(parts.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leaf)).toBe(true);
    expect(parts.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leafLight)).toBe(true);
    const trunks = parts.filter(({ shape, surface, scale }) =>
      shape === builder.cylinder && surface === builder.palette.wood && scale[0] === 0.14);
    for (const { bounds } of trunks) {
      for (const building of STREET_BUILDINGS) {
        const footprint = new THREE.Box3(
          new THREE.Vector3(building.x - building.width / 2, 0, building.z - building.depth / 2),
          new THREE.Vector3(building.x + building.width / 2, 3, building.z + building.depth / 2),
        );
        expect(bounds.intersectsBox(footprint)).toBe(false);
      }
      const seats = parts.filter(({ surface, scale, position }) =>
        surface === builder.palette.wood && position[1] === 0.58 && scale[0] === 2.1);
      expect(seats.some((seat) => bounds.intersectsBox(seat.bounds))).toBe(false);
    }
  });

  it('matches shared court surfaces and basketball hoop centers without changing the playing height', () => {
    const { parts, builder } = createArt();
    const basketball = BASKETBALL_COURT;
    const pickleball = PICKLEBALL_COURT;
    const court = parts.find(({ surface, position, scale }) => surface === builder.palette.teal &&
      position[0] === basketball.x && position[2] === basketball.z && scale[0] === basketball.width)!;
    expect(court).toBeDefined();
    expect(court.scale[2]).toBe(basketball.depth);
    expect(court.bounds.max.y).toBeCloseTo(basketball.surfaceY);
    for (const side of [-1, 1]) {
      const rimX = basketball.x + side * basketball.hoopOffset;
      const rimY = basketball.surfaceY + basketball.hoopHeight;
      const rim = parts.filter(({ surface, position, scale }) => surface === builder.palette.copper &&
        Math.abs(position[0] - rimX) < 0.25 && position[1] === rimY &&
        Math.abs(position[2] - basketball.z) < 0.25 && scale[0] === 0.15 && scale[1] === 0.035);
      expect(rim).toHaveLength(10);
      expect(rim.reduce((sum, part) => sum + part.position[0], 0) / rim.length).toBeCloseTo(rimX);
      expect(rim.reduce((sum, part) => sum + part.position[2], 0) / rim.length).toBeCloseTo(basketball.z);
      expect(parts.some(({ shape, surface, position }) => shape === builder.cylinder &&
        surface === builder.palette.copperEdge && position[2] === basketball.z &&
        Math.abs(position[0] - rimX - side * 0.65) < 0.001)).toBe(true);
      const board = parts.find(({ surface, position, scale }) => surface === builder.palette.paving &&
        Math.abs(position[0] - rimX - side * 0.35) < 0.001 && position[2] === basketball.z &&
        scale[0] === 0.09 && scale[2] === 1.3)!;
      expect(board).toBeDefined();
      expect(side * (board.position[0] - rimX)).toBeGreaterThan(0);
    }
    const panels = parts.filter(({ surface, position, scale }) =>
      (surface === builder.palette.roof || surface === builder.palette.teal) &&
      position[2] === pickleball.z && scale[1] === 0.03 && scale[2] === pickleball.depth)
      .sort((a, b) => a.position[0] - b.position[0]);
    expect(panels).toHaveLength(3);
    expect(panels[0].bounds.min.x).toBeCloseTo(pickleball.x - pickleball.width / 2);
    expect(panels[2].bounds.max.x).toBeCloseTo(pickleball.x + pickleball.width / 2);
    expect(panels[1].scale[0]).toBeCloseTo(pickleball.kitchenDepth * 2);
    for (const [index, panel] of panels.entries()) {
      expect(panel.bounds.max.y).toBeCloseTo(pickleball.surfaceY);
      if (index > 0) expect(panels[index - 1].bounds.max.x).toBeCloseTo(panel.bounds.min.x);
    }
  });

  it('uses the shared pickleball kitchen, service lines and a full-width open net', () => {
    const { parts, builder } = createArt();
    const court = PICKLEBALL_COURT;
    const tape = parts.find(({ surface, position, scale }) => surface === builder.palette.line &&
      position[0] === court.x && position[2] === court.z && scale[0] === 0.045 && scale[2] === court.depth)!;
    expect(tape).toBeDefined();
    expect(tape.bounds.max.y).toBeCloseTo(court.surfaceY + court.netHeight);
    const threads = parts.filter(({ surface, position, scale }) => surface === builder.palette.rubber &&
      position[0] === court.x && Math.abs(position[2] - court.z) <= court.depth / 2 + 0.001 &&
      scale[0] === 0.02 && scale[2] === 0.02 && scale[1] > 0.5);
    expect(threads).toHaveLength(25);
    expect(threads.every(({ bounds }) => bounds.max.y <= tape.bounds.min.y + 0.001)).toBe(true);
    for (const side of [-1, 1]) {
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
        position[0] === court.x + side * court.kitchenDepth && position[2] === court.z &&
        scale[0] === 0.055 && scale[2] === court.depth - 0.07)).toBe(true);
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
        side * (position[0] - court.x) > court.kitchenDepth && position[2] === court.z &&
        scale[2] === 0.055)).toBe(true);
      expect(parts.some(({ shape, surface, position, scale }) => shape === builder.cylinder &&
        surface === builder.palette.rubber && position[0] === court.x &&
        position[2] === court.z + side * (court.depth / 2 + 0.17) && scale[0] === 0.05)).toBe(true);
    }
  });

  it('reserves both playing surfaces and the intervening entrance without buildings or furniture', () => {
    const { parts, builder } = createArt();
    const parcel = STREET_BLOCKS.find(({ id }) => id === `block-${centerColumn - 1}-${centerRow + 1}`)!;
    expect(STREET_BUILDINGS.filter(({ blockId }) => blockId === parcel.id)).toEqual([]);
    const describe = ({ surface, position }: Part) => `${surface.name} at ${position.join(',')}`;
    const obstacles = parts.filter(({ bounds }) => bounds.max.y > 0.35 && bounds.min.y < 1.8);
    for (const court of [BASKETBALL_COURT, PICKLEBALL_COURT]) {
      const playing = new THREE.Box3(
        new THREE.Vector3(court.x - court.width / 2, court.surfaceY + 0.1, court.z - court.depth / 2),
        new THREE.Vector3(court.x + court.width / 2, 1.8, court.z + court.depth / 2),
      );
      expect(playing.min.x).toBeGreaterThan(parcel.minX);
      expect(playing.max.x).toBeLessThan(parcel.maxX);
      expect(playing.min.z).toBeGreaterThan(parcel.minZ);
      expect(playing.max.z).toBeLessThan(parcel.maxZ);
      const clutter = obstacles.filter(({ bounds, surface, shape, position }) => {
        if (!bounds.intersectsBox(playing)) return false;
        if (court === PICKLEBALL_COURT) return Math.abs(position[0] - court.x) > 0.08 ||
          (surface !== builder.palette.rubber && surface !== builder.palette.line);
        return shape !== builder.cylinder || surface !== builder.palette.copperEdge ||
          Math.abs(Math.abs(position[0] - court.x) - BASKETBALL_COURT.hoopOffset - 0.65) > 0.001;
      });
      expect(clutter.map(describe)).toEqual([]);
    }
    const passage = new THREE.Box3(
      new THREE.Vector3(BASKETBALL_COURT.x - 1, 0.1, PICKLEBALL_COURT.z + PICKLEBALL_COURT.depth / 2 + 0.35),
      new THREE.Vector3(BASKETBALL_COURT.x + 1, 1.8, BASKETBALL_COURT.z - BASKETBALL_COURT.depth / 2 - 0.1),
    );
    expect(obstacles.filter(({ bounds }) => bounds.intersectsBox(passage)).map(describe)).toEqual([]);
  });

  it('leaves both shallow subway flights visibly recessed instead of covering their lower treads with paving', () => {
    const { parts, builder } = createArt();
    for (const [x, z] of [[65, -117.8], [westX, 51.5 * sideScale]]) {
      const floor = parts.find(({ surface, position, scale }) => surface === builder.palette.rubber &&
        position[0] === x && position[2] === z && scale[0] === 2.14)!;
      expect(floor).toBeDefined();
      expect(floor.bounds.max.y).toBeLessThan(0);
      expect(floor.bounds.min.y).toBeGreaterThan(-0.14);
      const steps = parts.filter(({ surface, position, scale }) => surface === builder.palette.stone &&
        position[0] === x && Math.abs(position[2] - z) < 2 && scale[0] === 1.76 && scale[2] === 0.56)
        .sort((a, b) => b.position[2] - a.position[2]);
      expect(steps).toHaveLength(6);
      for (const [index, step] of steps.entries()) {
        expect(step.bounds.max.y).toBeCloseTo(0.35 - index * 0.08);
        expect(step.bounds.min.y).toBeGreaterThan(-0.14);
        if (index > 0) expect(steps[index - 1].bounds.min.z).toBeCloseTo(step.bounds.max.z);
        const treadZ = step.position[2];
        const covering = parts.filter(({ bounds }) => bounds.min.x < x && bounds.max.x > x &&
          bounds.min.z < treadZ && bounds.max.z > treadZ).map((part) => {
          const mesh = new THREE.Mesh(part.shape, part.surface);
          mesh.matrixWorld.copy(part.matrix);
          return mesh;
        });
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 4, treadZ), new THREE.Vector3(0, -1, 0), 0, 5);
        const hits = ray.intersectObjects(covering, false);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(step.bounds.max.y);
      }
      expect(steps.at(-1)!.bounds.max.y).toBeLessThan(0);
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.taxi &&
        position[0] === x && position[2] === z + 1.89 && scale[0] === 1.74)).toBe(true);
    }
  });

  it('frames open subway mouths with green ironwork, paired globes and genuinely descending handrails', () => {
    const { parts, builder } = createArt();
    for (const [x, z] of [[65, -117.8], [westX, 51.5 * sideScale]]) {
      const railings = parts.filter(({ surface, position, scale }) => surface === builder.palette.teal &&
        Math.abs(position[0] - x) < 1.2 && Math.abs(position[2] - z) < 2.2 &&
        scale[0] === 0.035 && scale[1] === 0.8);
      expect(railings).toHaveLength(25);
      expect(parts.filter(({ shape, surface, position, scale }) => shape === builder.crown &&
        surface === builder.palette.leafLight && scale[0] === 0.26 &&
        Math.abs(position[0] - x) < 1.2 && position[2] === z + 2.03)).toHaveLength(2);
      const rails = parts.filter(({ surface, position, scale }) => surface === builder.palette.stone &&
        Math.abs(Math.abs(position[0] - x) - 0.72) < 0.001 &&
        Math.abs(position[2] - z - 0.09) < 0.001 && scale[0] === 0.045);
      expect(rails).toHaveLength(2);
      for (const rail of rails) {
        const ends = [-0.5, 0.5].map((y) => new THREE.Vector3(0, y, 0).applyMatrix4(rail.matrix))
          .sort((a, b) => a.z - b.z);
        expect(ends[0].y).toBeCloseTo(0.5);
        expect(ends[1].y).toBeCloseTo(0.98);
        expect(ends[1].z - ends[0].z).toBeCloseTo(3.36);
      }
      const entrance = new THREE.Box3(
        new THREE.Vector3(x - 0.55, 0.5, z + 1.85),
        new THREE.Vector3(x + 0.55, 2, z + 3.25),
      );
      expect(parts.filter(({ bounds }) => bounds.intersectsBox(entrance))
        .map(({ surface, position }) => `${surface.name} at ${position.join(',')}`)).toEqual([]);
    }
  });

  it('separates braced facade scaffolding from a continuous protective shed with clear headroom', () => {
    const { parts, builder } = createArt();
    const walkZ = STREET_Z[centerRow] - SIDEWALK_OFFSET;
    const shedX = westX + 1.05;
    const deck = parts.find(({ surface, position, scale }) => surface === builder.palette.roof &&
      position[0] === shedX && position[1] === 2.78 && scale[0] === 7.3 && scale[2] === 2.5)!;
    expect(deck).toBeDefined();
    expect(deck.bounds.min.y).toBeGreaterThan(2.6);
    const corridor = new THREE.Box3(
      new THREE.Vector3(shedX - 3.4, 0.12, walkZ - 0.7),
      new THREE.Vector3(shedX + 3.4, 2.45, walkZ + 0.7),
    );
    parts.forEach(({ bounds, surface, position }) =>
      expect(bounds.intersectsBox(corridor), `Covered-walk obstruction ${surface.name} ${position}`).toBe(false));
    expect(parts.filter(({ surface, scale }) => surface === builder.palette.roof &&
      scale[0] === 0.085 && scale[1] === 6.8)).toHaveLength(6);
    const facadeBraces = parts.filter(({ surface, position, scale }) => surface === builder.palette.roof &&
      position[2] === walkZ - 5.3 + 2.7 + 0.45 && scale[0] === 0.055);
    expect(facadeBraces).toHaveLength(12);
    expect(facadeBraces.every(({ bounds }) => bounds.max.z < corridor.min.z)).toBe(true);
    expect(parts.filter(({ surface, position, scale }) => surface === builder.palette.teal &&
      position[0] === shedX && scale[1] === 0.48)).toHaveLength(2);
    expect(parts.filter(({ surface, position, scale }) => surface === builder.palette.line &&
      position[1] === 2.66 && scale[0] === 0.65)).toHaveLength(3);
  });

  it('uses borrowed yellow signal housings with three dark lenses, projecting visors and braced arms', () => {
    const { parts, builder, art } = createArt();
    const housings = parts.filter(({ surface, scale }) => surface === builder.palette.taxi &&
      scale[0] === 0.65 && scale[1] === 1.42);
    expect(housings).toHaveLength(approachCount);
    for (const housing of housings) {
      const [x, y, z] = housing.position;
      const darkLenses = parts.filter(({ shape, surface, position, scale }) => shape === builder.cylinder &&
        surface === builder.palette.rubber && scale[0] === 0.15 &&
        Math.hypot(position[0] - x, position[2] - z) < 0.2 && Math.abs(position[1] - y) <= 0.39);
      expect(darkLenses).toHaveLength(3);
      const visors = parts.filter(({ surface, position, scale }) => surface === builder.palette.rubber &&
        scale[0] === 0.4 && scale[2] === 0.42 &&
        Math.hypot(position[0] - x, position[2] - z) < 0.31 && Math.abs(position[1] - y) <= 0.58);
      expect(visors).toHaveLength(3);
      expect(visors.every(({ bounds }) => bounds.max.y > y - 0.2)).toBe(true);
    }
    expect(parts.filter(({ surface, position, scale }) => surface === builder.palette.copperEdge &&
      position[1] === 4.65 && scale[0] === 0.055)).toHaveLength(approachCount);
    for (const phase of ['north-south', 'east-west', 'clearance', 'pedestrians'] as const) {
      art.setSignals(allSignals(phase));
      expect(lamps(art, 'amber').count).toBe(0);
      if (phase === 'clearance') expect(lamps(art, 'green').count).toBe(0);
    }
  });

  it('reuses static batches and reproduces all authored transforms deterministically', () => {
    const first = createArt();
    const second = createArt();
    const batches = new Set(first.parts.map(({ shape, surface }) => `${shape.type}:${surface.name}`));
    expect(batches.size + first.art.group.children.length).toBeLessThanOrEqual(30);
    expect(first.parts.length).toBeLessThan(31_000);
    const triangles = first.parts.reduce((sum, { shape }) => sum + (shape.index?.count ?? shape.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeLessThan(430_000);
    expect(first.parts.map(({ shape, surface, matrix }) => [shape.type, surface.name, matrix.elements]))
      .toEqual(second.parts.map(({ shape, surface, matrix }) => [shape.type, surface.name, matrix.elements]));
  });

  it('displays only authoritative green axes and fails closed before receiving state', () => {
    const { art } = createArt();
    const red = lamps(art, 'red');
    const green = lamps(art, 'green');
    const allRed = red.count;
    expect(allRed).toBeGreaterThan(0);
    expect(green.count).toBe(0);
    expect(art.group.children).toHaveLength(3);
    for (const phase of ['north-south', 'east-west', 'pedestrians', 'clearance'] as const) {
      art.setSignals(allSignals(phase));
      expect(red.count + green.count).toBe(allRed);
      if (phase === 'clearance') expect(green.count).toBe(0);
      else {
        expect(green.count).toBeGreaterThan(0);
        for (const position of positions(green)) {
          if (phase === 'pedestrians') expect(position.y).toBeCloseTo(2.16, 4);
          else expect(position.y).toBeCloseTo(3.37, 4);
          const nearest = INTERSECTIONS.reduce((best, intersection) =>
            Math.hypot(intersection.x - position.x, intersection.z - position.z) <
              Math.hypot(best.x - position.x, best.z - position.z) ? intersection : best);
          if (phase === 'north-south') expect(Math.abs(position.z - nearest.z)).toBeCloseTo(STOP_LINE_OFFSET + 0.71, 4);
          if (phase === 'east-west') expect(Math.abs(position.x - nearest.x)).toBeCloseTo(STOP_LINE_OFFSET + 0.71, 4);
        }
      }
    }
    const materials = art.group.children.map((object) => (object as THREE.Mesh).material);
    art.setSignals(allSignals('north-south'));
    const version = green.instanceMatrix.version;
    art.setSignals(allSignals('north-south'));
    art.setSignals([{ id: 'unknown', phase: 'pedestrians' }]);
    expect(green.instanceMatrix.version).toBe(version);
    expect(art.group.children.map((object) => (object as THREE.Mesh).material)).toEqual(materials);
    expect(materials.every((material) => (material as THREE.MeshStandardMaterial).emissiveIntensity === 0.75)).toBe(true);
  });

  it('updates intersections independently without autonomous timers or lights', () => {
    const { art } = createArt();
    const target = INTERSECTIONS.find(({ x, z }) => x === STREET_X[centerColumn] && z === STREET_Z[centerRow])!;
    const next = INTERSECTIONS.find(({ x, z }) => x === STREET_X[centerColumn + 1] && z === STREET_Z[centerRow])!;
    art.setSignals([{ id: target.id, phase: 'north-south' }]);
    expect(lamps(art, 'green').count).toBe(2);
    art.setSignals([{ id: next.id, phase: 'pedestrians' }]);
    expect(lamps(art, 'green').count).toBe(6);
    const before = positions(lamps(art, 'green'));
    expect(positions(lamps(art, 'green'))).toEqual(before);
    art.group.traverse((object) => expect(object instanceof THREE.Light).toBe(false));
  });

  it('disposes only its own resources once and never invalidates another city', () => {
    const first = createArt();
    const second = createArt();
    const sharedGeometry = vi.spyOn(first.builder.cylinder, 'dispose');
    const sharedPaint = vi.spyOn(first.builder.palette.copperEdge, 'dispose');
    const owned = first.art.group.children.map((object) => {
      const mesh = object as THREE.InstancedMesh;
      return { mesh: vi.spyOn(mesh, 'dispose'), paint: vi.spyOn(mesh.material as THREE.Material, 'dispose') };
    });
    const parent = new THREE.Group().add(first.art.group);
    first.art.dispose();
    first.art.dispose();
    first.art.setSignals(allSignals('pedestrians'));
    expect(first.art.group.children).toHaveLength(0);
    expect(parent.children).toHaveLength(0);
    expect(sharedGeometry).not.toHaveBeenCalled();
    expect(sharedPaint).not.toHaveBeenCalled();
    owned.forEach(({ mesh, paint }) => {
      expect(mesh).toHaveBeenCalledTimes(1);
      expect(paint).toHaveBeenCalledTimes(1);
    });
    second.art.setSignals(allSignals('pedestrians'));
    expect(lamps(second.art, 'green').count).toBeGreaterThan(0);
  });
});
