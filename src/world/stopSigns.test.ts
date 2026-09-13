import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { METRO_OPENINGS } from '../content/metro';
import { PARK_BOUNDS } from '../content/park';
import { STOP_SIGN_GEOMETRY, STOP_SIGN_POSTS, STOP_SIGN_VERSION } from '../content/stopSigns';
import {
  CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, SIDEWALK_OFFSET, SIGNAL_POLE_OFFSET,
  STOP_LINE_OFFSET, STOP_SIGN_INTERSECTIONS, STREET_X, STREET_Z,
} from '../content/streets';
import { buildSignLettering } from './signLettering';
import { STREET_BUILDINGS } from './streetscape';
import { buildStopSigns, STOP_SIGN_STYLE } from './stopSigns';

const built: THREE.Group[] = [];

function createSigns() {
  const group = buildStopSigns();
  built.push(group);
  return group;
}

function blades(group: THREE.Group) {
  const mesh = group.children[0];
  if (!(mesh instanceof THREE.Mesh)) throw new Error('Missing stop-sign batch.');
  return mesh;
}

afterEach(() => {
  for (const group of built) {
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((surface) => surface.dispose());
    });
  }
  built.length = 0;
});

describe('posted all-way stop blades', () => {
  it('posts one right-hand blade per posted approach, and none at signalized corners', () => {
    expect(STOP_SIGN_INTERSECTIONS.length).toBeGreaterThan(0);
    expect(STOP_SIGN_INTERSECTIONS.every(({ control }) => control === 'all-way-stop')).toBe(true);
    const inBounds = STOP_SIGN_INTERSECTIONS.reduce((total, { x, z }) => total +
      [true, false].reduce((axes, vertical) => axes + [-1, 1].filter((side) =>
        Math.abs(x + (vertical ? side * SIGNAL_POLE_OFFSET : side * STOP_LINE_OFFSET)) <= CITY_EXTENT.x - 0.5 &&
        Math.abs(z + (vertical ? side * STOP_LINE_OFFSET : -side * SIGNAL_POLE_OFFSET)) <= CITY_EXTENT.z - 0.5).length, 0), 0);
    expect(STOP_SIGN_POSTS).toHaveLength(inBounds);
    expect(new Set(STOP_SIGN_POSTS.map(({ id }) => id)).size).toBe(STOP_SIGN_POSTS.length);
    const posted = new Set(STOP_SIGN_INTERSECTIONS.map(({ id }) => id));
    expect(STOP_SIGN_POSTS.every(({ intersectionId }) => posted.has(intersectionId))).toBe(true);
    for (const { id } of INTERSECTIONS.filter(({ control }) => control === 'signal')) {
      expect(STOP_SIGN_POSTS.some(({ intersectionId }) => intersectionId === id)).toBe(false);
    }
    expect(createSigns().userData.assetVersion).toBe(STOP_SIGN_VERSION);
  });

  it('stands at the painted bar on the curb, facing the driver it stops', () => {
    for (const post of STOP_SIGN_POSTS) {
      const intersection = INTERSECTIONS.find(({ id }) => id === post.intersectionId)!;
      const vertical = Math.abs(post.z - intersection.z) > Math.abs(post.x - intersection.x);
      const lateral = vertical ? post.x - intersection.x : post.z - intersection.z;
      const approach = vertical ? post.z - intersection.z : post.x - intersection.x;
      expect(Math.abs(lateral)).toBeCloseTo(SIGNAL_POLE_OFFSET, 9);
      expect(Math.abs(approach)).toBeCloseTo(STOP_LINE_OFFSET, 9);
      // The face normal points back up the approach, into the stopped driver's view.
      expect(Math.sin(post.yaw) * (vertical ? 0 : Math.sign(approach)) +
        Math.cos(post.yaw) * (vertical ? Math.sign(approach) : 0)).toBeCloseTo(1, 9);
      expect(Math.abs(post.x)).toBeLessThan(CITY_EXTENT.x - 0.5);
      expect(Math.abs(post.z)).toBeLessThan(CITY_EXTENT.z - 0.5);
      expect(Math.abs(post.x) > PARK_BOUNDS.x || Math.abs(post.z) > PARK_BOUNDS.z).toBe(true);
      for (const hole of METRO_OPENINGS) {
        expect(post.x < hole.minX || post.x > hole.maxX || post.z < hole.minZ || post.z > hole.maxZ).toBe(true);
      }
    }
    // Curb-side posts leave the sidewalk walking corridor open, as the signal poles do.
    expect(SIDEWALK_OFFSET - SIGNAL_POLE_OFFSET - STOP_SIGN_GEOMETRY.postRadius).toBeGreaterThan(0.6);
  });

  it('hangs an octagonal blade at readable height without blocking walkers, lanes or facades', () => {
    const mesh = blades(createSigns());
    const bounds = mesh.geometry.boundingBox!;
    const { width, bottom, plaqueHeight, plaqueGap } = STOP_SIGN_GEOMETRY;
    expect(bounds.min.y).toBeCloseTo(0, 6);
    expect(bounds.max.y).toBeCloseTo(bottom + width, 3);
    // Head clearance under the lowest plaque edge for a standing adult.
    expect(bottom - plaqueGap - plaqueHeight).toBeGreaterThan(1.8);
    const positions = mesh.geometry.getAttribute('position');
    const point = new THREE.Vector3();
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index);
      expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
      const overRoad = STREET_X.some((road) => Math.abs(point.x - road) <= ROAD_HALF_WIDTH) ||
        STREET_Z.some((road) => Math.abs(point.z - road) <= ROAD_HALF_WIDTH);
      expect(overRoad, `stop sign over a travel lane at ${point.x},${point.z}`).toBe(false);
      expect(Math.abs(point.x) > PARK_BOUNDS.x || Math.abs(point.z) > PARK_BOUNDS.z).toBe(true);
      expect(STREET_BUILDINGS.every((building) => Math.abs(point.x - building.x) > building.width / 2 + 0.2 ||
        Math.abs(point.z - building.z) > building.depth / 2 + 0.2)).toBe(true);
    }
  });

  it('measures a full octagon across the flats on every blade', () => {
    const mesh = blades(createSigns());
    const positions = mesh.geometry.getAttribute('position');
    const point = new THREE.Vector3();
    const center = STOP_SIGN_GEOMETRY.bottom + STOP_SIGN_GEOMETRY.width / 2;
    for (const post of STOP_SIGN_POSTS) {
      let across = 0;
      let tall = 0;
      for (let index = 0; index < positions.count; index += 1) {
        point.fromBufferAttribute(positions, index);
        // Blade band only: the post rings and the ALL WAY plaque sit outside it.
        if (Math.hypot(point.x - post.x, point.z - post.z) > 1 || Math.abs(point.y - center) > 0.42) continue;
        const lateral = (point.x - post.x) * Math.cos(post.yaw) - (point.z - post.z) * Math.sin(post.yaw);
        across = Math.max(across, Math.abs(lateral) * 2);
        tall = Math.max(tall, Math.abs(point.y - center) * 2);
      }
      expect(across, post.id).toBeCloseTo(STOP_SIGN_GEOMETRY.width, 4);
      expect(tall, post.id).toBeCloseTo(STOP_SIGN_GEOMETRY.width, 4);
    }
  });

  it('renders one static batch with a single texture-free material and a bounded budget', () => {
    const group = createSigns();
    const mesh = blades(group);
    expect(group.children).toHaveLength(1);
    expect(mesh.material).toMatchObject({ vertexColors: true, map: null });
    expect(mesh.geometry.getAttribute('color').count).toBe(mesh.geometry.getAttribute('position').count);
    expect(mesh.geometry.index!.count / 3).toBeLessThan(STOP_SIGN_POSTS.length * 250);
    group.traverse((object) => expect(object.userData.semanticId).toBeUndefined());
  });

  it('repeats identically and never keeps borrowed lettering alive', () => {
    const first = blades(createSigns()).geometry.getAttribute('position').array;
    const second = blades(createSigns()).geometry.getAttribute('position').array;
    expect(Array.from(first)).toEqual(Array.from(second));
    for (const label of ['STOP', 'ALL WAY']) {
      const shape = buildSignLettering(label, 1, 0.2);
      try {
        expect(shape.getAttribute('position').count).toBeGreaterThan(0);
      } finally {
        shape.dispose();
      }
    }
    expect(STOP_SIGN_STYLE.sides).toBe(8);
  });
});
