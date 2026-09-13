import * as THREE from 'three';
import { GROUND_LEVEL, GROUND_PUDDLES } from './groundWater';
import type { WeatherPhysics } from './weatherPhysics';

/** Water levels intersect the authored paraboloid beds; no flat decals or unbounded spawning. */
export class GroundWaterVisual {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.CircleGeometry(1, 32);
  private readonly material = new THREE.MeshStandardMaterial({
    color: 0x658f94, roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.84, depthWrite: false,
  });
  private readonly rings = new THREE.RingGeometry(0.9, 1, 24);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: 0xcce3e4, transparent: true, depthWrite: false });
  private readonly water = GROUND_PUDDLES.map((basin) => {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.name = `${basin.id} rain pool`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  });
  private readonly ripples = new THREE.InstancedMesh(this.rings, this.ringMaterial, GROUND_PUDDLES.length * 2);
  private readonly dummy = new THREE.Object3D();
  private disposed = false;

  constructor() {
    this.group.name = 'Rain-fed ground pools';
    this.ripples.name = 'Ground pool ripples';
    this.ripples.frustumCulled = false;
    this.ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(...this.water, this.ripples);
    this.dummy.rotation.x = -Math.PI / 2;
  }

  update(physics: WeatherPhysics, rainStrength: number, reducedMotion: boolean): void {
    if (this.disposed) return;
    this.ripples.visible = !reducedMotion && rainStrength > 0;
    this.ringMaterial.opacity = Math.min(0.5, rainStrength * 0.25);
    for (let index = 0; index < GROUND_PUDDLES.length; index++) {
      const basin = GROUND_PUDDLES[index];
      const state = physics.groundWater.states[index];
      const mesh = this.water[index];
      mesh.visible = state.depth > 0.0005;
      mesh.position.set(basin.x, GROUND_LEVEL - basin.maxDepth + state.depth + 0.002, basin.z);
      mesh.scale.set(basin.radiusX * state.radiusScale, basin.radiusZ * state.radiusScale, 1);
      for (let ring = 0; ring < 2; ring++) {
        const phase = (physics.time * 0.8 + index * 0.27 + ring * 0.5) % 1;
        const radius = mesh.visible ? state.radiusScale * (0.08 + phase * 0.8) : 0;
        this.dummy.position.copy(mesh.position);
        this.dummy.position.y += 0.003;
        this.dummy.scale.set(basin.radiusX * radius, basin.radiusZ * radius, 1);
        this.dummy.updateMatrix();
        this.ripples.setMatrixAt(index * 2 + ring, this.dummy.matrix);
      }
    }
    this.ripples.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.rings.dispose();
    this.ringMaterial.dispose();
    this.ripples.dispose();
    this.group.clear();
  }
}
