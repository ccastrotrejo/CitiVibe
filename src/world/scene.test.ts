import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import poster from '../../public/city/rainlight-003.svg?raw';
import { CITY, LANDMARKS } from '../content/city';
import { PARK_BOUNDS, PARK_PATHS } from '../content/park';
import { STOP_LINE_OFFSET, STREET_X, STREET_Z, TRAFFIC_ACTORS } from '../content/streets';
import { BIKE_MARKINGS, WALK_MARKINGS } from './pavement';
import { ART_INPUTS, buildCityScene, validateArtInputs, type CityScene } from './scene';

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

  it('has only neighborhood vehicles and eight park visitor rigs', () => {
    const { actors, bus } = createScene();
    expect([...actors.keys()]).toEqual([
      ...Array.from({ length: 8 }, (_, index) => `walker-${index + 1}`),
      ...TRAFFIC_ACTORS.map(({ id }) => id),
    ]);
    expect(bus).toBe(actors.get(CITY.busId));
    expect(actors.has('square-bus')).toBe(false);
    actors.forEach((actor) => {
      expect(actor.position).toEqual(new THREE.Vector3());
      const bounds = new THREE.Box3().setFromObject(actor);
      expect(bounds.min.y).toBeGreaterThan(-0.05);
      expect(bounds.min.y).toBeLessThanOrEqual(0.01);
    });
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
    expect((lawn.max.x - lawn.min.x) * (lawn.max.z - lawn.min.z)).toBeGreaterThan(1700);
    expect(park.getObjectByName('Great lawn')).toBeDefined();
    expect(park.getObjectByName('Reed pond')).toBeDefined();
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
        if (scale.y < 2 || scale.x > 0.2 ||
          Math.abs(center.x) > PARK_BOUNDS.x || Math.abs(center.z) > PARK_BOUNDS.z) continue;
        trunks++;
        for (const path of paths) {
          const distance = Math.min(...path.points.map((point) => Math.hypot(point.x - center.x, point.z - center.z)));
          expect(distance, `Tree at ${center.x},${center.z} blocks ${path.id}`)
            .toBeGreaterThan(path.width / 2 + scale.x);
        }
      }
    }
    expect(trunks).toBe(27);
  });

  it('rejects invalid version and seed before allocating resources', () => {
    for (const invalid of [
      { ...ART_INPUTS, schemaVersion: 2 }, { ...ART_INPUTS, assetVersion: 'unmatched' },
      { ...ART_INPUTS, seed: NaN }, { ...ART_INPUTS, seed: -1 },
    ]) expect(() => validateArtInputs(invalid)).toThrow();
  });

  it('marks every protected-lane segment without covering crossings or leaving the lane', () => {
    const { scene } = createScene();
    const painted = resources(scene).instances.find((mesh) =>
      mesh.geometry.name === 'Bicycle and direction pavement stencil')!;
    expect(painted.count).toBe(48);
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

  it('gives four yellow cabs roof lights and door details without enlarging traffic footprints', () => {
    const { actors } = createScene();
    const taxis = TRAFFIC_ACTORS.filter(({ vehicleType }) => vehicleType === 'taxi');
    expect(taxis).toHaveLength(4);
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
    expect(calls).toBeLessThanOrEqual(240);
    expect(triangles).toBeLessThan(200_000);
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
    document.querySelectorAll('[href]').forEach((element) => {
      expect(element.getAttribute('href')).toMatch(/^#/);
      expect(document.querySelector(element.getAttribute('href')!)).not.toBeNull();
    });
    LANDMARKS.forEach(({ id }) => expect(document.getElementById(id)).not.toBeNull());
  });
});
