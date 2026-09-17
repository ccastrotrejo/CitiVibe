import * as THREE from 'three';
import type { WeatherPhysics } from './weatherPhysics';
import { WEATHER_EXTENT } from './weatherPhysics';
import { CIVIC_MAINTENANCE_GLSL } from './civicMaintenance';

/** Displaced shells share source geometry, but own their materials and instance buffers. */
export class SnowVolumeVisual {
  readonly group = new THREE.Group();
  private readonly depth = { value: 0 };
  private readonly separation = { value: 0.002 };
  private readonly layers: { source: THREE.Mesh; mesh: THREE.Mesh; version: number }[] = [];
  private readonly materials = new Map<number, { color: THREE.MeshStandardMaterial; shadow: THREE.MeshDepthMaterial }>();
  private disposed = false;

  constructor(targets: readonly THREE.Mesh[], texture: THREE.DataTexture) {
    this.group.name = 'Accumulated snow volume';
    for (const source of targets) {
      if (Array.isArray(source.material)) throw new Error('Snow volume requires single-material static batches.');
      const retention: unknown = source.material.userData.snowRetention ?? 1;
      if (typeof retention !== 'number' || !Number.isFinite(retention) || retention < 0 || retention > 1) {
        throw new Error('Snow surface retention must be between zero and one.');
      }
      if (retention === 0) continue;
      let material = this.materials.get(retention);
      if (!material) {
        const color = new THREE.MeshStandardMaterial({ color: 0xe8eff2, roughness: 0.96, transparent: true });
        const shadow = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        const compile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
          shader.uniforms.weatherSnowDepth = this.depth;
          shader.uniforms.snowSurfaceGap = this.separation;
          shader.uniforms.weatherHeight = { value: texture };
          shader.uniforms.snowRetention = { value: retention };
          shader.vertexShader = `
            uniform float weatherSnowDepth;
            uniform sampler2D weatherHeight;
            uniform float snowRetention;
            uniform float snowSurfaceGap;
            varying vec3 vSnowBase;
            varying float vSnowUp;
            ${shader.vertexShader}`.replace('#include <project_vertex>', `
              vec4 snowVertex = vec4(transformed, 1.0);
              mat3 snowNormalMatrix = mat3(modelMatrix);
              #ifdef USE_INSTANCING
                snowVertex = instanceMatrix * snowVertex;
                snowNormalMatrix = snowNormalMatrix * mat3(instanceMatrix);
              #endif
              vec3 snowNormal = normal / vec3(
                dot(snowNormalMatrix[0], snowNormalMatrix[0]),
                dot(snowNormalMatrix[1], snowNormalMatrix[1]),
                dot(snowNormalMatrix[2], snowNormalMatrix[2]));
              vec3 snowWorldNormal = normalize(snowNormalMatrix * snowNormal);
              vSnowUp = snowWorldNormal.y;
              vec4 snowWorld = modelMatrix * snowVertex;
              vSnowBase = snowWorld.xyz;
              vec2 snowUv = (snowWorld.xz + ${WEATHER_EXTENT.toFixed(1)}) / ${(WEATHER_EXTENT * 2).toFixed(1)};
              float snowTop = texture2D(weatherHeight, snowUv).r;
              float snowExposure = smoothstep(snowTop - 0.55, snowTop - 0.1, snowWorld.y);
              snowWorld.y += weatherSnowDepth * snowRetention * snowExposure;
              // Vertical displacement alone leaves facade skirts coplanar with their source walls.
              snowWorld.xyz += snowWorldNormal * snowSurfaceGap;
              vec4 mvPosition = viewMatrix * snowWorld;
              gl_Position = projectionMatrix * mvPosition;
            `).replace('#include <worldpos_vertex>', 'vec4 worldPosition = snowWorld;');
          shader.fragmentShader = `
            uniform sampler2D weatherHeight;
            uniform float snowRetention;
            varying vec3 vSnowBase;
            varying float vSnowUp;
            ${CIVIC_MAINTENANCE_GLSL}
            ${shader.fragmentShader}`.replace('#include <clipping_planes_fragment>', `
              #include <clipping_planes_fragment>
              if (civicSnowRetention(vSnowBase, snowRetention) == 0.0) discard;
              vec2 snowUv = (vSnowBase.xz + ${WEATHER_EXTENT.toFixed(1)}) / ${(WEATHER_EXTENT * 2).toFixed(1)};
              float snowTop = texture2D(weatherHeight, snowUv).r;
              float snowCap = smoothstep(0.25, 0.65, vSnowUp) * smoothstep(snowTop - 0.55, snowTop - 0.1, vSnowBase.y);
              float snowEdge = smoothstep(snowTop - 0.25, snowTop - 0.05, vSnowBase.y) *
                (1.0 - smoothstep(snowTop + 0.05, snowTop + 0.3, vSnowBase.y));
              if (max(snowCap, snowEdge) < 0.1) discard;
            `);
        };
        color.onBeforeCompile = compile;
        shadow.onBeforeCompile = compile;
        color.customProgramCacheKey = shadow.customProgramCacheKey = () => 'snow-volume-3';
        material = { color, shadow };
        this.materials.set(retention, material);
      }
      const mesh = source instanceof THREE.InstancedMesh
        ? new THREE.InstancedMesh(source.geometry, material.color, source.count)
        : new THREE.Mesh(source.geometry, material.color);
      mesh.name = `Snow depth: ${source.name || 'district surface'}`;
      mesh.customDepthMaterial = material.shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.layers.push({ source, mesh, version: -1 });
    }
    this.group.visible = false;
  }

  update(physics: WeatherPhysics): void {
    if (this.disposed) return;
    this.depth.value = physics.snowDepth;
    this.group.visible = physics.snowDepth > 0.0005;
    if (!this.group.visible) return;
    const opacity = Math.min(1, physics.snowCover * 1.5);
    for (const { color } of this.materials.values()) {
      color.opacity = opacity;
      const transparent = opacity < 1;
      if (color.transparent !== transparent) {
        color.transparent = transparent;
        color.needsUpdate = true;
      }
    }
    for (const layer of this.layers) {
      const { source, mesh } = layer;
      mesh.matrix.copy(source.matrixWorld);
      mesh.matrixWorldNeedsUpdate = true;
      mesh.castShadow = physics.snowCover > 0.25;
      if (source instanceof THREE.InstancedMesh && mesh instanceof THREE.InstancedMesh && layer.version !== source.instanceMatrix.version) {
        mesh.instanceMatrix.array.set(source.instanceMatrix.array);
        mesh.instanceMatrix.needsUpdate = true;
        layer.version = source.instanceMatrix.version;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const { mesh } of this.layers) if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
    for (const { color, shadow } of this.materials.values()) { color.dispose(); shadow.dispose(); }
    this.layers.length = 0;
    this.materials.clear();
    this.group.clear();
  }
}
