import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PERSON_SPACE } from '../content/people';
import { buildCityScene } from './scene';
import { LOADING_FRONTAGE, LOADING_SERVICE_POCKET } from './loadingFrontage';
import { SERVICE_VISIT_POCKET } from './serviceActivities';
import { createStreetBuildings, STREET_BUILDINGS, validateStreetscape } from './streetscape';

describe('retained building 15 loading frontage', () => {
  it('aligns clearance metadata with the actual service visit while retaining the paved surface height', () => {
    expect(LOADING_FRONTAGE.target).toEqual({ x: 30, y: 0.025, z: 104.25 });
    expect(LOADING_FRONTAGE.target).toEqual({ ...SERVICE_VISIT_POCKET, y: 0.025 });
    expect(LOADING_SERVICE_POCKET).toMatchObject({
      x: SERVICE_VISIT_POCKET.x, z: SERVICE_VISIT_POCKET.z, surfaceY: 0.025,
    });
    const turnRadius = Math.hypot(PERSON_SPACE.width, PERSON_SPACE.length) / 2 + 0.04;
    expect(LOADING_SERVICE_POCKET.width / 2).toBeGreaterThanOrEqual(turnRadius);
    expect(LOADING_SERVICE_POCKET.depth / 2).toBeGreaterThanOrEqual(turnRadius);
  });

  it('reserves one rear ground-floor recess without moving the raised main entrance or neighboring lots', () => {
    const building = STREET_BUILDINGS.find(({ id }) => id === LOADING_FRONTAGE.buildingId)!;
    expect(building).toMatchObject({
      x: 28.44331616847601, z: 107.5, width: 6.303367663047975, depth: 7.795545321912504,
      use: 'residential', stoop: true, front: { axis: 'z', side: 1 }, attached: ['east'],
      loadingRecess: LOADING_FRONTAGE.recess,
    });
    expect(STREET_BUILDINGS.filter(({ loadingRecess }) => loadingRecess)).toHaveLength(1);
    for (const seed of [0, 1, 42, 173, 2401, 8128]) {
      const buildings = createStreetBuildings(seed);
      expect(buildings).toHaveLength(94);
      expect(() => validateStreetscape(buildings)).not.toThrow();
    }
  });

  it('keeps the full worker approach and pause envelope free of rendered solid scenery', () => {
    const world = buildCityScene();
    try {
      world.scene.updateMatrixWorld(true);
      const { target } = LOADING_FRONTAGE;
      const corridor = new THREE.Box3(
        new THREE.Vector3(target.x - 0.7, 0.1, 102.2 - 0.7),
        new THREE.Vector3(target.x + 0.7, 2.4, target.z + 0.7),
      );
      const matrix = new THREE.Matrix4();
      const collisions: string[] = [];
      world.scene.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        const count = object instanceof THREE.InstancedMesh ? object.count : 1;
        for (let index = 0; index < count; index++) {
          if (object instanceof THREE.InstancedMesh) object.getMatrixAt(index, matrix);
          else matrix.identity();
          const bounds = object.geometry.boundingBox!.clone().applyMatrix4(
            matrix.premultiply(object.matrixWorld),
          );
          if (bounds.intersectsBox(corridor)) {
            collisions.push(`${object.name}:${index} ${bounds.min.toArray()}..${bounds.max.toArray()}`);
          }
        }
      });
      expect(collisions).toEqual([]);
    } finally {
      world.dispose();
    }
  });

  it('provides a grounded threshold, a closed recessed door, supported side piers and the original upper wall', () => {
    const world = buildCityScene();
    try {
      world.scene.updateMatrixWorld(true);
      const building = STREET_BUILDINGS.find(({ id }) => id === LOADING_FRONTAGE.buildingId)!;
      const recess = building.loadingRecess!;
      const hit = (x: number, y: number, z: number, direction: THREE.Vector3) =>
        new THREE.Raycaster(new THREE.Vector3(x, y, z), direction, 0, 8)
          .intersectObjects(world.scene.children, true)[0]?.point;
      const down = new THREE.Vector3(0, -1, 0);
      for (const z of [102.2, recess.frontZ - 0.399, recess.frontZ + 0.1, LOADING_FRONTAGE.target.z]) {
        expect(hit(30, 0.5, z, down)?.y).toBeCloseTo(LOADING_FRONTAGE.target.y, 7);
      }
      const inward = new THREE.Vector3(0, 0, 1);
      expect(hit(30, 1.1, 102.2, inward)?.z).toBeCloseTo(recess.backZ - 0.05, 5);
      expect(hit(30, 3, 102.2, inward)?.z).toBeCloseTo(recess.frontZ, 5);
      for (const x of [recess.minX - 0.1, recess.maxX + 0.1]) {
        expect(hit(x, 1.1, 102.2, inward)?.z).toBeCloseTo(recess.frontZ, 5);
      }
    } finally {
      world.dispose();
    }
  });
});
