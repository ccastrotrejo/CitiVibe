import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnvironmentController } from './environment';
import { EnvironmentVisual } from './environmentVisual';
import { buildCityScene } from './scene';
import { SurfaceVisual } from './surfaceVisual';
import { WeatherSurface } from './weatherSurface';

const OPTIONS = { reducedMotion: false, lightweight: false };
const DATE = new Date(2026, 8, 12, 15);

function fixture() {
  const scene = new THREE.Scene();
  const background = new THREE.Color('#ddd8cc');
  scene.background = background;
  const hemisphere = new THREE.HemisphereLight('#fff1d8', '#a99f87', 2.4);
  const sun = new THREE.DirectionalLight('#fff1d6', 3);
  const geometry = new THREE.BoxGeometry();
  const windows = new THREE.MeshStandardMaterial({ emissive: '#010203', emissiveIntensity: 0.2 });
  windows.userData.window = true;
  const wall = new THREE.MeshStandardMaterial({ emissive: '#040506', emissiveIntensity: 0.4 });
  const actor = new THREE.Mesh(geometry, wall);
  actor.name = 'Unrelated actor';
  actor.position.set(3, 4, 5);
  scene.add(hemisphere, sun, actor, new THREE.Mesh(geometry, [wall, windows]), new THREE.Mesh(geometry, windows));
  const visual = new EnvironmentVisual(scene);
  const environment = new EnvironmentController();
  const rain = scene.getObjectByName('Environment rain') as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  const snow = scene.getObjectByName('Environment snow') as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  return {
    scene, hemisphere, sun, geometry, windows, wall, actor, visual, environment, rain, snow, background,
    draw(options = OPTIONS) { visual.update(environment.frame, options, environment.physics); },
    advance(seconds: number, reduced = false) {
      for (let tick = 0; tick < seconds * 30; tick++) environment.step(1 / 30, DATE, !reduced);
    },
    dispose() { visual.dispose(); geometry.dispose(); windows.dispose(); wall.dispose(); },
  };
}

describe('bounded environment GPU adapter', () => {
  it('reuses lights and modifies only tagged window emissive values', () => {
    const world = fixture();
    const actorPosition = world.actor.position.clone();
    const wallEmissive = world.wall.emissive.clone();
    world.environment.setTime('night', DATE);
    world.environment.setWeather('mist', true);
    world.draw();
    expect(world.scene.children.filter((object) => object instanceof THREE.Light)).toHaveLength(2);
    expect(world.sun.intensity).toBe(world.environment.frame.sunIntensity);
    expect(world.hemisphere.intensity).toBe(world.environment.frame.ambientIntensity);
    expect(world.windows.emissiveIntensity).toBe(world.environment.frame.glow);
    expect(world.wall.emissive).toEqual(wallEmissive);
    expect(world.actor.position).toEqual(actorPosition);
    expect((world.scene.fog as THREE.FogExp2).density).toBe(0.016);
    world.dispose();
  });

  it('draws terminal-velocity rain streaks and snow with fixed 600/160 and 420/120 caps', () => {
    const world = fixture();
    const group = world.scene.getObjectByName('Environment effects')!;
    const clouds = group.children.filter((object) => object.name === 'Weather cloud') as THREE.Mesh[];
    expect(clouds).toHaveLength(6);
    expect(new Set(clouds.map((cloud) => cloud.geometry)).size).toBe(1);
    expect(new Set(clouds.map((cloud) => cloud.material)).size).toBe(1);
    const rainAttribute = world.rain.geometry.getAttribute('position');
    const snowAttribute = world.snow.geometry.getAttribute('position');
    world.environment.setWeather('rain', true);
    world.environment.setRainIntensity(30);
    world.advance(1);
    for (let index = 0; index < 20; index++) {
      const lightweight = index % 2 === 0;
      world.draw({ ...OPTIONS, lightweight });
      expect(world.rain.geometry.drawRange.count).toBe((lightweight ? 160 : 600) * 2);
      expect(world.snow.geometry.drawRange.count).toBe(lightweight ? 120 : 420);
      expect(world.rain.geometry.getAttribute('position')).toBe(rainAttribute);
      expect(world.snow.geometry.getAttribute('position')).toBe(snowAttribute);
    }
    expect(rainAttribute.getY(1) - rainAttribute.getY(0)).toBeCloseTo(world.environment.physics.rain.velocities[1] * 0.055, 4);
    expect(rainAttribute.getX(1)).toBeLessThan(rainAttribute.getX(0));
    expect(world.rain.visible).toBe(true);
    expect(world.snow.visible).toBe(false);
    world.environment.setRainIntensity(1);
    world.draw();
    expect(world.rain.geometry.drawRange.count).toBeLessThan(600 * 2);
    world.environment.setWeather('snow', true);
    world.advance(1);
    world.draw();
    expect(world.rain.visible).toBe(false);
    expect(world.snow.visible).toBe(true);
    expect(snowAttribute.array).toEqual(world.environment.physics.snow.positions);
    expect(world.snow.material.map).toBeInstanceOf(THREE.DataTexture);
    world.dispose();
  });

  it('rebuilds the same precipitation and clouds from retained CPU state and never steps on draw', () => {
    const world = fixture();
    world.environment.setWeather('rain', true);
    world.advance(13);
    world.draw();
    const before = world.rain.geometry.getAttribute('position').array.slice();
    const uploads = (world.rain.geometry.getAttribute('position') as THREE.BufferAttribute).version;
    const revision = world.environment.physics.revision;
    const cloudPositions = world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position.toArray());
    world.draw();
    expect((world.rain.geometry.getAttribute('position') as THREE.BufferAttribute).version).toBe(uploads);
    expect(world.environment.physics.revision).toBe(revision);
    expect(world.rain.geometry.getAttribute('position').array).toEqual(before);
    world.visual.dispose();
    const restored = new EnvironmentVisual(world.scene);
    restored.update(world.environment.frame, OPTIONS, world.environment.physics);
    const rain = world.scene.getObjectByName('Environment rain') as THREE.LineSegments;
    expect(rain.geometry.getAttribute('position').array).toEqual(before);
    expect(world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position.toArray())).toEqual(cloudPositions);
    restored.dispose();
    world.dispose();
  });

  it('retains a stationary precipitation cue but suppresses decorative animation under reduced motion', () => {
    const world = fixture();
    world.environment.setWeather('snow', true);
    const options = { reducedMotion: true, lightweight: true };
    world.draw(options);
    const held = world.snow.geometry.getAttribute('position').array.slice();
    const clouds = world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position.clone());
    world.advance(10, true);
    world.draw(options);
    expect(world.snow.geometry.getAttribute('position').array).toEqual(held);
    expect(world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position)).toEqual(clouds);
    expect(world.snow.visible).toBe(true);
    expect(world.scene.getObjectByName('Rain impacts')!.visible).toBe(false);
    expect(world.scene.getObjectByName('Garden ripples')!.visible).toBe(false);
    expect(world.environment.physics.surface.snowSweMm).toBeGreaterThan(0);
    world.dispose();
  });

  it('restores borrowed state and idempotently disposes every owned GPU resource', () => {
    const world = fixture();
    const windowColor = world.windows.emissive.clone();
    const borrowed = [vi.spyOn(world.geometry, 'dispose'), vi.spyOn(world.windows, 'dispose'), vi.spyOn(world.sun, 'dispose')];
    const owned = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh>();
    world.scene.getObjectByName('Environment effects')!.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
        owned.add(object.geometry);
        const material = object.material as THREE.Material;
        owned.add(material);
        if (material instanceof THREE.PointsMaterial && material.map) owned.add(material.map);
        if (object instanceof THREE.InstancedMesh) owned.add(object);
      }
    });
    const disposals = [...owned].map((resource) => vi.spyOn(resource, 'dispose'));
    world.environment.setTime('night', DATE);
    world.draw();
    world.visual.dispose();
    world.visual.dispose();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    borrowed.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    expect(world.scene.background).toBe(world.background);
    expect(world.scene.fog).toBeNull();
    expect(world.sun.intensity).toBe(3);
    expect(world.windows.emissive).toEqual(windowColor);
    expect(world.scene.getObjectByName('Environment effects')).toBeUndefined();
    world.draw();
    expect(world.scene.background).toBe(world.background);
    world.dispose();
  });

  it('bends only marked vegetation, retains rooftop collisions and restores all rest poses', () => {
    const art = buildCityScene();
    const environment = new EnvironmentController();
    environment.physics.bindSurface(art.weatherSurface.heightAt);
    expect(art.weatherSurface.heightAt(-3.8, -10)).toBeCloseTo(10.98, 2);
    expect(art.weatherSurface.heightAt(-4, -3)).toBeGreaterThan(5);
    const original = art.foliage.map(({ mesh }) => mesh.instanceMatrix.array.slice());
    const visual = new EnvironmentVisual(art.scene, art.weatherSurface, art.foliage);
    environment.setWeather('windy', true);
    environment.step(0.1, DATE);
    visual.update(environment.frame, OPTIONS, environment.physics);
    expect(art.foliage[0].mesh.instanceMatrix.array).not.toEqual(original[0]);
    visual.update(environment.frame, OPTIONS, environment.physics);
    const held = art.foliage[0].mesh.instanceMatrix.array.slice();
    visual.update(environment.frame, OPTIONS, environment.physics);
    expect(art.foliage[0].mesh.instanceMatrix.array).toEqual(held);
    visual.update(environment.frame, { ...OPTIONS, reducedMotion: true }, environment.physics);
    art.foliage.forEach(({ mesh }, index) => expect(mesh.instanceMatrix.array).toEqual(original[index]));
    visual.dispose();
    art.foliage.forEach(({ mesh }, index) => expect(mesh.instanceMatrix.array).toEqual(original[index]));
    art.dispose();
  });

  it('shares exposure and accumulation uniforms without altering untagged material shaders', () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    material.userData.weatherSurface = true;
    const original = material.onBeforeCompile;
    const key = material.customProgramCacheKey;
    scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    const visual = new SurfaceVisual(scene, new WeatherSurface());
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('instanceMatrix * weatherPosition');
    expect(shader.fragmentShader).toContain('weatherTop - 0.65');
    expect(shader.fragmentShader).toContain('weatherNormal.y');
    const environment = new EnvironmentController();
    environment.physics.surface.snowSweMm = 1.2;
    environment.physics.surface.waterMm = 0.3;
    visual.update(environment.physics);
    expect(shader.uniforms.weatherSnow.value).toBe(1);
    expect(shader.uniforms.weatherWetness.value).toBe(0.5);
    const texture = shader.uniforms.weatherHeight.value as THREE.DataTexture;
    const dispose = vi.spyOn(texture, 'dispose');
    visual.dispose();
    visual.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(material.onBeforeCompile).toBe(original);
    expect(material.customProgramCacheKey).toBe(key);
    geometry.dispose();
    material.dispose();
  });
});
