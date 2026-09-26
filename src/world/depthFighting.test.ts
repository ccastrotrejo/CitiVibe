import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCityScene, type CityScene } from './scene';

interface Face { plane: number; a0: number; a1: number; b0: number; b1: number; colour: string; label: string }

const worlds: CityScene[] = [];
afterEach(() => worlds.splice(0).forEach((world) => world.dispose()));

/** Same-facing, differently coloured box faces that share a plane flicker as the camera moves. */
function coplanarConflicts(scene: THREE.Scene) {
  scene.updateMatrixWorld(true);
  const buckets = new Map<string, Face[]>();
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const tint = new THREE.Color();
  const corner = new THREE.Vector3();
  scene.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BoxGeometry)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    if (Array.isArray(object.material) || material.colorWrite === false) return;
    // Articulated actor batches move every frame; only fixed scenery is audited.
    if (object instanceof THREE.InstancedMesh && object.instanceMatrix.usage === THREE.DynamicDrawUsage) return;
    const { width, height, depth } = object.geometry.parameters;
    const count = object instanceof THREE.InstancedMesh ? object.count : 1;
    for (let index = 0; index < count; index++) {
      if (object instanceof THREE.InstancedMesh) {
        object.getMatrixAt(index, local);
        world.multiplyMatrices(object.matrixWorld, local);
      } else world.copy(object.matrixWorld);
      const e = world.elements;
      const aligned = [0, 1, 2].every((column) => {
        const axis = [e[column * 4], e[column * 4 + 1], e[column * 4 + 2]].map(Math.abs);
        const largest = Math.max(...axis);
        return axis.filter((value) => value > largest * 1e-4).length === 1;
      });
      if (!aligned) continue;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
        corner.set(sx * width, sy * height, sz * depth).applyMatrix4(world);
        [corner.x, corner.y, corner.z].forEach((value, axis) => {
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        });
      }
      let colour = material.color?.getHexString() ?? material.uuid;
      if (object instanceof THREE.InstancedMesh && object.instanceColor) {
        object.getColorAt(index, tint);
        colour += tint.getHexString();
      }
      const label = `${object.name || 'box'}#${index} [${min.map((v) => v.toFixed(2))}]..[${max.map((v) => v.toFixed(2))}]`;
      for (let axis = 0; axis < 3; axis++) {
        const [u, w] = [0, 1, 2].filter((other) => other !== axis);
        for (const sign of [-1, 1]) {
          const plane = sign > 0 ? max[axis] : min[axis];
          const key = `${axis}:${sign}:${Math.round(plane / 0.002)}`;
          const bucket = buckets.get(key) ?? [];
          bucket.push({ plane, a0: min[u], a1: max[u], b0: min[w], b1: max[w], colour, label });
          buckets.set(key, bucket);
        }
      }
    }
  });
  const conflicts: { area: number; labels: string }[] = [];
  for (const faces of buckets.values()) {
    for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
      const f = faces[i];
      const g = faces[j];
      if (f.colour === g.colour || Math.abs(f.plane - g.plane) > 0.0015) continue;
      const du = Math.min(f.a1, g.a1) - Math.max(f.a0, g.a0);
      const dw = Math.min(f.b1, g.b1) - Math.max(f.b0, g.b0);
      if (du > 0.01 && dw > 0.01) conflicts.push({ area: du * dw, labels: `${f.label} / ${g.label}` });
    }
  }
  return conflicts.sort((a, b) => b.area - a.area);
}

describe('fixed scenery depth fighting', () => {
  it('keeps trims, plinths and shed fascias off the planes of the walls they decorate', () => {
    const world = buildCityScene();
    worlds.push(world);
    const conflicts = coplanarConflicts(world.scene);
    const total = conflicts.reduce((sum, { area }) => sum + area, 0);
    // Before lot-line insets this was ~973 m²; the remainder is scattered centimetre-scale contact.
    expect(total).toBeLessThan(35);
    expect(conflicts[0]?.area ?? 0, conflicts[0]?.labels).toBeLessThan(1);
  });
});
