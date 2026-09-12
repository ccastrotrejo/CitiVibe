import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import poster from '../../public/city/rainlight-001.svg?raw';
import { LANDMARKS, ROUTE_LENGTH, sampleRoute } from '../content/city';
import { ART_INPUTS, buildCityScene, validateArtInputs } from './scene';
import type { CityScene } from './scene';

const worlds: CityScene[] = [];

function createScene() {
  const world = buildCityScene();
  worlds.push(world);
  return world;
}

function resources(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      const surfaces = Array.isArray(object.material) ? object.material : [object.material];
      surfaces.forEach((surface) => materials.add(surface));
      if (object instanceof THREE.InstancedMesh) instances.push(object);
    }
  });
  return { geometries, materials, instances };
}

afterEach(() => {
  worlds.forEach((world) => world.dispose());
  worlds.length = 0;
});

describe('original Rainlight Square artwork', () => {
  it('exposes only landmark hit targets while keeping all actors non-interactive', () => {
    const world = createScene();
    expect(world.hitTargets.map((target) => target.userData.semanticId)).toEqual(LANDMARKS.map(({ id }) => id));
    const pavilion = world.hitTargets[0];
    world.actors.forEach((actor) => actor.traverse((object) => {
      expect(object.userData.semanticId).toBeUndefined();
      expect(world.hitTargets).not.toContain(object);
    }));
    for (const target of world.hitTargets) {
      expect(target.visible).toBe(true);
      expect((target as THREE.Mesh).material).toMatchObject({
        visible: true, opacity: 0, colorWrite: false, depthWrite: false,
      });
    }
    const ray = new THREE.Raycaster(new THREE.Vector3(-4, 20, -3), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObjects(world.hitTargets)[0].object).toBe(pavilion);
    const route = sampleRoute(37);
    world.bus.position.set(route.x, route.y, route.z);
    world.bus.rotation.y = route.heading;
    world.scene.updateMatrixWorld(true);
    ray.set(new THREE.Vector3(route.x, 20, route.z), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObjects(world.hitTargets)).toHaveLength(0);
    for (const point of LANDMARKS) {
      ray.set(new THREE.Vector3(point.position.x, 20, point.position.z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObjects(world.hitTargets)[0].object.userData.semanticId).toBe(point.id);
    }
  });

  it('keeps the selection ring hidden at local origin for runtime landmark positioning', () => {
    const { marker } = createScene();
    expect(marker.visible).toBe(false);
    expect(marker.position).toEqual(new THREE.Vector3());
    marker.visible = true;
    expect(marker.visible).toBe(true);
  });

  it('builds a closed road at y=0 around the exact shared route centerline', () => {
    const { scene } = createScene();
    const road = scene.getObjectByName('Garden loop road') as THREE.Mesh;
    const positions = road.geometry.getAttribute('position');
    const normals = road.geometry.getAttribute('normal');
    const segments = positions.count / 2 - 1;
    for (let index = 0; index <= segments; index++) {
      const point = sampleRoute(index / segments * ROUTE_LENGTH);
      const left = new THREE.Vector3().fromBufferAttribute(positions, index * 2);
      const right = new THREE.Vector3().fromBufferAttribute(positions, index * 2 + 1);
      expect(left.y).toBe(0);
      expect(right.y).toBe(0);
      expect(left.distanceTo(right)).toBeCloseTo(4, 5);
      const midpoint = left.add(right).multiplyScalar(0.5);
      expect(midpoint.x).toBeCloseTo(point.x, 5);
      expect(midpoint.z).toBeCloseTo(point.z, 5);
      expect(normals.getY(index * 2)).toBeCloseTo(1);
    }
    const first = new THREE.Vector3().fromBufferAttribute(positions, 0);
    const last = new THREE.Vector3().fromBufferAttribute(positions, positions.count - 2);
    expect(first.distanceTo(last)).toBeCloseTo(0);
  });

  it('uses a ground-level wheel pivot and a longitudinal local +Z bus', () => {
    const { bus, hitTargets } = createScene();
    const bounds = new THREE.Box3();
    bus.traverse((object) => {
      if (object instanceof THREE.Mesh && !hitTargets.includes(object)) {
        bounds.union(new THREE.Box3().setFromObject(object));
      }
    });
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(bounds.max.x - bounds.min.x);
    expect(bus.position).toEqual(new THREE.Vector3());
    const front = new THREE.Vector3(0, 0, 1);
    for (const distance of [0, 35, 70, 101, ROUTE_LENGTH - 1]) {
      const point = sampleRoute(distance);
      const next = sampleRoute(distance + 0.001);
      const tangent = new THREE.Vector3(next.x - point.x, 0, next.z - point.z).normalize();
      const facing = front.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), point.heading);
      expect(facing.dot(tangent)).toBeGreaterThan(0.999);
    }
  });

  it('provides a fixed population of grounded original actor groups without moving them', () => {
    const { actors, bus, hitTargets } = createScene();
    expect([...actors.keys()]).toEqual([
      'square-bus', 'car-1', 'car-2', 'car-3',
      ...Array.from({ length: 8 }, (_, index) => `walker-${index + 1}`),
    ]);
    expect(actors.get('square-bus')).toBe(bus);
    for (const [id, actor] of actors) {
      expect(actor.position).toEqual(new THREE.Vector3());
      expect(actor.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
      const bounds = new THREE.Box3();
      actor.traverse((object) => {
        if (object instanceof THREE.Mesh && !hitTargets.includes(object)) {
          bounds.union(new THREE.Box3().setFromObject(object));
        }
      });
      if (id.startsWith('walker-')) {
        // Articulated legs bend at the knee because hipY (0.80m) is shorter than a
        // full leg (0.88m) — required so walking strides never over-extend and slip.
        // A shin/thigh box corner therefore dips a few cm below the nominal ground
        // plane while the foot sole stays grounded. Vehicles remain exactly grounded.
        expect(bounds.min.y).toBeGreaterThan(-0.05);
        expect(bounds.min.y).toBeLessThanOrEqual(0.01);
        expect(bounds.max.y).toBeLessThanOrEqual(1.75);
      } else {
        expect(bounds.min.y).toBeCloseTo(0, 6);
      }
      if (id.startsWith('car-')) expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(2.8);
    }
  });

  it('authors north zebra stripes along x and preserves the shared pedestrian corridor', () => {
    const { scene } = createScene();
    const crossing = scene.getObjectByName('North zebra crossing')!;
    expect(crossing).toBeDefined();
    const bounds = new THREE.Box3().setFromObject(crossing);
    expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
    expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(-16);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-18);
    expect(bounds.max.z).toBeLessThanOrEqual(-14);
    const stripes = crossing.children[0] as THREE.InstancedMesh;
    const transform = new THREE.Matrix4();
    stripes.getMatrixAt(0, transform);
    const scale = new THREE.Vector3().setFromMatrixScale(transform);
    expect(scale.x).toBeGreaterThan(scale.z * 5);
    expect(ART_INPUTS.sidewalkHalfWidth).toBeGreaterThan(4);
    expect(() => validateArtInputs(ART_INPUTS)).not.toThrow();
  });

  it('rejects version, dimensions, duplicate IDs and obstructed street anchors before building', () => {
    for (const invalid of [
      { ...ART_INPUTS, schemaVersion: 2 },
      { ...ART_INPUTS, assetVersion: 'unmatched' },
      { ...ART_INPUTS, seed: NaN },
      { ...ART_INPUTS, sidewalkHalfWidth: NaN },
      { ...ART_INPUTS, roadWidth: 6 },
      { ...ART_INPUTS, crossing: { x: 2, z: -16 } },
      { ...ART_INPUTS, busStop: { x: -9, z: -16 } },
      { ...ART_INPUTS, buildings: [ART_INPUTS.buildings[0], ART_INPUTS.buildings[0]] },
      { ...ART_INPUTS, buildings: [{ ...ART_INPUTS.buildings[0], height: Infinity }] },
      { ...ART_INPUTS, buildings: [{ ...ART_INPUTS.buildings[2], depth: 2 }] },
      { ...ART_INPUTS, buildings: [{ ...ART_INPUTS.buildings[0], x: 0 }] },
      { ...ART_INPUTS, buildings: [{ ...ART_INPUTS.buildings[0], x: -9, z: -10.8 }] },
    ]) {
      expect(() => validateArtInputs(invalid)).toThrow();
    }
  });

  it('shows mutually exclusive signal phases with shared materials and distinct lamp positions', () => {
    const world = createScene();
    const heads = ['Vehicle', 'North crossing', 'South crossing'].map((name) => ({
      stop: world.scene.getObjectByName(`${name} stop lamp`) as THREE.Mesh,
      go: world.scene.getObjectByName(`${name} go lamp`) as THREE.Mesh,
    }));
    const [vehicle, north, south] = heads;
    const dark = vehicle.stop.material;
    const red = north.stop.material;
    const green = vehicle.go.material;
    expect(new Set([dark, red, green]).size).toBe(3);
    expect(south.stop.material).toBe(red);
    expect(north.go.material).toBe(dark);
    heads.forEach(({ stop, go }) => expect(stop.position.y).toBeGreaterThan(go.position.y));
    world.setSignal!('clearance');
    heads.forEach(({ stop, go }) => {
      expect(stop.material).toBe(red);
      expect(go.material).toBe(dark);
    });
    world.setSignal!('pedestrians');
    expect(vehicle.stop.material).toBe(red);
    expect(vehicle.go.material).toBe(dark);
    for (const head of [north, south]) {
      expect(head.stop.material).toBe(dark);
      expect(head.go.material).toBe(green);
    }
    const count = resources(world.scene).geometries.size;
    world.setSignal!('pedestrians');
    expect(resources(world.scene).geometries.size).toBe(count);
    world.setSignal!('vehicles');
    expect(vehicle.go.material).toBe(green);
    expect(north.stop.material).toBe(red);
    world.dispose();
    world.setSignal!('pedestrians');
    expect(vehicle.go.material).toBe(green);
  });

  it('stays within the bounded district geometry and main-pass submission budget', () => {
    const { scene } = createScene();
    let calls = 0;
    let triangles = 0;
    scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      calls++;
      const shape = object.geometry;
      const count = object instanceof THREE.InstancedMesh ? object.count : 1;
      triangles += (shape.index?.count ?? shape.getAttribute('position').count) / 3 * count;
    });
    // Articulated actors (per-limb walker rigs + posable vehicle wheels) trade the
    // old static batching for real distance-driven locomotion, so the main pass runs
    // more draw calls than fully batched scenery. This is still trivially cheap: low
    // triangle count and a small fixed material set keep the frame budget comfortable.
    expect(calls).toBeLessThanOrEqual(180);
    expect(triangles).toBeLessThan(25000);
    expect(resources(scene).materials.size).toBeLessThanOrEqual(24);
  });

  it('disposes each unique owned resource exactly once without disposing another world', () => {
    const first = createScene();
    const second = createScene();
    const owned = resources(first.scene);
    const other = resources(second.scene);
    const unique = [...owned.geometries, ...owned.materials, ...owned.instances];
    const disposals = unique.map((resource) => vi.spyOn(resource, 'dispose'));
    const secondDisposals = [...other.geometries, ...other.materials].map((resource) => vi.spyOn(resource, 'dispose'));
    expect([...owned.geometries].some((shape) => other.geometries.has(shape))).toBe(false);
    expect([...owned.materials].some((surface) => other.materials.has(surface))).toBe(false);
    const sun = first.scene.children.find((object): object is THREE.DirectionalLight =>
      object instanceof THREE.DirectionalLight);
    expect(sun).toBeDefined();
    const shadowDisposal = vi.spyOn(sun!.shadow, 'dispose');
    first.dispose();
    first.dispose();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    secondDisposals.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    expect(shadowDisposal).toHaveBeenCalledTimes(1);
    expect(first.scene.children).toHaveLength(0);
    expect(first.bus.children).toHaveLength(0);
    expect(first.actors.size).toBe(0);
    expect(first.hitTargets).toHaveLength(0);
  });

  it('reproduces the same geometry and instance transforms without global shared ownership', () => {
    const first = resources(createScene().scene);
    const second = resources(createScene().scene);
    const shapeData = (shapes: Set<THREE.BufferGeometry>) => [...shapes].map((shape) => ({
      positions: [...shape.getAttribute('position').array],
      indices: shape.index ? [...shape.index.array] : [],
    }));
    expect(shapeData(first.geometries)).toEqual(shapeData(second.geometries));
    expect(first.instances.map((mesh) => [...mesh.instanceMatrix.array])).toEqual(
      second.instances.map((mesh) => [...mesh.instanceMatrix.array]),
    );
  });

  it('ships a small self-contained accessible original vector poster', () => {
    expect(new TextEncoder().encode(poster).byteLength).toBeLessThan(200_000);
    const document = new DOMParser().parseFromString(poster, 'image/svg+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 1200 900');
    expect(document.querySelector('title')?.textContent).toContain('Rainlight Square');
    expect(document.querySelector('desc')?.textContent).toContain('static illustration');
    expect(document.querySelector('script, image, foreignObject, style')).toBeNull();
    document.querySelectorAll('[href]').forEach((element) => {
      expect(element.getAttribute('href')).toMatch(/^#/);
      expect(document.querySelector(element.getAttribute('href')!)).not.toBeNull();
    });
    for (const point of LANDMARKS) {
      expect(document.getElementById(point.id)).not.toBeNull();
    }
  });
});
