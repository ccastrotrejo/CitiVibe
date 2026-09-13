import * as THREE from 'three';

interface ActorBatch {
  mesh: THREE.InstancedMesh;
  sources: THREE.Mesh[];
}

/** Shares submissions across articulated actors without changing their simulation or rigs. */
export class ActorInstances {
  readonly group = new THREE.Group();
  private readonly batches: ActorBatch[] = [];
  private readonly inverse = new THREE.Matrix4();
  private readonly transform = new THREE.Matrix4();
  private disposed = false;

  constructor(private readonly actors: readonly THREE.Group[]) {
    this.group.name = 'Instanced neighborhood activity';
    const sources = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; meshes: THREE.Mesh[] }>();
    for (const actor of actors) {
      actor.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.InstancedMesh || Array.isArray(object.material)) {
          throw new Error('Neighborhood actor parts must use single-material, non-instanced meshes.');
        }
        const key = `${object.geometry.uuid}:${object.material.uuid}`;
        let batch = sources.get(key);
        if (!batch) {
          batch = { geometry: object.geometry, material: object.material, meshes: [] };
          sources.set(key, batch);
        }
        batch.meshes.push(object);
      });
    }
    for (const { geometry, material, meshes } of sources.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, meshes.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      // The fixed population crosses the whole city; stale local bounds must never cull it.
      mesh.frustumCulled = false;
      meshes.forEach((source) => { source.visible = false; });
      this.group.add(mesh);
      this.batches.push({ mesh, sources: meshes });
    }
    this.update();
  }

  update(): void {
    if (this.disposed) return;
    this.group.updateWorldMatrix(true, false);
    this.inverse.copy(this.group.matrixWorld).invert();
    for (const actor of this.actors) actor.updateWorldMatrix(true, true);
    for (const { mesh, sources } of this.batches) {
      sources.forEach((source, index) => {
        this.transform.multiplyMatrices(this.inverse, source.matrixWorld);
        mesh.setMatrixAt(index, this.transform);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh, sources } of this.batches) {
      mesh.dispose();
      sources.forEach((source) => { source.visible = true; });
    }
    this.batches.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}
