import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET_SIGN_POSTS, STREET_SIGN_VERSION } from '../content/streetNames';
import { buildSignLettering } from './signLettering';

export const SIGN_STYLE = {
  green: '#07513e',
  white: '#f8f6e9',
  metal: '#aab6b3',
  maxWidth: 2.9,
  height: 0.54,
  avenueHeight: 3.14,
  crossStreetHeight: 3.78,
} as const;

/** Two-sided blades on existing signal poles, in four static spatial batches. Scene owns resources. */
export function buildStreetSigns(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Neighborhood street signs';
  group.userData.assetVersion = STREET_SIGN_VERSION;
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0.18 });
  paint.name = 'Street enamel and galvanized bands';
  const box = new THREE.BoxGeometry();
  const collar = new THREE.CylinderGeometry(1, 1, 1, 8);
  const plane = new THREE.PlaneGeometry();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const parts: THREE.BufferGeometry[] = [];
  const lettering = new Map<string, THREE.BufferGeometry>();

  function add(
    shape: THREE.BufferGeometry, tint: string,
    position: readonly [number, number, number],
    scale: readonly [number, number, number], yaw = 0,
  ) {
    const part = shape.clone();
    part.deleteAttribute('uv');
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(0, yaw, 0);
    transform.updateMatrix();
    part.applyMatrix4(transform.matrix);
    color.set(tint);
    const colors = new Float32Array(part.getAttribute('position').count * 3);
    for (let index = 0; index < colors.length; index += 3) color.toArray(colors, index);
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(part);
  }

  function blade(post: typeof STREET_SIGN_POSTS[number], label: string, y: number, yaw: number) {
    const width = Math.min(SIGN_STYLE.maxWidth, label.length * 0.22 + 0.3);
    const center = width / 2 + 0.12;
    const position = (x: number, z: number): [number, number, number] =>
      [post.x + x * Math.cos(yaw) + z * Math.sin(yaw), y,
        post.z - x * Math.sin(yaw) + z * Math.cos(yaw)];
    add(box, SIGN_STYLE.metal, position(center, 0), [width, SIGN_STYLE.height, 0.045], yaw);
    let text = lettering.get(label);
    if (!text) {
      text = buildSignLettering(label, width - 0.34, 0.34);
      lettering.set(label, text);
    }
    for (const side of [1, -1]) {
      const faceYaw = yaw + (side === 1 ? 0 : Math.PI);
      add(plane, SIGN_STYLE.green, position(center, side * 0.025),
        [width - 0.035, SIGN_STYLE.height - 0.035, 1], faceYaw);
      for (const offset of [-1, 1]) {
        const trim = position(center, side * 0.028);
        trim[1] += offset * (SIGN_STYLE.height / 2 - 0.035);
        add(plane, SIGN_STYLE.white, trim, [width - 0.14, 0.009, 1], faceYaw);
      }
      add(text, SIGN_STYLE.white, position(center, side * 0.034), [1, 1, 1], faceYaw);
    }
    add(collar, SIGN_STYLE.metal, [post.x, y, post.z], [0.092, 0.12, 0.092]);
    add(box, SIGN_STYLE.metal, position(0.11, 0), [0.27, 0.12, 0.1], yaw);
  }

  try {
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      for (const post of STREET_SIGN_POSTS) {
        if ((post.x > 0 ? 1 : 0) + (post.z > 0 ? 2 : 0) !== quadrant) continue;
        blade(post, post.avenue.name, SIGN_STYLE.avenueHeight, post.side * Math.PI / 2);
        blade(post, post.crossStreet.name, SIGN_STYLE.crossStreetHeight, post.side === 1 ? Math.PI : 0);
      }
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error(`Could not assemble street sign quadrant ${quadrant}.`);
      parts.forEach((part) => part.dispose());
      parts.length = 0;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, paint);
      mesh.name = `Street sign quadrant ${quadrant}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  } catch (error) {
    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    paint.dispose();
    throw error;
  } finally {
    parts.forEach((part) => part.dispose());
    lettering.forEach((shape) => shape.dispose());
    box.dispose();
    collar.dispose();
    plane.dispose();
  }
}
