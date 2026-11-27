import * as THREE from 'three';

const IDENTITY = new THREE.Matrix4();
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

function zeroSubtree(node: THREE.Object3D): void {
  node.matrixWorld.copy(ZERO_MATRIX);
  const children = node.children;
  for (let i = 0; i < children.length; i++) zeroSubtree(children[i]);
}

function updateActorSubtree(node: THREE.Object3D, parentWorld: THREE.Matrix4 | null): void {
  if (node.scale.x === 0 && node.scale.y === 0 && node.scale.z === 0) {
    // Skip expensive quaternion/matrix composition across hidden optional weather/station subtrees.
    if (node.matrixWorld.elements[0] !== 0 || node.matrixWorld.elements[5] !== 0 ||
      node.matrixWorld.elements[10] !== 0 || node.matrixWorld.elements[12] !== 0 ||
      node.matrixWorld.elements[13] !== 0 || node.matrixWorld.elements[14] !== 0) {
      zeroSubtree(node);
    }
    return;
  }
  if (node.matrixAutoUpdate) node.updateMatrix();
  if (parentWorld === null) node.matrixWorld.copy(node.matrix);
  else node.matrixWorld.multiplyMatrices(parentWorld, node.matrix);
  const children = node.children;
  for (let i = 0; i < children.length; i++) updateActorSubtree(children[i], node.matrixWorld);
}

interface ActorBatch {
  mesh: THREE.InstancedMesh;
  sources: THREE.Mesh[];
}

/** Shares submissions across articulated actors without changing their simulation or rigs. */
export class ActorInstances {
  readonly group = new THREE.Group();
  /** Rig roots whose world matrices this class refreshes itself each update. */
  readonly roots: ReadonlySet<THREE.Object3D>;
  private readonly batches: ActorBatch[] = [];
  private readonly inverse = new THREE.Matrix4();
  private readonly transform = new THREE.Matrix4();
  private disposed = false;

  constructor(private readonly actors: readonly THREE.Group[]) {
    this.group.name = 'Instanced neighborhood activity';
    this.roots = new Set(actors);
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
      if (meshes.some((source) => source.userData.instanceColor instanceof THREE.Color)) {
        const white = new THREE.Color(0xffffff);
        meshes.forEach((source, index) => mesh.setColorAt(index,
          source.userData.instanceColor instanceof THREE.Color ? source.userData.instanceColor : white));
      }
      meshes.forEach((source) => { source.visible = false; });
      this.group.add(mesh);
      this.batches.push({ mesh, sources: meshes });
    }
    this.update();
  }

  update(): void {
    if (this.disposed) return;
    this.group.updateWorldMatrix(true, false);
    const identity = this.group.matrixWorld.equals(IDENTITY);
    if (!identity) this.inverse.copy(this.group.matrixWorld).invert();
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i];
      const parentWorld = actor.parent && !actor.parent.matrixWorld.equals(IDENTITY) ? actor.parent.matrixWorld : null;
      updateActorSubtree(actor, parentWorld);
    }
    for (let b = 0; b < this.batches.length; b++) {
      const { mesh, sources } = this.batches[b];
      const array = mesh.instanceMatrix.array as Float32Array;
      if (identity) {
        for (let index = 0; index < sources.length; index++) {
          array.set(sources[index].matrixWorld.elements, index * 16);
        }
      } else {
        for (let index = 0; index < sources.length; index++) {
          this.transform.multiplyMatrices(this.inverse, sources[index].matrixWorld);
          array.set(this.transform.elements, index * 16);
        }
      }
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
