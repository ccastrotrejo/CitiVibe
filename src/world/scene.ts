import * as THREE from 'three';
import { CITY, CONTENT, LANDMARKS, validateLandmarks } from '../content/city';
import { PARK_ACTORS } from '../content/park';
import { METRO_OPENINGS } from '../content/metro';
import { LAMP_GEOMETRY, PARK_LAMPS, STREET_LAMPS, validateLighting } from '../content/lighting';
import { BASKETBALL_COURT, COURT_PLAYERS, PICKLEBALL_COURT } from '../content/courts';
import { CITY_EXTENT, TRAFFIC_ACTORS, type TrafficSignalState } from '../content/streets';
import { ActorInstances } from './actorInstances';
import { CourtActivity, type CourtPlayerRig } from './courtActivity';
import { buildCentralPark } from './park';
import { buildPavementMarkings } from './pavement';
import { buildStreetscape } from './streetscape';
import { WALKER, poseNeutral } from './locomotion';
import type { LegRig, VehicleRig, WalkerRig, WheelRig } from './locomotion';
import { captureWeatherSurface, type FoliageBatch } from './weatherArt';
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
  setTrafficSignals?(signals: readonly TrafficSignalState[]): void;
  updateActors?(): void;
  updateCourtActivity?(elapsedSeconds: number, reducedMotion: boolean, groundLift?: number): void;
  dispose(): void;
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  transforms: THREE.Matrix4[];
  flexible: boolean;
}

export interface ArtInputs {
  schemaVersion: number;
  assetVersion: string;
  seed: number;
}

/** Versioned art inputs, paired with CONTENT's stable route and landmark manifest. */
export const ART_INPUTS = {
  schemaVersion: 1,
  assetVersion: CONTENT.assetVersion,
  seed: CONTENT.seed,
} as const satisfies ArtInputs;

/** Reject malformed authored inputs before allocating scene/GPU resources. */
export function validateArtInputs(inputs: ArtInputs): void {
  if (inputs.schemaVersion !== 1 || inputs.assetVersion !== CITY.version ||
    !Number.isSafeInteger(inputs.seed) || inputs.seed < 0 || inputs.seed > 0xffffffff) {
    throw new Error('Invalid Rainlight Square art version or seed.');
  }
}

/** Warm tungsten through cool fluorescent; the last entry is a bluish television glow. */
const WINDOW_TINTS: readonly (readonly [number, number, number])[] = [
  [1.0, 0.74, 0.4], [1.0, 0.82, 0.55], [0.96, 0.86, 0.66], [0.86, 0.88, 0.94], [0.78, 0.85, 1.0],
];
const WINDOW_OFF: readonly [number, number, number] = [0.02, 0.02, 0.03];

/** Deterministic per-window stream: quantised world position keeps occupancy stable across builds. */
function windowHash(x: number, y: number, z: number): number {
  let hash = 2166136261 >>> 0;
  for (const value of [Math.round(x * 13), Math.round(y * 13), Math.round(z * 13)]) {
    hash = Math.imul(hash ^ (value & 0xffff), 16777619) >>> 0;
    hash = Math.imul(hash ^ ((value >> 16) & 0xffff), 16777619) >>> 0;
  }
  return hash / 0x100000000;
}

/**
 * Clone the glazing material and reinterpret its night emissive per instance: the shader keeps the
 * environment layer's day->night ramp (via the emissive magnitude) but recolours each window from a
 * per-instance attribute, so occupancy and light colour vary building to building.
 */
function patchedWindowMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const clone = source.clone();
  clone.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 windowGlow;\nvarying vec3 vWindowGlow;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWindowGlow = windowGlow;');
    shader.fragmentShader = `varying vec3 vWindowGlow;\n${shader.fragmentShader}`
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vWindowGlow * length( emissive );');
  };
  clone.customProgramCacheKey = () => 'rainlight-window-glow';
  return clone;
}

/** Original, deterministic Rainlight Square art; the caller owns actor movement. */
export function buildCityScene(): CityScene {
  validateArtInputs(ART_INPUTS);
  validateLandmarks(LANDMARKS);
  validateLighting();
  const landmark = (id: string) => {
    const result = LANDMARKS.find((point) => point.id === id);
    if (!result) throw new Error(`Missing original landmark: ${id}.`);
    return result;
  };
  const pavilion = landmark(CITY.landmark.id);
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
    sand: paint('#d2dad3'),
    stone: paint('#b9bdac'),
    paving: paint('#deddd0'),
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
    taxi: paint('#e7b94d'),
  };
  // Tag glazing so the environment layer can light windows warmly after dark.
  palette.glass.userData.window = true;
  // Public lighting: luminaire heads emit and pools brighten only after dusk (driven by frame.night).
  const lampGlow = material(new THREE.MeshStandardMaterial({
    color: '#ffe7bb', emissive: '#ffd68f', emissiveIntensity: 0, roughness: 0.5,
  }));
  lampGlow.userData.nightLight = true;
  lampGlow.userData.nightColor = '#ffd68f';
  lampGlow.userData.nightIntensity = 1.2;
  const lampPool = material(new THREE.MeshBasicMaterial({
    color: '#ffdca0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lampPool.userData.nightPool = true;
  lampPool.userData.nightOpacity = 0.4;
  for (const surface of [palette.stone, palette.paving, palette.road, palette.line, palette.cream, palette.clay,
    palette.teal, palette.roof, palette.copper, palette.copperEdge, palette.wood, palette.leaf, palette.leafLight]) {
    surface.userData.weatherSurface = true;
  }
  palette.road.userData.snowRetention = 0.45;
  palette.line.userData.snowRetention = 0.45;
  const box = geometry(new THREE.BoxGeometry());
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const crown = geometry(new THREE.DodecahedronGeometry(1));
  const disc = geometry(new THREE.CircleGeometry(1, 18));
  disc.rotateX(-Math.PI / 2);
  const dummy = new THREE.Object3D();

  function batcher(parent: THREE.Object3D) {
    const batches = new Map<string, Batch>();
    return {
      add(
        shape: THREE.BufferGeometry, surface: THREE.Material,
        position: readonly [number, number, number], scale: readonly [number, number, number],
        rotation: readonly [number, number, number] = [0, 0, 0],
        flexible = (shape === crown || shape === cylinder) && (surface === palette.leaf || surface === palette.leafLight),
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

  function groundShape(halfWidth: number, halfDepth: number): THREE.Shape {
    const outline = new THREE.Shape();
    outline.moveTo(-halfWidth, -halfDepth);
    outline.lineTo(halfWidth, -halfDepth);
    outline.lineTo(halfWidth, halfDepth);
    outline.lineTo(-halfWidth, halfDepth);
    outline.closePath();
    for (const { minX, maxX, minZ, maxZ } of METRO_OPENINGS) {
      const hole = new THREE.Path();
      hole.moveTo(minX, -minZ);
      hole.lineTo(maxX, -minZ);
      hole.lineTo(maxX, -maxZ);
      hole.lineTo(minX, -maxZ);
      hole.closePath();
      outline.holes.push(hole);
    }
    return outline;
  }
  const groundOutline = groundShape(CITY_EXTENT.x, CITY_EXTENT.z);
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
  const backdrop = mesh(geometry(new THREE.ShapeGeometry(groundShape(450, 450))),
    material(new THREE.MeshBasicMaterial({ color: '#dfe5df' })), 'City backdrop');
  backdrop.material.userData.environmentBackdrop = true;
  backdrop.rotation.x = -Math.PI / 2;
  backdrop.position.y = -0.96;

  const park = buildCentralPark({ block, add: district.add, box, cylinder, crown, palette });
  scene.add(park.group);
  const streetscape = buildStreetscape({ block, add: district.add, box, cylinder, crown, palette });
  scene.add(streetscape.group);
  const pavement = buildPavementMarkings({ block, add: district.add, box, cylinder, crown, palette });
  const { streetHeight, parkHeight, poleRadius, armLength, armHeight, headSize, headDrop,
    parkGlobeRadius, streetPoolRadius, parkPoolRadius, surfaceY } = LAMP_GEOMETRY;
  for (const { x, z, arm } of STREET_LAMPS) {
    district.add(cylinder, palette.rubber, [x, streetHeight / 2, z], [poleRadius, streetHeight, poleRadius]);
    const headX = x + arm * armLength;
    block(palette.rubber, (x + headX) / 2, armHeight, z, armLength, 0.09, 0.09);
    block(lampGlow, headX, armHeight - headDrop, z, headSize[0], headSize[1], headSize[2]);
    district.add(disc, lampPool, [headX, surfaceY, z], [streetPoolRadius, 1, streetPoolRadius]);
  }
  for (const { x, z } of PARK_LAMPS) {
    district.add(cylinder, palette.rubber, [x, parkHeight / 2, z], [poleRadius, parkHeight, poleRadius]);
    district.add(crown, lampGlow, [x, parkHeight + parkGlobeRadius, z], [parkGlobeRadius, parkGlobeRadius, parkGlobeRadius]);
    district.add(disc, lampPool, [x, surfaceY, z], [parkPoolRadius, 1, parkPoolRadius]);
  }
  district.finish();
  for (const object of scene.children) {
    if (object instanceof THREE.InstancedMesh && object.material === palette.glass) {
      const glow = new Float32Array(object.count * 3);
      const instance = new THREE.Matrix4();
      const anchor = new THREE.Vector3();
      for (let index = 0; index < object.count; index++) {
        object.getMatrixAt(index, instance);
        anchor.setFromMatrixPosition(instance);
        const occupancy = windowHash(anchor.x, anchor.y, anchor.z);
        const hue = windowHash(anchor.z + 91, anchor.x - 47, anchor.y + 19);
        const tint = occupancy < 0.34 ? WINDOW_OFF
          : WINDOW_TINTS[hue < 0.4 ? 0 : hue < 0.68 ? 1 : hue < 0.85 ? 2 : hue < 0.95 ? 3 : 4];
        glow.set(tint, index * 3);
      }
      const glazing = geometry(object.geometry.clone());
      glazing.setAttribute('windowGlow', new THREE.InstancedBufferAttribute(glow, 3));
      object.geometry = glazing;
      object.material = material(patchedWindowMaterial(palette.glass));
    }
    if (object instanceof THREE.InstancedMesh && object.material === lampPool) {
      object.castShadow = false;
      object.renderOrder = 2;
    }
  }
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
  function buildWalkerRig(group: THREE.Group, shirt: THREE.Material, headMat: THREE.Material, running = false): WalkerRig {
    const buildLeg = (): LegRig => {
      const hip = new THREE.Object3D();
      hip.add(limb(box, palette.rubber, [0, -WALKER.thigh / 2, 0], WALKER.thighSize));
      const knee = new THREE.Object3D();
      knee.position.y = -WALKER.thigh;
      knee.add(limb(box, running ? headMat : palette.rubber, [0, -WALKER.shank / 2, 0], WALKER.shankSize));
      const ankle = new THREE.Object3D();
      ankle.position.y = -WALKER.shank;
      ankle.add(limb(box, running ? palette.line : palette.rubber, [0, WALKER.footSize[1] / 2, WALKER.footFwd], WALKER.footSize));
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
      if (running) {
        shoulder.add(limb(box, shirt, [0, -0.13, 0], [0.12, 0.27, 0.15]));
        shoulder.add(limb(box, headMat, [0, -0.27, 0.12], [0.11, 0.12, 0.3]));
      } else {
        shoulder.add(limb(box, shirt, [0, -WALKER.armLen / 2, 0], WALKER.armSize));
      }
      torso.add(shoulder);
      const leg = legs[index];
      leg.hip.position.set(side * WALKER.hipHalf, 0, 0);
      pelvis.add(leg.hip);
    });
    return { kind: 'walker', pelvis, torso, legs, arms };
  }

  const shirts = [palette.teal, palette.clay, palette.cream, palette.leaf];
  const neighborhoodActors: THREE.Group[] = [];
  for (const [index, definition] of PARK_ACTORS.entries()) {
    const running = definition.gait === 'run';
    const walker = actorGroup(definition.id, running ? 'Park runner' : 'Park walker');
    neighborhoodActors.push(walker);
    const rig = buildWalkerRig(walker, running ? [palette.bus, palette.teal, palette.line][index % 3] : shirts[index % shirts.length],
      index % 2 ? palette.skin : palette.skinLight, running);
    walker.userData.rig = rig;
    poseNeutral(rig);
  }

  const bicycleTire = geometry(new THREE.TorusGeometry(0.32, 0.035, 6, 12).rotateY(Math.PI / 2));
  for (const [index, definition] of TRAFFIC_ACTORS.entries()) {
    const group = actorGroup(definition.id, `Neighborhood ${definition.vehicleType ?? definition.kind}`);
    neighborhoodActors.push(group);
    if (definition.kind === 'pedestrian') {
      const rig = buildWalkerRig(group, shirts[index % shirts.length], index % 2 ? palette.skin : palette.skinLight);
      group.userData.rig = rig;
      poseNeutral(rig);
      continue;
    }
    const body = new THREE.Object3D();
    group.add(body);
    const part = (surface: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const object = limb(box, surface, [x, y, z], [w, h, d]);
      body.add(object);
      return object;
    };
    const wheels: WheelRig[] = [];
    if (definition.kind === 'cyclist') {
      part(palette.teal, 0, 0.58, 0, 0.08, 0.1, 1.25);
      part(palette.teal, 0, 0.7, -0.15, 0.08, 0.6, 0.08);
      part(palette.rubber, 0, 1.03, -0.25, 0.28, 0.08, 0.35);
      part(palette.copperEdge, 0, 0.85, 0.62, 0.06, 0.75, 0.06);
      part(palette.rubber, 0, 1.2, 0.62, 0.58, 0.06, 0.08);
      part(shirts[index % shirts.length], 0, 1.42, -0.05, 0.35, 0.52, 0.24);
      body.add(limb(crown, palette.skinLight, [0, 1.82, 0.05], [0.18, 0.2, 0.18]));
      body.add(limb(crown, palette.cream, [0, 1.95, 0.05], [0.21, 0.12, 0.22]));
      for (const side of [-1, 1]) {
        body.add(limb(box, shirts[index % shirts.length], [side * 0.23, 1.35, 0.29], [0.11, 0.12, 0.6], [-0.25, 0, 0]));
      }
      for (const z of [-0.58, 0.58]) {
        const steer = new THREE.Object3D();
        steer.position.set(0, 0.355, z);
        group.add(steer);
        const spin = new THREE.Object3D();
        steer.add(spin);
        spin.add(limb(bicycleTire, palette.rubber, [0, 0, 0], [1, 1, 1]));
        spin.add(limb(box, palette.stone, [0, 0, 0], [0.03, 0.59, 0.025]));
        spin.add(limb(box, palette.stone, [0, 0, 0], [0.03, 0.025, 0.59]));
        wheels.push({ steer, spin, front: z > 0 });
      }
      const pedals = [-1, 1].map((side) => {
        const crank = new THREE.Object3D();
        crank.position.set(side * 0.16, 0.78, -0.12);
        crank.add(limb(box, palette.rubber, [0, -0.15, 0], [0.12, 0.36, 0.13]));
        body.add(crank);
        return crank;
      });
      const rig: VehicleRig = { kind: 'vehicle', body, wheels, wheelRadius: 0.355, pedals };
      group.userData.rig = rig;
      poseNeutral(rig);
      continue;
    }
    const type = definition.vehicleType;
    const taxi = type === 'taxi';
    const busType = type === 'bus';
    const large = busType || type === 'truck';
    const van = type === 'van';
    const length = busType ? 4.6 : type === 'truck' ? 4.5 : van ? 3.3 : 2.7;
    const width = busType ? 1.9 : large ? 1.7 : van ? 1.5 : 1.45;
    const radius = large ? 0.36 : 0.26;
    const color = taxi ? palette.taxi : busType ? palette.cream :
      [palette.teal, palette.clay, palette.cream][index % 3];
    part(color, 0, taxi ? 0.63 : 0.7, 0, width, taxi ? 0.66 : 0.8, length - 0.1);
    part(palette.glass, 0, taxi ? 1.13 : 1.24, large || van ? 0 : -0.15,
      width - 0.17, taxi ? 0.47 : 0.6, large || van ? length - 0.3 : 1.45);
    part(color, 0, taxi ? 1.39 : 1.6, large || van ? 0 : -0.15,
      taxi ? width - 0.09 : width, taxi ? 0.1 : 0.15, large || van ? length : 1.5);
    if (busType) {
      part(palette.teal, 0, 0.82, 0, width + 0.03, 0.24, length);
      for (let z = -1.8; z <= 1.8; z += 0.85) part(color, 0, 1.26, z, width, 0.66, 0.12);
    } else if (large || van) {
      part(color, 0, 1.25, -0.55, width, 1.24, length - 1.2);
      part(palette.cream, 0, 1.93, -0.55, width + 0.02, 0.1, length - 1.2);
      for (const side of [-1, 1]) part(palette.stone, side * width / 2, 1.22, -0.6, 0.03, 0.04, length - 1.5);
    } else if (taxi) {
      part(palette.rubber, 0, 1.46, -0.15, 0.66, 0.05, 0.3);
      part(palette.cream, 0, 1.58, -0.15, 0.62, 0.22, 0.23).name = 'Unbranded taxi roof light';
      part(palette.rubber, 0, 0.65, 1.32, 0.64, 0.18, 0.045).name = 'Taxi front grille';
      part(palette.taxi, 0, 0.43, 1.32, 0.26, 0.1, 0.045);
      for (const side of [-1, 1]) {
        part(color, side * 0.675, 1.15, -0.13, 0.055, 0.45, 0.085);
        part(palette.rubber, side * 0.716, 0.57, 0, 0.014, 0.045, 1.8);
        for (const z of [-0.51, 0.16]) {
          part(palette.stone, side * 0.718, 0.9, z, 0.012, 0.035, 0.16);
        }
        part(palette.rubber, side * 0.709, 0.68, -0.48, 0.018, 0.22, 0.25)
          .name = 'Generic taxi door medallion';
        part(palette.taxi, side * 0.72, 0.68, -0.48, 0.006, 0.12, 0.15);
      }
      // A tiny original geometric TAXI stencil, without company logos or roof advertising.
      const letters = [
        ['111', '010', '010', '010', '010'],
        ['010', '101', '111', '101', '101'],
        ['101', '101', '010', '101', '101'],
        ['111', '010', '010', '010', '111'],
      ];
      for (const side of [-1, 1]) letters.forEach((letter, column) => {
        letter.forEach((row, y) => [...row].forEach((pixel, x) => {
          if (pixel === '1') part(palette.rubber, side * (-0.255 + column * 0.14 + x * 0.035),
            1.65 - y * 0.035, -0.15 + side * 0.119, 0.031, 0.031, 0.006);
        }));
      });
    }
    for (const side of [-1, 1]) {
      part(palette.line, side * width * 0.32, 0.75, length / 2 - 0.025, 0.23, 0.16, 0.04);
      part(palette.clay, side * width * 0.32, 0.75, -length / 2 + 0.025, 0.2, 0.16, 0.04);
      for (const z of [-length * 0.32, length * 0.32]) {
        wheels.push(buildWheel(group, side * (width / 2 - 0.13), radius, z, radius / 0.38, 0.7, z > 0));
      }
    }
    const rig: VehicleRig = { kind: 'vehicle', body, wheels, wheelRadius: radius };
    group.userData.rig = rig;
    poseNeutral(rig);
  }
  const courtPlayers: CourtPlayerRig[] = COURT_PLAYERS.map((definition, index) => {
    const group = new THREE.Group();
    group.name = definition.id;
    scene.add(group);
    neighborhoodActors.push(group);
    const rig = buildWalkerRig(group, [palette.bus, palette.teal, palette.clay, palette.cream][index % 4],
      index % 2 ? palette.skin : palette.skinLight);
    if (definition.sport === 'pickleball') {
      rig.arms[0].add(limb(box, palette.wood, [0, -0.49, 0], [0.032, 0.18, 0.032]));
      const paddle = limb(cylinder, palette.teal, [0, -0.65, 0], [0.1, 0.016, 0.13]);
      paddle.rotation.x = Math.PI / 2;
      paddle.name = 'Pickleball paddle';
      rig.arms[0].add(paddle);
    }
    return { definition, group, rig };
  });
  const courtBall = (name: string, radius: number, surface: THREE.Material) => {
    const group = new THREE.Group();
    group.name = name;
    group.add(limb(crown, surface, [0, 0, 0], [radius, radius, radius]));
    scene.add(group);
    neighborhoodActors.push(group);
    return group;
  };
  const courtActivity = new CourtActivity(courtPlayers,
    courtBall('Basketball in play', BASKETBALL_COURT.ballRadius, palette.bus),
    courtBall('Pickleball in play', PICKLEBALL_COURT.ballRadius, palette.taxi));
  const actorInstances = new ActorInstances(neighborhoodActors);
  scene.add(actorInstances.group);
  const bus = actors.get(CITY.busId)!;
  actors.forEach((actor) => actor.traverse((part) => { part.castShadow = false; }));

  const invisible = material(new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, colorWrite: false, depthWrite: false,
  }));
  const hitTargets: THREE.Object3D[] = [];
  for (const point of LANDMARKS) {
    const height = point.id === pavilion.id ? 4 : 1.6;
    const isCourt = point.id === 'juniper-court';
    const target = new THREE.Mesh(isCourt ? box : cylinder, invisible);
    target.name = `${point.name} semantic hit volume`;
    target.userData.semanticId = point.id;
    target.position.set(point.position.x, point.position.y + height / 2, point.position.z);
    target.scale.set(point.hitRadius, height, point.hitRadius);
    if (isCourt) {
      const minX = BASKETBALL_COURT.x - BASKETBALL_COURT.runoffWidth / 2;
      const maxX = PICKLEBALL_COURT.x + PICKLEBALL_COURT.runoffWidth / 2;
      target.position.x = (minX + maxX) / 2;
      target.scale.set(maxX - minX, height, BASKETBALL_COURT.runoffDepth);
    }
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
  sun.position.set(-130, 200, 140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const shadowExtent = Math.max(CITY_EXTENT.x, CITY_EXTENT.z) * 1.6;
  Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 700 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.06;
  // PCF samples span more world space after the district expansion.
  const shadowTexel = shadowExtent * 2 / sun.shadow.mapSize.x;
  sun.shadow.bias = -1.25 * shadowTexel / (sun.shadow.camera.far - sun.shadow.camera.near);
  scene.add(sun);
  scene.updateMatrixWorld(true);

  let disposed = false;
  return {
    scene, bus, actors, hitTargets, marker, weatherSurface, snowMeshes, foliage,
    setTrafficSignals: (signals) => streetscape.setSignals(signals),
    updateActors: () => actorInstances.update(),
    updateCourtActivity: (elapsedSeconds, reducedMotion, groundLift = 0) => {
      if (!disposed) courtActivity.update(elapsedSeconds, reducedMotion, groundLift);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      actorInstances.dispose();
      pavement.dispose();
      park.dispose();
      streetscape.dispose();
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
