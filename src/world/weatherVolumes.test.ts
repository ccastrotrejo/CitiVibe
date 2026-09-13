import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from './scene';
import { EnvironmentController } from './environment';
import { EnvironmentVisual } from './environmentVisual';
import { GROUND_LEVEL, GROUND_PUDDLES } from './groundWater';
import { PARK_PATHS } from '../content/park';
import { SnowVolumeVisual } from './snowVolumeVisual';
import { CAMERA_PROJECTION } from '../content/city';

const DATE = new Date(2026, 8, 13, 15);
const OPTIONS = { reducedMotion: false, lightweight: false };

function setup() {
  const art = buildCityScene();
  const environment = new EnvironmentController();
  environment.physics.bindSurface(art.weatherSurface.heightAt, art.weatherSurface.snowRetentionAt);
  const visual = new EnvironmentVisual(art.scene, art.weatherSurface, art.foliage, art.snowMeshes);
  return { art, environment, visual, draw: () => visual.update(environment.frame, OPTIONS, environment.physics) };
}

describe('snow volume and rain-fed depression rendering', () => {
  it('targets roofs, streets and canopies with displaced color and shadow geometry, not only a tint', () => {
    const { art, environment, visual, draw } = setup();
    const volume = art.scene.getObjectByName('Accumulated snow volume')!;
    expect(art.snowMeshes.some((mesh) => !Array.isArray(mesh.material) && mesh.material.userData.snowRetention === 0.45)).toBe(true);
    expect(art.weatherSurface.snowRetentionAt(-102, -115)).toBeCloseTo(0.45);
    expect(art.snowMeshes).toContain(art.scene.getObjectByName('Great lawn'));
    expect(art.snowMeshes).not.toContain(art.scene.getObjectByName('Park reservoir'));
    expect(art.snowMeshes).toContain(art.foliage[0].mesh);
    expect(volume.children).toHaveLength(art.snowMeshes.length);
    expect(volume.visible).toBe(false);
    environment.physics.surface.snowSweMm = 6;
    environment.physics.revision++;
    draw();
    expect(volume.visible).toBe(true);
    const cap = volume.children[0];
    if (!(cap instanceof THREE.Mesh) || !(cap.material instanceof THREE.MeshStandardMaterial) ||
      !(cap.customDepthMaterial instanceof THREE.MeshDepthMaterial)) throw new Error('Missing snow shell materials.');
    expect(cap.geometry).toBe(art.snowMeshes[0].geometry);
    for (const [material, library] of [[cap.material, THREE.ShaderLib.standard], [cap.customDepthMaterial, THREE.ShaderLib.depth]] as const) {
      const shader = {
        uniforms: THREE.UniformsUtils.clone(library.uniforms), vertexShader: library.vertexShader, fragmentShader: library.fragmentShader,
      };
      material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
      expect(shader.vertexShader).toContain('snowWorld.y += weatherSnowDepth * snowRetention * snowExposure');
      expect(shader.vertexShader).toContain('snowWorld.xyz += snowWorldNormal * snowSurfaceGap');
      expect(shader.vertexShader).toContain('instanceMatrix * snowVertex');
      expect(shader.fragmentShader).toContain('if (max(snowCap, snowEdge) < 0.1) discard');
      expect(shader.uniforms.weatherSnowDepth.value).toBeCloseTo(0.15);
      expect(shader.uniforms.snowSurfaceGap.value).toBe(0.002);
      environment.physics.surface.snowSweMm = 3;
      draw();
      expect(shader.uniforms.weatherSnowDepth.value).toBeCloseTo(0.075);
      environment.physics.surface.snowSweMm = 6;
      draw();
    }
    visual.dispose();
    art.dispose();
  });

  it('separates facade snow from its source plane in color and shadow passes at supported camera angles', () => {
    const sourceMaterial = new THREE.MeshStandardMaterial();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.DataTexture(new Float32Array([8]), 1, 1, THREE.RedFormat, THREE.FloatType);
    const source = new THREE.Mesh(geometry, sourceMaterial);
    const volume = new SnowVolumeVisual([source], texture);
    try {
      const shell = volume.group.children[0];
      if (!(shell instanceof THREE.Mesh) || !(shell.material instanceof THREE.MeshStandardMaterial) || !shell.customDepthMaterial) {
        throw new Error('Missing snow shell materials.');
      }
      const gaps = [];
      for (const [material, library] of [[shell.material, THREE.ShaderLib.standard], [shell.customDepthMaterial, THREE.ShaderLib.depth]] as const) {
        const shader = {
          uniforms: THREE.UniformsUtils.clone(library.uniforms), vertexShader: library.vertexShader, fragmentShader: library.fragmentShader,
        };
        material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
        expect(shader.vertexShader).toContain('snowWorld.xyz += snowWorldNormal * snowSurfaceGap');
        gaps.push(shader.uniforms.snowSurfaceGap);
      }
      expect(gaps[0]).toBe(gaps[1]);
      const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, CAMERA_PROJECTION.far);
      const point = new THREE.Vector3(4, 4, 0);
      for (const pitch of [CAMERA_PROJECTION.minPitch, CAMERA_PROJECTION.maxPitch]) {
        for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
          const radius = CAMERA_PROJECTION.distance * Math.cos(pitch);
          camera.position.set(Math.sin(yaw) * radius, CAMERA_PROJECTION.distance * Math.sin(pitch), Math.cos(yaw) * radius);
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
          const normal = Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw))
            ? new THREE.Vector3(Math.sign(Math.sin(yaw)), 0, 0)
            : new THREE.Vector3(0, 0, Math.sign(Math.cos(yaw)));
          const shellPoint = point.clone().addScaledVector(normal, gaps[0].value);
          // An upward-only skirt stays in the same wall plane; the normal offset creates a depth margin.
          expect(shellPoint.clone().sub(point).dot(normal)).toBeCloseTo(0.002);
          expect(point.clone().project(camera).z - shellPoint.project(camera).z).toBeGreaterThan(2 / 2 ** 24);
        }
      }
      expect(source.position).toEqual(new THREE.Vector3());
    } finally {
      volume.dispose();
      sourceMaterial.dispose();
      geometry.dispose();
      texture.dispose();
    }
  });

  it('uses opaque depth ordering after snow settles and restores its fade without repeated shader invalidation', () => {
    const { art, environment, visual, draw } = setup();
    try {
      const volume = art.scene.getObjectByName('Accumulated snow volume')!;
      const shell = volume.children[0];
      if (!(shell instanceof THREE.Mesh) || !(shell.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing snow shell.');
      environment.physics.surface.snowSweMm = 0.1;
      draw();
      expect(shell.material.transparent).toBe(true);
      expect(shell.material.opacity).toBeGreaterThan(0);
      expect(shell.material.opacity).toBeLessThan(1);
      environment.physics.surface.snowSweMm = 6;
      draw();
      expect(shell.material.transparent).toBe(false);
      expect(shell.material.depthWrite).toBe(true);
      expect(shell.material.opacity).toBe(1);
      const settledVersion = shell.material.version;
      draw();
      expect(shell.material.version).toBe(settledVersion);
      environment.physics.surface.snowSweMm = 0.1;
      draw();
      expect(shell.material.transparent).toBe(true);
      expect(shell.material.version).toBe(settledVersion + 1);
      expect(environment.physics.surface.snowSweMm).toBe(0.1);
    } finally {
      visual.dispose();
      art.dispose();
    }
  });

  it('does not draw zero-retention, zero-thickness shells over bare geometry', () => {
    const material = new THREE.MeshStandardMaterial();
    material.userData.snowRetention = 0;
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.DataTexture();
    const volume = new SnowVolumeVisual([new THREE.Mesh(geometry, material)], texture);
    expect(volume.group.children).toHaveLength(0);
    volume.dispose();
    material.dispose();
    geometry.dispose();
    texture.dispose();
  });

  it('keeps snow attached to swaying canopy instances, restores poses, and releases only owned resources', () => {
    const { art, environment, visual, draw } = setup();
    const source = art.foliage[0].mesh;
    const volume = art.scene.getObjectByName('Accumulated snow volume')!;
    const cap = volume.children[art.snowMeshes.indexOf(source)];
    if (!(cap instanceof THREE.InstancedMesh)) throw new Error('Missing instanced canopy snow.');
    const geometryDispose = vi.spyOn(source.geometry, 'dispose');
    const instanceDispose = vi.spyOn(cap, 'dispose');
    const material = cap.material;
    if (Array.isArray(material) || !cap.customDepthMaterial) throw new Error('Missing snow materials.');
    const materialDispose = vi.spyOn(material, 'dispose');
    const shadowDispose = vi.spyOn(cap.customDepthMaterial, 'dispose');
    environment.setWeather('windy', true);
    environment.physics.surface.snowSweMm = 8;
    environment.step(0.1, DATE);
    draw();
    expect(cap.instanceMatrix.array).toEqual(source.instanceMatrix.array);
    expect(cap.instanceMatrix.array).not.toBe(source.instanceMatrix.array);
    const uploaded = cap.instanceMatrix.version;
    draw();
    expect(cap.instanceMatrix.version).toBe(uploaded);
    visual.update(environment.frame, { ...OPTIONS, reducedMotion: true }, environment.physics);
    expect(cap.instanceMatrix.array).toEqual(source.instanceMatrix.array);
    visual.dispose();
    visual.dispose();
    expect(instanceDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(shadowDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    art.dispose();
  });

  it('cuts shallow ground depressions instead of floating puddle decals over intact terrain', () => {
    const art = buildCityScene();
    const ground = art.scene.getObjectByName('Miniature ground')!;
    for (const basin of GROUND_PUDDLES) {
      const bed = art.scene.getObjectByName(`${basin.id} rain depression`)!;
      const ray = new THREE.Raycaster(new THREE.Vector3(basin.x, 10, basin.z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(ground)).toHaveLength(0);
      expect(ray.intersectObject(art.scene.getObjectByName('Park lawn')!)).toHaveLength(0);
      expect(ray.intersectObject(art.scene.getObjectByName('Great lawn')!)).toHaveLength(0);
      const hit = ray.intersectObject(bed)[0];
      expect(hit.point.y).toBeCloseTo(GROUND_LEVEL - basin.maxDepth, 5);
      expect(art.weatherSurface.heightAt(basin.x, basin.z)).toBeLessThan(GROUND_LEVEL - 0.02);
      for (const path of PARK_PATHS) {
        for (const point of path.curve.getPoints(256)) {
          expect(Math.hypot(point.x - basin.x, point.z - basin.z))
            .toBeGreaterThan(Math.max(basin.radiusX, basin.radiusZ) + path.width / 2);
        }
      }
    }
    art.dispose();
  });

  it('renders rising and spreading retained water, preserves it on redraw/recovery and suppresses ripples with reduced motion', () => {
    const { art, environment, visual, draw } = setup();
    environment.setWeather('rain', true);
    environment.setRainIntensity(30);
    for (let tick = 0; tick < 600; tick++) environment.step(0.1, DATE);
    draw();
    const pools = GROUND_PUDDLES.map((basin, index) => {
      const mesh = art.scene.getObjectByName(`${basin.id} rain pool`)!;
      const state = environment.physics.groundWater.states[index];
      expect(mesh.visible).toBe(true);
      expect(state.depth).toBeGreaterThan(0.04);
      expect(mesh.position.y).toBeCloseTo(GROUND_LEVEL - basin.maxDepth + state.depth + 0.002);
      expect(mesh.scale.x).toBeCloseTo(basin.radiusX * state.radiusScale);
      return { position: mesh.position.clone(), scale: mesh.scale.clone() };
    });
    const retained = structuredClone(environment.physics.groundWater.states);
    draw();
    expect(environment.physics.groundWater.states).toEqual(retained);
    visual.update(environment.frame, { ...OPTIONS, reducedMotion: true }, environment.physics);
    expect(art.scene.getObjectByName('Ground pool ripples')!.visible).toBe(false);
    visual.dispose();
    const restored = new EnvironmentVisual(art.scene, art.weatherSurface, art.foliage, art.snowMeshes);
    restored.update(environment.frame, OPTIONS, environment.physics);
    GROUND_PUDDLES.forEach((basin, index) => {
      const mesh = art.scene.getObjectByName(`${basin.id} rain pool`)!;
      expect(mesh.position).toEqual(pools[index].position);
      expect(mesh.scale).toEqual(pools[index].scale);
    });
    environment.setRainIntensity(0);
    restored.update(environment.frame, OPTIONS, environment.physics);
    expect(art.scene.getObjectByName('Environment rain')!.visible).toBe(false);
    expect(art.scene.getObjectByName('Rain impacts')!.visible).toBe(false);
    expect(art.scene.getObjectByName('Ground pool ripples')!.visible).toBe(false);
    expect(art.scene.getObjectByName(`${GROUND_PUDDLES[0].id} rain pool`)!.visible).toBe(true);
    restored.dispose();
    art.dispose();
  });
});
