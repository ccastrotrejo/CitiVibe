import * as THREE from 'three';
import { CAMERA_PROJECTION } from '../content/city';
import { CITY_EXTENT } from '../content/streets';
import { PARK_RESERVOIR } from '../content/park';
import { STEAM_STACKS } from '../content/civicUtilities';
import type { EnvironmentColor, EnvironmentFrame } from './environment';
import { SurfaceVisual } from './surfaceVisual';
import { FoliageWind } from './weatherArt';
import type { FoliageBatch } from './weatherArt';
import { RAIN_COUNT, SNOW_COUNT, SPLASH_COUNT, WeatherPhysics, waterWaveSpeed } from './weatherPhysics';
import { WeatherSurface } from './weatherSurface';
import { SnowVolumeVisual } from './snowVolumeVisual';
import { GroundWaterVisual } from './groundWaterVisual';
import { getWindowPhase, setWindowPhase } from './windowLighting';
import { prepareVaporMaterial, SteamVisual } from './steamVisual';

export interface EnvironmentVisualOptions {
  reducedMotion: boolean;
  lightweight: boolean;
}

const RAIN_LIGHT = 160;
const SNOW_LIGHT = 120;
const CLOUD_COUNT = 6;
const CLOUD_X = CITY_EXTENT.x + 14;
const CLOUD_Z = CITY_EXTENT.z + 14;
const RIPPLE_COUNT = 12;
const RIPPLE_SPEED = waterWaveSpeed(0.3, 0.08);
const ENV_WIDTH = 64;
const ENV_HEIGHT = 32;
const SUN_DIRECTION = new THREE.Vector3(-130, 200, 140).normalize();

function copyColor(target: THREE.Color, source: EnvironmentColor): void {
  target.setRGB(source.r, source.g, source.b);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Math.pow(Math.max(0, value), 1 / 2.2) * 255)));
}

/** GPU-only adapter. CPU precipitation, deposition and wind survive graphics recovery. */
export class EnvironmentVisual {
  private readonly group = new THREE.Group();
  private readonly sky = new THREE.Color();
  private readonly fog = new THREE.FogExp2(0);
  private readonly originalBackground: THREE.Scene['background'];
  private readonly originalFog: THREE.Scene['fog'];
  private readonly originalEnvironment: THREE.Scene['environment'];
  private readonly originalEnvironmentIntensity: number;
  private readonly envPixels = new Uint8Array(ENV_WIDTH * ENV_HEIGHT * 4);
  private readonly envTexture: THREE.DataTexture;
  private readonly pmremGenerator: THREE.PMREMGenerator | null = null;
  private pmremTarget: THREE.WebGLRenderTarget | null = null;
  private readonly waterNormalMaps: THREE.Texture[] = [];
  private lastEnvKey = '';
  private lastPmremTime = -Infinity;
  private readonly rainGeometry = new THREE.BufferGeometry();
  private readonly rainMaterial = new THREE.LineBasicMaterial({
    color: 0xc5d7e2, transparent: true, opacity: 0, depthWrite: false,
  });
  private readonly rain = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
  private readonly snowGeometry = new THREE.BufferGeometry();
  private readonly snowMaterial = new THREE.PointsMaterial({
    color: 0xf0f5fa, size: 2.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false,
  });
  private readonly snow = new THREE.Points(this.snowGeometry, this.snowMaterial);
  private readonly flakeTexture: THREE.DataTexture;
  private readonly cloudGeometry = new THREE.SphereGeometry(1, 8, 5);
  private readonly cloudMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.1, depthWrite: false,
  });
  private readonly clouds: { mesh: THREE.Mesh; x: number; z: number }[] = [];
  private readonly steam: SteamVisual;
  private readonly rainPositions = new Float32Array(RAIN_COUNT * 6);
  private readonly snowPositions = new Float32Array(SNOW_COUNT * 3);
  private readonly ringGeometry = new THREE.RingGeometry(0.8, 1, 16);
  private readonly splashMaterial = new THREE.MeshBasicMaterial({ color: 0xc1d5dc, transparent: true, depthWrite: false });
  private readonly rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xc8e0dc, transparent: true, depthWrite: false });
  private readonly splashes = new THREE.InstancedMesh(this.ringGeometry, this.splashMaterial, SPLASH_COUNT);
  private readonly ripples = new THREE.InstancedMesh(this.ringGeometry, this.rippleMaterial, RIPPLE_COUNT);
  private readonly dummy = new THREE.Object3D();
  private readonly surfaces: SurfaceVisual;
  private readonly snowVolume: SnowVolumeVisual;
  private readonly groundWater = new GroundWaterVisual();
  private readonly foliageWind = new FoliageWind();
  private readonly lights: {
    light: THREE.HemisphereLight | THREE.DirectionalLight;
    color: THREE.Color;
    intensity: number;
    ground: THREE.Color | null;
  }[] = [];
  private readonly windows: {
    material: THREE.MeshStandardMaterial;
    emissive: THREE.Color;
    intensity: number;
    phase: number | undefined;
  }[] = [];
  private readonly backdrops: { material: THREE.MeshBasicMaterial; color: THREE.Color }[] = [];
  private readonly nightLights: {
    material: THREE.MeshStandardMaterial;
    emissive: THREE.Color;
    intensity: number;
    color: THREE.Color;
    max: number;
  }[] = [];
  private disposed = false;
  private lastRevision = -1;
  private lastLightweight = false;
  private lastReduced = false;
  private lastRain = false;
  private lastSnow = false;
  private lastRainIntensity = -1;

  constructor(
    private readonly scene: THREE.Scene,
    surface = new WeatherSurface(),
    private readonly foliage: readonly FoliageBatch[] = [],
    snowMeshes: readonly THREE.Mesh[] = [],
    renderer?: THREE.WebGLRenderer,
  ) {
    this.originalBackground = scene.background;
    this.originalFog = scene.fog;
    this.originalEnvironment = scene.environment;
    this.originalEnvironmentIntensity = scene.environmentIntensity;
    this.envTexture = new THREE.DataTexture(this.envPixels, ENV_WIDTH, ENV_HEIGHT, THREE.RGBAFormat);
    this.envTexture.colorSpace = THREE.SRGBColorSpace;
    this.envTexture.mapping = THREE.EquirectangularReflectionMapping;
    this.envTexture.magFilter = THREE.LinearFilter;
    this.envTexture.minFilter = THREE.LinearFilter;
    if (renderer && typeof (renderer as unknown as { getContext?: unknown }).getContext === 'function') {
      this.pmremGenerator = new THREE.PMREMGenerator(renderer);
      this.pmremGenerator.compileEquirectangularShader();
    }
    this.surfaces = new SurfaceVisual(scene, surface);
    this.snowVolume = new SnowVolumeVisual(snowMeshes, this.surfaces.heightTexture);
    const seen = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (object instanceof THREE.HemisphereLight || object instanceof THREE.DirectionalLight) {
        this.lights.push({
          light: object, color: object.color.clone(), intensity: object.intensity,
          ground: object instanceof THREE.HemisphereLight ? object.groundColor.clone() : null,
        });
      }
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshBasicMaterial && material.userData.environmentBackdrop === true && !seen.has(material)) {
          seen.add(material);
          this.backdrops.push({ material, color: material.color.clone() });
        }
        if (material instanceof THREE.MeshStandardMaterial && material.userData.waterRipple === true && !seen.has(material)) {
          seen.add(material);
          if (material.normalMap && !this.waterNormalMaps.includes(material.normalMap)) {
            this.waterNormalMaps.push(material.normalMap);
          }
        }
        if (material instanceof THREE.MeshStandardMaterial && material.userData.nightLight === true && !seen.has(material)) {
          seen.add(material);
          this.nightLights.push({
            material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity,
            color: new THREE.Color(material.userData.nightColor ?? '#ffd68f'),
            max: Number(material.userData.nightIntensity ?? 1),
          });
        }
        if (!(material instanceof THREE.MeshStandardMaterial) || material.userData.window !== true || seen.has(material)) continue;
        seen.add(material);
        this.windows.push({
          material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity,
          phase: getWindowPhase(material),
        });
      }
    });
    const flakeSize = 64;
    const pixels = new Uint8Array(flakeSize * flakeSize * 4);
    const center = (flakeSize - 1) / 2;
    for (let y = 0; y < flakeSize; y++) {
      for (let x = 0; x < flakeSize; x++) {
        const offset = (y * flakeSize + x) * 4;
        const dist = Math.hypot(x - center, y - center) / (center * 0.92);
        const soft = Math.max(0, 1 - dist);
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
        pixels[offset + 3] = Math.round(soft * soft * (3 - 2 * soft) * 255);
      }
    }
    this.flakeTexture = new THREE.DataTexture(pixels, flakeSize, flakeSize);
    this.flakeTexture.magFilter = THREE.LinearFilter;
    this.flakeTexture.minFilter = THREE.LinearFilter;
    this.flakeTexture.needsUpdate = true;
    this.snowMaterial.map = this.flakeTexture;
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.snowGeometry.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const bounds = new THREE.Sphere(new THREE.Vector3(0, 26, 0), Math.hypot(CITY_EXTENT.x, CITY_EXTENT.z, 26) + 1);
    this.rainGeometry.boundingSphere = bounds;
    this.snowGeometry.boundingSphere = bounds;
    this.rain.name = 'Environment rain';
    this.snow.name = 'Environment snow';
    this.splashes.name = 'Rain impacts';
    this.ripples.name = 'Garden ripples';
    this.splashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splashes.frustumCulled = false;
    this.ripples.frustumCulled = false;
    this.group.name = 'Environment effects';
    this.group.add(this.rain, this.snow, this.splashes, this.ripples, this.snowVolume.group, this.groundWater.group);
    prepareVaporMaterial(this.cloudMaterial, this.cloudGeometry);
    this.steam = new SteamVisual(STEAM_STACKS.map(({ id, x, z, surfaceY, height }) =>
      ({ id, x, z, baseY: surfaceY, height })), this.cloudGeometry, this.cloudMaterial);
    this.group.add(this.steam.mesh);
    let seed = 2401;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let index = 0; index < CLOUD_COUNT; index++) {
      const cloud = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
      cloud.name = 'Weather cloud';
      cloud.position.set((index + 0.5) * CLOUD_X * 2 / CLOUD_COUNT - CLOUD_X,
        48 + random() * 10, (random() * 2 - 1) * CITY_EXTENT.z);
      cloud.scale.set(7 + random() * 4, 0.7 + random(), 3 + random() * 3);
      this.clouds.push({ mesh: cloud, x: cloud.position.x, z: cloud.position.z });
      this.group.add(cloud);
    }
    scene.background = this.sky;
    scene.fog = this.fog;
    scene.environment = this.envTexture;
    scene.add(this.group);
  }

  private updateEnvironmentDome(frame: EnvironmentFrame, lightweight: boolean, elapsedTime: number): void {
    this.scene.environmentIntensity = lightweight ? 0 : 0.14 + 0.06 * (1 - frame.clouds * 0.5);
    if (lightweight) {
      this.scene.environment = null;
      return;
    }
    const key = [
      Math.round(frame.palette.sky.r * 36),
      Math.round(frame.palette.sky.g * 36),
      Math.round(frame.palette.sky.b * 36),
      Math.round(frame.palette.sun.r * 30),
      Math.round(frame.sunIntensity * 16),
      Math.round(frame.night * 24),
      Math.round(frame.clouds * 16),
    ].join(':');
    if (key === this.lastEnvKey && this.scene.environment !== null) return;
    // Throttle PMREM GPU render-target regeneration during smooth weather transitions (~4 Hz max).
    if (this.lastEnvKey !== '' && elapsedTime === this.lastPmremTime) {
      // Explicit paused weather/time jump: regenerate immediately.
    } else if (this.lastEnvKey !== '' && Math.abs(elapsedTime - this.lastPmremTime) < 0.25 && this.scene.environment !== null) {
      return;
    }
    this.lastEnvKey = key;
    this.lastPmremTime = elapsedTime;

    const { sky, fog, sun, ground, ambient, window: win } = frame.palette;
    const sunStrength = Math.min(1.8, frame.sunIntensity * 0.34) * (1 - frame.clouds * 0.65);
    const cityGlow = frame.night * 0.28;
    for (let row = 0; row < ENV_HEIGHT; row++) {
      // Equirectangular row 0 is bottom (-pi/2) or top (+pi/2): Three.js maps v=1 to zenith (+Y), v=0 to nadir (-Y).
      const v = (row + 0.5) / ENV_HEIGHT;
      const elevation = (v - 0.5) * Math.PI;
      const dy = Math.sin(elevation);
      const cosEl = Math.cos(elevation);
      for (let col = 0; col < ENV_WIDTH; col++) {
        const phi = ((col + 0.5) / ENV_WIDTH) * Math.PI * 2;
        const dx = Math.cos(phi) * cosEl;
        const dz = Math.sin(phi) * cosEl;
        let r: number;
        let g: number;
        let b: number;
        if (dy >= 0) {
          const zenith = Math.pow(dy, 0.55);
          r = fog.r + (sky.r * 0.92 - fog.r) * zenith;
          g = fog.g + (sky.g * 0.95 - fog.g) * zenith;
          b = fog.b + (sky.b * 1.02 - fog.b) * zenith;
          const sunDot = Math.max(0, dx * SUN_DIRECTION.x + dy * SUN_DIRECTION.y + dz * SUN_DIRECTION.z);
          const sunGlow = Math.pow(sunDot, 14) * sunStrength + Math.pow(sunDot, 3) * sunStrength * 0.22;
          const horizonBand = Math.pow(1 - dy, 4) * cityGlow;
          r += sun.r * sunGlow + win.r * horizonBand;
          g += sun.g * sunGlow + win.g * horizonBand;
          b += sun.b * sunGlow + win.b * horizonBand;
        } else {
          const nadir = Math.min(1, Math.pow(-dy, 0.65));
          const bounceR = (ground.r * 0.65 + ambient.r * 0.35) * 0.68;
          const bounceG = (ground.g * 0.65 + ambient.g * 0.35) * 0.68;
          const bounceB = (ground.b * 0.65 + ambient.b * 0.35) * 0.68;
          r = fog.r * 0.82 + (bounceR - fog.r * 0.82) * nadir;
          g = fog.g * 0.82 + (bounceG - fog.g * 0.82) * nadir;
          b = fog.b * 0.82 + (bounceB - fog.b * 0.82) * nadir;
        }
        const offset = (row * ENV_WIDTH + col) * 4;
        this.envPixels[offset] = clampByte(r);
        this.envPixels[offset + 1] = clampByte(g);
        this.envPixels[offset + 2] = clampByte(b);
        this.envPixels[offset + 3] = 255;
      }
    }
    this.envTexture.needsUpdate = true;
    if (this.pmremGenerator) {
      this.pmremTarget?.dispose();
      this.pmremTarget = this.pmremGenerator.fromEquirectangular(this.envTexture);
      this.scene.environment = this.pmremTarget.texture;
    } else {
      this.scene.environment = this.envTexture;
    }
  }

  /** Pure projection of retained state: draws, resize and quality changes never advance physics. */
  update(frame: EnvironmentFrame, options: EnvironmentVisualOptions, physics: WeatherPhysics): void {
    if (this.disposed) return;
    copyColor(this.sky, frame.palette.sky);
    copyColor(this.fog.color, frame.palette.fog);
    this.updateEnvironmentDome(frame, options.lightweight, physics.time);
    for (const normalMap of this.waterNormalMaps) {
      if (options.reducedMotion) normalMap.offset.set(0, 0);
      else normalMap.offset.set(physics.time * 0.018, physics.time * 0.013);
    }
    for (const { material } of this.backdrops) copyColor(material.color, frame.palette.sky);
    this.fog.density = frame.fog * 60 / CAMERA_PROJECTION.distance;
    for (const { light } of this.lights) {
      const hemisphere = light instanceof THREE.HemisphereLight;
      light.intensity = hemisphere ? frame.ambientIntensity : frame.sunIntensity;
      copyColor(light.color, hemisphere ? frame.palette.ambient : frame.palette.sun);
      if (hemisphere) copyColor(light.groundColor, frame.palette.ground);
    }
    for (const { material } of this.windows) {
      copyColor(material.emissive, frame.palette.window);
      material.emissiveIntensity = frame.glow;
      setWindowPhase(material, frame.phase);
    }
    for (const { material, color, max } of this.nightLights) {
      material.emissive.copy(color);
      material.emissiveIntensity = frame.night * max;
    }
    this.surfaces.update(physics);
    const changed = physics.revision !== this.lastRevision || options.lightweight !== this.lastLightweight ||
      options.reducedMotion !== this.lastReduced || frame.rainIntensityMmH !== this.lastRainIntensity;
    if (changed) this.foliageWind.update(this.foliage, physics.wind, physics.time, options.reducedMotion);
    const rainStrength = frame.rain * Math.sqrt(frame.rainIntensityMmH / 8);
    this.snowVolume.update(physics);
    if (changed || (rainStrength > 0.001) !== this.lastRain) this.groundWater.update(physics, rainStrength, options.reducedMotion);
    this.rain.visible = rainStrength > 0.001;
    this.snow.visible = frame.snow > 0.001;
    this.rainMaterial.opacity = Math.min(0.8, rainStrength * 0.48);
    this.snowMaterial.opacity = frame.snow * 0.85;
    copyColor(this.rainMaterial.color, frame.palette.rain);
    const rainCount = Math.ceil((options.lightweight ? RAIN_LIGHT : RAIN_COUNT) * Math.sqrt(frame.rainIntensityMmH / 30));
    const snowCount = options.lightweight ? SNOW_LIGHT : SNOW_COUNT;
    this.rainGeometry.setDrawRange(0, rainCount * 2);
    this.snowGeometry.setDrawRange(0, snowCount);
    if (this.rain.visible && (changed || !this.lastRain)) {
      for (let index = 0; index < rainCount; index++) {
        const source = index * 3;
        const target = index * 6;
        for (let axis = 0; axis < 3; axis++) {
          this.rainPositions[target + axis] = physics.rain.positions[source + axis];
          const direction = axis === 1 ? 1 : -1;
          this.rainPositions[target + 3 + axis] = physics.rain.positions[source + axis] +
            direction * physics.rain.velocities[source + axis] * 0.055;
        }
      }
      this.rainGeometry.getAttribute('position').needsUpdate = true;
    }
    if (this.snow.visible && (changed || !this.lastSnow)) {
      this.snowPositions.set(physics.snow.positions);
      this.snowGeometry.getAttribute('position').needsUpdate = true;
    }
    this.cloudMaterial.opacity = frame.clouds * 0.23;
    copyColor(this.cloudMaterial.color, frame.palette.cloud);
    for (const cloud of this.clouds) {
      cloud.mesh.position.x = (cloud.x + CLOUD_X + (options.reducedMotion ? 0 : physics.cloudOffset.x)) % (CLOUD_X * 2) - CLOUD_X;
      cloud.mesh.position.z = (cloud.z + CLOUD_Z + (options.reducedMotion ? 0 : physics.cloudOffset.z)) % (CLOUD_Z * 2) - CLOUD_Z;
    }
    this.steam.update(physics.time, physics.wind, frame.temperatureC, options.reducedMotion, options.lightweight);
    this.splashes.visible = !options.reducedMotion && rainStrength > 0.001;
    this.splashMaterial.opacity = Math.min(0.6, rainStrength * 0.35);
    this.splashes.count = options.lightweight ? 16 : SPLASH_COUNT;
    this.dummy.rotation.set(-Math.PI / 2, 0, 0);
    if (this.splashes.visible && (changed || !this.lastRain)) {
      for (let index = 0; index < this.splashes.count; index++) {
        const age = physics.splashAges[index];
        const radius = age < 0.55 ? 0.035 + age * 0.35 : 0;
        this.dummy.position.fromArray(physics.splashPositions, index * 3);
        this.dummy.scale.setScalar(radius);
        this.dummy.updateMatrix();
        this.splashes.setMatrixAt(index, this.dummy.matrix);
      }
      this.splashes.instanceMatrix.needsUpdate = true;
    }
    this.ripples.visible = !options.reducedMotion;
    this.ripples.count = options.lightweight ? 4 : RIPPLE_COUNT;
    this.rippleMaterial.opacity = Math.min(0.35, 0.04 + frame.windSpeed * 0.025 + frame.rain * 0.15);
    if (this.ripples.visible && changed) {
      for (let index = 0; index < this.ripples.count; index++) {
        const phase = (physics.time * RIPPLE_SPEED / 0.5 + index / RIPPLE_COUNT) % 1;
        const radius = 0.1 + phase * 0.9;
        const angle = index / RIPPLE_COUNT * Math.PI * 2;
        const spread = index % 2 ? 0.6 : 0.35;
        this.dummy.position.set(PARK_RESERVOIR.x + Math.cos(angle) * PARK_RESERVOIR.radiusX * spread,
          0.018, PARK_RESERVOIR.z + Math.sin(angle) * PARK_RESERVOIR.radiusZ * spread);
        this.dummy.scale.set(radius, radius * 0.7, radius);
        this.dummy.updateMatrix();
        this.ripples.setMatrixAt(index, this.dummy.matrix);
      }
      this.ripples.instanceMatrix.needsUpdate = true;
    }
    this.lastRevision = physics.revision;
    this.lastLightweight = options.lightweight;
    this.lastReduced = options.reducedMotion;
    this.lastRain = this.rain.visible;
    this.lastSnow = this.snow.visible;
    this.lastRainIntensity = frame.rainIntensityMmH;
  }

  /** Release owned effects and restore borrowed lighting, materials and foliage exactly once. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.snowVolume.dispose();
    this.groundWater.dispose();
    this.steam.dispose();
    this.surfaces.dispose();
    for (const { mesh, transforms } of this.foliage) {
      transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.snowGeometry.dispose();
    this.snowMaterial.dispose();
    this.flakeTexture.dispose();
    this.envTexture.dispose();
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
    this.ringGeometry.dispose();
    this.splashMaterial.dispose();
    this.rippleMaterial.dispose();
    this.splashes.dispose();
    this.ripples.dispose();
    if (this.scene.background === this.sky) this.scene.background = this.originalBackground;
    if (this.scene.fog === this.fog) this.scene.fog = this.originalFog;
    if (this.scene.environment === this.envTexture || this.scene.environment === this.pmremTarget?.texture) {
      this.scene.environment = this.originalEnvironment;
      this.scene.environmentIntensity = this.originalEnvironmentIntensity;
    }
    this.pmremTarget?.dispose();
    this.pmremTarget = null;
    this.pmremGenerator?.dispose();
    for (const normalMap of this.waterNormalMaps) normalMap.offset.set(0, 0);
    this.waterNormalMaps.length = 0;
    for (const { light, color, intensity, ground } of this.lights) {
      light.color.copy(color);
      light.intensity = intensity;
      if (light instanceof THREE.HemisphereLight && ground) light.groundColor.copy(ground);
    }
    for (const { material, emissive, intensity, phase } of this.windows) {
      material.emissive.copy(emissive);
      material.emissiveIntensity = intensity;
      if (phase !== undefined) setWindowPhase(material, phase);
    }
    for (const { material, emissive, intensity } of this.nightLights) {
      material.emissive.copy(emissive);
      material.emissiveIntensity = intensity;
    }
    for (const { material, color } of this.backdrops) material.color.copy(color);
    this.lights.length = 0;
    this.windows.length = 0;
    this.backdrops.length = 0;
    this.nightLights.length = 0;
    this.clouds.length = 0;
    this.group.clear();
  }
}
