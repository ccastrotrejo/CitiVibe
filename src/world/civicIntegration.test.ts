import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STEAM_PILOT, STREET_DRAINS, outsideWalkingCorridors } from '../content/civicUtilities';
import { LOADING_SERVICE_POCKET } from './loadingFrontage';
import { BUILDING_SERVICE_CONNECTIONS, STREET_BUILDINGS } from './streetscape';
import { buildCityScene, type CityScene } from './scene';

describe('integrated civic utility geometry', () => {
  let world: CityScene;
  const meshes: THREE.Mesh[] = [];
  beforeAll(() => {
    world = buildCityScene();
    world.scene.updateMatrixWorld(true);
    const actors = new Set<THREE.Object3D>(world.actors.values());
    world.scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let parent = object.parent; parent; parent = parent.parent) if (actors.has(parent)) return;
      meshes.push(object);
    });
  });
  afterAll(() => world?.dispose());

  const hit = (x: number, y: number, z: number, direction: THREE.Vector3) => {
    const result = new THREE.Raycaster(new THREE.Vector3(x, y, z), direction, 0, 3)
      .intersectObjects(meshes, false)[0];
    if (!result) throw new Error(`No civic surface at ${x}, ${y}, ${z}.`);
    return result.point;
  };

  it('cuts genuine road recesses beneath flush metal bars and keeps curb mouths open behind their face', () => {
    for (const drain of STREET_DRAINS) {
      expect(hit(drain.x, 0.2, drain.z, new THREE.Vector3(0, -1, 0)).y).toBeCloseTo(drain.surfaceY);
      expect(hit(drain.x + 0.06, 0.2, drain.z, new THREE.Vector3(0, -1, 0)).y).toBeCloseTo(drain.recessY);
      const mouth = hit(drain.x, 0.02, drain.z + 0.2, new THREE.Vector3(0, 0, -1));
      const solidCurb = hit(drain.x + drain.width / 2 + 0.15, 0.02, drain.z + 0.2, new THREE.Vector3(0, 0, -1));
      expect(mouth.z).toBeLessThan(solidCurb.z - 0.1);
      expect(world.weatherSurface.snowRetentionAt(drain.x, drain.z)).toBeCloseTo(drain.snowRetention);
    }
  });

  it('mounts two closed-lid service bins against real rear walls away from walking corridors', () => {
    expect(BUILDING_SERVICE_CONNECTIONS).toHaveLength(2);
    for (const prop of BUILDING_SERVICE_CONNECTIONS) {
      const building = STREET_BUILDINGS.find(({ id }) => id === prop.buildingId)!;
      expect(prop.z).toBe(building.z - building.depth / 2);
      expect(prop.yaw).toBe(Math.PI);
      const center = { ...prop, z: prop.z - 0.22 };
      expect(outsideWalkingCorridors(center, 0.62, 0.44)).toBe(true);
      expect(hit(prop.x, 0.9, prop.z - 0.15, new THREE.Vector3(0, -1, 0)).y).toBeCloseTo(0.745);
    }
  });

  it('captures the narrow steam source at its actual top rather than the pavement between grid centers', () => {
    expect(hit(STEAM_PILOT.x, 3, STEAM_PILOT.z, new THREE.Vector3(0, -1, 0)).y).toBeCloseTo(STEAM_PILOT.topY);
    expect(world.weatherSurface.heightAt(STEAM_PILOT.x, STEAM_PILOT.z)).toBeCloseTo(STEAM_PILOT.topY);
  });

  it('keeps the full standing and turning service pocket paved and unobstructed', () => {
    const pocket = LOADING_SERVICE_POCKET;
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) for (const z of [-0.5, -0.25, 0, 0.25, 0.5]) {
      expect(hit(pocket.x + x * pocket.width, 2.3, pocket.z + z * pocket.depth,
        new THREE.Vector3(0, -1, 0)).y).toBeCloseTo(pocket.surfaceY);
    }
  });
});
