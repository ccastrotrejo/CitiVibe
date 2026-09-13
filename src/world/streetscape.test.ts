import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  BIKE_OFFSET, CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_OFFSET,
  STOP_LINE_OFFSET, STREET_X, STREET_Z, VEHICLE_OFFSET,
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

function createArt() {
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
  const art = buildStreetscape(builder);
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
  it('authors eight peripheral parcels and varied, separated street walls without touching the garden', () => {
    expect(SIDEWALK_OFFSET).toBe(6.2);
    expect(STOP_LINE_OFFSET).toBe(8.5);
    expect(STREET_BLOCKS).toHaveLength(8);
    expect(STREET_BUILDINGS).toHaveLength(32);
    expect(new Set(STREET_BUILDINGS.map(({ skin }) => skin)).size).toBe(4);
    expect(new Set(STREET_BUILDINGS.map(({ floors }) => floors)).size).toBe(5);
    expect(new Set(STREET_BUILDINGS.map(({ roof }) => roof)).size).toBe(4);
    expect(STREET_BUILDINGS.filter(({ setbackFloors }) => setbackFloors > 0)).toHaveLength(4);
    expect(() => validateStreetscape()).not.toThrow();
    for (const building of STREET_BUILDINGS) {
      expect(Math.abs(building.x) - building.width / 2 > 24 ||
        Math.abs(building.z) - building.depth / 2 > 21).toBe(true);
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
        const principal = building.skin === 'clay' && building.stoop && building.floors <= 5 && floor === 0;
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
    const brownstones = STREET_BUILDINGS.filter(({ skin, stoop, floors }) => skin === 'clay' && stoop && floors <= 5);
    expect(brownstones).toHaveLength(6);
    for (const building of brownstones) {
      const entryX = building.x - building.width * 0.26;
      const front = building.z + building.depth / 2;
      const door = parts.find(({ surface, position, scale }) => surface === builder.palette.glass &&
        position[0] === entryX && position[2] === front + 0.05 && scale[0] === 0.95)!;
      expect(door.bounds.min.y).toBeCloseTo(0.84);
      const steps = parts.filter(({ surface, position, scale }) => surface === builder.palette.copperEdge &&
        position[0] === entryX && position[2] > front && position[1] < 0.6 && scale[0] === 1.45);
      expect(steps).toHaveLength(4);
      expect(Math.max(...steps.map(({ bounds }) => bounds.max.y))).toBeCloseTo(door.bounds.min.y);
      const principalWindows = parts.filter(({ surface, position, scale }) =>
        surface === builder.palette.glass && Math.abs(position[0] - building.x) < building.width / 2 &&
        position[2] === front + 0.025 && scale[1] === 1.55);
      expect(principalWindows).toHaveLength(2);
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

  it('leaves sidewalk centerlines and the central garden free of ground-level obstacles', () => {
    const { parts } = createArt();
    const obstacles = parts.filter(({ bounds }) => bounds.max.y > 0.35 && bounds.min.y < 1.8);
    for (const part of obstacles) {
      expect(part.bounds.max.x <= -24 || part.bounds.min.x >= 24 ||
        part.bounds.max.z <= -21 || part.bounds.min.z >= 21,
      `Core obstacle ${part.surface.name} ${part.position}`).toBe(true);
      for (const x of STREET_X) {
        for (const side of [-1, 1]) {
          const path = x + side * SIDEWALK_OFFSET;
          expect(part.bounds.max.x < path - 0.22 || part.bounds.min.x > path + 0.22,
            `Avenue sidewalk obstacle ${part.surface.name} ${part.position}`).toBe(true);
        }
      }
      for (const z of STREET_Z) {
        for (const side of [-1, 1]) {
          const path = z + side * SIDEWALK_OFFSET;
          expect(part.bounds.max.z < path - 0.22 || part.bounds.min.z > path + 0.22,
            `Cross-street sidewalk obstacle ${part.surface.name} ${part.position}`).toBe(true);
        }
      }
    }
  });

  it('keeps original public-space anchors open with court, transit, crane and unbranded props', () => {
    const { parts, builder } = createArt();
    expect(parts.some(({ position, scale, surface }) =>
      position[0] === -44.5 && position[2] === 40 && scale[0] === 9.4 && surface === builder.palette.teal)).toBe(true);
    expect(parts.some(({ position, scale }) => position[0] === 44.5 && position[2] === -34.9 && scale[0] === 5.2)).toBe(true);
    expect(parts.some(({ position, scale }) => position[0] === -44 && position[1] === 18.5 && scale[0] === 13.2)).toBe(true);
    for (const [x, z] of [[-45, 40], [45, -40]]) {
      expect(STREET_BUILDINGS.every((building) => Math.abs(x - building.x) > building.width / 2 ||
        Math.abs(z - building.z) > building.depth / 2)).toBe(true);
    }
    expect(parts.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leaf)).toBe(true);
    expect(parts.some(({ shape, surface }) => shape === builder.crown && surface === builder.palette.leafLight)).toBe(true);
  });

  it('separates braced facade scaffolding from a continuous protective shed with clear headroom', () => {
    const { parts, builder } = createArt();
    const walkZ = STREET_Z[1] - SIDEWALK_OFFSET;
    const deck = parts.find(({ surface, position, scale }) => surface === builder.palette.roof &&
      position[0] === -42.8 && position[1] === 2.78 && scale[0] === 8.8 && scale[2] === 2.5)!;
    expect(deck).toBeDefined();
    expect(deck.bounds.min.y).toBeGreaterThan(2.6);
    const corridor = new THREE.Box3(
      new THREE.Vector3(-46.95, 0.12, walkZ - 0.7),
      new THREE.Vector3(-38.65, 2.45, walkZ + 0.7),
    );
    parts.forEach(({ bounds, surface, position }) =>
      expect(bounds.intersectsBox(corridor), `Covered-walk obstruction ${surface.name} ${position}`).toBe(false));
    expect(parts.filter(({ surface, scale }) => surface === builder.palette.roof &&
      scale[0] === 0.085 && scale[1] === 6.8)).toHaveLength(6);
    const facadeBraces = parts.filter(({ surface, position, scale }) => surface === builder.palette.roof &&
      position[2] === -34.3 && scale[0] === 0.055);
    expect(facadeBraces).toHaveLength(12);
    expect(facadeBraces.every(({ bounds }) => bounds.max.z < corridor.min.z)).toBe(true);
    expect(parts.filter(({ surface, position, scale }) => surface === builder.palette.teal &&
      position[0] === -42.8 && scale[1] === 0.48)).toHaveLength(2);
    expect(parts.filter(({ surface, position, scale }) => surface === builder.palette.line &&
      position[1] === 2.66 && scale[0] === 0.65)).toHaveLength(3);
  });

  it('uses borrowed yellow signal housings with three dark lenses, projecting visors and braced arms', () => {
    const { parts, builder, art } = createArt();
    const housings = parts.filter(({ surface, scale }) => surface === builder.palette.taxi &&
      scale[0] === 0.65 && scale[1] === 1.42);
    expect(housings).toHaveLength(48);
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
      position[1] === 4.65 && scale[0] === 0.055)).toHaveLength(48);
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
    expect(first.parts.length).toBeLessThan(11_000);
    const triangles = first.parts.reduce((sum, { shape }) => sum + (shape.index?.count ?? shape.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeLessThan(170_000);
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
    const target = INTERSECTIONS[5];
    art.setSignals([{ id: target.id, phase: 'north-south' }]);
    expect(lamps(art, 'green').count).toBe(2);
    art.setSignals([{ id: INTERSECTIONS[6].id, phase: 'pedestrians' }]);
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
