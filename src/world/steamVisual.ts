import * as THREE from 'three';
import type { Wind } from './weatherPhysics';

export interface SteamSource {
  id: string;
  x: number;
  z: number;
  baseY: number;
  height: number;
}

export const STEAM_PUFFS_PER_SOURCE = 12;
const LIFETIME = 6;

/** Shares the existing cloud material; each geometry supplies its own density. */
export function prepareVaporMaterial(material: THREE.MeshBasicMaterial, cloud: THREE.BufferGeometry): void {
  cloud.setAttribute('vaporOpacity', new THREE.Float32BufferAttribute(
    new Float32Array(cloud.getAttribute('position').count).fill(1), 1));
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float vaporOpacity;\nvarying float vVaporOpacity;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVaporOpacity = vaporOpacity;');
    shader.fragmentShader = `varying float vVaporOpacity;\n${shader.fragmentShader}`
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse, opacity * vVaporOpacity );');
  };
  material.customProgramCacheKey = () => 'rainlight-cloud-and-steam-v1';
}

/** Analytic projection of retained weather time: no emitter clock or catch-up allocations. */
export class SteamVisual {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly geometry: THREE.BufferGeometry;
  private readonly opacity: THREE.InstancedBufferAttribute;
  private readonly dummy = new THREE.Object3D();
  private disposed = false;
  private lastTime = NaN;
  private lastWindX = NaN;
  private lastWindZ = NaN;
  private lastDensity = NaN;
  private lastCloudOpacity = NaN;

  constructor(private readonly sources: readonly SteamSource[], cloud: THREE.BufferGeometry, material: THREE.MeshBasicMaterial) {
    const ids = new Set<string>();
    for (const source of sources) {
      if (!source.id || ids.has(source.id) || ![source.x, source.z, source.baseY, source.height].every(Number.isFinite) ||
        source.height <= 0) throw new Error('Invalid street steam source.');
      ids.add(source.id);
    }
    this.geometry = cloud.clone();
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(sources.length * STEAM_PUFFS_PER_SOURCE), 1)
      .setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('vaporOpacity', this.opacity);
    this.mesh = new THREE.InstancedMesh(this.geometry, material, this.opacity.count);
    this.mesh.name = 'Street steam';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(time: number, wind: Wind, temperatureC: number, reducedMotion: boolean, lightweight: boolean): void {
    if (this.disposed) return;
    this.mesh.visible = this.sources.length > 0 && !lightweight;
    if (!this.mesh.visible) return;
    const retainedTime = reducedMotion ? 0 : time;
    const density = 0.07 + Math.min(1, Math.max(0, (18 - temperatureC) / 24)) * 0.035;
    const cloudOpacity = Math.max(0.001, this.mesh.material.opacity);
    const windX = reducedMotion ? 0 : wind.x;
    const windZ = reducedMotion ? 0 : wind.z;
    if (retainedTime === this.lastTime && windX === this.lastWindX && windZ === this.lastWindZ &&
      density === this.lastDensity && cloudOpacity === this.lastCloudOpacity) return;
    let index = 0;
    for (const source of this.sources) {
      for (let puff = 0; puff < STEAM_PUFFS_PER_SOURCE; puff++, index++) {
        const age = ((retainedTime / LIFETIME + puff / STEAM_PUFFS_PER_SOURCE) % 1 + 1) % 1;
        const drift = 0.075 * age * age;
        const radius = 0.12 + age * 0.43;
        this.dummy.position.set(source.x + windX * drift,
          source.baseY + source.height + 0.08 + age * 2.4, source.z + windZ * drift);
        this.dummy.scale.set(radius, radius * 1.35, radius);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
        this.opacity.setX(index, density * Math.sin(age * Math.PI) ** 2 / cloudOpacity);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacity.needsUpdate = true;
    this.lastTime = retainedTime;
    this.lastWindX = windX;
    this.lastWindZ = windZ;
    this.lastDensity = density;
    this.lastCloudOpacity = cloudOpacity;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
  }
}
