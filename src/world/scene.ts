import * as THREE from 'three';
import { CITY, CONTENT, LANDMARKS, ROUTE_LENGTH, sampleRoute, validateLandmarks } from '../content/city';
import { VEHICLE, WALKER, poseNeutral } from './locomotion';
import type { LegRig, VehicleRig, WalkerRig, WheelRig } from './locomotion';
import { captureWeatherSurface } from './weatherArt';
import type { FoliageBatch } from './weatherArt';
import type { WeatherSurface } from './weatherSurface';
import { GROUND_LEVEL, GROUND_PUDDLES } from './groundWater';

export interface CityScene {
  scene: THREE.Scene;
  bus: THREE.Group;
  actors: Map<string, THREE.Group>;
  hitTargets: THREE.Object3D[];
  marker: THREE.Object3D;
  weatherSurface: WeatherSurface;
  snowMeshes: THREE.Mesh[];
  foliage: FoliageBatch[];
  setSignal?(phase: 'vehicles' | 'clearance' | 'pedestrians'): void;
  dispose(): void;
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  transforms: THREE.Matrix4[];
  flexible: boolean;
}

interface BuildingInput {
  id: string;
  family: 'hall' | 'terrace' | 'cottage';
  skin: 'cream' | 'teal' | 'clay';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface ArtInputs {
  schemaVersion: number;
  assetVersion: string;
  seed: number;
  roadWidth: number;
  sidewalkHalfWidth: number;
  crossing: { x: number; z: number };
  busStop: { x: number; z: number };
  buildings: readonly BuildingInput[];
}

/** Versioned art inputs, paired with CONTENT's stable route and landmark manifest. */
export const ART_INPUTS = {
  schemaVersion: 1,
  assetVersion: CONTENT.assetVersion,
  seed: CONTENT.seed,
  roadWidth: 4,
  sidewalkHalfWidth: 4.8,
  crossing: { x: 0, z: -16 },
  busStop: { x: -9, z: -13 },
  buildings: [
    { id: 'west-hall', family: 'hall', skin: 'teal', x: -11.5, z: -9.5, width: 5.6, depth: 4.4, height: 7.8 },
    { id: 'north-hall', family: 'hall', skin: 'cream', x: -3.8, z: -10, width: 4.8, depth: 4.2, height: 10.4 },
    { id: 'terraced-houses', family: 'terrace', skin: 'clay', x: 9.3, z: -8.6, width: 6.6, depth: 5.5, height: 6.6 },
    { id: 'east-cottage', family: 'cottage', skin: 'cream', x: 12.4, z: 6.6, width: 4.6, depth: 4.8, height: 4 },
    { id: 'garden-cottage', family: 'cottage', skin: 'teal', x: 2.9, z: 8.2, width: 5.2, depth: 4.1, height: 3.5 },
  ],
} as const satisfies ArtInputs;

/** Reject malformed authored inputs before allocating scene/GPU resources. */
export function validateArtInputs(inputs: ArtInputs): void {
  if (inputs.schemaVersion !== 1 || inputs.assetVersion !== CITY.version ||
    !Number.isSafeInteger(inputs.seed) || inputs.seed < 0 || inputs.seed > 0xffffffff ||
    inputs.roadWidth !== 4 || !Number.isFinite(inputs.sidewalkHalfWidth) ||
    inputs.sidewalkHalfWidth < 4.5 || inputs.sidewalkHalfWidth > 5) {
    throw new Error('Invalid Rainlight Square art version, seed, or street dimensions.');
  }
  const crossing = sampleRoute(14);
  if (inputs.crossing.x !== crossing.x || inputs.crossing.z !== crossing.z ||
    inputs.busStop.x !== -9 || inputs.busStop.z !== -13) {
    throw new Error('Art crossing or bus stop does not match the street contract.');
  }
  const ids = new Set<string>();
  if (inputs.buildings.length < 1 || inputs.buildings.length > 8) throw new Error('Invalid district building count.');
  for (const building of inputs.buildings) {
    const { id, x, z, width, depth, height, family, skin } = building;
    if (!id || ids.has(id) || ![x, z, width, depth, height].every(Number.isFinite) ||
      !['hall', 'terrace', 'cottage'].includes(family) || !['cream', 'teal', 'clay'].includes(skin) ||
      width < 2 || depth < 2 || height < 2 || height > 14 ||
      (family === 'terrace' && (width <= 2 || depth <= 2.4)) ||
      Math.abs(x) + width / 2 > 16.5 || Math.abs(z) + depth / 2 > 13) {
      throw new Error(`Invalid original building input: ${id}.`);
    }
    ids.add(id);
    if (Math.abs(x) < width / 2 + 1.1 && Math.abs(z + 16) < depth / 2 + 4.5) {
      throw new Error(`Building blocks the north crossing: ${id}.`);
    }
    if (Math.abs(x + 9) < width / 2 + 3 && Math.abs(z + 13) < depth / 2 + 0.7) {
      throw new Error(`Building blocks the bus stop: ${id}.`);
    }
  }
}

/** Original, deterministic Rainlight Square art; the caller owns actor movement. */
export function buildCityScene(): CityScene {
  validateArtInputs(ART_INPUTS);
  validateLandmarks(LANDMARKS);
  const landmark = (id: string) => {
    const result = LANDMARKS.find((point) => point.id === id);
    if (!result) throw new Error(`Missing original landmark: ${id}.`);
    return result;
  };
  const pavilion = landmark(CITY.landmark.id);
  const terrace = landmark('terrace-steps');
  const garden = landmark('reed-garden');
  const scene = new THREE.Scene();
  scene.name = CITY.name;
  scene.background = new THREE.Color('#e9e2d3');
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances = new Set<THREE.InstancedMesh>();
  const foliage: FoliageBatch[] = [];
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => {
    geometries.add(value);
    return value;
  };
  const material = <T extends THREE.Material>(value: T): T => {
    materials.add(value);
    return value;
  };
  const paint = (color: string, roughness = 0.88) =>
    material(new THREE.MeshStandardMaterial({ color, roughness }));
  const palette = {
    sand: paint('#e9e2d3'),
    stone: paint('#d6c7aa'),
    paving: paint('#ebdcc0'),
    road: paint('#727f7c'),
    line: paint('#f4e7cb'),
    cream: paint('#f0dec0'),
    clay: paint('#bc745b'),
    teal: paint('#568581'),
    roof: paint('#626c67'),
    copper: paint('#b97850', 0.65),
    copperEdge: paint('#80553e'),
    glass: paint('#354f53', 0.5),
    wood: paint('#9c7952'),
    leaf: paint('#70866a'),
    leafLight: paint('#9aa478'),
    water: paint('#739d98', 0.6),
    bus: paint('#db8b57'),
    rubber: paint('#3b4643'),
    skin: paint('#bd8e68'),
    skinLight: paint('#d9b694'),
  };
  // Tag glazing so the environment layer can light windows warmly after dark.
  palette.glass.userData.window = true;
  for (const surface of [palette.stone, palette.paving, palette.road, palette.line, palette.cream, palette.clay,
    palette.teal, palette.roof, palette.copper, palette.copperEdge, palette.wood, palette.leaf, palette.leafLight]) {
    surface.userData.weatherSurface = true;
  }
  palette.road.userData.snowRetention = 0.45;
  palette.line.userData.snowRetention = 0.45;
  const box = geometry(new THREE.BoxGeometry());
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const crown = geometry(new THREE.DodecahedronGeometry(1));
  const hipRoof = geometry(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4));
  const dummy = new THREE.Object3D();

  function batcher(parent: THREE.Object3D) {
    const batches = new Map<string, Batch>();
    return {
      add(
        shape: THREE.BufferGeometry, surface: THREE.Material,
        position: readonly [number, number, number], scale: readonly [number, number, number],
        rotation: readonly [number, number, number] = [0, 0, 0],
        flexible = false,
      ) {
        const key = `${shape.uuid}:${surface.uuid}:${flexible}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = { geometry: shape, material: surface, transforms: [], flexible };
          batches.set(key, batch);
        }
        dummy.position.set(...position);
        dummy.scale.set(...scale);
        dummy.rotation.set(...rotation);
        dummy.updateMatrix();
        batch.transforms.push(dummy.matrix.clone());
      },
      finish() {
        for (const batch of batches.values()) {
          const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.transforms.length);
          batch.transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          if (batch.flexible) {
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            if (mesh.boundingSphere) mesh.boundingSphere.radius += 1;
            foliage.push({ mesh, transforms: batch.transforms });
          }
          instances.add(mesh);
          parent.add(mesh);
        }
        batches.clear();
      },
    };
  }
  const district = batcher(scene);
  const block = (
    surface: THREE.Material, x: number, y: number, z: number,
    width: number, height: number, depth: number, yaw = 0,
  ) => district.add(box, surface, [x, y, z], [width, height, depth], [0, yaw, 0]);

  function mesh(shape: THREE.BufferGeometry, surface: THREE.Material, name: string) {
    const object = new THREE.Mesh(shape, surface);
    object.name = name;
    object.receiveShadow = true;
    scene.add(object);
    return object;
  }

  const groundOutline = new THREE.Shape();
  groundOutline.moveTo(-42, -42);
  groundOutline.lineTo(42, -42);
  groundOutline.quadraticCurveTo(46, -42, 46, -38);
  groundOutline.lineTo(46, 38);
  groundOutline.quadraticCurveTo(46, 42, 42, 42);
  groundOutline.lineTo(-42, 42);
  groundOutline.quadraticCurveTo(-46, 42, -46, 38);
  groundOutline.lineTo(-46, -38);
  groundOutline.quadraticCurveTo(-46, -42, -42, -42);
  for (const basin of GROUND_PUDDLES) {
    const hole = new THREE.Path();
    hole.absellipse(basin.x, -basin.z, basin.radiusX, basin.radiusZ, 0, Math.PI * 2, true);
    groundOutline.holes.push(hole);
    const positions = [basin.x, GROUND_LEVEL - basin.maxDepth, basin.z];
    const indices: number[] = [];
    const segments = 32;
    for (let ring = 1; ring <= 4; ring++) {
      const radius = ring / 4;
      for (let index = 0; index < segments; index++) {
        const angle = index / segments * Math.PI * 2;
        positions.push(basin.x + Math.cos(angle) * basin.radiusX * radius,
          GROUND_LEVEL - basin.maxDepth + basin.maxDepth * radius ** 2,
          basin.z + Math.sin(angle) * basin.radiusZ * radius);
        const current = 1 + (ring - 1) * segments + index;
        const next = 1 + (ring - 1) * segments + (index + 1) % segments;
        if (ring === 1) indices.push(0, next, current);
        else indices.push(current - segments, next, current, current - segments, next - segments, next);
      }
    }
    const shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    shape.setIndex(indices);
    shape.computeVertexNormals();
    mesh(shape, palette.stone, `${basin.id} rain depression`);
  }
  const ground = mesh(geometry(new THREE.ExtrudeGeometry(groundOutline, {
    depth: 0.8, bevelEnabled: false, steps: 1, curveSegments: 8,
  })), palette.stone, 'Miniature ground');
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.94;
  const backdrop = mesh(geometry(new THREE.PlaneGeometry(400, 400)), palette.sand, 'Sand backdrop');
  backdrop.rotation.x = -Math.PI / 2;
  backdrop.position.y = -0.96;

  // Road edges use the route's exact center and normal, including every rounded turn.
  function ribbon(halfWidth: number, y: number, offset = 0) {
    const vertices: number[] = [];
    const indices: number[] = [];
    const segments = 256;
    for (let index = 0; index <= segments; index++) {
      const point = sampleRoute(index / segments * ROUTE_LENGTH);
      for (const side of [1, -1]) {
        const distance = offset + side * halfWidth;
        vertices.push(
          point.x + Math.cos(point.heading) * distance, y,
          point.z - Math.sin(point.heading) * distance,
        );
      }
      if (index < segments) {
        const start = index * 2;
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }
    const shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    shape.setIndex(indices);
    shape.computeVertexNormals();
    return shape;
  }
  mesh(ribbon(ART_INPUTS.sidewalkHalfWidth, -0.025), palette.paving, 'Loop sidewalk');
  mesh(ribbon(ART_INPUTS.roadWidth / 2, 0), palette.road, 'Garden loop road');
  mesh(ribbon(0.045, 0.012, 1.85), palette.line, 'Outer road edge');
  mesh(ribbon(0.045, 0.012, -1.85), palette.line, 'Inner road edge');

  const crossing = new THREE.Group();
  crossing.name = 'North zebra crossing';
  const crossingPaint = batcher(crossing);
  for (let stripe = 0; stripe < 5; stripe++) {
    crossingPaint.add(box, palette.line,
      [ART_INPUTS.crossing.x, 0.014, ART_INPUTS.crossing.z - 1.6 + stripe * 0.8],
      [2.6, 0.024, 0.36]);
  }
  crossingPaint.finish();
  scene.add(crossing);
  const stop = ART_INPUTS.busStop;
  block(palette.paving, stop.x, 0.015, stop.z, 5.8, 0.12, 1.3);
  block(palette.line, stop.x, 0.02, stop.z - 0.85, 5.8, 0.04, 0.16);
  district.add(cylinder, palette.copperEdge, [stop.x - 3.3, 1.25, stop.z], [0.05, 2.5, 0.05]);
  block(palette.teal, stop.x - 3.3, 2.3, stop.z, 0.8, 0.65, 0.12);
  block(palette.cream, stop.x - 3.3, 2.3, stop.z - 0.07, 0.52, 0.2, 0.04);

  const { x: pavilionX, z: pavilionZ } = pavilion.position;
  block(palette.paving, pavilionX, 0.02, pavilionZ, 11, 0.18, 10);
  block(palette.paving, -4, 0, 8, 2, 0.1, 10);
  block(palette.paving, 3.5, 0, -3, 7, 0.1, 2);
  for (let index = 0; index < 6; index++) {
    block(palette.stone, -8.4 + index * 1.75, 0.12, 1.2, 0.025, 0.025, 1.25);
  }

  function house({ x, z, width, depth, height, skin: color, family }: BuildingInput) {
    const skin = palette[color];
    block(palette.stone, x, 0.18, z, width + 0.5, 0.45, depth + 0.5);
    block(skin, x, height / 2 + 0.3, z, width, height, depth);
    block(palette.cream, x, height + 0.37, z, width + 0.3, 0.25, depth + 0.3);
    if (family === 'cottage') {
      district.add(hipRoof, palette.roof, [x, height + 1.08, z],
        [(width + 0.3) / Math.SQRT2, 1.4, (depth + 0.3) / Math.SQRT2]);
    } else {
      block(palette.roof, x, height + 0.52, z, width - 0.4, 0.12, depth - 0.4);
    }
    if (family === 'terrace') {
      block(skin, x, height + 1.2, z - 0.9, width - 1.8, 2, depth - 2.2);
      block(palette.cream, x, height + 2.25, z - 0.9, width - 1.5, 0.2, depth - 1.9);
      block(palette.roof, x, height + 2.4, z - 0.9, width - 2, 0.1, depth - 2.4);
    }
    for (let level = 1.7; level < height; level += 2) {
      for (let column = -width / 2 + 1; column < width / 2 - 0.5; column += 1.55) {
        for (const side of [-1, 1]) {
          block(palette.glass, x + column, level, z + side * (depth / 2 + 0.02), 0.72, 1.08, 0.05);
          block(palette.cream, x + column, level - 0.6, z + side * (depth / 2 + 0.09), 0.88, 0.1, 0.24);
        }
      }
      for (let column = -depth / 2 + 1; column < depth / 2 - 0.5; column += 1.55) {
        for (const side of [-1, 1]) {
          block(palette.glass, x + side * (width / 2 + 0.02), level, z + column, 0.05, 1.08, 0.72);
        }
      }
    }
    block(palette.glass, x, 1.15, z + depth / 2 + 0.03, 1.1, 1.7, 0.07);
    block(palette.wood, x, 2.2, z + depth / 2 + 0.55, 1.7, 0.16, 1.2);
  }
  ART_INPUTS.buildings.forEach(house);
  for (let step = 0; step < 5; step++) {
    block(palette.paving, terrace.position.x, 0.13 + step * 0.18, terrace.position.z + 0.8 - step * 0.42,
      5.6, 0.26 + step * 0.36, 0.45);
  }
  block(palette.clay, terrace.position.x - 3.15, 0.4, terrace.position.z, 0.5, 0.8, 2.3);
  block(palette.clay, terrace.position.x + 3.15, 0.4, terrace.position.z, 0.5, 0.8, 2.3);
  for (const side of [-1, 1]) {
    district.add(crown, palette.leafLight, [terrace.position.x + side * 3.15, 1.05, terrace.position.z],
      [0.45, 0.45, 0.85]);
  }

  const plinth = geometry(new THREE.CylinderGeometry(3.7, 3.9, 0.32, 8));
  const eaves = geometry(new THREE.CylinderGeometry(4.45, 4.45, 0.22, 8));
  const copperRoof = geometry(new THREE.CylinderGeometry(0.55, 4.5, 1.7, 8));
  district.add(plinth, palette.cream, [pavilionX, 0.27, pavilionZ], [1, 1, 0.9]);
  district.add(eaves, palette.copperEdge, [pavilionX, 5.35, pavilionZ], [1, 1, 0.9]);
  district.add(copperRoof, palette.copper, [pavilionX, 6.3, pavilionZ], [1, 1, 0.9]);
  district.add(cylinder, palette.copperEdge, [pavilionX, 7.2, pavilionZ], [0.34, 0.2, 0.34]);
  district.add(crown, palette.copper, [pavilionX, 7.53, pavilionZ], [0.32, 0.4, 0.32]);
  for (let index = 0; index < 8; index++) {
    const angle = index / 8 * Math.PI * 2 + Math.PI / 8;
    district.add(cylinder, palette.cream, [
      pavilionX + Math.cos(angle) * 2.95, 2.83, pavilionZ + Math.sin(angle) * 2.65,
    ], [0.19, 4.8, 0.19]);
    district.add(cylinder, palette.stone, [
      pavilionX + Math.cos(angle) * 2.95, 0.64, pavilionZ + Math.sin(angle) * 2.65,
    ], [0.31, 0.45, 0.31]);
  }
  block(palette.wood, pavilionX, 0.95, pavilionZ, 3.5, 0.22, 1.4);
  block(palette.stone, pavilionX - 1.2, 0.68, pavilionZ, 0.3, 0.5, 1.1);
  block(palette.stone, pavilionX + 1.2, 0.68, pavilionZ, 0.3, 0.5, 1.1);

  const { x: gardenX, z: gardenZ } = garden.position;
  block(palette.leafLight, gardenX - 0.6, -0.01, gardenZ + 0.4, 8.6, 0.2, 6.3);
  block(palette.stone, gardenX, 0.16, gardenZ, 5.2, 0.35, 3.4);
  block(palette.water, gardenX, 0.35, gardenZ, 4.7, 0.08, 2.9);
  for (let index = 0; index < 12; index++) {
    const x = gardenX - 2 + index % 6 * 0.72;
    const z = gardenZ + (index < 6 ? -1.15 : 1.15);
    district.add(cylinder, palette.leaf, [x, 0.85, z], [0.045, 0.9 + index % 3 * 0.15, 0.045], [0, 0, 0], true);
    district.add(crown, palette.leafLight, [x, 1.23, z], [0.17, 0.32, 0.16], [0, 0, 0], true);
  }

  const treePositions = [
    [-14.3, -3, 1], [-14, 1.4, 0.9], [-13, 9.2, 1.1], [-6, 10.3, 0.85],
    [-0.5, 3.8, 1], [6.3, 3.2, 1.1], [14.7, -1.6, 0.9], [15.2, -10.5, 0.85],
    [-22.9, -7, 0.9], [-22.9, 1, 1], [-12, 18.9, 0.85], [0, 18.9, 1], [12, 18.9, 0.85],
    [22.9, 0, 0.85], [22.9, 8, 1],
  ] as const;
  let seed: number = ART_INPUTS.seed;
  treePositions.forEach(([x, z, size], index) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    district.add(cylinder, palette.wood, [x, 1.3 * size, z], [0.13, 2.6 * size, 0.13]);
    district.add(crown, index % 3 ? palette.leaf : palette.leafLight, [x, 3.25 * size, z],
      [1.25 * size, 1.65 * size, 1.2 * size], [0, seed / 0x100000000 * Math.PI * 2, 0.1], true);
    district.add(cylinder, palette.paving, [x, 0.03, z], [0.8, 0.12, 0.8]);
  });
  for (const [x, z] of [[-11, 3.7], [-5.4, 10.5], [4.7, -2.8]] as const) {
    block(palette.wood, x, 0.65, z, 2, 0.16, 0.65);
    block(palette.wood, x, 1.05, z - 0.3, 2, 0.55, 0.12);
    block(palette.copperEdge, x - 0.7, 0.3, z, 0.12, 0.6, 0.48);
    block(palette.copperEdge, x + 0.7, 0.3, z, 0.12, 0.6, 0.48);
  }
  for (const [x, z] of [[-16.5, -6], [-16.5, 6], [16.5, -6], [16.5, 6]] as const) {
    district.add(cylinder, palette.copperEdge, [x, 1.8, z], [0.065, 3.6, 0.065]);
    block(palette.cream, x, 3.68, z, 0.45, 0.28, 0.45);
    block(palette.copperEdge, x, 3.87, z, 0.55, 0.1, 0.55);
  }
  for (const [x, z, shirt] of [
    [-11.35, 3.7, palette.clay], [-5.65, 10.5, palette.teal],
  ] as const) {
    block(shirt, x, 1.06, z, 0.34, 0.48, 0.22);
    district.add(crown, palette.skin, [x, 1.46, z], [0.18, 0.22, 0.18]);
    for (const side of [-1, 1]) {
      block(palette.rubber, x + side * 0.1, 0.74, z + 0.15, 0.13, 0.15, 0.45);
      block(palette.rubber, x + side * 0.1, 0.43, z + 0.32, 0.13, 0.56, 0.14);
      block(shirt, x + side * 0.22, 0.99, z + 0.06, 0.12, 0.32, 0.14);
    }
  }
  const stopSignal = material(new THREE.MeshStandardMaterial({
    color: '#de6151', emissive: '#de6151', emissiveIntensity: 0.65, roughness: 0.7,
  }));
  const goSignal = material(new THREE.MeshStandardMaterial({
    color: '#86b97f', emissive: '#86b97f', emissiveIntensity: 0.65, roughness: 0.7,
  }));
  const signalNormal = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);
  const lampRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), signalNormal);
  const signalLights = [
    { name: 'Vehicle', x: -3.6, z: -18.8, height: 3.5, kind: 'vehicles' },
    { name: 'North crossing', x: 1.6, z: -18.8, height: 2.5, kind: 'pedestrians' },
    { name: 'South crossing', x: -1.6, z: -13.2, height: 2.5, kind: 'pedestrians' },
  ].map(({ name, x, z, height, kind }) => {
    district.add(cylinder, palette.copperEdge, [x, (height - 0.3) / 2, z], [0.055, height - 0.3, 0.055]);
    block(palette.rubber, x, height, z, 0.5, 0.84, 0.26, Math.PI / 4);
    const lamp = (label: string, y: number) => {
      const light = mesh(cylinder, palette.rubber, `${name} ${label} lamp`);
      light.position.set(x + signalNormal.x * 0.16, y, z + signalNormal.z * 0.16);
      light.scale.set(0.135, 0.04, 0.135);
      light.quaternion.copy(lampRotation);
      light.receiveShadow = false;
      return light;
    };
    return { kind, stop: lamp('stop', height + 0.2), go: lamp('go', height - 0.2) };
  });

  // Outer city — an ambient skyline that surrounds the tuned core. Every piece reuses
  // one of the existing geometries and palette materials, so the batcher folds it into
  // the established InstancedMeshes: no new draw calls, no new materials. It is purely
  // decorative backdrop revealed as the camera pans or zooms out; the simulated loop,
  // route, actors, and signals are untouched. A fixed-seed RNG keeps it deterministic.
  const outerSkins = [palette.cream, palette.clay, palette.teal, palette.stone, palette.wood] as const;
  let outerSeed = (ART_INPUTS.seed ^ 0x9e3779b9) >>> 0;
  const outerRandom = () => {
    outerSeed = (Math.imul(outerSeed, 1664525) + 1013904223) >>> 0;
    return outerSeed / 0x100000000;
  };
  const outerTower = (x: number, z: number) => {
    const width = 2 + outerRandom() * 2.6;
    const depth = 2 + outerRandom() * 2.6;
    const height = 2.4 + outerRandom() * 8.5;
    const skin = outerSkins[Math.floor(outerRandom() * outerSkins.length)];
    block(palette.stone, x, 0.2, z, width + 0.5, 0.4, depth + 0.5);
    block(skin, x, height / 2 + 0.3, z, width, height, depth);
    block(palette.cream, x, height + 0.36, z, width + 0.25, 0.22, depth + 0.25);
    // A single glazed band per street face reads as windows from a distance without
    // the per-floor geometry the core buildings carry up close.
    for (const face of [1, -1]) {
      block(palette.glass, x, height * 0.55, z + face * (depth / 2 + 0.02), width - 0.5, height * 0.7, 0.05);
    }
    if (outerRandom() > 0.45) {
      district.add(hipRoof, palette.roof, [x, height + 0.85, z],
        [(width + 0.25) / Math.SQRT2, 1.2, (depth + 0.25) / Math.SQRT2]);
    } else {
      block(palette.roof, x, height + 0.5, z, width - 0.35, 0.12, depth - 0.35);
    }
  };
  const outerStep = 6.4;
  for (let ix = -6; ix <= 6; ix++) {
    for (let iz = -6; iz <= 6; iz++) {
      const gx = ix * outerStep;
      const gz = iz * outerStep;
      if (Math.abs(gx) <= 24 && Math.abs(gz) <= 24) continue;
      outerTower(gx + (outerRandom() - 0.5) * 2.6, gz + (outerRandom() - 0.5) * 2.6);
    }
  }
  const outerTree = (x: number, z: number) => {
    const size = 0.8 + outerRandom() * 0.6;
    district.add(cylinder, palette.wood, [x, 1.3 * size, z], [0.13, 2.6 * size, 0.13]);
    district.add(crown, outerRandom() > 0.5 ? palette.leaf : palette.leafLight,
      [x, 3.2 * size, z], [1.2 * size, 1.6 * size, 1.15 * size],
      [0, outerRandom() * Math.PI * 2, 0.08], true);
  };
  for (let index = 0; index < 18; index++) {
    const angle = index / 18 * Math.PI * 2;
    const radius = 30 + outerRandom() * 12;
    outerTree(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  district.finish();
  const weatherSurface = captureWeatherSurface(scene);
  const snowMeshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material.userData.weatherSurface === true) {
      snowMeshes.push(object);
    }
  });

  const actors = new Map<string, THREE.Group>();
  function actorGroup(id: string, name: string) {
    const group = new THREE.Group();
    group.name = name;
    actors.set(id, group);
    scene.add(group);
    return group;
  }
  // Actors are posable rigs: static shells stay batched, while feet, wheels, and
  // vehicle bodies are separate named pivots the locomotion layer drives per frame.
  const wheel = geometry(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 12));
  const limb = (
    shape: THREE.BufferGeometry, surface: THREE.Material,
    position: readonly [number, number, number], scale: readonly [number, number, number],
    rotation: readonly [number, number, number] = [0, 0, 0],
  ) => {
    const object = new THREE.Mesh(shape, surface);
    object.position.set(...position);
    object.scale.set(...scale);
    object.rotation.set(...rotation);
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  };
  function buildWheel(
    parent: THREE.Object3D, x: number, y: number, z: number,
    radiusFactor: number, thicknessFactor: number, front: boolean,
  ): WheelRig {
    const steer = new THREE.Object3D();
    steer.position.set(x, y, z);
    parent.add(steer);
    const spin = new THREE.Object3D();
    steer.add(spin);
    spin.add(limb(wheel, palette.rubber, [0, 0, 0], [radiusFactor, thicknessFactor, radiusFactor], [0, 0, Math.PI / 2]));
    spin.add(limb(cylinder, palette.stone, [Math.sign(x) * 0.1, 0, 0], [0.16 * radiusFactor, 0.05, 0.16 * radiusFactor], [0, 0, Math.PI / 2]));
    return { steer, spin, front };
  }
  function buildWalkerRig(group: THREE.Group, shirt: THREE.Material, headMat: THREE.Material): WalkerRig {
    const buildLeg = (): LegRig => {
      const hip = new THREE.Object3D();
      hip.add(limb(box, palette.rubber, [0, -WALKER.thigh / 2, 0], WALKER.thighSize));
      const knee = new THREE.Object3D();
      knee.position.y = -WALKER.thigh;
      knee.add(limb(box, palette.rubber, [0, -WALKER.shank / 2, 0], WALKER.shankSize));
      const ankle = new THREE.Object3D();
      ankle.position.y = -WALKER.shank;
      ankle.add(limb(box, palette.rubber, [0, WALKER.footSize[1] / 2, WALKER.footFwd], WALKER.footSize));
      knee.add(ankle);
      hip.add(knee);
      return { hip, knee, ankle };
    };
    const pelvis = new THREE.Object3D();
    pelvis.position.y = WALKER.hipY;
    group.add(pelvis);
    const torso = new THREE.Object3D();
    pelvis.add(torso);
    torso.add(limb(box, shirt, [0, WALKER.torsoOffset, 0], WALKER.torsoSize));
    torso.add(limb(crown, headMat, [0, WALKER.headOffset, 0], WALKER.headScale));
    const arms: [THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D()];
    const legs: [LegRig, LegRig] = [buildLeg(), buildLeg()];
    [-1, 1].forEach((side, index) => {
      const shoulder = arms[index];
      shoulder.position.set(side * WALKER.shoulderHalf, WALKER.shoulderY, 0);
      shoulder.add(limb(box, shirt, [0, -WALKER.armLen / 2, 0], WALKER.armSize));
      torso.add(shoulder);
      const leg = legs[index];
      leg.hip.position.set(side * WALKER.hipHalf, 0, 0);
      pelvis.add(leg.hip);
    });
    return { kind: 'walker', pelvis, torso, legs, arms };
  }

  const bus = actorGroup(CITY.busId, 'Ordinary square bus');
  const busBody = new THREE.Object3D();
  busBody.name = 'bus-body';
  bus.add(busBody);
  const coach = batcher(busBody);
  coach.add(box, palette.bus, [0, 1.15, 0], [1.9, 1.4, 4.5]);
  coach.add(box, palette.cream, [0, 2.06, 0], [1.92, 0.46, 4.52]);
  coach.add(box, palette.cream, [0, 2.33, 0], [1.78, 0.14, 4.32]);
  coach.add(box, palette.glass, [0, 1.67, 2.265], [1.55, 0.84, 0.035]);
  coach.add(box, palette.glass, [0, 1.7, -2.265], [1.5, 0.7, 0.035]);
  for (const side of [-1, 1]) {
    for (const z of [-1.5, -0.53, 0.44, 1.41]) {
      coach.add(box, palette.glass, [side * 0.958, 1.7, z], [0.03, 0.75, 0.8]);
    }
    coach.add(box, palette.line, [side * 0.59, 0.94, 2.28], [0.3, 0.18, 0.06]);
    coach.add(box, palette.clay, [side * 0.66, 0.94, -2.28], [0.18, 0.22, 0.06]);
  }
  coach.add(box, palette.copperEdge, [0, 0.67, 2.3], [1.8, 0.14, 0.12]);
  coach.add(box, palette.copperEdge, [0, 0.67, -2.3], [1.8, 0.14, 0.12]);
  coach.finish();
  const busWheels: WheelRig[] = [];
  for (const side of [-1, 1]) {
    for (const z of [-1.4, 1.4]) {
      busWheels.push(buildWheel(bus, side * 0.95, 0.38, z, 1, 1, z > 0));
    }
  }
  const busRig: VehicleRig = { kind: 'vehicle', body: busBody, wheels: busWheels, wheelRadius: VEHICLE.busWheelRadius };
  bus.userData.rig = busRig;
  poseNeutral(busRig);

  for (const [index, color] of [palette.cream, palette.teal, palette.clay].entries()) {
    const car = actorGroup(`car-${index + 1}`, 'Small ordinary car');
    const carBody = new THREE.Object3D();
    carBody.name = 'car-body';
    car.add(carBody);
    const parts = batcher(carBody);
    parts.add(box, color, [0, 0.6, 0], [1.45, 0.55, 2.65]);
    parts.add(box, palette.glass, [0, 1.06, -0.15], [1.2, 0.48, 1.45]);
    parts.add(box, color, [0, 1.33, -0.15], [1.23, 0.12, 1.48]);
    for (const side of [-1, 1]) {
      parts.add(box, palette.line, [side * 0.5, 0.67, 1.36], [0.25, 0.15, 0.06]);
    }
    parts.finish();
    const carWheels: WheelRig[] = [];
    for (const side of [-1, 1]) {
      for (const z of [-0.91, 0.91]) {
        carWheels.push(buildWheel(car, side * 0.73, 0.26, z, 0.26 / 0.38, 0.8, z > 0));
      }
    }
    const carRig: VehicleRig = { kind: 'vehicle', body: carBody, wheels: carWheels, wheelRadius: VEHICLE.carWheelRadius };
    car.userData.rig = carRig;
    poseNeutral(carRig);
  }

  const shirts = [palette.teal, palette.clay, palette.cream, palette.leaf];
  for (let index = 0; index < 8; index++) {
    const walker = actorGroup(`walker-${index + 1}`, 'Square walker');
    const rig = buildWalkerRig(walker, shirts[index % shirts.length], index % 2 ? palette.skin : palette.skinLight);
    walker.userData.rig = rig;
    poseNeutral(rig);
  }

  const invisible = material(new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, colorWrite: false, depthWrite: false,
  }));
  const hitTargets: THREE.Object3D[] = [];
  for (const point of LANDMARKS) {
    const height = point.id === pavilion.id ? 8 : 1.6;
    const target = new THREE.Mesh(cylinder, invisible);
    target.name = `${point.name} semantic hit volume`;
    target.userData.semanticId = point.id;
    target.position.set(point.position.x, point.position.y + height / 2, point.position.z);
    target.scale.set(point.hitRadius, height, point.hitRadius);
    scene.add(target);
    hitTargets.push(target);
  }
  const marker = mesh(
    geometry(new THREE.RingGeometry(5.05, 5.24, 64)),
    material(new THREE.MeshBasicMaterial({ color: '#93532f', depthWrite: false })),
    'Landmark selection ring',
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;

  scene.add(new THREE.HemisphereLight('#fff1d8', '#a99f87', 2.4));
  const sun = new THREE.DirectionalLight('#fff1d6', 3);
  sun.position.set(-16, 28, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 85 });
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  scene.updateMatrixWorld(true);

  let disposed = false;
  let signalPhase: 'vehicles' | 'clearance' | 'pedestrians' | undefined;
  function setSignal(phase: 'vehicles' | 'clearance' | 'pedestrians') {
    if (disposed || phase === signalPhase) return;
    signalPhase = phase;
    for (const light of signalLights) {
      const mayProceed = phase === light.kind;
      light.stop.material = mayProceed ? palette.rubber : stopSignal;
      light.go.material = mayProceed ? goSignal : palette.rubber;
    }
  }
  setSignal('vehicles');
  return {
    scene, bus, actors, hitTargets, marker, setSignal, weatherSurface, foliage, snowMeshes,
    dispose() {
      if (disposed) return;
      disposed = true;
      instances.forEach((instance) => instance.dispose());
      geometries.forEach((shape) => shape.dispose());
      materials.forEach((surface) => surface.dispose());
      sun.shadow.dispose();
      instances.clear();
      foliage.length = 0;
      geometries.clear();
      materials.clear();
      hitTargets.length = 0;
      actors.forEach((actor) => actor.clear());
      actors.clear();
      scene.clear();
    },
  };
}
