import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PARK_LAKESIDE, PARK_PATHS } from '../content/park';
import { buildCityScene, type CityScene } from './scene';

const worlds: CityScene[] = [];
function createScene() {
  const world = buildCityScene();
  world.scene.updateMatrixWorld(true);
  worlds.push(world);
  return world;
}
function namedMesh(scene: THREE.Scene, name: string) {
  const object = scene.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`Missing park mesh: ${name}.`);
  return object;
}
function topAt(mesh: THREE.Mesh, x: number, z: number) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(mesh)[0];
  if (!hit) throw new Error(`No surface on ${mesh.name} at ${x}, ${z}.`);
  return hit.point.y;
}
afterEach(() => worlds.splice(0).forEach((world) => world.dispose()));

describe('lakeside scenery refinement', () => {
  it('has a continuous, symmetric bridge with level landings and no raised slab steps', () => {
    const { scene } = createScene();
    const { bridge } = PARK_LAKESIDE;
    const deck = namedMesh(scene, 'Lake bridge continuous deck');
    const rails = namedMesh(scene, 'Lake bridge curved railings');
    const bounds = new THREE.Box3().setFromObject(deck);
    expect(bounds.min.x).toBeCloseTo(bridge.startX);
    expect(bounds.max.x).toBeCloseTo(bridge.endX);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(bridge.width);
    for (let index = 0; index <= 100; index++) {
      const t = 0.0001 + index / 100 * 0.9998;
      const x = THREE.MathUtils.lerp(bridge.startX, bridge.endX, t);
      const height = topAt(deck, x, bridge.z);
      expect(height).toBeCloseTo(bridge.landingY + Math.sin(t * Math.PI) ** 2 * bridge.rise, 2);
      expect(height).toBeCloseTo(topAt(deck, bridge.startX + bridge.endX - x, bridge.z), 5);
      for (const side of [-1, 1]) {
        expect(topAt(rails, x, bridge.z + side * 1.32) - height).toBeCloseTo(1.12, 5);
      }
    }
    for (const x of [bridge.startX + 0.01, bridge.endX - 0.01]) {
      expect(topAt(deck, x, bridge.z)).toBeCloseTo(bridge.landingY, 3);
    }
  });

  it('ends the bridge before the fountain and keeps new solid geometry outside every path', () => {
    const { scene } = createScene();
    const deck = new THREE.Box3().setFromObject(namedMesh(scene, 'Lake bridge continuous deck'));
    const fountain = new THREE.Box3().setFromObject(namedMesh(scene, 'Lakeside fountain'));
    expect(fountain.min.x - deck.max.x).toBeGreaterThan(3);
    const solids = ['Lake bridge continuous deck', 'Lake bridge curved railings', 'Lakeside fountain']
      .map((name) => ({ name, bounds: new THREE.Box3().setFromObject(namedMesh(scene, name)) }));
    for (const path of PARK_PATHS) for (const point of path.curve.getPoints(1024)) {
      for (const { name, bounds } of solids) {
        const nearest = bounds.clampPoint(point.clone().setY(0.6), new THREE.Vector3());
        expect(Math.hypot(nearest.x - point.x, nearest.z - point.z), `${name}: ${path.id}`)
          .toBeGreaterThan(path.width / 2 + 0.05);
      }
    }
  });

  it('models a hollow fountain basin with raised coping instead of stacked solid disks', () => {
    const { scene } = createScene();
    const fountain = namedMesh(scene, 'Lakeside fountain');
    const { x, z } = PARK_LAKESIDE.fountain;
    expect(topAt(fountain, x + 1.6, z)).toBeCloseTo(0.2);
    expect(topAt(fountain, x + 2.3, z)).toBeCloseTo(0.68);
    expect(topAt(fountain, x + 0.95, z)).toBeCloseTo(2.06);
    expect(new THREE.Box3().setFromObject(fountain).getSize(new THREE.Vector3()).x)
      .toBeCloseTo(PARK_LAKESIDE.fountain.radius * 2);
  });

  it('gives both seating pergolas four supports and a complete overhead slatted roof', () => {
    const { scene } = createScene();
    const matrix = new THREE.Matrix4();
    const center = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    for (const pergola of PARK_LAKESIDE.pergolas) {
      let posts = 0;
      let slats = 0;
      scene.traverseVisible((object) => {
        if (!(object instanceof THREE.InstancedMesh) || object.geometry.type !== 'BoxGeometry' ||
          !(object.material instanceof THREE.MeshStandardMaterial) || object.material.color.getHexString() !== '9c7952') return;
        for (let index = 0; index < object.count; index++) {
          object.getMatrixAt(index, matrix);
          matrix.decompose(center, rotation, scale);
          if (Math.abs(center.x - pergola.x) > 1.5 || Math.abs(center.z - pergola.z) > 1.5) continue;
          if (Math.abs(scale.y - 2.62) < 0.001) posts++;
          if (Math.abs(scale.x - 3.5) < 0.001 && center.y > 3) {
            expect(center.y - scale.y / 2).toBeGreaterThan(2.8);
            slats++;
          }
        }
      });
      expect(posts).toBe(4);
      expect(slats).toBe(9);
    }
  });

  it('adds shallow-to-deep pond color without changing the lawn palette or water weather behavior', () => {
    const { scene, weatherSurface, snowMeshes } = createScene();
    const pond = namedMesh(scene, 'Reed pond');
    const colors = pond.geometry.getAttribute('color');
    const normals = pond.geometry.getAttribute('normal');
    expect(colors.count).toBe(pond.geometry.getAttribute('position').count);
    expect(colors.getX(0)).toBeLessThan(colors.getX(colors.count - 1));
    for (let index = 0; index < normals.count; index++) expect(normals.getY(index)).toBeCloseTo(1);
    expect(weatherSurface.heightAt(-20, 28)).toBeCloseTo(0.012);
    expect(weatherSurface.snowRetentionAt(-20, 28)).toBe(0);
    expect(snowMeshes).not.toContain(pond);
    const deck = namedMesh(scene, 'Lake bridge continuous deck');
    expect(snowMeshes).toContain(deck);
    expect(weatherSurface.snowRetentionAt(-20, 31.5)).toBe(1);
    expect(weatherSurface.heightAt(-20, 31.5)).toBeGreaterThan(1);
    const lawn = namedMesh(scene, 'Park lawn');
    const meadow = namedMesh(scene, 'Great lawn');
    expect(lawn.material).toBe(meadow.material);
    for (const [surface, color] of [[lawn, '#849b70'], [meadow, '#a0b782']] as const) {
      expect(new THREE.Color().fromBufferAttribute(surface.geometry.getAttribute('color'), 0).getHexString())
        .toBe(new THREE.Color(color).getHexString());
    }
  });
});
