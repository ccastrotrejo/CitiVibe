import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BUILDING_FABRIC } from '../content/facades';
import { CIVIC_SERVICES } from '../content/civicServices';
import { buildStreetscape, createStreetBuildings, STREET_BUILDINGS, validateStreetscape, type StreetscapeBuilder } from './streetscape';
import { buildCurbTransitions, CURB_TRANSITIONS } from './pavement';

function measureArt(build: (builder: StreetscapeBuilder) => { dispose(): void } | void) {
  const box = new THREE.BoxGeometry();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const crown = new THREE.DodecahedronGeometry(1);
  const names = ['sand', 'stone', 'paving', 'road', 'line', 'cream', 'clay', 'teal', 'roof',
    'copper', 'copperEdge', 'glass', 'wood', 'leaf', 'leafLight', 'water', 'bus', 'rubber', 'taxi', 'facade'] as const;
  const palette = Object.fromEntries(names.map((name) => [name, new THREE.MeshStandardMaterial()])) as
    Record<(typeof names)[number], THREE.MeshStandardMaterial>;
  const meshes: THREE.Mesh[] = [];
  const add: StreetscapeBuilder['add'] = (geometry, material, position, scale, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.updateMatrixWorld();
    meshes.push(mesh);
  };
  const art = build({
    box, cylinder, crown, palette, add,
    block: (material, x, y, z, w, h, d, yaw = 0) => add(box, material, [x, y, z], [w, h, d], [0, yaw, 0]),
  });
  return {
    meshes,
    dispose() {
      art?.dispose();
      [box, cylinder, crown].forEach((geometry) => geometry.dispose());
      Object.values(palette).forEach((material) => material.dispose());
    },
  };
}

describe('bounded coherent building fabric', () => {
  it('retains use inventory, all seven construction systems and safe parcels across seeds', () => {
    expect(STREET_BUILDINGS).toHaveLength(94);
    expect(STREET_BUILDINGS.filter(({ use }) => use === 'residential')).toHaveLength(43);
    expect(STREET_BUILDINGS.filter(({ use }) => use === 'mixed-use')).toHaveLength(31);
    expect(STREET_BUILDINGS.filter(({ use }) => use === 'office')).toHaveLength(17);
    expect(STREET_BUILDINGS.filter(({ use }) => use === 'civic')).toHaveLength(3);
    for (const service of CIVIC_SERVICES) {
      expect(STREET_BUILDINGS.find(({ id }) => id === service.buildingId))
        .toMatchObject({ use: 'civic', civicService: service.kind, storefront: null, stoop: false });
    }
    expect(new Set(STREET_BUILDINGS.map(({ fabricType }) => fabricType)).size).toBe(7);
    for (const seed of [0, 1, 42, 173, 2401, 8128]) {
      const buildings = createStreetBuildings(seed);
      expect(() => validateStreetscape(buildings)).not.toThrow();
      for (const building of buildings) {
        expect(BUILDING_FABRIC[building.fabricType].materials).toContain(building.facadeFamily);
        expect(BUILDING_FABRIC[building.fabricType].roofs).toContain(building.roof);
      }
    }
  });

  it('saves at least twelve thousand triangles with one shared correctly oriented pane', () => {
    const art = measureArt(buildStreetscape);
    try {
      const triangles = art.meshes.reduce((sum, { geometry }) =>
        sum + (geometry.index?.count ?? geometry.getAttribute('position').count) / 3, 0);
      expect(triangles).toBeLessThanOrEqual(337_804 - 12_000);
      const panes = art.meshes.filter(({ geometry }) => geometry.name === 'Shared outward-facing facade glazing');
      expect(panes.length).toBeGreaterThan(2_500);
      expect(new Set(panes.map(({ geometry }) => geometry)).size).toBe(1);
      for (const pane of panes) {
        expect(pane.geometry.index!.count).toBe(6);
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(pane.matrixWorld);
        expect(normal.y).toBeCloseTo(0, 10);
        expect(Math.max(Math.abs(normal.x), Math.abs(normal.z))).toBeCloseTo(1, 10);
      }
    } finally {
      art.dispose();
    }
  });

  it('joins both road levels and the old paver to a zero-height landing with actual sloping surfaces', () => {
    const art = measureArt(buildCurbTransitions);
    try {
      const heightAt = (x: number, z: number) => new THREE.Raycaster(
        new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0), 0, 2,
      ).intersectObjects(art.meshes, false)[0]?.point.y;
      for (const landing of CURB_TRANSITIONS) {
        const side = Math.sign(landing.x);
        expect(heightAt(landing.x, landing.z)).toBeCloseTo(0, 8);
        expect(heightAt(landing.x - side * 1.649, landing.z)).toBeCloseTo(-0.015, 3);
        expect(heightAt(landing.x + side * 1.299, landing.z)).toBeCloseTo(-0.08, 3);
        expect(heightAt(landing.x, landing.z + Math.sign(landing.z) * 1.699)).toBeCloseTo(-0.005, 3);
      }
    } finally {
      art.dispose();
    }
  });
});
