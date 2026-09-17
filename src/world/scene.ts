import * as THREE from 'three';
import { CITY, CONTENT } from '../content/city';
import { PARK_ACTORS } from '../content/park';
import { PARK_RESTING_VISITORS } from '../content/parkVisitors';
import { createPersonProfile } from '../content/people';
import { PLAY_PEOPLE } from '../content/play';
import { METRO_OPENINGS } from '../content/metro';
import { COURT_LAMPS, LAMP_GEOMETRY, PARK_LAMPS, STREET_LAMPS, validateLighting } from '../content/lighting';
import { BASKETBALL_COURT, COURT_PLAYERS, PICKLEBALL_COURT } from '../content/courts';
import { CITY_EXTENT, TRAFFIC_ACTORS, type TrafficSignalState } from '../content/streets';
import { BIKE_SHARE_STATIONS } from '../content/bikeShare';
import type { ActorState } from './actors';
import { ActorInstances } from './actorInstances';
import { CourtActivity, type CourtPlayerRig } from './courtActivity';
import { buildCentralPark } from './park';
import { buildPavementMarkings } from './pavement';
import { MURAL_WALLS, buildStreetscape, type StreetscapeBuilder } from './streetscape';
import { buildStreetSigns } from './streetSigns';
import { buildStopSigns } from './stopSigns';
import { validateFacadeContent } from '../content/facades';
import { buildMurals } from './murals';
import { buildStreetFurniture } from './streetFurniture';
import { buildBikeShare } from './bikeShare';
import { buildVehicleRig, type VehicleArt } from './vehicle';
import { buildSignLettering } from './signLettering';
import { poseNeutral } from './locomotion';
import { buildPersonRig, type PersonArt } from './person';
import { PlayActivity } from './playActivity';
import { captureWeatherSurface, type FoliageBatch } from './weatherArt';
import type { WeatherSurface } from './weatherSurface';
import { GROUND_LEVEL, GROUND_PUDDLES } from './groundWater';
import type { VehicleLightingRig } from './vehicleLighting';

/** One frame's worth of simulation state the scene needs to advance its owned activity. */
export interface CityFrame {
  signals: readonly TrafficSignalState[];
  elapsedSeconds: number;
  reducedMotion: boolean;
  groundLift: number;
  actors: readonly ActorState[];
}

export interface CityScene {
  scene: THREE.Scene;
  bus: THREE.Group;
  actors: Map<string, THREE.Group>;
  weatherSurface: WeatherSurface;
  snowMeshes: THREE.Mesh[];
  foliage: FoliageBatch[];
  vehicleLights: VehicleLightingRig[];
  /** Advance every scene-owned activity in the one order they must run. */
  frame(state: CityFrame): void;
  dispose(): void;
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  transforms: THREE.Matrix4[];
  /** Per-instance masonry tints; present only for batches submitted with a colour. */
  tints: THREE.Color[] | null;
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
  validateFacadeContent();
  validateLighting();
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
    taxi: paint('#e7b94d'),
    // White so per-instance tints reproduce authored masonry colours exactly.
    facade: paint('#ffffff'),
  };
  // Tag glazing so the environment layer can light windows warmly after dark.
  palette.glass.userData.window = true;
  const vehicleGlass = material(palette.glass.clone());
  vehicleGlass.userData = {};
  const civicBlue = paint('#256897');
  civicBlue.userData.weatherSurface = true;
  // Public lighting: luminaire heads emit and pools brighten only after dusk (driven by frame.night).
  const lampGlow = material(new THREE.MeshStandardMaterial({
    color: '#ffe7bb', emissive: '#ffd68f', emissiveIntensity: 0, roughness: 0.5,
  }));
  lampGlow.userData.nightLight = true;
  lampGlow.userData.nightColor = '#ffd68f';
  lampGlow.userData.nightIntensity = 2.2;
  // Emergency beacons read as steady coloured lamps in daylight and after dark alike.
  const beacon = (color: string) => material(new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.85, roughness: 0.4,
  }));
  const beaconRed = beacon('#e5484d');
  const beaconBlue = beacon('#5a8dff');
  for (const surface of [palette.stone, palette.paving, palette.road, palette.line, palette.cream, palette.clay,
    palette.teal, palette.roof, palette.copper, palette.copperEdge, palette.wood, palette.leaf, palette.leafLight,
    palette.facade]) {
    surface.userData.weatherSurface = true;
  }
  palette.road.userData.snowRetention = 0.45;
  palette.line.userData.snowRetention = 0.45;
  const box = geometry(new THREE.BoxGeometry());
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const crown = geometry(new THREE.DodecahedronGeometry(1));
  const personArt: PersonArt = { box, head: geometry(new THREE.IcosahedronGeometry(1)), material: paint('#ffffff') };
  personArt.material.name = 'Shared person colors';
  const dummy = new THREE.Object3D();

  function batcher(parent: THREE.Object3D) {
    const batches = new Map<string, Batch>();
    return {
      add(
        shape: THREE.BufferGeometry, surface: THREE.Material,
        position: readonly [number, number, number], scale: readonly [number, number, number],
        rotation: readonly [number, number, number] = [0, 0, 0],
        tint?: string,
      ) {
        const flexible = (shape === crown || shape === cylinder) &&
          (surface === palette.leaf || surface === palette.leafLight);
        const key = `${shape.uuid}:${surface.uuid}:${flexible}:${tint ? 'tinted' : 'plain'}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = { geometry: shape, material: surface, transforms: [], tints: tint ? [] : null, flexible };
          batches.set(key, batch);
        }
        if (!batch.tints !== !tint) throw new Error('A batch cannot mix tinted and untinted instances.');
        if (tint && batch.tints) batch.tints.push(new THREE.Color(tint));
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
          // Tints multiply the white facade material, so one batch carries every masonry colour.
          if (batch.tints) {
            batch.tints.forEach((color, index) => mesh.setColorAt(index, color));
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          }
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
    width: number, height: number, depth: number, yaw = 0, tint?: string,
  ) => district.add(box, surface, [x, y, z], [width, height, depth], [0, yaw, 0], tint);

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

  const builder: StreetscapeBuilder = { block, add: district.add, box, cylinder, crown, palette };
  const park = buildCentralPark(builder);
  scene.add(park.group);
  const streetscape = buildStreetscape(builder, lampGlow);
  scene.add(streetscape.group);
  const pavement = buildPavementMarkings(builder);
  buildStreetFurniture(builder, civicBlue, vehicleGlass, {
    food: geometry(buildSignLettering('FOOD', 2.8, 0.48)),
    parking: geometry(buildSignLettering('P', 0.4, 0.52)),
  });
  const bikeShare = buildBikeShare(builder, personArt, civicBlue);
  const { streetHeight, parkHeight, poleRadius, armLength, armHeight, headSize, headDrop,
    parkGlobeRadius } = LAMP_GEOMETRY;
  for (const { x, z, arm } of STREET_LAMPS) {
    district.add(cylinder, palette.rubber, [x, streetHeight / 2, z], [poleRadius, streetHeight, poleRadius]);
    const headX = x + arm * armLength;
    block(palette.rubber, (x + headX) / 2, armHeight, z, armLength, 0.09, 0.09);
    block(palette.rubber, headX, armHeight - headDrop, z, headSize[0], headSize[1], headSize[2]);
    block(lampGlow, headX, armHeight - headDrop - headSize[1] / 2, z,
      headSize[0] * 0.85, 0.035, headSize[2] * 0.85);
  }
  for (const { x, z } of PARK_LAMPS) {
    district.add(cylinder, palette.rubber, [x, parkHeight / 2, z], [poleRadius, parkHeight, poleRadius]);
    district.add(crown, lampGlow, [x, parkHeight + parkGlobeRadius, z], [parkGlobeRadius, parkGlobeRadius, parkGlobeRadius]);
  }
  for (const { x, z, targetZ } of COURT_LAMPS) {
    const height = LAMP_GEOMETRY.courtHeight;
    district.add(cylinder, palette.rubber, [x, height / 2, z], [0.1, height, 0.1]);
    district.add(cylinder, palette.stone, [x, 0.08, z],
      [LAMP_GEOMETRY.courtBaseRadius, 0.16, LAMP_GEOMETRY.courtBaseRadius]);
    block(palette.rubber, x, height - 0.12, z, 1.1, 0.1, 0.1);
    const pitch = -Math.atan2(targetZ - z, height);
    for (const side of [-1, 1]) {
      district.add(box, palette.rubber, [x + side * 0.35, height, z], [0.52, 0.18, 0.72], [pitch, 0, 0]);
      district.add(box, lampGlow, [x + side * 0.35, height - Math.cos(pitch) * 0.1, z - Math.sin(pitch) * 0.1],
        [0.44, 0.035, 0.61], [pitch, 0, 0]);
    }
  }
  district.finish();
  for (const group of [buildStreetSigns(), buildStopSigns(), buildMurals(MURAL_WALLS)]) {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometry(object.geometry);
        const surfaces = Array.isArray(object.material) ? object.material : [object.material];
        surfaces.forEach(material);
        if (object instanceof THREE.InstancedMesh) instances.add(object);
      }
    });
    scene.add(group);
  }
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
  }
  const weatherSurface = captureWeatherSurface(scene);
  const snowMeshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && !Array.isArray(object.material) &&
      object.material.userData.weatherSurface === true &&
      // Vertical paint wets in the rain but has no upward face to accumulate on.
      object.material.userData.snowRetention !== 0) {
      snowMeshes.push(object);
    }
  });

  const actors = new Map<string, THREE.Group>();
  const vehicleLights: VehicleLightingRig[] = [];
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
  const taperedShell = geometry(new THREE.BoxGeometry());
  const shellPositions = taperedShell.getAttribute('position');
  for (let index = 0; index < shellPositions.count; index++) {
    if (shellPositions.getY(index) <= 0) continue;
    shellPositions.setX(index, shellPositions.getX(index) * 0.9);
    shellPositions.setZ(index, shellPositions.getZ(index) * 0.8 - 0.06);
  }
  taperedShell.computeVertexNormals();
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
  const neighborhoodActors: THREE.Group[] = [...bikeShare.rigs];
  scene.add(...bikeShare.rigs);
  for (const definition of PARK_ACTORS) {
    const running = definition.gait === 'run';
    const walker = actorGroup(definition.id, running ? 'Park runner' : 'Park walker');
    neighborhoodActors.push(walker);
    const rig = buildPersonRig(walker, createPersonProfile(definition.id, running ? 'runner' : 'park'), personArt);
    walker.userData.rig = rig;
    poseNeutral(rig);
  }

  const vehicleArt: VehicleArt = {
    box, cylinder, wheel, taperedShell, personArt, civicBlue, vehicleGlass, lampGlow, palette, beaconRed, beaconBlue,
    vehiclePaint: palette.facade,
  };
  for (const [index, definition] of TRAFFIC_ACTORS.entries()) {
    const group = actorGroup(definition.id, `Neighborhood ${definition.vehicleType ?? definition.kind}`);
    neighborhoodActors.push(group);
    if (definition.kind === 'pedestrian') {
      const rig = buildPersonRig(group, createPersonProfile(definition.id, 'street'), personArt);
      group.userData.rig = rig;
      poseNeutral(rig);
      continue;
    }
    vehicleLights.push(buildVehicleRig(group, definition, index, vehicleArt));
  }
  const courtPlayers: CourtPlayerRig[] = COURT_PLAYERS.map((definition) => {
    const group = new THREE.Group();
    group.name = definition.id;
    scene.add(group);
    neighborhoodActors.push(group);
    const rig = buildPersonRig(group, createPersonProfile(definition.id, definition.sport), personArt);
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
  const playActivity = new PlayActivity(PLAY_PEOPLE.map((definition) => {
    const group = new THREE.Group();
    group.name = definition.id;
    const rig = buildPersonRig(group, createPersonProfile(definition.id, definition.context), personArt);
    scene.add(group);
    neighborhoodActors.push(group);
    return { definition, group, rig };
  }));
  for (const definition of PARK_RESTING_VISITORS) {
    const group = actorGroup(definition.id, definition.id);
    const rig = buildPersonRig(group, createPersonProfile(group.name, 'resting'), personArt);
    group.userData.rig = rig;
    poseNeutral(rig);
    neighborhoodActors.push(group);
  }
  const actorInstances = new ActorInstances(neighborhoodActors);
  scene.add(actorInstances.group);
  const bus = actors.get(CITY.busId)!;
  actors.forEach((actor) => actor.traverse((part) => { part.castShadow = false; }));

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
  // Station rider groups and their state slots never change identity; resolve them
  // once and rebuild the id->state lookup only when the actor-state array changes,
  // instead of scanning every station against every actor each frame.
  const stationRiders = BIKE_SHARE_STATIONS.map((station) => actors.get(station.riderId));
  let riderStateSource: readonly ActorState[] | null = null;
  let riderStates: (ActorState | undefined)[] = [];
  return {
    scene, bus, actors, weatherSurface, snowMeshes, foliage, vehicleLights,
    frame({ signals, elapsedSeconds, reducedMotion, groundLift, actors: actorStates }) {
      if (disposed) return;
      streetscape.setSignals(signals);
      courtActivity.update(elapsedSeconds, reducedMotion, groundLift);
      playActivity.update(elapsedSeconds, reducedMotion, groundLift);
      bikeShare.update(elapsedSeconds, reducedMotion, groundLift, actorStates);
      if (riderStateSource !== actorStates) {
        riderStateSource = actorStates;
        const byId = new Map(actorStates.map((actor) => [actor.id, actor] as const));
        riderStates = BIKE_SHARE_STATIONS.map((station) => byId.get(station.riderId));
      }
      for (let index = 0; index < stationRiders.length; index += 1) {
        const phase = riderStates[index]?.sharedBike?.phase;
        stationRiders[index]?.scale.setScalar(!reducedMotion && phase === 'riding' ? 1 : 0);
      }
      actorInstances.update();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      actorInstances.dispose();
      bikeShare.dispose();
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
      actors.forEach((actor) => actor.clear());
      actors.clear();
      vehicleLights.length = 0;
      scene.clear();
    },
  };
}
