import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ActorInstances } from './actorInstances';

describe('neighborhood actor instancing', () => {
  it('shares one draw across actors and follows world-space limb transforms', () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const scene = new THREE.Scene();
    const actors = [new THREE.Group(), new THREE.Group()];
    const parts = actors.map((actor) => {
      const part = new THREE.Mesh(geometry, material);
      part.position.y = 1;
      actor.add(part);
      scene.add(actor);
      return part;
    });
    const batches = new ActorInstances(actors);
    scene.add(batches.group);
    const mesh = batches.group.children[0] as THREE.InstancedMesh;
    expect(batches.group.children).toHaveLength(1);
    expect(mesh.count).toBe(2);
    expect(parts.every((part) => !part.visible)).toBe(true);
    actors[1].position.set(42, 0, -26);
    actors[1].rotation.y = Math.PI / 2;
    parts[1].rotation.x = 0.2;
    batches.update();
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(1, matrix);
    matrix.elements.forEach((value, index) => expect(value).toBeCloseTo(parts[1].matrixWorld.elements[index], 5));
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeInstances = vi.spyOn(mesh, 'dispose');
    batches.dispose();
    batches.dispose();
    batches.update();
    expect(disposeInstances).toHaveBeenCalledTimes(1);
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
    expect(parts.every((part) => part.visible)).toBe(true);
    expect(batches.group.parent).toBeNull();
    geometry.dispose();
    material.dispose();
  });
});
