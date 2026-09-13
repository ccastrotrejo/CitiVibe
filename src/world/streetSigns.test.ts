import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NAMED_AVENUES, NAMED_CROSS_STREETS, STREET_SIGN_POSTS, STREET_SIGN_VERSION } from '../content/streetNames';
import { CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_OFFSET, SIGNAL_POLE_OFFSET, STOP_LINE_OFFSET, STREET_X, STREET_Z } from '../content/streets';
import { METRO_OPENINGS } from '../content/metro';
import { STREET_BUILDINGS } from './streetscape';
import { buildSignLettering } from './signLettering';
import { buildStreetSigns, SIGN_STYLE } from './streetSigns';

const signs: THREE.Group[] = [];

function createSigns() {
  const group = buildStreetSigns();
  signs.push(group);
  return group;
}

afterEach(() => {
  for (const group of signs) {
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const surfaces = Array.isArray(object.material) ? object.material : [object.material];
        surfaces.forEach((surface) => materials.add(surface));
      }
    });
    materials.forEach((material) => material.dispose());
  }
  signs.length = 0;
});

describe('NYC-inspired original street-name blades', () => {
  it('covers every existing avenue and cross street at twelve primary junctions without changing the grid', () => {
    expect(NAMED_AVENUES.map(({ x }) => x)).toEqual(STREET_X);
    expect(NAMED_CROSS_STREETS.map(({ z }) => z)).toEqual(STREET_Z);
    expect(INTERSECTIONS).toHaveLength(36);
    expect(STREET_SIGN_POSTS).toHaveLength(12);
    expect(new Set(STREET_SIGN_POSTS.map(({ id }) => id)).size).toBe(12);
    const roads = [...NAMED_AVENUES, ...NAMED_CROSS_STREETS];
    const named = new Set(STREET_SIGN_POSTS.flatMap(({ avenue, crossStreet }) => [avenue.id, crossStreet.id]));
    expect([...named].sort()).toEqual(roads.map(({ id }) => id).sort());
    expect(new Set(roads.map(({ name }) => name)).size).toBe(12);
    expect(createSigns().userData.assetVersion).toBe(STREET_SIGN_VERSION);
  });

  it('mounts on existing traffic-signal poles without adding obstacles to walking, cycling or gates', () => {
    for (const post of STREET_SIGN_POSTS) {
      const intersection = INTERSECTIONS.find(({ id }) => id === post.intersectionId)!;
      expect(post.x).toBe(intersection.x + post.side * SIGNAL_POLE_OFFSET);
      expect(post.z).toBe(intersection.z + post.side * (STOP_LINE_OFFSET + 0.5));
      expect(Math.abs(post.x)).toBeLessThan(CITY_EXTENT.x - 0.5);
      expect(Math.abs(post.z)).toBeLessThan(CITY_EXTENT.z - 0.5);
      expect(Math.abs(post.x) > 39 || Math.abs(post.z) > 88).toBe(true);
      expect(SIDEWALK_OFFSET - SIGNAL_POLE_OFFSET - 0.092).toBeGreaterThan(0.6);
      for (const hole of METRO_OPENINGS) {
        expect(post.x < hole.minX || post.x > hole.maxX || post.z < hole.minZ || post.z > hole.maxZ).toBe(true);
      }
    }
    // Above the 2.78 m pedestrian signal hood, below the 4.34 m mast-arm underside.
    expect(Math.min(SIGN_STYLE.avenueHeight, SIGN_STYLE.crossStreetHeight) - SIGN_STYLE.height / 2).toBeGreaterThan(2.78);
    expect(Math.max(SIGN_STYLE.avenueHeight, SIGN_STYLE.crossStreetHeight) + SIGN_STYLE.height / 2).toBeLessThan(4.34);
  });

  it('keeps the blade geometry clear of vehicle lanes, facades and the park', () => {
    const group = createSigns();
    for (const mesh of group.children) {
      if (!(mesh instanceof THREE.Mesh)) throw new Error('Missing street-sign batch.');
      const positions = mesh.geometry.getAttribute('position');
      for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const overRoad = STREET_X.some((road) => Math.abs(x - road) <= ROAD_HALF_WIDTH) ||
          STREET_Z.some((road) => Math.abs(z - road) <= ROAD_HALF_WIDTH);
        if (overRoad) expect(y).toBeGreaterThan(3.5);
        expect(Math.abs(x) > 39 || Math.abs(z) > 88).toBe(true);
        expect(STREET_BUILDINGS.every((building) => Math.abs(x - building.x) > building.width / 2 + 0.2 ||
          Math.abs(z - building.z) > building.depth / 2 + 0.2)).toBe(true);
      }
    }
  });

  it('has readable, correctly wound front and rear lettering on each perpendicular blade', () => {
    const group = createSigns();
    for (const post of STREET_SIGN_POSTS) {
      const quadrant = (post.x > 0 ? 1 : 0) + (post.z > 0 ? 2 : 0);
      const mesh = group.children[quadrant];
      if (!(mesh instanceof THREE.Mesh)) throw new Error('Missing street-sign batch.');
      const positions = mesh.geometry.getAttribute('position');
      const normals = mesh.geometry.getAttribute('normal');
      for (const [label, y, yaw] of [
        [post.avenue.name, SIGN_STYLE.avenueHeight, post.side * Math.PI / 2],
        [post.crossStreet.name, SIGN_STYLE.crossStreetHeight, post.side === 1 ? Math.PI : 0],
      ] as const) {
        const width = Math.min(SIGN_STYLE.maxWidth, label.length * 0.22 + 0.3);
        const front: number[] = [];
        const back: number[] = [];
        for (let index = 0; index < positions.count; index++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, index)
            .sub(new THREE.Vector3(post.x, y, post.z))
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
          if (Math.abs(point.y) > 0.2 || point.x < 0.12 || point.x > width + 0.12 ||
            Math.abs(Math.abs(point.z) - 0.034) > 0.00001) continue;
          const side = Math.sign(point.z);
          const normal = new THREE.Vector3().fromBufferAttribute(normals, index)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
          expect(normal.z).toBeCloseTo(side);
          // Undo the rear face's 180-degree rotation: text must match, not read mirrored.
          (side === 1 ? front : back).push((point.x - width / 2 - 0.12) * side, point.y);
        }
        expect(front.length).toBeGreaterThan(50);
        expect(front).toHaveLength(back.length);
        front.forEach((coordinate, index) => expect(coordinate).toBeCloseTo(back[index], 4));
      }
    }
  });

  it('uses four static batches and one shared texture-free material with no regulatory arrows or new posts', () => {
    const group = createSigns();
    const materials = new Set<THREE.Material>();
    let triangles = 0;
    expect(group.children).toHaveLength(4);
    group.traverse((object) => {
      expect(object.userData.semanticId).toBeUndefined();
      if (!(object instanceof THREE.Mesh)) return;
      expect(object.material).toMatchObject({ vertexColors: true, map: null });
      expect(object.geometry.boundingBox!.min.y).toBeGreaterThan(2.8);
      expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      triangles += object.geometry.index!.count / 3;
      materials.add(object.material);
    });
    expect(materials.size).toBe(1);
    expect(triangles).toBeLessThan(6400);
  });

  it('centers every name within its safe area and rejects missing glyphs explicitly', () => {
    for (const { name } of [...NAMED_AVENUES, ...NAMED_CROSS_STREETS]) {
      const shape = buildSignLettering(name, 2.3, 0.34);
      try {
        shape.computeBoundingBox();
        const bounds = shape.boundingBox!;
        expect(bounds.getCenter(new THREE.Vector3()).length()).toBeLessThan(0.00001);
        expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(2.30001);
        expect(bounds.max.y - bounds.min.y).toBeLessThanOrEqual(0.34001);
        const normal = shape.getAttribute('normal');
        for (let index = 0; index < normal.count; index++) expect(normal.getZ(index)).toBe(1);
      } finally {
        shape.dispose();
      }
    }
    for (const text of ['', ' ', 'UNKNOWN']) expect(() => buildSignLettering(text, 2, 0.3)).toThrow();
    expect(() => buildSignLettering('REED ST', NaN, 0.3)).toThrow();
  });
});
