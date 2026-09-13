import * as THREE from 'three';
import type { Wind } from './weatherPhysics';
import { WeatherSurface } from './weatherSurface';

export interface FoliageBatch {
  mesh: THREE.InstancedMesh;
  transforms: readonly THREE.Matrix4[];
}

/** Capture only static art, before actors and semantic hit volumes are attached. */
export function captureWeatherSurface(scene: THREE.Scene): WeatherSurface {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const surface = new WeatherSurface(Math.min(-0.96, bounds.min.y));
  const transform = new THREE.Matrix4();
  const instance = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const indices = object.geometry.index;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const retention: unknown = material.userData.weatherSurface === true ? material.userData.snowRetention ?? 1 : 0;
    if (typeof retention !== 'number' || !Number.isFinite(retention) || retention < 0 || retention > 1) {
      throw new Error('Static weather surfaces need finite snow retention between zero and one.');
    }
    const count = indices?.count ?? positions.count;
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
    for (let index = 0; index < instances; index++) {
      transform.copy(object.matrixWorld);
      if (object instanceof THREE.InstancedMesh) {
        object.getMatrixAt(index, instance);
        transform.multiply(instance);
      }
      for (let vertex = 0; vertex < count; vertex += 3) {
        a.fromBufferAttribute(positions, indices ? indices.getX(vertex) : vertex).applyMatrix4(transform);
        b.fromBufferAttribute(positions, indices ? indices.getX(vertex + 1) : vertex + 1).applyMatrix4(transform);
        c.fromBufferAttribute(positions, indices ? indices.getX(vertex + 2) : vertex + 2).applyMatrix4(transform);
        surface.triangle(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, retention);
      }
    }
  });
  return surface;
}

/** Small quasi-static drag bending; roots remain anchored and each update starts at the rest pose. */
export class FoliageWind {
  private readonly bend = new THREE.Matrix4();
  private readonly translation = new THREE.Matrix4();
  private readonly rotation = new THREE.Quaternion();
  private readonly angle = new THREE.Euler();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly pivot = new THREE.Vector3();

  update(batches: readonly FoliageBatch[], wind: Wind, time: number, reduced: boolean): void {
    const speed = Math.hypot(wind.x, wind.z);
    for (const { mesh, transforms } of batches) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bottom = mesh.geometry.boundingBox;
      if (!bottom) throw new Error('Wind-responsive foliage needs valid geometry bounds.');
      for (let index = 0; index < transforms.length; index++) {
        const original = transforms[index];
        if (reduced) {
          mesh.setMatrixAt(index, original);
          continue;
        }
        const elements = original.elements;
        this.pivot.set(0, bottom.min.y, 0).applyMatrix4(original);
        const variation = 0.85 + 0.15 * Math.sin(time * Math.PI / 3 + elements[12] * 0.2 + elements[14] * 0.15);
        const force = Math.min(0.09, speed * speed * 0.0015) * variation / Math.max(1, speed);
        this.angle.set(wind.z * force, 0, -wind.x * force);
        this.rotation.setFromEuler(this.angle);
        this.bend.compose(this.pivot, this.rotation, this.scale);
        this.translation.makeTranslation(-this.pivot.x, -this.pivot.y, -this.pivot.z);
        this.bend.multiply(this.translation).multiply(original);
        mesh.setMatrixAt(index, this.bend);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
