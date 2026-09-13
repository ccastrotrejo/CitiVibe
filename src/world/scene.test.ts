import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import poster from '../../public/city/rainlight-005.svg?raw';
import shell from '../../index.html?raw';
import { CAMERA_ANCHORS, CAMERA_PROJECTION, CITY, LANDMARKS } from '../content/city';
import { BASKETBALL_COURT, COURT_PLAYERS, PICKLEBALL_COURT } from '../content/courts';
import { METRO_ENTRANCES, METRO_GEOMETRY } from '../content/metro';
import { PARK_LAMPS, STREET_LAMPS } from '../content/lighting';
import { PARK_ACTORS, PARK_BOUNDS, PARK_PATHS } from '../content/park';
import { PLAY_AREA, PLAY_PEOPLE } from '../content/play';
import type { PersonProfile } from '../content/people';
import { STOP_LINE_OFFSET, STREET_X, STREET_Z, TRAFFIC_ACTORS } from '../content/streets';
import { BIKE_MARKINGS, WALK_MARKINGS } from './pavement';
import { ART_INPUTS, buildCityScene, validateArtInputs, type CityScene } from './scene';
import { SIDEWALK_SHEDS } from './streetscape';

const worlds: CityScene[] = [];
function createScene() { const world = buildCityScene(); worlds.push(world); return world; }
function resources(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    if (object instanceof THREE.InstancedMesh) instances.push(object);
  });
  return { geometries, materials, instances };
}
afterEach(() => { worlds.splice(0).forEach((world) => world.dispose()); });

describe('original car-free park district', () => {
  it('keeps five semantic landmarks and no selectable actors', () => {
    const world = createScene();
    expect(world.hitTargets.map((target) => target.userData.semanticId)).toEqual(LANDMARKS.map(({ id }) => id));
    world.actors.forEach((actor) => actor.traverse((object) => expect(object.userData.semanticId).toBeUndefined()));
    const ray = new THREE.Raycaster();
    for (const point of LANDMARKS) {
      ray.set(new THREE.Vector3(point.position.x, 20, point.position.z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObjects(world.hitTargets)[0].object.userData.semanticId).toBe(point.id);
    }
    expect(world.marker.visible).toBe(false);
    expect(world.marker.position).toEqual(new THREE.Vector3());
  });

  it('has 246 traveling actors, thirty-six park walkers and eighteen runner rigs', () => {
    const { actors, bus } = createScene();
    expect([...actors.keys()]).toEqual([
      ...PARK_ACTORS.map(({ id }) => id),
      ...TRAFFIC_ACTORS.map(({ id }) => id),
    ]);
    expect(bus).toBe(actors.get(CITY.busId));
    expect(actors.size).toBe(246);
    expect(PARK_ACTORS.filter(({ gait }) => gait === 'walk')).toHaveLength(36);
    expect(PARK_ACTORS.filter(({ gait }) => gait === 'run')).toHaveLength(18);
    expect(actors.has('square-bus')).toBe(false);
    actors.forEach((actor) => {
      expect(actor.position).toEqual(new THREE.Vector3());
      const bounds = new THREE.Box3().setFromObject(actor);
      expect(bounds.min.y).toBeGreaterThan(-0.05);
      expect(bounds.min.y).toBeLessThanOrEqual(0.01);
    });
  });

  it('selects both full-size courts without turning neighboring streets into landmark targets', () => {
    const world = createScene();
    const ray = new THREE.Raycaster();
    for (const court of [BASKETBALL_COURT, PICKLEBALL_COURT]) {
      for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) {
        const x = court.x + sideX * (court.runoffWidth / 2 - 0.01);
        const z = court.z + sideZ * (court.runoffDepth / 2 - 0.01);
        ray.set(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
        expect(ray.intersectObjects(world.hitTargets)[0]?.object.userData.semanticId).toBe('juniper-court');
      }
    }
    for (const z of [95, 125.8, 132]) {
      ray.set(new THREE.Vector3(-5, 20, z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObjects(world.hitTargets)).toHaveLength(0);
    }
  });

  it('integrates all diverse people and keeps the meadow family envelope clear of paths and props', () => {
    const { scene, actors } = createScene();
    const people: PersonProfile[] = [];
    scene.traverse((object) => {
      if (object.userData.person) people.push(object.userData.person);
    });
    expect(people).toHaveLength(232);
    expect(people.filter(({ context }) => context === 'resting')).toHaveLength(8);
    expect(people.filter(({ context }) => context === 'play-child')).toHaveLength(6);
    expect(people.filter(({ context }) => context === 'play-guardian')).toHaveLength(2);
    for (const { id } of PLAY_PEOPLE) {
      expect(scene.getObjectByName(id)).toBeDefined();
      expect(actors.has(id)).toBe(false);
    }
    const area = new THREE.Box3(new THREE.Vector3(PLAY_AREA.minX, 0.3, PLAY_AREA.minZ),
      new THREE.Vector3(PLAY_AREA.maxX, 2.3, PLAY_AREA.maxZ));
    const nearest = new THREE.Vector3();
    for (const path of PARK_PATHS) for (const point of path.curve.getSpacedPoints(512)) {
      nearest.copy(point).setY(0.3).clamp(area.min, area.max);
      expect(Math.hypot(nearest.x - point.x, nearest.z - point.z), path.id).toBeGreaterThan(path.width / 2 + 0.4);
    }
    const matrix = new THREE.Matrix4();
    for (const instance of resources(scene).instances) {
      if (!instance.castShadow) continue;
      instance.geometry.computeBoundingBox();
      for (let index = 0; index < instance.count; index++) {
        instance.getMatrixAt(index, matrix);
        const bounds = instance.geometry.boundingBox!.clone().applyMatrix4(matrix);
        expect(bounds.intersectsBox(area), `Meadow obstruction at ${bounds.getCenter(nearest).toArray()}`).toBe(false);
      }
    }
  });

  it('retains human-sized players and a compact paddle with the same moving contact center', () => {
    const { scene } = createScene();
    expect(PICKLEBALL_COURT.ballRadius).toBe(0.037);
    expect(BASKETBALL_COURT.ballRadius).toBe(0.12);
    const paddles: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name === 'Pickleball paddle') paddles.push(object);
    });
    expect(paddles).toHaveLength(2);
    for (const paddle of paddles) {
      paddle.geometry.computeBoundingBox();
      paddle.updateMatrix();
      const size = paddle.geometry.boundingBox!.clone().applyMatrix4(paddle.matrix).getSize(new THREE.Vector3());
      expect(paddle.position.toArray()).toEqual([0, -0.65, 0]);
      expect(size.x).toBeGreaterThanOrEqual(0.19);
      expect(size.x).toBeLessThanOrEqual(0.201);
      expect(size.y).toBeCloseTo(0.26);
      expect(size.z).toBeCloseTo(0.016);
    }
    for (const player of COURT_PLAYERS) {
      const group = scene.getObjectByName(player.id)!;
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      expect(group.scale.toArray()).toEqual([1, 1, 1]);
      expect(size.y).toBeGreaterThan(1.4);
      expect(size.y).toBeLessThan(2.2);
    }
  });

  it('frames both full-size playing and runoff areas in the relocated court view', () => {
    const pose = CAMERA_ANCHORS.find(({ id }) => id === 'court-view')!.pose;
    for (const aspect of [4 / 3, 16 / 10, 16 / 9]) {
      const height = Math.max(CAMERA_PROJECTION.overviewHeight, CAMERA_PROJECTION.overviewWidth / aspect);
      const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2,
        height / 2, -height / 2, 0.1, CAMERA_PROJECTION.far);
      const radius = CAMERA_PROJECTION.distance * Math.cos(pose.pitch);
      camera.position.set(pose.x + Math.sin(pose.yaw) * radius, CAMERA_PROJECTION.distance * Math.sin(pose.pitch),
        pose.z + Math.cos(pose.yaw) * radius);
      camera.lookAt(pose.x, 0, pose.z);
      camera.zoom = pose.zoom;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      for (const court of [BASKETBALL_COURT, PICKLEBALL_COURT]) {
        for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) for (const y of [0, 3.2]) {
          const point = new THREE.Vector3(court.x + sideX * court.runoffWidth / 2, y,
            court.z + sideZ * court.runoffDepth / 2).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(0.9);
          expect(Math.abs(point.y)).toBeLessThan(0.85);
          expect(Math.abs(point.z)).toBeLessThan(1);
        }
      }
    }
  });

  it('opens all eight subway wells through the island and backdrop to real descending treads', () => {
    const { scene, hitTargets, weatherSurface } = createScene();
    const ground = scene.getObjectByName('Miniature ground')!;
    const backdrop = scene.getObjectByName('City backdrop')!;
    const staticRoots = scene.children.filter((object) => !hitTargets.includes(object));
    const ray = new THREE.Raycaster();
    const up = new THREE.Vector3(0, 1, 0);
    expect(METRO_ENTRANCES).toHaveLength(8);
    for (const entrance of METRO_ENTRANCES) {
      const samples = [0, 5, 11].map((step) => ({
        z: METRO_GEOMETRY.openingDepth / 2 - (step + 0.5) * METRO_GEOMETRY.treadDepth,
        y: METRO_GEOMETRY.surfaceY - (step + 1) * METRO_GEOMETRY.stepRise,
      }));
      samples.push({
        z: -METRO_GEOMETRY.openingDepth / 2 + METRO_GEOMETRY.landingDepth / 2,
        y: METRO_GEOMETRY.surfaceY - METRO_GEOMETRY.stepCount * METRO_GEOMETRY.stepRise,
      });
      for (const sample of samples) {
        const origin = new THREE.Vector3(0, 10, sample.z).applyAxisAngle(up, entrance.yaw);
        origin.x += entrance.x;
        origin.z += entrance.z;
        ray.set(origin, new THREE.Vector3(0, -1, 0));
        expect(ray.intersectObjects([ground, backdrop])).toHaveLength(0);
        expect(ray.intersectObjects(staticRoots, true)[0]?.point.y).toBeCloseTo(sample.y, 4);
      }
      const size = weatherSurface.cellSize;
      const x = Math.floor(entrance.x / size) * size + size / 2;
      const z = Math.floor(entrance.z / size) * size + size / 2;
      ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
      const tread = ray.intersectObjects(staticRoots, true)[0];
      expect(tread.point.y).toBeLessThan(-0.96);
      expect(weatherSurface.heightAt(x, z)).toBeCloseTo(tread.point.y, 4);
    }
  });

  it('removes the asphalt circuit, stop and signals and fills the center with a park', () => {
    const { scene } = createScene();
    for (const name of ['Garden loop road', 'Loop sidewalk', 'North zebra crossing', 'Vehicle stop lamp']) {
      expect(scene.getObjectByName(name)).toBeUndefined();
    }
    const park = scene.getObjectByName('Central park landscape')!;
    const lawn = new THREE.Box3().setFromObject(park.getObjectByName('Park lawn')!);
    expect(lawn.min.x).toBeCloseTo(-PARK_BOUNDS.x);
    expect(lawn.max.z).toBeCloseTo(PARK_BOUNDS.z);
    expect(lawn.max.x - lawn.min.x).toBe(78);
    expect(lawn.max.z - lawn.min.z).toBe(176);
    expect(park.getObjectByName('Great lawn')).toBeDefined();
    expect(park.getObjectByName('Reed pond')).toBeDefined();
    expect(park.getObjectByName('Park reservoir')).toBeDefined();
    expect(park.getObjectByName('South meadow')).toBeDefined();
    expect(park.getObjectByName('Lakeside terrace')).toBeDefined();
    const transform = new THREE.Matrix4();
    const center = new THREE.Vector3();
    scene.traverseVisible((object) => {
      if (!(object instanceof THREE.InstancedMesh) || !object.castShadow ||
        Array.isArray(object.material) || !object.material.userData.window) return;
      for (let index = 0; index < object.count; index++) {
        object.getMatrixAt(index, transform);
        center.setFromMatrixPosition(transform);
        expect(Math.abs(center.x) > PARK_BOUNDS.x || Math.abs(center.z) > PARK_BOUNDS.z).toBe(true);
      }
    });
  });

  it('draws exactly the shared walking curves, including gate and outside paths', () => {
    const { scene } = createScene();
    for (const path of PARK_PATHS) {
      const mesh = scene.getObjectByName(`Park path ${path.id}`) as THREE.Mesh;
      const vertices = mesh.geometry.getAttribute('position');
      const left = new THREE.Vector3();
      const right = new THREE.Vector3();
      for (let index = 0; index <= 80; index++) {
        left.fromBufferAttribute(vertices, index * 2);
        right.fromBufferAttribute(vertices, index * 2 + 1);
        expect(left.distanceTo(right)).toBeCloseTo(path.width, 4);
        const midpoint = left.add(right).multiplyScalar(0.5);
        const route = path.curve.getPoint(index / 80);
        expect(midpoint.x).toBeCloseTo(route.x, 4);
        expect(midpoint.z).toBeCloseTo(route.z, 4);
      }
    }
  });

  it('fits the larger city in the overview and keeps its corners inside the shadow camera', () => {
    const { scene } = createScene();
    scene.updateMatrixWorld(true);
    const sun = scene.children.find((object): object is THREE.DirectionalLight => object instanceof THREE.DirectionalLight)!;
    sun.shadow.updateMatrices(sun);
    const shadow = sun.shadow.getFrustum();
    const shadowTexel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
    const worldDepthBias = -sun.shadow.bias * (sun.shadow.camera.far - sun.shadow.camera.near);
    expect(worldDepthBias / shadowTexel).toBeCloseTo(1.25);
    expect(worldDepthBias).toBeLessThan(0.7);
    expect(sun.shadow.normalBias).toBe(0.06);
    const pose = CAMERA_ANCHORS[0].pose;
    for (const aspect of [4 / 3, 16 / 10, 16 / 9]) {
      const height = Math.max(CAMERA_PROJECTION.overviewHeight, CAMERA_PROJECTION.overviewWidth / aspect);
      const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2,
        height / 2, -height / 2, 0.1, CAMERA_PROJECTION.far);
      const radius = CAMERA_PROJECTION.distance * Math.cos(pose.pitch);
      camera.position.set(Math.sin(pose.yaw) * radius, CAMERA_PROJECTION.distance * Math.sin(pose.pitch), Math.cos(pose.yaw) * radius);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      const view = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const x of [-CITY.bounds.x, CITY.bounds.x]) for (const z of [-CITY.bounds.z, CITY.bounds.z]) {
        for (const y of [0, 38]) {
          const corner = new THREE.Vector3(x, y, z);
          expect(view.containsPoint(corner)).toBe(true);
          expect(shadow.containsPoint(corner)).toBe(true);
        }
      }
    }
  });

  it('keeps tree trunks clear of every park walking surface and gate', () => {
    const { scene } = createScene();
    const paths = PARK_PATHS.map((path) => ({ ...path, points: path.curve.getPoints(1024) }));
    const transform = new THREE.Matrix4();
    const center = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    let trunks = 0;
    for (const instance of resources(scene).instances) {
      if (instance.geometry.type !== 'CylinderGeometry' ||
        !(instance.material instanceof THREE.MeshStandardMaterial) ||
        instance.material.color.getHexString() !== '9c7952') continue;
      for (let index = 0; index < instance.count; index++) {
        instance.getMatrixAt(index, transform);
        transform.decompose(center, rotation, scale);
        if (scale.y < 2 || scale.x > 0.3 ||
          Math.abs(center.x) > PARK_BOUNDS.x || Math.abs(center.z) > PARK_BOUNDS.z) continue;
        trunks++;
        for (const path of paths) {
          const distance = Math.min(...path.points.map((point) => Math.hypot(point.x - center.x, point.z - center.z)));
          expect(distance, `Tree at ${center.x},${center.z} blocks ${path.id}`)
            .toBeGreaterThan(path.width / 2 + scale.x);
        }
      }
    }
    expect(trunks).toBeGreaterThanOrEqual(65);
  });

  it('rejects invalid version and seed before allocating resources', () => {
    for (const invalid of [
      { ...ART_INPUTS, schemaVersion: 2 }, { ...ART_INPUTS, assetVersion: 'unmatched' },
      { ...ART_INPUTS, seed: NaN }, { ...ART_INPUTS, seed: -1 },
    ]) expect(() => validateArtInputs(invalid)).toThrow();
  });

  it('keeps park walking surfaces and sidewalk body clearance free of low props', () => {
    const { scene } = createScene();
    const paths = PARK_PATHS.map((path) => ({
      id: path.id, clearance: path.id.includes('sidewalk') ? 0.35 : path.width / 2 + 0.05,
      points: path.curve.getPoints(1024),
    }));
    const transform = new THREE.Matrix4();
    const bounds = new THREE.Box3();
    const inverse = new THREE.Matrix4();
    const nearest = new THREE.Vector3();
    for (const instance of resources(scene).instances) {
      if (!instance.castShadow) continue;
      instance.geometry.computeBoundingBox();
      for (let index = 0; index < instance.count; index++) {
        instance.getMatrixAt(index, transform);
        bounds.copy(instance.geometry.boundingBox!).applyMatrix4(transform);
        const center = bounds.getCenter(new THREE.Vector3());
        if (bounds.max.y < 0.3 || bounds.min.y > 1.6 ||
          Math.abs(center.x) > PARK_BOUNDS.x + 0.2 || Math.abs(center.z) > PARK_BOUNDS.z + 0.2) continue;
        inverse.copy(transform).invert();
        for (const path of paths) for (const point of path.points) {
          nearest.copy(point).setY(THREE.MathUtils.clamp(center.y, 0.3, 1.6)).applyMatrix4(inverse);
          nearest.clamp(instance.geometry.boundingBox!.min, instance.geometry.boundingBox!.max).applyMatrix4(transform);
          const distance = Math.hypot(nearest.x - point.x, nearest.z - point.z);
          if (distance < path.clearance) {
            throw new Error(`Prop ${instance.geometry.type} at ${center.x},${center.y},${center.z} blocks ${path.id}: ${distance}.`);
          }
        }
      }
    }
  });

  it('marks every protected-lane segment without covering crossings or leaving the lane', () => {
    const { scene } = createScene();
    const painted = resources(scene).instances.find((mesh) =>
      mesh.geometry.name === 'Bicycle and direction pavement stencil')!;
    expect(painted.count).toBe(120);
    expect(BIKE_MARKINGS).toHaveLength(painted.count);
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    const vertices = painted.geometry.getAttribute('position');
    const normals = painted.geometry.getAttribute('normal');
    BIKE_MARKINGS.forEach((mark, index) => {
      painted.getMatrixAt(index, matrix);
      const vertical = Math.abs(Math.cos(mark.yaw)) > 0.5;
      for (let vertex = 0; vertex < vertices.count; vertex++) {
        point.fromBufferAttribute(vertices, vertex).applyMatrix4(matrix);
        expect(normals.getY(vertex)).toBeCloseTo(1);
        expect(Math.abs(vertical ? point.x - mark.x : point.z - mark.z)).toBeLessThan(0.64);
        expect(Math.min(...(vertical ? STREET_Z : STREET_X)
          .map((crossing) => Math.abs((vertical ? point.z : point.x) - crossing))))
          .toBeGreaterThan(STOP_LINE_OFFSET);
      }
    });
  });

  it('places legible pedestrian stencils on shared park paths, not on the grass', () => {
    const { scene } = createScene();
    const painted = resources(scene).instances.find((mesh) =>
      mesh.geometry.name === 'Park running and walking pavement stencil')!;
    expect(painted.count).toBe(WALK_MARKINGS.length);
    const matrix = new THREE.Matrix4();
    const center = new THREE.Vector3();
    WALK_MARKINGS.forEach(({ id, at }, index) => {
      painted.getMatrixAt(index, matrix);
      center.setFromMatrixPosition(matrix);
      const path = PARK_PATHS.find((path) => path.id === id)!;
      const expected = path.curve.getPointAt(at);
      expect(center.x).toBeCloseTo(expected.x, 4);
      expect(center.z).toBeCloseTo(expected.z, 4);
      expect(center.y).toBeGreaterThan(-0.012);
    });
  });

  it('gives six yellow cabs roof lights and door details without enlarging traffic footprints', () => {
    const { actors } = createScene();
    const taxis = TRAFFIC_ACTORS.filter(({ vehicleType }) => vehicleType === 'taxi');
    expect(taxis).toHaveLength(6);
    for (const { id } of taxis) {
      const cab = actors.get(id)!;
      expect(cab.getObjectByName('Unbranded taxi roof light')).toBeDefined();
      expect(cab.getObjectByName('Taxi front grille')).toBeDefined();
      expect(cab.getObjectByName('Generic taxi door medallion')).toBeDefined();
      const bounds = new THREE.Box3().setFromObject(cab);
      expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(2.8);
      expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(1.46);
      expect(bounds.max.y).toBeLessThan(1.8);
    }
  });

  it('stays within the expanded scene budgets', () => {
    const { scene } = createScene();
    let calls = 0;
    let triangles = 0;
    scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      calls++;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 *
        (object instanceof THREE.InstancedMesh ? object.count : 1);
    });
    expect(calls).toBeLessThanOrEqual(110);
    expect(triangles).toBeLessThan(600_000);
    expect(resources(scene).materials.size).toBeLessThanOrEqual(36);
  });

  it('disposes unique resources once and leaves another world intact', () => {
    const first = createScene();
    const second = createScene();
    const owned = resources(first.scene);
    const other = resources(second.scene);
    const disposals = [...owned.geometries, ...owned.materials, ...owned.instances].map((resource) => vi.spyOn(resource, 'dispose'));
    const otherDisposals = [...other.geometries, ...other.materials].map((resource) => vi.spyOn(resource, 'dispose'));
    const sun = first.scene.children.find((object) => object instanceof THREE.DirectionalLight)!;
    const shadow = vi.spyOn(sun.shadow, 'dispose');
    first.dispose(); first.dispose();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    otherDisposals.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    expect(shadow).toHaveBeenCalledTimes(1);
    expect(first.scene.children).toHaveLength(0);
    expect(first.actors.size).toBe(0);
    expect(first.hitTargets).toHaveLength(0);
  });

  it('reproduces geometry and transforms without cross-world resource sharing', () => {
    const first = resources(createScene().scene);
    const second = resources(createScene().scene);
    const data = (geometries: Set<THREE.BufferGeometry>) => [...geometries].map((geometry) => [
      [...geometry.getAttribute('position').array], geometry.index ? [...geometry.index.array] : [],
    ]);
    expect(data(first.geometries)).toEqual(data(second.geometries));
    expect(first.instances.map((mesh) => [...mesh.instanceMatrix.array]))
      .toEqual(second.instances.map((mesh) => [...mesh.instanceMatrix.array]));
    expect([...first.geometries].some((geometry) => second.geometries.has(geometry))).toBe(false);
  });

  it('ships a self-contained original still with all matching landmark IDs', () => {
    expect(new TextEncoder().encode(poster).byteLength).toBeLessThan(200_000);
    const document = new DOMParser().parseFromString(poster, 'image/svg+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 1200 900');
    expect(document.querySelector('title')?.textContent).toContain('Rainlight Square');
    expect(document.querySelector('script, image, foreignObject, style')).toBeNull();
    const courtSurfaces = document.querySelectorAll('#juniper-court > [data-court]');
    for (const [index, court] of [[0, BASKETBALL_COURT], [1, PICKLEBALL_COURT]] as const) {
      expect(Number(courtSurfaces[index].getAttribute('width'))).toBe(court.width);
      expect(Number(courtSurfaces[index].getAttribute('height'))).toBe(court.depth);
      expect(Number(courtSurfaces[index].getAttribute('x'))).toBeCloseTo(court.x - court.width / 2, 5);
      expect(Number(courtSurfaces[index].getAttribute('y'))).toBeCloseTo(court.z - court.depth / 2, 5);
    }
    expect(document.querySelectorAll('[data-metro]')).toHaveLength(METRO_ENTRANCES.length);
    for (const entrance of METRO_ENTRANCES) {
      const symbol = document.querySelector(`[data-metro="${entrance.id}"]`)!;
      const transform = symbol.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/)!;
      expect(Number(transform[1])).toBeCloseTo(entrance.x, 5);
      expect(Number(transform[2])).toBeCloseTo(entrance.z, 5);
      expect(Number(transform[3])).toBeCloseTo(-entrance.yaw * 180 / Math.PI);
    }
    expect(document.querySelectorAll('[data-shed]')).toHaveLength(SIDEWALK_SHEDS.length);
    for (const shed of SIDEWALK_SHEDS) {
      const symbol = document.querySelector(`[data-shed="${shed.id}"]`)!;
      const transform = symbol.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(1 ([-\d.]+)\)/)!;
      expect(Number(transform[1])).toBeCloseTo(shed.x, 5);
      expect(Number(transform[2])).toBeCloseTo(shed.z, 5);
      expect(Number(transform[3])).toBeCloseTo(shed.length, 5);
    }
    document.querySelectorAll('[href]').forEach((element) => {
      expect(element.getAttribute('href')).toMatch(/^#/);
      expect(document.querySelector(element.getAttribute('href')!)).not.toBeNull();
    });
    LANDMARKS.forEach(({ id }) => expect(document.getElementById(id)).not.toBeNull());
    const html = new DOMParser().parseFromString(shell, 'text/html');
    expect(html.querySelector('img')?.getAttribute('src')).toBe(`/city/${CITY.version}.svg`);
    expect(html.title).toBe('CitiVibe - Rainlight Square');
    const styles = readFileSync('src/styles.css', 'utf8');
    for (const { id, position: anchor } of LANDMARKS) {
      const position = poster.match(new RegExp(`${id} (\\d+(?:\\.\\d+)?),(\\d+(?:\\.\\d+)?)`));
      const marker = styles.match(new RegExp(`\\.marker-${id} \\{ left: ([\\d.]+)%; top: ([\\d.]+)%; \\}`));
      expect(position).not.toBeNull();
      expect(marker).not.toBeNull();
      expect(Number(position![1])).toBeCloseTo(600 + 2 * (anchor.x - anchor.z), 3);
      expect(Number(position![2])).toBeCloseTo(480 + 0.95 * (anchor.x + anchor.z), 3);
      expect(Number(marker![1])).toBeCloseTo(Number(position![1]) / 12, 3);
      expect(Number(marker![2])).toBeCloseTo(Number(position![2]) / 9, 3);
    }
  });
});

describe('public street and park lighting fixtures', () => {
  it('emits dusk-driven lamp heads and ground pools tagged for the night ramp', () => {
    const { scene } = createScene();
    const { materials, instances } = resources(scene);
    const glow = [...materials].find((material) => material.userData.nightLight === true) as THREE.MeshStandardMaterial;
    const pool = [...materials].find((material) => material.userData.nightPool === true) as THREE.MeshBasicMaterial;
    expect(glow).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(glow.emissiveIntensity).toBe(0);
    expect(pool).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(pool.transparent).toBe(true);
    const poolMeshes = instances.filter((mesh) => mesh.material === pool);
    expect(poolMeshes.length).toBeGreaterThan(0);
    poolMeshes.forEach((mesh) => {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.count).toBe(STREET_LAMPS.length + PARK_LAMPS.length);
    });
  });

  it('gives building windows per-instance glow with dark and multiple lit tints', () => {
    const { scene } = createScene();
    const glazing = resources(scene).instances.find((mesh) =>
      mesh.geometry.getAttribute('windowGlow') !== undefined)!;
    expect(glazing).toBeDefined();
    const attribute = glazing.geometry.getAttribute('windowGlow');
    expect(attribute.count).toBe(glazing.count);
    const swatches = new Set<string>();
    let dark = 0;
    for (let index = 0; index < attribute.count; index++) {
      const r = attribute.getX(index), g = attribute.getY(index), b = attribute.getZ(index);
      if (r < 0.1 && g < 0.1 && b < 0.1) { dark++; continue; }
      swatches.add(`${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)}`);
    }
    expect(dark).toBeGreaterThan(0);
    expect(swatches.size).toBeGreaterThanOrEqual(3);
  });
});
