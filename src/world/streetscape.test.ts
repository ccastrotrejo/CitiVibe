import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BASKETBALL_COURT, COURT_PLAYERS, PICKLEBALL_COURT, RECREATION_AREA, netHeightAt } from '../content/courts';
import { CAMERA_ANCHORS, CAMERA_PROJECTION } from '../content/city';
import { METRO_ENTRANCES, METRO_GEOMETRY, METRO_OPENINGS, type MetroEntrance } from '../content/metro';
import {
  BIKE_OFFSET, CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_HALF_WIDTH, SIDEWALK_OFFSET,
  SIGNAL_POLE_OFFSET, SIGNALED_INTERSECTIONS, STOP_LINE_OFFSET, STOP_SIGN_INTERSECTIONS,
  STREET_X, STREET_Z, TWO_WAY_BIKE_STREETS, TWO_WAY_BIKE_TRACK,
  VEHICLE_OFFSET, bikeLaneOffset,
} from '../content/streets';
import {
  buildStreetscape, BUILDING_SIDEWALK_INSET, createStreetBuildings, SIDEWALK_SHEDS, STREET_BLOCKS, STREET_BUILDINGS, SUBWAY_ENTRANCES, validateStreetscape,
  type StreetBuilding, type Streetscape, type StreetscapeBuilder, type StreetscapeSignalState,
} from './streetscape';
import { sampleTrafficRoute, SIDEWALK_WALKING_CLEARANCE, SIDEWALK_WALKING_OFFSETS, SIDEWALK_WALKING_ROUTES } from './traffic';
import { FoliageWind } from './weatherArt';

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
// Signalized corners only: posted all-way stops carry painted bars but no mast arms or heads.
const approachCount = SIGNALED_INTERSECTIONS.reduce((total, { x, z }) => total +
  [true, false].reduce((axes, vertical) => axes + [-1, 1].filter((side) =>
    Math.abs(x + (vertical ? side * SIGNAL_POLE_OFFSET : side * (STOP_LINE_OFFSET + 0.5))) <= CITY_EXTENT.x - 0.5 &&
    Math.abs(z + (vertical ? side * (STOP_LINE_OFFSET + 0.5) : -side * SIGNAL_POLE_OFFSET)) <= CITY_EXTENT.z - 0.5).length, 0), 0);

function metroPoint({ x, z, yaw }: MetroEntrance, lx: number, y: number, lz: number) {
  return new THREE.Vector3(x + lx * Math.cos(yaw) + lz * Math.sin(yaw), METRO_GEOMETRY.surfaceY + y,
    z - lx * Math.sin(yaw) + lz * Math.cos(yaw));
}

function metroRelative({ x, z, yaw }: MetroEntrance, point: THREE.Vector3) {
  return new THREE.Vector3((point.x - x) * Math.cos(yaw) - (point.z - z) * Math.sin(yaw),
    point.y - METRO_GEOMETRY.surfaceY, (point.x - x) * Math.sin(yaw) + (point.z - z) * Math.cos(yaw));
}

function createArt(build = buildStreetscape) {
  const box = new THREE.BoxGeometry();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const crown = new THREE.DodecahedronGeometry(1);
  const names = [
    'sand', 'stone', 'paving', 'road', 'line', 'cream', 'clay', 'teal', 'roof', 'copper',
    'copperEdge', 'glass', 'wood', 'leaf', 'leafLight', 'water', 'bus', 'rubber', 'taxi',
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

function buildingParts(parts: Part[], building: StreetBuilding) {
  const isBase = ({ position, scale }: Part, candidate: StreetBuilding) =>
    position[0] === candidate.x && position[2] === candidate.z &&
    position[1] === (candidate.brownstone ? 0.4 : 0.17) &&
    scale[0] === candidate.width + 0.3 && scale[2] === candidate.depth + 0.3;
  const start = parts.findIndex((part) => isBase(part, building));
  expect(start).toBeGreaterThanOrEqual(0);
  const next = STREET_BUILDINGS[STREET_BUILDINGS.indexOf(building) + 1];
  const end = next ? parts.findIndex((part) => isBase(part, next)) : parts.findIndex((part, index) =>
    index > start && part.position[1] === 0.01 && part.scale[0] === 1.45);
  expect(end).toBeGreaterThan(start);
  return parts.slice(start, end);
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

describe('original connected-city streetscape', () => {
  it('uses full-size courts and clear runoff in the existing six-street city, not miniature or half courts', () => {
    const feet = 0.3048;
    expect(STREET_X).toEqual([-102, -76, -46, 46, 76, 102]);
    expect(STREET_Z).toEqual([-162, -132, -95, 95, 132, 162]);
    expect(CITY_EXTENT).toEqual({ x: 110, z: 170 });
    expect(BASKETBALL_COURT.width).toBeCloseTo(94 * feet, 8);
    expect(BASKETBALL_COURT.depth).toBeCloseTo(50 * feet, 8);
    expect(BASKETBALL_COURT.hoopHeight).toBeCloseTo(10 * feet, 8);
    expect(BASKETBALL_COURT.hoopOffset).toBeCloseTo((47 - 4 - 1.25) * feet, 8);
    expect(BASKETBALL_COURT.backboardOffset).toBeCloseTo(43 * feet, 8);
    expect(BASKETBALL_COURT.rimRadius * 2).toBeCloseTo(1.5 * feet, 8);
    expect(BASKETBALL_COURT.backboardWidth).toBeCloseTo(6 * feet, 8);
    expect(BASKETBALL_COURT.backboardHeight).toBeCloseTo(3.5 * feet, 8);
    expect(BASKETBALL_COURT.runoffWidth - BASKETBALL_COURT.width).toBeCloseTo(4, 8);
    expect(BASKETBALL_COURT.runoffDepth - BASKETBALL_COURT.depth).toBeCloseTo(4, 8);
    expect(PICKLEBALL_COURT.width).toBeCloseTo(44 * feet, 8);
    expect(PICKLEBALL_COURT.depth).toBeCloseTo(20 * feet, 8);
    expect(PICKLEBALL_COURT.runoffWidth).toBeCloseTo(60 * feet, 8);
    expect(PICKLEBALL_COURT.runoffDepth).toBeCloseTo(30 * feet, 8);
    expect(PICKLEBALL_COURT.kitchenDepth).toBeCloseTo(7 * feet, 8);
    expect(PICKLEBALL_COURT.netHeight).toBeCloseTo(3 * feet, 8);
    expect(PICKLEBALL_COURT.netCenterHeight).toBeCloseTo(34 / 12 * feet, 8);
    expect(PICKLEBALL_COURT.netSpan).toBeCloseTo(22 * feet, 8);
    expect(STREET_BLOCKS.find(({ id }) => id === `block-${centerColumn}-${centerRow + 1}`))
      .toMatchObject({ minX: -39, maxX: 39, minZ: 102, maxZ: 125 });
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
      expect(building.width).toBeLessThanOrEqual(building.reservedWidth);
      expect(building.width).toBeGreaterThanOrEqual(building.reservedWidth * 0.75);
      expect(building.depth).toBeLessThanOrEqual(building.reservedDepth);
      expect(building.depth).toBeGreaterThanOrEqual(building.reservedDepth * 0.9);
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
      expect(buildings).toHaveLength(depth > width * 3 ? 8 : width > depth * 3 ? 6 : 1);
      outerBuildings += buildings.length;
    }
    expect(outerBuildings).toBe(40);
    for (const side of [-1, 1]) {
      const masonry = STREET_BUILDINGS.filter(({ blockId, brownstone }) => !brownstone &&
        blockId === `block-${centerColumn + side}-${centerRow}`);
      expect(masonry.every(({ width }) => width >= 12.8 * 0.9)).toBe(true);
    }
  });

  it('retains all relocated IDs and court clearances while varying dimensions inside their original envelopes', () => {
    expect(STREET_BUILDINGS.map(({ id }) => id)).toEqual(
      Array.from({ length: 94 }, (_, index) => `street-building-${index + 1}`));
    const destinations = [
      'block-2-0', 'block-1-3', 'block-2-0', 'block-1-3', 'block-2-3',
      'block-1-3', 'block-2-4', 'block-1-3', 'block-2-4', 'block-2-3',
    ];
    for (let column = 0; column < 10; column++) {
      const building = STREET_BUILDINGS[10 + column];
      const brownstone = column === 0 || column === 4;
      expect(building.blockId).toBe(destinations[column]);
      expect(building.width).toBeLessThanOrEqual(column % 2 ? 6.6 : 6.3);
      expect(building.width).toBeGreaterThanOrEqual((column % 2 ? 6.6 : 6.3) * 0.75);
      expect(building.depth).toBeLessThanOrEqual(7.6 + column % 3 * 0.6);
      expect(building.depth).toBeGreaterThanOrEqual((7.6 + column % 3 * 0.6) * 0.9);
      expect(building.floors).toBeGreaterThanOrEqual(3);
      expect(building.floors).toBeLessThanOrEqual(brownstone ? 5 : 7);
      if (brownstone) expect(building.skin).toBe('clay');
      expect(building.brownstone).toBe(brownstone);
      expect(building.stoop).toBe(column % 2 === 0);
      expect(building.fireEscape).toBe((10 + column) % 3 === 0);
      expect(building.setbackFloors).toBe(column === 5 ? 2 : 0);
    }
    for (const row of [0, 4]) {
      const wall = STREET_BUILDINGS.filter(({ blockId }) => blockId === `block-2-${row}`).sort((a, b) => a.x - b.x);
      expect(wall).toHaveLength(6);
      expect(wall[0].width).toBeLessThanOrEqual(6.3);
      expect(wall[5].width).toBeLessThanOrEqual(6.3);
      for (let index = 1; index < wall.length; index++) {
        expect(wall[index].x - wall[index].width / 2 - wall[index - 1].x - wall[index - 1].width / 2)
          .toBeGreaterThanOrEqual(0.8);
      }
    }
  });

  it('rejects invalid dimensions, duplicate IDs, overlapping parcels and blocked sidewalks', () => {
    const first = STREET_BUILDINGS[0];
    for (const buildings of [
      [first, first],
      [{ ...first, x: 0, z: 0 }],
      [{ ...first, width: Infinity }],
      [{ ...first, width: first.reservedWidth + 0.01 }],
      [{ ...first, reservedDepth: NaN }],
      [{ ...first, floors: 2.5 }],
      [{ ...first, floors: 9 }],
      [{ ...first, setbackFloors: 5 }],
      [{ ...first, architecture: { ...first.architecture, floorHeight: Infinity } }],
      [{ ...first, architecture: { ...first.architecture, windowWidth: -0.1 } }],
      [{ ...first, architecture: { ...first.architecture, baySpacing: 0.5 } }],
      [{ ...first, architecture: { ...first.architecture, parapetHeight: 1 } }],
      [{ ...first, architecture: { ...first.architecture, family: 'loft' as const } }],
      [{ ...first, blockId: 'not-a-parcel' }],
      [{ ...first, z: -33, stoop: true }],
      [{ ...first, x: -39 + first.width / 2 + 0.4 - 0.0001 }],
      [first, { ...first, id: 'overlapping-neighbor' }],
    ]) expect(() => validateStreetscape(buildings)).toThrow();
  });

  it('seeds dimensions, facade families and rooflines independently without moving the authored city', () => {
    expect(createStreetBuildings()).toEqual(STREET_BUILDINGS);
    const another = createStreetBuildings(173);
    expect(another).not.toEqual(STREET_BUILDINGS);
    const footprint = (building: StreetBuilding) => [building.id, building.blockId, building.x, building.z];
    expect(another.map(footprint)).toEqual(STREET_BUILDINGS.map(footprint));
    expect(new Set(STREET_BUILDINGS.map(({ width, depth }) => `${width}:${depth}`)).size).toBe(94);
    expect(new Set(STREET_BUILDINGS.map(({ architecture }) => architecture.family)).size).toBe(4);
    for (const feature of ['windowWidth', 'windowHeight', 'baySpacing', 'floorHeight', 'parapetHeight'] as const) {
      expect(new Set(STREET_BUILDINGS.map(({ architecture }) => architecture[feature])).size).toBeGreaterThan(80);
    }
    for (const family of ['masonry', 'loft', 'terrace']) {
      const members = STREET_BUILDINGS.filter(({ architecture }) => architecture.family === family);
      expect(members.length).toBeGreaterThan(15);
      expect(new Set(members.map(({ skin }) => skin)).size).toBe(4);
      expect(new Set(members.map(({ roof }) => roof)).size).toBe(4);
    }
    for (const seed of [0, 1, 42, 173, 2401, 8128]) {
      expect(() => validateStreetscape(createStreetBuildings(seed))).not.toThrow();
    }
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
        const y = 0.3 + floor * building.architecture.floorHeight +
          (principal ? 1.6 : building.architecture.floorHeight * 0.52);
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

  it('renders coherent window proportions and sash, divided or picture glazing, not metadata-only variants', () => {
    const { parts, builder } = createArt();
    const renderedWidths = new Set<number>();
    for (const building of STREET_BUILDINGS) {
      const art = buildingParts(parts, building);
      const { windowWidth, windowHeight, floorHeight, mullions, parapetHeight } = building.architecture;
      const windows = art.filter(({ surface, scale }) => surface === builder.palette.glass &&
        (scale[0] === windowWidth || scale[2] === windowWidth) && scale[1] === windowHeight);
      expect(windows.length, building.id).toBeGreaterThan(0);
      windows.forEach((window) => {
        const front = window.scale[2] === 0.045;
        const side = Math.sign(window.position[front ? 2 : 0] - building[front ? 'z' : 'x']);
        const horizontal = art.find(({ surface, position, scale }) =>
          surface === builder.palette.rubber && position[1] === window.position[1] &&
          position[front ? 0 : 2] === window.position[front ? 0 : 2] &&
          Math.abs(position[front ? 2 : 0] - window.position[front ? 2 : 0] - side * 0.03) < 1e-9 &&
          scale[1] === 0.065 && scale[front ? 0 : 2] === windowWidth);
        const vertical = art.find(({ surface, position, scale }) =>
          surface === builder.palette.rubber && position[1] === window.position[1] &&
          position[front ? 0 : 2] === window.position[front ? 0 : 2] &&
          Math.abs(position[front ? 2 : 0] - window.position[front ? 2 : 0] - side * 0.03) < 1e-9 &&
          scale[1] === windowHeight && scale[front ? 0 : 2] === 0.06);
        expect(!!horizontal, `${building.id} horizontal mullion`).toBe(mullions !== 'none');
        expect(!!vertical, `${building.id} vertical mullion`).toBe(mullions === 'cross');
        const floor = Math.round((window.position[1] - 0.3 - floorHeight * 0.52) / floorHeight);
        expect(window.bounds.min.y).toBeGreaterThan(0.3 + floor * floorHeight);
        expect(window.bounds.max.y).toBeLessThan(0.3 + (floor + 1) * floorHeight);
        const inset = floor >= building.floors;
        const span = front ? building.width - (inset ? 1.4 : 0) : building.depth - (inset ? 2.2 : 0);
        const center = building[front ? 'x' : 'z'];
        expect(window.bounds.min[front ? 'x' : 'z']).toBeGreaterThan(center - span / 2);
        expect(window.bounds.max[front ? 'x' : 'z']).toBeLessThan(center + span / 2);
      });
      renderedWidths.add(windows[0].scale[0]);
      expect(art.some(({ surface, position, scale }) => surface === builder.palette.paving &&
        scale[1] === parapetHeight && position[1] >
        (building.floors + building.setbackFloors) * floorHeight)).toBe(true);
    }
    expect(renderedWidths.size).toBeGreaterThan(80);
  });

  it('keeps actual building details inside their retained clearance envelopes with shared borrowed resources', () => {
    const { parts, builder } = createArt();
    for (const building of STREET_BUILDINGS) {
      const art = buildingParts(parts, building);
      const parcel = STREET_BLOCKS.find(({ id }) => id === building.blockId)!;
      const inset = BUILDING_SIDEWALK_INSET - SIDEWALK_HALF_WIDTH;
      const envelope = new THREE.Box3(
        new THREE.Vector3(building.x - building.reservedWidth / 2 - 0.4, -0.01,
          building.z - building.reservedDepth / 2 - 0.35),
        new THREE.Vector3(building.x + building.reservedWidth / 2 + 0.4, 24,
          building.z + building.reservedDepth / 2 + (building.stoop ? 1.2 : 0.35)),
      ).intersect(new THREE.Box3(
        new THREE.Vector3(parcel.minX + inset, -0.01, parcel.minZ + inset),
        new THREE.Vector3(parcel.maxX - inset, 24, parcel.maxZ - inset),
      )).expandByScalar(1e-9);
      for (const part of art) {
        expect(envelope.containsBox(part.bounds), `${building.id} ${part.surface.name} ${part.position}`).toBe(true);
        expect([builder.box, builder.cylinder, builder.crown]).toContain(part.shape);
        expect(Object.values(builder.palette)).toContain(part.surface);
      }
      expect(art.some(({ shape, surface, scale }) => shape === builder.cylinder &&
        surface === builder.palette.wood && scale[0] === 0.95)).toBe(building.roof === 'tank');
      expect(art.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leaf))
        .toBe(building.roof === 'garden');
      expect(art.filter(({ surface, scale }) => surface === builder.palette.clay &&
        scale[0] === 0.55 && scale[1] === 1.1)).toHaveLength(building.roof === 'chimneys' ? 2 : 0);
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
        Math.abs(position[2] - front - 0.025) < 0.001 &&
        scale[1] === building.architecture.windowHeight + 0.25);
      expect(principalWindows.length).toBeGreaterThanOrEqual(1);
      expect(principalWindows.length).toBeLessThan(Math.floor((building.width - 0.5) / building.architecture.baySpacing));
      principalWindows.forEach(({ position }) => {
        expect(parts.some(({ surface, position: lintel, scale }) =>
          surface === builder.palette.copperEdge && lintel[0] === position[0] &&
          Math.abs(lintel[1] - position[1] - (building.architecture.windowHeight + 0.25) / 2 - 0.1) < 0.001 &&
          scale[0] === building.architecture.windowWidth + 0.27)).toBe(true);
      });
      const rails = parts.filter(({ surface, position, scale }) => surface === builder.palette.rubber &&
        Math.abs(Math.abs(position[0] - entryX) - 0.72) < 0.001 &&
        position[2] > front && position[2] < front + 1.1 && scale[0] === 0.045);
      expect(rails).toHaveLength(6);
      const corniceY = building.floors * building.architecture.floorHeight + 0.3;
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
          Math.abs(position[2] - intersection.z - side * 6.7) < 0.001 &&
          Math.abs(position[0] - intersection.x) <= ROAD_HALF_WIDTH && scale[2] === 2);
        const vertical = lines.filter(({ position, scale }) =>
          Math.abs(position[0] - intersection.x - side * 6.7) < 0.001 &&
          Math.abs(position[2] - intersection.z) <= ROAD_HALF_WIDTH && scale[0] === 2);
        expect(horizontal).toHaveLength(11);
        expect(vertical).toHaveLength(11);
        for (const stripe of [...horizontal, ...vertical]) {
          const axis = horizontal.includes(stripe) ? 'z' : 'x';
          expect(Math.min(Math.abs(stripe.bounds.min[axis] - intersection[axis]),
            Math.abs(stripe.bounds.max[axis] - intersection[axis]))).toBeCloseTo(5.7);
          expect(Math.max(Math.abs(stripe.bounds.min[axis] - intersection[axis]),
            Math.abs(stripe.bounds.max[axis] - intersection[axis]))).toBeCloseTo(7.7);
        }
        if (Math.abs(intersection.z - side * STOP_LINE_OFFSET) < CITY_EXTENT.z) {
          expect(lines.some(({ position, scale }) =>
            position[0] === intersection.x - side * VEHICLE_OFFSET &&
            position[2] === intersection.z - side * STOP_LINE_OFFSET && scale[0] === 2.65)).toBe(true);
        }
      }
    }
  });

  it('supports both walking lanes and rounded corners on locally widened paving without extending into the park', () => {
    const { parts, builder } = createArt();
    expect(BUILDING_SIDEWALK_INSET).toBe(SIDEWALK_WALKING_CLEARANCE);
    const paving = parts.filter(({ surface, bounds }) => surface === builder.palette.paving &&
      Math.abs(bounds.max.y + 0.08) < 1e-9);
    const sample = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const uncovered: string[] = [];
    for (const route of SIDEWALK_WALKING_ROUTES.flat()) {
      for (let distance = 0; distance < route.length; distance += 0.75) {
        sampleTrafficRoute(route, distance, sample);
        for (let direction = 0; direction < 8; direction++) {
          const angle = direction * Math.PI / 4;
          const x = sample.position.x + Math.cos(angle) * 0.4;
          const z = sample.position.z + Math.sin(angle) * 0.4;
          if (!paving.some(({ bounds }) => x >= bounds.min.x - 1e-9 && x <= bounds.max.x + 1e-9 &&
            z >= bounds.min.z - 1e-9 && z <= bounds.max.z + 1e-9)) uncovered.push(`${route.id}: ${x},${z}`);
        }
      }
    }
    expect(uncovered).toEqual([]);
    expect(paving.every(({ bounds }) => bounds.max.x <= -parkHalfX || bounds.min.x >= parkHalfX ||
      bounds.max.z <= -parkHalfZ || bounds.min.z >= parkHalfZ)).toBe(true);
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
    expect(parts.some(({ position, scale, surface }) => position[0] === SUBWAY_ENTRANCES[0].x &&
      position[2] === SUBWAY_ENTRANCES[0].z + METRO_GEOMETRY.openingDepth / 2 && scale[0] === 2.06 &&
      surface === builder.palette.rubber)).toBe(true);
    expect(parts.some(({ position, scale }) => position[0] === westX - 0.5 && position[1] === 18.5 && scale[0] === 10.3)).toBe(true);
    for (const [x, z] of [[BASKETBALL_COURT.x, BASKETBALL_COURT.z], [PICKLEBALL_COURT.x, PICKLEBALL_COURT.z], [63, -118]]) {
      expect(STREET_BUILDINGS.every((building) => Math.abs(x - building.x) > building.width / 2 ||
        Math.abs(z - building.z) > building.depth / 2)).toBe(true);
    }
    expect(parts.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leaf)).toBe(true);
    expect(parts.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leafLight)).toBe(true);
    const trunks = parts.filter(({ shape, surface, scale }) =>
      shape === builder.cylinder && surface === builder.palette.wood && scale[0] === 0.14);
    expect(trunks).toHaveLength(39);
    expect(parts.filter(({ surface, scale, position }) => surface === builder.palette.wood &&
      position[1] === 0.58 && scale[0] === 2.1)).toHaveLength(11 * 3);
    expect(parts.filter(({ surface, scale, position }) => surface === builder.palette.paving &&
      position[1] === 0.68 && scale[0] === 1.65)).toHaveLength(2);
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
        Math.abs(position[2] - basketball.z) < 0.25 && scale[1] === 0.019 && scale[2] === 0.019);
      expect(rim).toHaveLength(24);
      expect(rim.reduce((sum, part) => sum + part.position[0], 0) / rim.length).toBeCloseTo(rimX);
      expect(rim.reduce((sum, part) => sum + part.position[2], 0) / rim.length).toBeCloseTo(basketball.z);
      rim.forEach(({ position, scale }) =>
        expect(Math.hypot(position[0] - rimX, position[2] - basketball.z) - scale[2] / 2)
          .toBeCloseTo(basketball.rimRadius, 6));
      expect(parts.some(({ shape, surface, position }) => shape === builder.cylinder &&
        surface === builder.palette.copperEdge && position[2] === basketball.z &&
        Math.abs(position[0] - basketball.x - side * basketball.supportOffset) < 0.001)).toBe(true);
      const board = parts.find(({ surface, position, scale }) => surface === builder.palette.paving &&
        Math.abs(position[0] - basketball.x - side * (basketball.backboardOffset + 0.02)) < 0.001 &&
        position[2] === basketball.z && scale[0] === 0.04 && scale[2] === basketball.backboardWidth)!;
      expect(board).toBeDefined();
      expect(board.scale[1]).toBe(basketball.backboardHeight);
      expect(board.bounds.min.y).toBeCloseTo(basketball.surfaceY + basketball.backboardBottom);
      expect(side * (board.position[0] - rimX) - board.scale[0] / 2).toBeCloseTo(0.381);
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
        position[0] === basketball.x + side * basketball.freeThrowOffset &&
        position[2] === basketball.z && scale[0] === basketball.lineWidth && scale[2] === basketball.keyWidth))
        .toBe(true);
      const threePointArc = parts.filter(({ surface, position, scale }) => surface === builder.palette.line &&
        scale[1] === 0.008 && scale[2] === basketball.lineWidth &&
        Math.abs(Math.hypot(position[0] - rimX, position[2] - basketball.z) - basketball.threePointRadius) < 0.005);
      expect(threePointArc).toHaveLength(48);
    }
    const panels = parts.filter(({ surface, position, scale }) =>
      (surface === builder.palette.roof || surface === builder.palette.teal) &&
      position[2] === pickleball.z && scale[1] === 0.03 && scale[2] === pickleball.depth)
      .sort((a, b) => a.position[0] - b.position[0]);
    expect(panels).toHaveLength(3);
    expect(panels[0].bounds.min.x).toBeCloseTo(pickleball.x - pickleball.width / 2);
    expect(panels[2].bounds.max.x).toBeCloseTo(pickleball.x + pickleball.width / 2);
    expect(panels[1].scale[0]).toBeCloseTo(pickleball.kitchenDepth * 2);
    const pickleballArea = panels.reduce((area, panel) => area + panel.scale[0] * panel.scale[2], 0);
    expect(pickleballArea).toBeCloseTo(pickleball.width * pickleball.depth);
    expect(pickleballArea).toBeLessThan(court.scale[0] * court.scale[2] / 4);
    for (const [index, panel] of panels.entries()) {
      expect(panel.bounds.max.y).toBeCloseTo(pickleball.surfaceY);
      if (index > 0) expect(panels[index - 1].bounds.max.x).toBeCloseTo(panel.bounds.min.x);
    }
  });

  it('uses full-size pickleball lines, 22-foot post clearance and a shared sagged open net', () => {
    const { parts, builder } = createArt();
    const court = PICKLEBALL_COURT;
    const tape = parts.filter(({ surface, position, scale }) => surface === builder.palette.line &&
      position[0] === court.x && Math.abs(position[2] - court.z) < court.netSpan / 2 &&
      position[1] > 0.8 && scale[0] === 0.04 && scale[2] === 0.04);
    expect(tape.length).toBeGreaterThan(20);
    const topPoints = tape.flatMap(({ matrix }) => [-0.5, 0.5].map((end) =>
      new THREE.Vector3(0, end, 0).applyMatrix4(matrix).add(new THREE.Vector3(0, 0.02, 0))));
    expect(Math.min(...topPoints.map(({ z }) => z))).toBeCloseTo(court.z - court.netSpan / 2, 6);
    expect(Math.max(...topPoints.map(({ z }) => z))).toBeCloseTo(court.z + court.netSpan / 2, 6);
    for (const point of topPoints) expect(point.y).toBeCloseTo(court.surfaceY + netHeightAt(point.z - court.z), 6);
    expect(topPoints.some(({ y, z }) => Math.abs(z - court.z) < 1e-6 &&
      Math.abs(y - court.surfaceY - court.netCenterHeight) < 1e-6)).toBe(true);
    expect(netHeightAt(0)).toBe(court.netCenterHeight);
    expect(netHeightAt(court.depth / 2)).toBe(court.netHeight);
    expect(netHeightAt(-court.depth / 2)).toBe(court.netHeight);
    expect(netHeightAt(court.depth)).toBe(court.netHeight);
    expect(netHeightAt(-1)).toBe(netHeightAt(1));
    const threads = parts.filter(({ surface, position, scale }) => surface === builder.palette.rubber &&
      position[0] === court.x && Math.abs(position[2] - court.z) <= court.netSpan / 2 + 0.001 &&
      scale[0] === 0.015 && scale[2] === 0.015 && scale[1] > 0.5);
    expect(threads).toHaveLength(tape.length + 1);
    for (const thread of threads) expect(thread.bounds.max.y)
      .toBeCloseTo(court.surfaceY + netHeightAt(thread.position[2] - court.z) - 0.04, 6);
    for (const side of [-1, 1]) {
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
        position[0] === court.x + side * court.kitchenDepth && position[2] === court.z &&
        scale[0] === court.lineWidth && scale[2] === court.depth - court.lineWidth)).toBe(true);
      expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
        side * (position[0] - court.x) > court.kitchenDepth && position[2] === court.z &&
        scale[2] === court.lineWidth)).toBe(true);
      const post = parts.find(({ shape, surface, position, scale }) => shape === builder.cylinder &&
        surface === builder.palette.rubber && position[0] === court.x &&
        position[2] === court.z + side * court.netPostOffset && scale[0] === court.netPostRadius)!;
      expect(post).toBeDefined();
      expect(post.bounds.max.y).toBeCloseTo(court.surfaceY + court.netHeight, 6);
      expect(Math.abs(post.position[2] - court.z) - post.scale[0]).toBeCloseTo(court.netSpan / 2, 6);
    }
  });

  it('reserves both complete runoff areas and a continuous two-metre public passage without clutter', () => {
    const { parts, builder } = createArt();
    const parcel = STREET_BLOCKS.find(({ id }) => id === `block-${centerColumn}-${centerRow + 1}`)!;
    expect(STREET_BUILDINGS.filter(({ blockId }) => blockId === parcel.id)).toHaveLength(2);
    const describe = ({ surface, position }: Part) => `${surface.name} at ${position.join(',')}`;
    const obstacles = parts.filter(({ bounds }) => bounds.max.y > 0.12 && bounds.min.y < 2.4);
    for (const court of [BASKETBALL_COURT, PICKLEBALL_COURT]) {
      const playing = new THREE.Box3(
        new THREE.Vector3(court.x - court.runoffWidth / 2, court.surfaceY + 0.1, court.z - court.runoffDepth / 2),
        new THREE.Vector3(court.x + court.runoffWidth / 2, 2.4, court.z + court.runoffDepth / 2),
      );
      expect(playing.min.x).toBeGreaterThan(parcel.minX);
      expect(playing.max.x).toBeLessThan(parcel.maxX);
      expect(playing.min.z).toBeGreaterThan(parcel.minZ);
      expect(playing.max.z).toBeLessThan(parcel.maxZ);
      const clutter = obstacles.filter(({ bounds, surface, position }) => {
        if (!bounds.intersectsBox(playing)) return false;
        if (court === PICKLEBALL_COURT) return Math.abs(position[0] - court.x) > 0.08 ||
          (surface !== builder.palette.rubber && surface !== builder.palette.line);
        return true;
      });
      expect(clutter.map(describe)).toEqual([]);
      const runoff = parts.filter(({ surface, position, bounds }) => surface === builder.palette.road &&
        Math.abs(position[1] - court.surfaceY + 0.015) < 1e-6 &&
        bounds.min.x >= playing.min.x - 1e-6 && bounds.max.x <= playing.max.x + 1e-6 &&
        bounds.min.z >= playing.min.z - 1e-6 && bounds.max.z <= playing.max.z + 1e-6);
      expect(runoff).toHaveLength(4);
      expect(runoff.reduce((sum, { scale }) => sum + scale[0] * scale[2], 0))
        .toBeCloseTo(court.runoffWidth * court.runoffDepth - court.width * court.depth, 6);
      for (const { bounds } of runoff) expect(bounds.max.y).toBeCloseTo(court.surfaceY, 6);
    }
    const passage = new THREE.Box3(
      new THREE.Vector3(RECREATION_AREA.passageMinX, 0.12, RECREATION_AREA.minZ),
      new THREE.Vector3(RECREATION_AREA.passageMaxX, 2.4, RECREATION_AREA.maxZ),
    );
    expect(passage.max.x - passage.min.x).toBe(2);
    expect(obstacles.filter(({ bounds }) => bounds.intersectsBox(passage)).map(describe)).toEqual([]);
  });

  it('keeps players visible from the ordinary camera and baskets clear from front-facing orbits', () => {
    const { parts } = createArt();
    const { pose } = CAMERA_ANCHORS[0];
    const direction = new THREE.Vector3(
      Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch),
      Math.cos(pose.yaw) * Math.cos(pose.pitch),
    );
    const targets = COURT_PLAYERS.flatMap((player) => {
      const court = player.sport === 'basketball' ? BASKETBALL_COURT : PICKLEBALL_COURT;
      return [0.08, 1.65].map((height) => ({
        point: new THREE.Vector3(court.x + player.x, court.surfaceY + height, court.z + player.z), direction,
      }));
    });
    for (const side of [-1, 1]) targets.push({
      point: new THREE.Vector3(BASKETBALL_COURT.x + side * BASKETBALL_COURT.hoopOffset,
        BASKETBALL_COURT.surfaceY + BASKETBALL_COURT.hoopHeight + 0.05, BASKETBALL_COURT.z),
      direction: new THREE.Vector3(-side * direction.x, direction.y, direction.z),
    });
    for (const { point, direction: view } of targets) {
      const ray = new THREE.Raycaster(point, view, 0.05, CAMERA_PROJECTION.distance);
      const candidates = parts.filter(({ bounds }) => ray.ray.intersectsBox(bounds)).map((part) => {
        const mesh = new THREE.Mesh(part.shape, part.surface);
        mesh.name = `${part.surface.name} ${part.position.join(',')}`;
        mesh.matrixWorld.copy(part.matrix);
        return mesh;
      });
      expect(ray.intersectObjects(candidates, false).map(({ object }) => object.name), point.toArray().join(','))
        .toEqual([]);
    }
  });

  it('keeps the shifted west court fence clear of a rotated 0.8 by 1.2 m walking body', () => {
    const { parts, builder } = createArt();
    const fenceX = RECREATION_AREA.minX + 0.85;
    expect(fenceX).toBeCloseTo(-38.15);
    const fence = parts.filter(({ surface, position }) => position[0] === fenceX &&
      (surface === builder.palette.copperEdge || surface === builder.palette.rubber) &&
      Math.abs(position[2] - BASKETBALL_COURT.z) < BASKETBALL_COURT.runoffDepth / 2 + 0.46);
    expect(fence).toHaveLength(70);
    expect(fence.every(({ bounds }) => bounds.max.x <
      BASKETBALL_COURT.x - BASKETBALL_COURT.runoffWidth / 2)).toBe(true);
    const body = new THREE.Box3(new THREE.Vector3(-0.4, 0.12, -0.6), new THREE.Vector3(0.4, 2.4, 0.6));
    const pose = new THREE.Object3D();
    const inverse = new THREE.Matrix4();
    const relative = new THREE.Matrix4();
    const fenceMatrix = new THREE.Matrix4();
    const broad = new THREE.Box3();
    const candidateBounds = new THREE.Box3();
    const triangle = new THREE.Triangle();
    const sample = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const routes = SIDEWALK_WALKING_ROUTES.flat().filter(({ id }) => id === `block-${centerColumn}-${centerRow + 1}`);
    expect(routes).toHaveLength(2);
    const findCollision = (offsetX: number) => {
      for (const route of routes) {
        for (let distance = 0; distance < route.length; distance += 0.1) {
          sampleTrafficRoute(route, distance, sample);
          pose.position.set(sample.position.x, 0, sample.position.z);
          pose.rotation.set(0, sample.heading, 0);
          pose.updateMatrix();
          inverse.copy(pose.matrix).invert();
          broad.copy(body).applyMatrix4(pose.matrix);
          for (const part of fence) {
            candidateBounds.copy(part.bounds);
            candidateBounds.min.x += offsetX;
            candidateBounds.max.x += offsetX;
            if (!broad.intersectsBox(candidateBounds)) continue;
            fenceMatrix.copy(part.matrix);
            fenceMatrix.elements[12] += offsetX;
            relative.multiplyMatrices(inverse, fenceMatrix);
            const vertices = part.shape.getAttribute('position');
            const indices = part.shape.index;
            for (let index = 0; index < (indices?.count ?? vertices.count); index += 3) {
              [triangle.a, triangle.b, triangle.c].forEach((vertex, corner) =>
                vertex.fromBufferAttribute(vertices, indices ? indices.getX(index + corner) : index + corner)
                  .applyMatrix4(relative));
              if (body.intersectsTriangle(triangle)) {
                return `${route.id} ${distance}: ${part.surface.name} ${part.position}`;
              }
            }
          }
        }
      }
    };
    expect(findCollision(-0.4)).toBeDefined();
    expect(findCollision(0)).toBeUndefined();
  });

  it('distributes eight compact openings beside sidewalks without occupying buildings or walking channels', () => {
    expect(METRO_ENTRANCES).toHaveLength(8);
    expect(new Set(METRO_ENTRANCES.map(({ id }) => id)).size).toBe(8);
    expect(new Set(METRO_ENTRANCES.map(({ x, z }) => `${Math.sign(x)},${Math.sign(z)}`)).size).toBe(4);
    expect(SUBWAY_ENTRANCES).toBe(METRO_ENTRANCES);
    expect(METRO_GEOMETRY.openingWidth).toBe(1.9);
    expect(METRO_GEOMETRY.openingDepth).toBe(4.5);
    expect(METRO_GEOMETRY.stepCount * METRO_GEOMETRY.treadDepth + METRO_GEOMETRY.landingDepth).toBeCloseTo(4.5);
    for (const hole of METRO_OPENINGS) {
      expect((hole.maxX - hole.minX) * (hole.maxZ - hole.minZ)).toBeCloseTo(8.55);
      expect(STREET_BLOCKS.some((parcel) => hole.minX > parcel.minX && hole.maxX < parcel.maxX &&
        hole.minZ > parcel.minZ && hole.maxZ < parcel.maxZ)).toBe(true);
      const envelope = new THREE.Box3(
        new THREE.Vector3(hole.minX - 0.3, -3, hole.minZ - 0.3),
        new THREE.Vector3(hole.maxX + 0.3, 3, hole.maxZ + 0.3),
      );
      const distances: number[] = [];
      for (const [roads, min, max] of [[STREET_X, envelope.min.x, envelope.max.x], [STREET_Z, envelope.min.z, envelope.max.z]] as const) {
        for (const road of roads) for (const side of [-1, 1]) for (const offset of SIDEWALK_WALKING_OFFSETS) {
          const walk = road + side * offset;
          const distance = Math.max(min - walk, walk - max);
          expect(distance, `${hole.id}: walkway ${walk}`).toBeGreaterThan(offset === SIDEWALK_OFFSET ? 1 : 0.4);
          distances.push(distance);
        }
      }
      expect(Math.min(...distances)).toBeLessThan(0.6);
      for (const building of STREET_BUILDINGS) {
        const footprint = new THREE.Box3(
          new THREE.Vector3(building.x - building.width / 2 - 0.15, -3, building.z - building.depth / 2 - 0.15),
          new THREE.Vector3(building.x + building.width / 2 + 0.15, 24, building.z + building.depth / 2 + 0.15),
        );
        expect(envelope.intersectsBox(footprint), `${hole.id}: ${building.id}`).toBe(false);
      }
    }
  });

  it('keeps rendered metro sweeps at 5.8–7.6 m and entrance approaches clear after the buildingward move', () => {
    const { parts } = createArt();
    const g = METRO_GEOMETRY;
    const obstacles = parts.filter(({ bounds }) => bounds.max.y > 0.12 && bounds.min.y < 2.4);
    for (const entrance of METRO_ENTRANCES) {
      const horizontal = Math.abs(Math.sin(entrance.yaw)) > 0.5;
      const across = horizontal ? 'z' : 'x';
      const along = horizontal ? 'x' : 'z';
      const roads = horizontal ? STREET_Z : STREET_X;
      const road = roads.reduce((nearest, value) =>
        Math.abs(value - entrance[across]) < Math.abs(nearest - entrance[across]) ? value : nearest);
      const side = Math.sign(entrance[across] - road);
      const sweep = new THREE.Box3(
        new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, 2.4, 0),
      );
      sweep.min[across] = Math.min(road + side * 5.8, road + side * 7.6);
      sweep.max[across] = Math.max(road + side * 5.8, road + side * 7.6);
      sweep.min[along] = entrance[along] - g.openingDepth / 2 - 0.5;
      sweep.max[along] = entrance[along] + g.openingDepth / 2 + g.apronDepth + 0.5;
      const approach = new THREE.Box3().setFromPoints([
        metroPoint(entrance, -0.8, 0.12 - g.surfaceY, g.openingDepth / 2 + 0.1),
        metroPoint(entrance, 0.8, 2.4 - g.surfaceY, g.openingDepth / 2 + g.apronDepth + 0.9),
      ]);
      for (const [name, corridor] of [['parallel sweep', sweep], ['entry approach', approach]] as const) {
        expect(obstacles.filter(({ bounds }) => bounds.intersectsBox(corridor))
          .map(({ surface, position }) => `${surface.name} ${position}`), `${entrance.id}: ${name}`).toEqual([]);
      }
    }
  });

  it('places every tread below sidewalk and island level and leaves local paving genuinely open', () => {
    const { parts, builder } = createArt();
    const g = METRO_GEOMETRY;
    expect(g.surfaceY).toBe(-0.08);
    for (const entrance of METRO_ENTRANCES) {
      const floor = parts.find(({ surface, position, scale }) => surface === builder.palette.rubber &&
        metroRelative(entrance, new THREE.Vector3(...position)).length() < 4 &&
        scale[0] === g.openingWidth && scale[2] === g.landingDepth)!;
      expect(floor).toBeDefined();
      expect(floor.bounds.max.y).toBeCloseTo(-2.24);
      const steps = parts.filter(({ surface, position, scale }) => surface === builder.palette.stone &&
        metroRelative(entrance, new THREE.Vector3(...position)).length() < 4 &&
        scale[0] === g.openingWidth && scale[2] === g.treadDepth)
        .map((part) => ({ ...part, local: metroRelative(entrance, new THREE.Vector3(...part.position)) }))
        .sort((a, b) => b.local.z - a.local.z);
      expect(steps).toHaveLength(g.stepCount);
      for (const [index, step] of steps.entries()) {
        expect(step.bounds.max.y).toBeCloseTo(g.surfaceY - (index + 1) * g.stepRise);
        expect(step.bounds.max.y).toBeLessThan(-0.14);
        expect(step.local.x).toBeCloseTo(0);
        if (index > 0) expect(steps[index - 1].local.z - g.treadDepth / 2).toBeCloseTo(step.local.z + g.treadDepth / 2);
        const [x, , z] = step.position;
        const covering = parts.filter(({ bounds }) => bounds.min.x < x && bounds.max.x > x &&
          bounds.min.z < z && bounds.max.z > z).map((part) => {
          const mesh = new THREE.Mesh(part.shape, part.surface);
          mesh.matrixWorld.copy(part.matrix);
          return mesh;
        });
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0), 0, 8);
        const hits = ray.intersectObjects(covering, false);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(step.bounds.max.y);
      }
      expect(steps.at(-1)!.bounds.max.y).toBeCloseTo(floor.bounds.max.y);
    }
  });

  it('frames open subway mouths with green ironwork, paired globes and genuinely descending handrails', () => {
    const { parts, builder } = createArt();
    const g = METRO_GEOMETRY;
    for (const entrance of METRO_ENTRANCES) {
      const nearby = parts.filter(({ position }) => {
        const point = metroRelative(entrance, new THREE.Vector3(...position));
        return Math.abs(point.x) < 1.4 && Math.abs(point.z) < 2.6;
      });
      const railings = nearby.filter(({ surface, scale }) => surface === builder.palette.rubber &&
        scale[0] === 0.03 && scale[1] === 0.82);
      expect(railings).toHaveLength(29);
      expect(railings.every(({ bounds }) => bounds.max.y < 1.1)).toBe(true);
      const globes = nearby.filter(({ shape, surface, scale }) => shape === builder.crown &&
        surface === builder.palette.taxi && scale[0] === 0.18);
      expect(globes).toHaveLength(2);
      expect(globes.every(({ bounds }) => bounds.max.y < 3)).toBe(true);
      expect(nearby.filter(({ shape, surface, scale }) => shape === builder.crown &&
        surface === builder.palette.leaf && scale[1] === 0.065)).toHaveLength(2);
      const rails = nearby.filter(({ surface, scale }) => surface === builder.palette.stone &&
        scale[0] === 0.045 && scale[1] > 3);
      expect(rails).toHaveLength(2);
      for (const rail of rails) {
        const ends = [-0.5, 0.5].map((y) => metroRelative(entrance, new THREE.Vector3(0, y, 0).applyMatrix4(rail.matrix)))
          .sort((a, b) => a.z - b.z);
        expect(ends[0].y).toBeCloseTo(-g.stepCount * g.stepRise + 0.86);
        expect(ends[1].y).toBeCloseTo(-g.stepRise + 0.86);
        expect(ends[1].z - ends[0].z).toBeCloseTo((g.stepCount - 1) * g.treadDepth);
      }
      const approach = new THREE.Box3().setFromPoints([
        metroPoint(entrance, -0.75, 0.2, g.openingDepth / 2 + 0.12),
        metroPoint(entrance, 0.75, 2.1, g.openingDepth / 2 + 1.1),
      ]);
      expect(parts.filter(({ bounds }) => bounds.intersectsBox(approach))
        .map(({ surface, position }) => `${surface.name} at ${position.join(',')}`)).toEqual([]);
    }
  });

  it('renders original double-sided SUBWAY lettering on an unobstructed entrance header', () => {
    const { parts, builder } = createArt();
    const g = METRO_GEOMETRY;
    const starts = [0, 4, 8, 12, 18, 22];
    for (const entrance of METRO_ENTRANCES) {
      const faces: string[][] = [];
      for (const face of [-1, 1]) {
        const strokes = parts.filter(({ surface, position, scale }) => {
          const local = metroRelative(entrance, new THREE.Vector3(...position));
          return surface === builder.palette.line && Math.abs(local.x) < 1 &&
            Math.abs(local.y - g.signHeight) < 0.2 &&
            Math.abs(local.z - g.openingDepth / 2 - face * 0.055) < 0.001 &&
            scale[0] === 0.022 && scale[2] === 0.022;
        });
        expect(strokes).toHaveLength(24);
        const counts = starts.map(() => 0);
        faces.push(strokes.map(({ matrix }) => {
          const ends = [-0.5, 0.5].map((end) => {
            const point = metroRelative(entrance, new THREE.Vector3(0, end, 0).applyMatrix4(matrix));
            return [Number((point.x * face / 0.065 + 12.5).toFixed(4)),
              Number((2 - (point.y - g.signHeight) / 0.065).toFixed(4))];
          });
          const middle = (ends[0][0] + ends[1][0]) / 2;
          const letter = starts.filter((start) => middle >= start).length - 1;
          counts[letter]++;
          expect(ends.every(([x, y]) => x >= starts[letter] && x <= (starts[letter + 1] ?? 26) - 1 && y >= 0 && y <= 4)).toBe(true);
          return ends.map((point) => point.join(',')).sort().join(':');
        }).sort());
        expect(counts).toEqual([5, 3, 6, 4, 3, 3]);
      }
      expect(faces[0]).toEqual(faces[1]);
      const header = parts.find(({ surface, position, scale }) => surface === builder.palette.rubber &&
        metroRelative(entrance, new THREE.Vector3(...position)).distanceTo(new THREE.Vector3(0, g.signHeight, g.openingDepth / 2)) < 0.001 &&
        scale[0] === 2.06)!;
      expect(header.bounds.min.y).toBeGreaterThan(2.1);
      expect(header.scale[0]).toBeLessThan(2.1);
    }
  });

  it('keeps compact metro signs, globes and upper descending treads visible from the ordinary camera', () => {
    const { parts } = createArt();
    const g = METRO_GEOMETRY;
    const { pose } = CAMERA_ANCHORS[0];
    const direction = new THREE.Vector3(
      Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch),
      Math.cos(pose.yaw) * Math.cos(pose.pitch),
    );
    const occluders = (point: THREE.Vector3) => {
      const ray = new THREE.Raycaster(point, direction, 0.015, CAMERA_PROJECTION.distance);
      const candidates = parts.filter(({ bounds }) => ray.ray.intersectsBox(bounds)).map((part) => {
        const mesh = new THREE.Mesh(part.shape, part.surface);
        mesh.name = `${part.surface.name} ${part.position}`;
        mesh.matrixWorld.copy(part.matrix);
        return mesh;
      });
      return ray.intersectObjects(candidates, false);
    };
    for (const entrance of METRO_ENTRANCES) {
      const sign = metroPoint(entrance, 0, g.signHeight, g.openingDepth / 2 + 0.07);
      expect(occluders(sign).map(({ object }) => object.name), `${entrance.id} sign`).toEqual([]);
      for (const side of [-1, 1]) {
        const globe = metroPoint(entrance, side * (g.openingWidth / 2 + g.wallThickness / 2),
          g.globeHeight, g.openingDepth / 2).addScaledVector(direction, 0.25);
        expect(occluders(globe).map(({ object }) => object.name), `${entrance.id} globe ${side}`).toEqual([]);
      }
      let visibleSteps = 0;
      const blocked: string[] = [];
      for (let step = 0; step < g.stepCount; step++) {
        const hits = occluders(metroPoint(entrance, 0, -(step + 1) * g.stepRise + 0.02,
          g.openingDepth / 2 - (step + 0.9) * g.treadDepth));
        if (hits.length === 0) visibleSteps++;
        else if (step < 3) blocked.push(`${step + 1}: ${hits[0].object.name}`);
      }
      expect(visibleSteps, `${entrance.id} stair flight ${blocked.join('; ')}`).toBeGreaterThanOrEqual(3);
    }
    const entrance = SUBWAY_ENTRANCES[0];
    const focus = CAMERA_ANCHORS.find(({ id }) => id === 'crosstown-view')!;
    expect(focus.pose.x).toBe(entrance.x);
    expect(focus.pose.z).toBe(entrance.z);
    expect(focus.pose.yaw).toBe(pose.yaw);
    expect(focus.pose.pitch).toBe(pose.pitch);
    const height = Math.max(CAMERA_PROJECTION.overviewHeight, CAMERA_PROJECTION.overviewWidth / 1.6) / focus.pose.zoom;
    const camera = new THREE.OrthographicCamera(-height * 0.8, height * 0.8, height / 2, -height / 2, 0.1, CAMERA_PROJECTION.far);
    const target = new THREE.Vector3(focus.pose.x, 0, focus.pose.z);
    camera.position.copy(target).addScaledVector(direction, CAMERA_PROJECTION.distance);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const signEdges = [-1, 1].map((side) => metroPoint(entrance, side * 1.03, g.signHeight, g.openingDepth / 2).project(camera));
    expect(signEdges.every(({ x, y, z }) => Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(z) < 1)).toBe(true);
    expect(Math.abs(signEdges[1].x - signEdges[0].x) * 1440 / 2).toBeGreaterThan(24);
  });

  it('separates braced facade scaffolding from a continuous protective shed with clear headroom', () => {
    const { parts, builder } = createArt();
    const walkZ = STREET_Z[centerRow] - SIDEWALK_OFFSET;
    const shedX = westX + 1.05;
    const deck = parts.find(({ surface, position, scale }) => surface === builder.palette.roof &&
      position[0] === shedX && position[1] === 2.78 && scale[0] === 7.3 &&
      Math.abs(scale[2] - 3.1) < 1e-9)!;
    expect(deck).toBeDefined();
    expect(deck.bounds.min.y).toBeGreaterThan(2.6);
    const corridor = new THREE.Box3(
      new THREE.Vector3(shedX - 3.4, 0.12, walkZ - 1),
      new THREE.Vector3(shedX + 3.4, 2.45, walkZ + 1),
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
      position[1] === 2.66 && scale[0] === 0.65)).toHaveLength(24);
  });

  it('adds seven sheds and four upper scaffold sections on occupied buildings with clear two-metre passages', () => {
    const { parts, builder } = createArt();
    expect(SIDEWALK_SHEDS).toHaveLength(7);
    expect(SIDEWALK_SHEDS.filter(({ scaffold }) => scaffold)).toHaveLength(4);
    for (const shed of SIDEWALK_SHEDS) {
      expect(STREET_BUILDINGS.some(({ id }) => id === shed.buildingId)).toBe(true);
      const deck = parts.find(({ surface, position, scale }) => surface === builder.palette.roof &&
        Math.abs(position[0] - shed.x) < 2 && position[2] === shed.z &&
        position[1] === 2.78 && scale[0] === shed.length)!;
      expect(deck).toBeDefined();
      expect(deck.bounds.min.y).toBeGreaterThan(2.6);
      const corridor = new THREE.Box3(
        new THREE.Vector3(shed.x - 1, 0.12, shed.z - shed.length / 2),
        new THREE.Vector3(shed.x + 1, 2.4, shed.z + shed.length / 2),
      );
      expect(parts.filter(({ bounds }) => bounds.intersectsBox(corridor))
        .map(({ surface, position }) => `${surface.name} ${position}`), shed.id).toEqual([]);
      const building = STREET_BUILDINGS.find(({ id }) => id === shed.buildingId)!;
      const entryX = building.brownstone ? building.x - building.width * 0.26 : building.x;
      const front = building.z + building.depth / 2;
      expect(corridor.intersectsBox(new THREE.Box3(
        new THREE.Vector3(entryX - 0.9, 0, front),
        new THREE.Vector3(entryX + 0.9, 2.4, front + 1.8),
      ))).toBe(false);
      if (!shed.scaffold) continue;
      const frames = parts.filter(({ surface, scale, position }) => surface === builder.palette.roof &&
        scale[0] === 0.07 && scale[1] > 4 && Math.abs(position[0] - shed.x) < 3.5 &&
        Math.abs(position[2] - shed.z) < shed.length / 2);
      expect(frames).toHaveLength(6);
      expect(frames.every(({ bounds }) => bounds.min.y >= 2.89)).toBe(true);
    }
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

  it('leaves posted all-way stops without signal masts while their painted bars remain', () => {
    const { parts, builder } = createArt();
    const masts = parts.filter(({ shape, surface, scale }) => shape === builder.cylinder &&
      surface === builder.palette.copperEdge && scale[0] === 0.075 && scale[1] === 5);
    expect(masts).toHaveLength(approachCount);
    expect(STOP_SIGN_INTERSECTIONS.length).toBeGreaterThan(0);
    for (const { x, z } of STOP_SIGN_INTERSECTIONS) {
      expect(masts.some(({ position }) => Math.hypot(position[0] - x, position[2] - z) < 12)).toBe(false);
      for (const side of [-1, 1]) {
        const stopZ = z - side * STOP_LINE_OFFSET;
        if (Math.abs(stopZ) >= CITY_EXTENT.z) continue;
        expect(parts.some(({ surface, position, scale }) => surface === builder.palette.line &&
          position[2] === stopZ && position[0] === x - side * VEHICLE_OFFSET &&
          scale[0] === 2.65 && scale[2] === 0.18),
        `painted stop bar at ${x},${stopZ}`).toBe(true);
      }
    }
  });

  it('keeps the full 5.8–7.6 m bidirectional pedestrian sweep clear beneath every sidewalk shed', () => {
    const { parts } = createArt();
    const corridors = SIDEWALK_SHEDS.map((shed) => {
      const road = STREET_X.reduce((nearest, x) => Math.abs(x - shed.x) < Math.abs(nearest - shed.x) ? x : nearest);
      return { x: road + Math.sign(shed.x - road) * 6.7, z: shed.z, width: 1.8, depth: shed.length };
    });
    corridors.push({ x: westX + 1.05, z: STREET_Z[centerRow] - 6.7, width: 7.3, depth: 1.8 });
    for (const { x, z, width, depth } of corridors) {
      const corridor = new THREE.Box3(
        new THREE.Vector3(x - width / 2, 0.12, z - depth / 2),
        new THREE.Vector3(x + width / 2, 2.4, z + depth / 2),
      );
      expect(parts.filter(({ bounds }) => bounds.intersectsBox(corridor))
        .map(({ surface, position }) => `${surface.name} ${position}`)).toEqual([]);
    }
  });

  it('retains all trees and crown shapes while clearing walking headroom, including maximum wind bending', () => {
    const { parts, builder } = createArt();
    const trunks = parts.filter(({ shape, surface, scale }) =>
      shape === builder.cylinder && surface === builder.palette.wood && scale[0] === 0.14);
    const foliage = parts.filter(({ shape, surface }) => shape === builder.crown &&
      (surface === builder.palette.leaf || surface === builder.palette.leafLight));
    expect(trunks).toHaveLength(39);
    let raised = 0;
    for (const trunk of trunks) {
      const large = foliage.find(({ surface, position, scale }) => surface === builder.palette.leaf &&
        position[2] === trunk.position[2] &&
        Math.abs(position[0] + 0.35 * scale[0] / 1.35 - trunk.position[0]) < 1e-9)!;
      expect(large).toBeDefined();
      const size = large.scale[0] / 1.35;
      const lift = large.position[1] - 3.3 * size;
      expect(lift).toBeGreaterThanOrEqual(-1e-9);
      expect(lift).toBeLessThan(1.5);
      if (lift > 0.01) raised++;
      expect(trunk.bounds.min.y).toBeCloseTo(0);
      expect(trunk.scale[1]).toBeCloseTo(3.2 * size + lift);
      [1.35 * size, 1.6 * size, 1.25 * size].forEach((value, axis) =>
        expect(large.scale[axis]).toBeCloseTo(value, 10));
      const small = foliage.find(({ surface, position }) => surface === builder.palette.leafLight &&
        Math.abs(position[0] - trunk.position[0] - 0.5 * size) < 1e-9 &&
        Math.abs(position[2] - trunk.position[2] - 0.1) < 1e-9)!;
      expect(small).toBeDefined();
      expect(small.position[1]).toBeCloseTo(3.9 * size + lift);
      [0.95 * size, 1.1 * size, size].forEach((value, axis) =>
        expect(small.scale[axis]).toBeCloseTo(value, 10));
    }
    expect(raised).toBeGreaterThan(20);
    expect(raised).toBeLessThan(39);
    const samples: { x: number; z: number }[] = [];
    const sample = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const route of SIDEWALK_WALKING_ROUTES.flat()) {
      for (let distance = 0; distance < route.length; distance += 0.5) {
        sampleTrafficRoute(route, distance, sample);
        samples.push({ x: sample.position.x, z: sample.position.z });
      }
    }
    const mesh = new THREE.InstancedMesh(builder.crown, builder.palette.leaf, foliage.length);
    cleanups.push(() => mesh.dispose());
    const batch = { mesh, transforms: foliage.map(({ matrix }) => matrix) };
    const wind = new FoliageWind();
    const matrix = new THREE.Matrix4();
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI / 4;
      wind.update([batch], { x: Math.cos(angle) * 20, z: Math.sin(angle) * 20 }, direction * 1.5, false);
      const obstacles = trunks.map(({ bounds }) => bounds);
      for (let index = 0; index < foliage.length; index++) {
        mesh.getMatrixAt(index, matrix);
        const bounds = builder.crown.boundingBox!.clone().applyMatrix4(matrix);
        if (bounds.min.y < 2.4) obstacles.push(bounds);
      }
      const collisions = obstacles.filter((bounds) => samples.some(({ x, z }) => {
        const dx = Math.max(bounds.min.x - x, 0, x - bounds.max.x);
        const dz = Math.max(bounds.min.z - z, 0, z - bounds.max.z);
        return dx * dx + dz * dz < 0.4 ** 2 - 1e-9;
      }));
      expect(collisions.map(({ min, max }) => [min.toArray(), max.toArray()])).toEqual([]);
    }
  });

  it('reuses static batches and reproduces all authored transforms deterministically', () => {
    const first = createArt();
    const second = createArt();
    const batches = new Set(first.parts.map(({ shape, surface }) => `${shape.type}:${surface.name}`));
    expect(batches.size + first.art.group.children.length).toBeLessThanOrEqual(31);
    expect(first.parts.length).toBeLessThan(32_000);
    const triangles = first.parts.reduce((sum, { shape }) => sum + (shape.index?.count ?? shape.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeLessThan(440_000);
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
