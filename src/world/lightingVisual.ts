import * as THREE from 'three';
import { COURT_LAMPS, LAMP_GEOMETRY, PARK_LAMPS, STREET_LAMPS } from '../content/lighting';
import type { ActorState } from './actors';
import type { EnvironmentFrame } from './environment';
import type { EnvironmentVisualOptions } from './environmentVisual';
import { drivingLightLevel, sampleVehicleLights, type VehicleLightingRig, type VehicleLightLevels } from './vehicleLighting';
import type { WeatherPhysics } from './weatherPhysics';
import { WEATHER_EXTENT } from './weatherPhysics';
import { SURFACE_RESOLUTION, type WeatherSurface } from './weatherSurface';

export const LOCAL_LIGHT_BUDGET = { public: 6, vehicles: 2 } as const;
const WARM = new THREE.Color('#ffdab0');
const HEAD = new THREE.Color('#fff1db');
const RED = new THREE.Color('#ff2310');
const AMBER = new THREE.Color('#ff950d');
const UP = new THREE.Vector3(0, 1, 0);
const SIDES = [-1, 1] as const;
const { armLength, armHeight, headDrop, headSize, parkHeight, parkGlobeRadius, streetPoolRadius, parkPoolRadius } = LAMP_GEOMETRY;
const FIXTURES = [
  ...STREET_LAMPS.map(({ x, z, arm }) => ({
    x: x + arm * armLength, y: armHeight - headDrop - headSize[1] / 2, z, targetZ: z,
    radius: streetPoolRadius, strength: 0.19, intensity: 65,
  })),
  ...PARK_LAMPS.map(({ x, z }) => ({
    x, y: parkHeight + parkGlobeRadius, z, targetZ: z, radius: parkPoolRadius, strength: 0.13, intensity: 65,
  })),
  ...COURT_LAMPS.map((lamp) => ({
    ...lamp, y: LAMP_GEOMETRY.courtHeight - 0.1, strength: 0.24, intensity: 140,
  })),
];

/** Normalized cosine/inverse-square pool with a smooth finite cutoff, not a hard disc. */
export function lightPoolFalloff(radius: number): number {
  const r = Math.max(0, radius);
  return (1 - THREE.MathUtils.smoothstep(r, 0.65, 1)) / (1 + 5 * r * r) ** 1.5;
}

/** Zero weight at the selection boundary prevents popping as a fixed light slot changes owners. */
export function localLightWeight(distance: number, boundary: number): number {
  return 1 - THREE.MathUtils.smoothstep(distance, Math.max(0, boundary - 12), boundary);
}

interface VehicleEntry {
  rig: VehicleLightingRig;
  actor: ActorState;
  levels: VehicleLightLevels;
  distance: number;
}

/** All visible cues are instanced. Only eight unshadowed local lights shade nearby focused geometry. */
export class LightingVisual {
  readonly group = new THREE.Group();
  private readonly lensGeometry = new THREE.BoxGeometry();
  private readonly lensMaterial = new THREE.MeshBasicMaterial();
  private readonly lenses: THREE.InstancedMesh;
  private readonly haloGeometry = new THREE.PlaneGeometry(2, 2);
  private readonly haloTexture: THREE.DataTexture;
  private readonly haloMaterial: THREE.MeshBasicMaterial;
  private readonly halos: THREE.InstancedMesh;
  private readonly poolGeometry = new THREE.PlaneGeometry(2, 2, 8, 8);
  private readonly poolMaterial: THREE.ShaderMaterial;
  private readonly pools: THREE.InstancedMesh;
  private readonly surfaceTexture: THREE.DataTexture;
  private readonly publicLights: THREE.SpotLight[] = [];
  private readonly vehicleLights: THREE.SpotLight[] = [];
  private readonly fixtures = FIXTURES.map((fixture) => ({ ...fixture, distance: 0 }));
  private readonly rankedFixtures = [...this.fixtures];
  private readonly vehicles: VehicleEntry[];
  private readonly rankedVehicles: VehicleEntry[];
  private readonly transform = new THREE.Object3D();
  private readonly position = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly toCamera = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private lensCount = 0;
  private haloCount = 0;
  private poolCount = 0;
  private disposed = false;

  constructor(scene: THREE.Scene, rigs: readonly VehicleLightingRig[], actors: readonly ActorState[], surface: WeatherSurface) {
    this.group.name = 'City lighting';
    this.vehicles = rigs.map((rig) => {
      const actor = actors.find(({ id }) => id === rig.id);
      if (!actor) throw new Error(`Missing lighting actor: ${rig.id}.`);
      return { rig, actor, levels: { head: 0, tail: 0, brake: 0, left: 0, right: 0 }, distance: 0 };
    });
    this.rankedVehicles = this.vehicles.filter(({ rig }) => !rig.bicycle);
    const count = rigs.reduce((sum, rig) => sum + rig.lamps.length, 0);
    this.lenses = new THREE.InstancedMesh(this.lensGeometry, this.lensMaterial, count);
    this.lenses.name = 'Vehicle lamp lenses';
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const radius = Math.hypot((x + 0.5) / 32 - 1, (y + 0.5) / 32 - 1);
      const value = Math.round(255 * Math.exp(-7 * radius * radius) * (1 - THREE.MathUtils.smoothstep(radius, 0.7, 1)));
      pixels.set([255, value, 255, 255], (y * 64 + x) * 4);
    }
    this.haloTexture = new THREE.DataTexture(pixels, 64, 64);
    this.haloTexture.magFilter = this.haloTexture.minFilter = THREE.LinearFilter;
    this.haloTexture.needsUpdate = true;
    this.haloMaterial = new THREE.MeshBasicMaterial({
      alphaMap: this.haloTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.halos = new THREE.InstancedMesh(this.haloGeometry, this.haloMaterial, count + FIXTURES.length);
    this.halos.name = 'Soft lamp halos';
    const data = new Float32Array(surface.heights.length * 2);
    surface.heights.forEach((height, index) => {
      data[index * 2] = height;
      data[index * 2 + 1] = surface.retention[index];
    });
    this.surfaceTexture = new THREE.DataTexture(data, SURFACE_RESOLUTION, SURFACE_RESOLUTION, THREE.RGFormat, THREE.FloatType);
    this.surfaceTexture.needsUpdate = true;
    this.poolGeometry.rotateX(-Math.PI / 2);
    this.poolMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        lightSurface: { value: this.surfaceTexture }, snowDepth: { value: 0 }, wetness: { value: 0 },
      },
      vertexShader: `
        uniform sampler2D lightSurface;
        uniform float snowDepth;
        varying vec2 vLightUv;
        varying vec2 vSurfaceUv;
        varying vec3 vLightColor;
        #include <fog_pars_vertex>
        void main() {
          vLightUv = uv * 2.0 - 1.0;
          vLightColor = instanceColor;
          vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vSurfaceUv = (world.xz + ${WEATHER_EXTENT.toFixed(1)}) / ${(WEATHER_EXTENT * 2).toFixed(1)};
          vec2 surface = texture2D(lightSurface, vSurfaceUv).rg;
          world.y = clamp(surface.r, -0.15, 0.15) + snowDepth * surface.g + 0.025;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D lightSurface;
        uniform float wetness;
        varying vec2 vLightUv;
        varying vec2 vSurfaceUv;
        varying vec3 vLightColor;
        #include <fog_pars_fragment>
        void main() {
          float height = texture2D(lightSurface, vSurfaceUv).r;
          if (height > 0.2 || height < -0.2) discard;
          float r = length(vLightUv);
          float falloff = (1.0 - smoothstep(0.65, 1.0, r)) / pow(1.0 + 5.0 * r * r, 1.5);
          gl_FragColor = vec4(vLightColor, falloff * mix(1.0, 0.72, wetness));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.pools = new THREE.InstancedMesh(this.poolGeometry, this.poolMaterial, FIXTURES.length + rigs.length * 2);
    this.pools.name = 'Soft ground illumination';
    for (const mesh of [this.lenses, this.halos, this.pools]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, WARM);
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
    }
    this.pools.renderOrder = 3;
    this.halos.renderOrder = 4;
    const allocate = (target: THREE.SpotLight[], count: number, color: THREE.Color) => {
      for (let i = 0; i < count; i++) {
        const light = new THREE.SpotLight(color, 0, 16, Math.PI / 3, 0.8, 2);
        light.name = target === this.publicLights ? 'Local public light' : 'Local vehicle light';
        light.castShadow = false;
        this.group.add(light, light.target);
        target.push(light);
      }
    };
    allocate(this.publicLights, LOCAL_LIGHT_BUDGET.public, WARM);
    allocate(this.vehicleLights, LOCAL_LIGHT_BUDGET.vehicles, HEAD);
    scene.add(this.group);
  }

  update(frame: EnvironmentFrame, physics: WeatherPhysics, seconds: number, camera: THREE.Camera,
    focus: { x: number; z: number; zoom: number }, options: EnvironmentVisualOptions): void {
    if (this.disposed) return;
    camera.updateMatrixWorld();
    this.lensCount = this.haloCount = this.poolCount = 0;
    this.poolMaterial.uniforms.snowDepth.value = physics.snowDepth;
    this.poolMaterial.uniforms.wetness.value = physics.wetness;
    for (const fixture of this.fixtures) {
      fixture.distance = Math.hypot(fixture.x - focus.x, fixture.z - focus.z);
      this.position.set(fixture.x, fixture.y, fixture.z);
      this.halo(this.position, camera, WARM, frame.night * 0.48, 0.65 + frame.fog * 15);
      this.pool(fixture.x, fixture.targetZ, 0, fixture.radius, fixture.radius, WARM, frame.night * fixture.strength);
    }
    for (const entry of this.vehicles) {
      const { rig, actor, levels } = entry;
      rig.body.updateWorldMatrix(true, true);
      sampleVehicleLights(actor, frame, seconds, options.reducedMotion, levels);
      entry.distance = Math.hypot(actor.position.x - focus.x, actor.position.z - focus.z);
      for (const { mount, channel, size } of rig.lamps) {
        mount.getWorldPosition(this.position);
        mount.getWorldQuaternion(this.transform.quaternion);
        this.transform.position.copy(this.position);
        this.transform.scale.set(size[0], size[1], size[2]);
        this.transform.updateMatrix();
        const tint = channel === 'head' ? HEAD : channel === 'left' || channel === 'right' ? AMBER : RED;
        const level = channel === 'tail' ? Math.max(levels.tail, levels.brake) : levels[channel];
        this.color.copy(tint).multiplyScalar(0.025 + level * 2);
        this.lenses.setMatrixAt(this.lensCount, this.transform.matrix);
        this.lenses.setColorAt(this.lensCount++, this.color);
        if (size[0] < size[2] && (channel === 'left' || channel === 'right')) {
          this.direction.set(Math.sign(mount.position.x), 0, 0);
        } else this.direction.set(0, 0, mount.position.z > 0 ? 1 : -1);
        this.direction.transformDirection(mount.matrixWorld);
        this.toCamera.copy(camera.position).sub(this.position).normalize();
        const facing = THREE.MathUtils.smoothstep(this.direction.dot(this.toCamera), 0, 0.4);
        this.halo(this.position, camera, tint, level * facing * 0.38, channel === 'head' ? 0.5 : 0.35);
      }
      const beamLength = rig.bicycle ? 3.6 : 6.5;
      const beamWidth = rig.bicycle ? 0.65 : 1.5;
      // A paired downward road footprint, not a luminous cone floating in clear air.
      for (const side of SIDES) {
        this.position.set(rig.bicycle ? 0 : side * 0.4, 0, rig.length / 2 + beamLength * 0.62).applyMatrix4(rig.body.matrixWorld);
        this.pool(this.position.x, this.position.z, actor.heading, beamWidth, beamLength, HEAD,
          levels.head * (rig.bicycle ? 0.035 : 0.14));
      }
    }
    this.commit(this.lenses, this.lensCount);
    this.commit(this.halos, this.haloCount);
    this.commit(this.pools, this.poolCount);
    const detail = options.lightweight ? 0 : THREE.MathUtils.smoothstep(focus.zoom, 1.2, 2.8);
    this.rankedFixtures.sort((a, b) => a.distance - b.distance);
    const publicBoundary = Math.min(45, this.rankedFixtures[LOCAL_LIGHT_BUDGET.public]?.distance ?? 45);
    this.publicLights.forEach((light, index) => {
      const fixture = this.rankedFixtures[index];
      light.position.set(fixture.x, fixture.y - 0.12, fixture.z);
      light.target.position.set(fixture.x, 0, fixture.targetZ);
      light.intensity = fixture.intensity * frame.night * detail * localLightWeight(fixture.distance, publicBoundary);
      light.distance = Math.min(16, fixture.radius * 2);
    });
    this.rankedVehicles.sort((a, b) => a.distance - b.distance);
    const vehicleBoundary = Math.min(45, this.rankedVehicles[LOCAL_LIGHT_BUDGET.vehicles]?.distance ?? 45);
    this.vehicleLights.forEach((light, index) => {
      const entry = this.rankedVehicles[index];
      light.intensity = 0;
      if (!entry) return;
      const { rig } = entry;
      light.position.set(0, 0.76, rig.length / 2 + 0.05).applyMatrix4(rig.body.matrixWorld);
      light.target.position.set(0, -0.25, rig.length / 2 + 8).applyMatrix4(rig.body.matrixWorld);
      light.angle = 0.42;
      light.penumbra = 0.7;
      light.intensity = 38 * drivingLightLevel(frame) * detail * localLightWeight(entry.distance, vehicleBoundary);
    });
  }

  private commit(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  }

  private pool(x: number, z: number, yaw: number, width: number, length: number, color: THREE.Color, intensity: number): void {
    if (intensity <= 0.001) return;
    this.transform.position.set(x, 0, z);
    this.transform.quaternion.setFromAxisAngle(UP, yaw);
    this.transform.scale.set(width, 1, length);
    this.transform.updateMatrix();
    this.pools.setMatrixAt(this.poolCount, this.transform.matrix);
    this.pools.setColorAt(this.poolCount++, this.color.copy(color).multiplyScalar(intensity));
  }

  private halo(position: THREE.Vector3, camera: THREE.Camera, color: THREE.Color, intensity: number, radius: number): void {
    if (intensity <= 0.001) return;
    this.transform.position.copy(position);
    this.transform.quaternion.copy(camera.quaternion);
    this.transform.scale.setScalar(radius);
    this.transform.updateMatrix();
    this.halos.setMatrixAt(this.haloCount, this.transform.matrix);
    this.halos.setColorAt(this.haloCount++, this.color.copy(color).multiplyScalar(intensity));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const mesh of [this.lenses, this.halos, this.pools]) mesh.dispose();
    for (const resource of [this.lensGeometry, this.lensMaterial, this.haloGeometry, this.haloMaterial,
      this.haloTexture, this.poolGeometry, this.poolMaterial, this.surfaceTexture]) resource.dispose();
    for (const light of [...this.publicLights, ...this.vehicleLights]) light.dispose();
    this.group.clear();
  }
}
