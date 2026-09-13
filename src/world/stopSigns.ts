import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STOP_SIGN_GEOMETRY, STOP_SIGN_POSTS, STOP_SIGN_VERSION } from '../content/stopSigns';
import { buildSignLettering } from './signLettering';

export const STOP_SIGN_STYLE = {
  face: '#a8372e',
  white: '#f6f2e8',
  metal: '#aab6b3',
  back: '#8d9793',
  legend: '#3b4643',
  /** Eight flats, rotated so the blade reads level rather than point-up. */
  sides: 8,
} as const;

const OCTAGON_RATIO = 1 / Math.cos(Math.PI / STOP_SIGN_STYLE.sides);

/** Original octagonal blades on their own posts at every posted approach. Scene owns resources. */
export function buildStopSigns(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Neighborhood stop signs';
  group.userData.assetVersion = STOP_SIGN_VERSION;
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.12 });
  paint.name = 'Stop sign enamel and galvanized posts';
  const box = new THREE.BoxGeometry();
  const post = new THREE.CylinderGeometry(1, 1, 1, 8);
  // Bake the blade upright with level flats so each post only needs its own yaw.
  const blade = new THREE.CylinderGeometry(1, 1, 1, STOP_SIGN_STYLE.sides)
    .rotateX(Math.PI / 2).rotateZ(Math.PI / STOP_SIGN_STYLE.sides);
  const parts: THREE.BufferGeometry[] = [];
  let unit: THREE.BufferGeometry | null = null;
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const { width, bottom, plaqueHeight, plaqueGap, postRadius } = STOP_SIGN_GEOMETRY;
  const radius = width / 2 * OCTAGON_RATIO;
  const legend = buildSignLettering('STOP', width * 0.74, width * 0.26);
  const plaque = buildSignLettering('ALL WAY', width * 0.64, plaqueHeight * 0.5);

  function add(
    shape: THREE.BufferGeometry, tint: string,
    position: readonly [number, number, number],
    scale: readonly [number, number, number],
    rotation: readonly [number, number, number] = [0, 0, 0],
  ) {
    const part = shape.clone();
    part.deleteAttribute('uv');
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(...rotation);
    transform.updateMatrix();
    part.applyMatrix4(transform.matrix);
    color.set(tint);
    const colors = new Float32Array(part.getAttribute('position').count * 3);
    for (let index = 0; index < colors.length; index += 3) color.toArray(colors, index);
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(part);
  }

  try {
    // Author one blade in local space (+Z faces the driver), then instance it per approach.
    const center = bottom + width / 2;
    const plaqueY = bottom - plaqueGap - plaqueHeight / 2;
    add(post, STOP_SIGN_STYLE.metal, [0, center / 2, 0], [postRadius, center, postRadius]);
    add(blade, STOP_SIGN_STYLE.white, [0, center, 0], [radius, radius, 0.035]);
    for (const side of [1, -1]) {
      add(blade, side > 0 ? STOP_SIGN_STYLE.face : STOP_SIGN_STYLE.back,
        [0, center, side * 0.018], [radius * 0.9, radius * 0.9, 0.014]);
    }
    add(legend, STOP_SIGN_STYLE.white, [0, center, 0.027], [1, 1, 1]);
    add(box, STOP_SIGN_STYLE.white, [0, plaqueY, 0], [width * 0.78, plaqueHeight, 0.035]);
    add(plaque, STOP_SIGN_STYLE.legend, [0, plaqueY, 0.024], [1, 1, 1]);
    unit = mergeGeometries(parts);
    if (!unit) throw new Error('Could not assemble a neighborhood stop sign.');
    unit.computeBoundingBox();
    unit.computeBoundingSphere();
    const mesh = new THREE.InstancedMesh(unit, paint, STOP_SIGN_POSTS.length);
    STOP_SIGN_POSTS.forEach(({ x, z, yaw }, index) => {
      transform.position.set(x, 0, z);
      transform.scale.set(1, 1, 1);
      transform.rotation.set(0, yaw, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.name = 'Stop sign blades';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  } catch (error) {
    paint.dispose();
    unit?.dispose();
    throw error;
  } finally {
    parts.forEach((part) => part.dispose());
    [box, post, blade, legend, plaque].forEach((shape) => shape.dispose());
  }
}
