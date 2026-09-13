import * as THREE from 'three';
import { CAMERA_PROJECTION } from '../content/city';
import { CITY_EXTENT } from '../content/streets';
import type { EnvironmentColor, EnvironmentFrame } from './environment';

export interface EnvironmentVisualOptions {
  reducedMotion: boolean;
  lightweight: boolean;
}

const RAIN_HIGH = 600;
const RAIN_LIGHT = 160;
const CLOUD_COUNT = 6;
const CLOUD_HALF_WIDTH = CITY_EXTENT.x + 14;
const CLOUD_SPAN = CLOUD_HALF_WIDTH * 2;
const CLOUD_SPEED = 0.1;

function copyColor(target: THREE.Color, source: EnvironmentColor): void {
  target.setRGB(source.r, source.g, source.b);
}

/** GPU-only adapter. Recreate for a restored scene, retaining the EnvironmentController. */
export class EnvironmentVisual {
  private readonly group = new THREE.Group();
  private readonly sky = new THREE.Color();
  private readonly fog = new THREE.FogExp2(0);
  private readonly originalBackground: THREE.Scene['background'];
  private readonly originalFog: THREE.Scene['fog'];
  private readonly rainGeometry = new THREE.BufferGeometry();
  private readonly rainMaterial = new THREE.PointsMaterial({
    color: 0xc5d7e2, size: 1.35, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false,
  });
  private readonly rain = new THREE.Points(this.rainGeometry, this.rainMaterial);
  private readonly cloudGeometry = new THREE.SphereGeometry(1, 8, 5);
  private readonly cloudMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.1, depthWrite: false,
  });
  private readonly clouds: THREE.Mesh[] = [];
  private readonly positions = new Float32Array(RAIN_HIGH * 3);
  private readonly origins = new Float32Array(RAIN_HIGH * 3);
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
  }[] = [];
  private readonly backdrops: { material: THREE.MeshBasicMaterial; color: THREE.Color }[] = [];
  private lastTime = -1;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene) {
    this.originalBackground = scene.background;
    this.originalFog = scene.fog;
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
        if (!(material instanceof THREE.MeshStandardMaterial) || material.userData.window !== true || seen.has(material)) continue;
        seen.add(material);
        this.windows.push({ material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity });
      }
    });
    let seed = 2401;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let index = 0; index < RAIN_HIGH; index++) {
      this.origins[index * 3] = (random() * 2 - 1) * CITY_EXTENT.x;
      this.origins[index * 3 + 1] = random() * 52;
      this.origins[index * 3 + 2] = (random() * 2 - 1) * CITY_EXTENT.z;
    }
    this.positions.set(this.origins);
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 26, 0), Math.hypot(CITY_EXTENT.x, CITY_EXTENT.z, 26));
    this.rain.name = 'Environment rain';
    this.rain.visible = false;
    this.group.name = 'Environment effects';
    this.group.add(this.rain);
    for (let index = 0; index < CLOUD_COUNT; index++) {
      const cloud = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
      cloud.position.set((index + 0.5) * CLOUD_SPAN / CLOUD_COUNT - CLOUD_HALF_WIDTH, 48 + random() * 10, (random() * 2 - 1) * CITY_EXTENT.z);
      cloud.scale.set(7 + random() * 4, 0.7 + random(), 3 + random() * 3);
      cloud.userData.originX = cloud.position.x;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
    scene.background = this.sky;
    scene.fog = this.fog;
    scene.add(this.group);
  }

  /** elapsedSeconds is the retained simulation clock, never wall time. No owned scheduling. */
  update(frame: EnvironmentFrame, options: EnvironmentVisualOptions, elapsedSeconds: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Effect time must be finite and nonnegative.');
    copyColor(this.sky, frame.palette.sky);
    copyColor(this.fog.color, frame.palette.fog);
    for (const { material } of this.backdrops) copyColor(material.color, frame.palette.sky);
    // Haze should veil the neighborhood, not erase it as the overview camera moves back.
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
    }
    this.rain.visible = frame.rain > 0.001;
    this.rainMaterial.opacity = frame.rain * 0.42;
    copyColor(this.rainMaterial.color, frame.palette.rain);
    this.rainGeometry.setDrawRange(0, options.lightweight ? RAIN_LIGHT : RAIN_HIGH);
    this.cloudMaterial.opacity = frame.clouds * 0.23;
    copyColor(this.cloudMaterial.color, frame.palette.cloud);
    const effectTime = options.reducedMotion ? 0 : elapsedSeconds;
    if (effectTime !== this.lastTime) {
      // Periodic coordinates avoid ever-growing particle positions and resume catch-up.
      const fall = (effectTime % 13) * 4;
      for (let index = 0; index < RAIN_HIGH; index++) {
        this.positions[index * 3 + 1] = (this.origins[index * 3 + 1] - fall + 52) % 52;
      }
      this.rainGeometry.getAttribute('position').needsUpdate = true;
      for (const cloud of this.clouds) {
        cloud.position.x = ((cloud.userData.originX as number) + CLOUD_HALF_WIDTH +
          (effectTime % (CLOUD_SPAN / CLOUD_SPEED)) * CLOUD_SPEED) % CLOUD_SPAN - CLOUD_HALF_WIDTH;
      }
      this.lastTime = effectTime;
    }
  }

  /** Release only owned effects; borrowed scene lights/materials are restored, never disposed. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
    if (this.scene.background === this.sky) this.scene.background = this.originalBackground;
    if (this.scene.fog === this.fog) this.scene.fog = this.originalFog;
    for (const { light, color, intensity, ground } of this.lights) {
      light.color.copy(color);
      light.intensity = intensity;
      if (light instanceof THREE.HemisphereLight && ground) light.groundColor.copy(ground);
    }
    for (const { material, emissive, intensity } of this.windows) {
      material.emissive.copy(emissive);
      material.emissiveIntensity = intensity;
    }
    for (const { material, color } of this.backdrops) material.color.copy(color);
    this.lights.length = 0;
    this.windows.length = 0;
    this.backdrops.length = 0;
    this.clouds.length = 0;
    this.group.clear();
  }
}
