import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { prepareVaporMaterial, SteamVisual, STEAM_PUFFS_PER_SOURCE } from './steamVisual';

function fixture() {
  const geometry = new THREE.SphereGeometry(1, 8, 5);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false });
  prepareVaporMaterial(material, geometry);
  const sources = [{ id: 'test-stack', x: 10, z: -20, baseY: 0.1, height: 3 }];
  const visual = new SteamVisual(sources, geometry, material);
  return { geometry, material, sources, visual };
}

describe('bounded street steam', () => {
  it('shares the cloud material, emits only above its stack and stays bounded in wind', () => {
    const { geometry, material, visual } = fixture();
    visual.update(7, { x: 7, z: -3 }, -4, false, false);
    expect(visual.mesh.material).toBe(material);
    expect(visual.mesh.count).toBe(STEAM_PUFFS_PER_SOURCE);
    expect(visual.mesh.visible).toBe(true);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (let i = 0; i < visual.mesh.count; i++) {
      visual.mesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(position.y).toBeGreaterThan(3.1);
      expect(position.y).toBeLessThan(5.6);
      expect(position.x).toBeGreaterThanOrEqual(10);
      expect(position.x).toBeLessThan(10.6);
      expect(position.z).toBeLessThanOrEqual(-20);
      const opacity = visual.mesh.geometry.getAttribute('vaporOpacity').getX(i) * material.opacity;
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(0.106);
    }
    visual.dispose(); material.dispose(); geometry.dispose();
  });

  it('reconstructs identical positions from retained time and never advances on redraw', () => {
    const { geometry, material, sources, visual } = fixture();
    const wind = { x: 2, z: 1 };
    visual.update(13.3, wind, 12, false, false);
    const held = visual.mesh.instanceMatrix.array.slice();
    const uploads = visual.mesh.instanceMatrix.version;
    visual.update(13.3, wind, 12, false, false);
    expect(visual.mesh.instanceMatrix.array).toEqual(held);
    expect(visual.mesh.instanceMatrix.version).toBe(uploads);
    visual.dispose();
    const restored = new SteamVisual(sources, geometry, material);
    restored.update(13.3, wind, 12, false, false);
    expect(restored.mesh.instanceMatrix.array).toEqual(held);
    restored.update(13.6, wind, 12, false, false);
    expect(restored.mesh.instanceMatrix.array).not.toEqual(held);
    restored.dispose(); material.dispose(); geometry.dispose();
  });

  it('holds a reduced-motion still, removes only the plume in lightweight mode and owns no material', () => {
    const { geometry, material, visual } = fixture();
    visual.update(0, { x: 0, z: 0 }, 10, true, false);
    const still = visual.mesh.instanceMatrix.array.slice();
    visual.update(90, { x: 8, z: -6 }, 10, true, false);
    expect(visual.mesh.instanceMatrix.array).toEqual(still);
    visual.update(90, { x: 8, z: -6 }, 10, true, true);
    expect(visual.mesh.visible).toBe(false);
    const owned = vi.spyOn(visual.mesh.geometry, 'dispose');
    const borrowed = vi.spyOn(material, 'dispose');
    visual.dispose(); visual.dispose();
    expect(owned).toHaveBeenCalledTimes(1);
    expect(borrowed).not.toHaveBeenCalled();
    material.dispose(); geometry.dispose();
  });
});
