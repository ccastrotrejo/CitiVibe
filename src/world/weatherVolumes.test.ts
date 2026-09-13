import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from './scene';
import { EnvironmentController } from './environment';
import { EnvironmentVisual } from './environmentVisual';
import { GROUND_LEVEL, GROUND_PUDDLES } from './groundWater';

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
    expect(art.snowMeshes).toContain(art.scene.getObjectByName('Garden loop road'));
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
      expect(shader.vertexShader).toContain('instanceMatrix * snowVertex');
      expect(shader.fragmentShader).toContain('if (max(snowCap, snowEdge) < 0.1) discard');
      expect(shader.uniforms.weatherSnowDepth.value).toBeCloseTo(0.15);
      environment.physics.surface.snowSweMm = 3;
      draw();
      expect(shader.uniforms.weatherSnowDepth.value).toBeCloseTo(0.075);
      environment.physics.surface.snowSweMm = 6;
      draw();
    }
    visual.dispose();
    art.dispose();
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
      const hit = ray.intersectObject(bed)[0];
      expect(hit.point.y).toBeCloseTo(GROUND_LEVEL - basin.maxDepth, 5);
      expect(art.weatherSurface.heightAt(basin.x, basin.z)).toBeLessThan(GROUND_LEVEL - 0.02);
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
