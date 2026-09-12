import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnvironmentController } from './environment';
import { EnvironmentVisual } from './environmentVisual';

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
  const rain = scene.getObjectByName('Environment rain') as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  return {
    scene, hemisphere, sun, geometry, windows, wall, actor, visual, environment, rain, background,
    dispose() { visual.dispose(); geometry.dispose(); windows.dispose(); wall.dispose(); },
  };
}

describe('bounded environment GPU adapter', () => {
  it('reuses existing lights and changes only explicitly tagged window materials', () => {
    const world = fixture();
    const lightCount = world.scene.children.filter((object) => object instanceof THREE.Light).length;
    const actorPosition = world.actor.position.clone();
    const wallEmissive = world.wall.emissive.clone();
    world.environment.setTime('night', DATE);
    world.environment.setWeather('mist', true);
    world.visual.update(world.environment.frame, OPTIONS, 0);
    expect(world.scene.children.filter((object) => object instanceof THREE.Light)).toHaveLength(lightCount);
    expect(world.sun.intensity).toBe(world.environment.frame.sunIntensity);
    expect(world.hemisphere.intensity).toBe(world.environment.frame.ambientIntensity);
    expect(world.windows.emissiveIntensity).toBe(world.environment.frame.glow);
    expect(world.windows.emissive.r).toBe(world.environment.frame.palette.window.r);
    expect(world.wall.emissive).toEqual(wallEmissive);
    expect(world.wall.emissiveIntensity).toBe(0.4);
    expect(world.actor.position).toEqual(actorPosition);
    expect(world.scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect((world.scene.fog as THREE.FogExp2).density).toBe(0.016);
    world.dispose();
  });

  it('uses six shared clouds and no more than 600/160 rain points without reallocating on updates', () => {
    const world = fixture();
    world.environment.setWeather('rain', true);
    const group = world.scene.getObjectByName('Environment effects')!;
    const clouds = group.children.filter((object) => object instanceof THREE.Mesh);
    expect(clouds).toHaveLength(6);
    expect(new Set(clouds.map((cloud) => cloud.geometry)).size).toBe(1);
    expect(new Set(clouds.map((cloud) => cloud.material)).size).toBe(1);
    const attribute = world.rain.geometry.getAttribute('position');
    const array = attribute.array;
    for (let index = 0; index < 100; index++) {
      world.visual.update(world.environment.frame, { ...OPTIONS, lightweight: index % 2 === 0 }, index / 30);
      expect(world.rain.geometry.drawRange.count).toBe(index % 2 === 0 ? 160 : 600);
      expect(world.rain.geometry.getAttribute('position')).toBe(attribute);
      expect(attribute.array).toBe(array);
      expect(world.rain.visible).toBe(true);
    }
    expect(attribute.count).toBe(600);
    expect(world.rain.material.opacity).toBeCloseTo(0.42);
    expect(world.rain.material.size).toBeGreaterThanOrEqual(1);
    expect(world.rain.material.sizeAttenuation).toBe(false);
    world.dispose();
  });

  it('reproduces particles and cloud positions from the same simulation clock across restoration', () => {
    const first = fixture();
    const second = fixture();
    first.environment.setWeather('rain', true);
    first.environment.setTime('night', DATE);
    first.visual.update(first.environment.frame, OPTIONS, 1291.5);
    second.visual.update(first.environment.frame, OPTIONS, 1291.5);
    const before = Array.from(first.rain.geometry.getAttribute('position').array);
    expect(second.rain.geometry.getAttribute('position').array).toEqual(first.rain.geometry.getAttribute('position').array);
    const clouds = (world: ReturnType<typeof fixture>) =>
      world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position.toArray());
    expect(clouds(first)).toEqual(clouds(second));
    first.visual.dispose();
    const restored = new EnvironmentVisual(first.scene);
    restored.update(first.environment.frame, OPTIONS, 1291.5);
    const rain = first.scene.getObjectByName('Environment rain') as THREE.Points;
    expect(Array.from(rain.geometry.getAttribute('position').array)).toEqual(before);
    expect(first.environment.frame.night).toBe(1);
    restored.dispose();
    first.dispose();
    second.dispose();
  });

  it('freezes effects on repeated draw times and under reduced motion but keeps weather visible', () => {
    const world = fixture();
    world.environment.setWeather('rain', true);
    world.visual.update(world.environment.frame, OPTIONS, 3);
    const geometry = world.rain.geometry.getAttribute('position');
    const snapshot = Array.from(geometry.array);
    world.visual.update(world.environment.frame, OPTIONS, 3);
    expect(Array.from(geometry.array)).toEqual(snapshot);
    world.visual.update(world.environment.frame, { reducedMotion: true, lightweight: true }, 99);
    const staticSnapshot = Array.from(geometry.array);
    const clouds = world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position.clone());
    world.visual.update(world.environment.frame, { reducedMotion: true, lightweight: true }, 199);
    expect(Array.from(geometry.array)).toEqual(staticSnapshot);
    expect(world.scene.getObjectByName('Environment effects')!.children.map((object) => object.position)).toEqual(clouds);
    expect(world.rain.visible).toBe(true);
    expect(world.rain.geometry.drawRange.count).toBe(160);
    world.visual.update(world.environment.frame, OPTIONS, 3.1);
    expect(Array.from(geometry.array)).not.toEqual(snapshot);
    world.dispose();
  });

  it('rebuilds the same reduced-motion still even when the world simulation has continued', () => {
    const world = fixture();
    world.environment.setWeather('rain', true);
    world.visual.update(world.environment.frame, OPTIONS, 13.7);
    world.visual.update(world.environment.frame, { ...OPTIONS, reducedMotion: true }, 18.7);
    const held = Array.from(world.rain.geometry.getAttribute('position').array);
    world.visual.dispose();
    const visual = new EnvironmentVisual(world.scene);
    visual.update(world.environment.frame, { ...OPTIONS, reducedMotion: true }, 1234);
    const rain = world.scene.getObjectByName('Environment rain') as THREE.Points;
    expect(Array.from(rain.geometry.getAttribute('position').array)).toEqual(held);
    visual.dispose();
    world.dispose();
  });

  it('restores borrowed state and idempotently disposes each owned resource exactly once', () => {
    const world = fixture();
    const originalWindow = world.windows.emissive.clone();
    const originalFog = new THREE.Fog('#ffffff');
    world.visual.dispose();
    world.scene.fog = originalFog;
    const visual = new EnvironmentVisual(world.scene);
    const geometryDispose = vi.spyOn(world.geometry, 'dispose');
    const materialDispose = vi.spyOn(world.windows, 'dispose');
    const lightDispose = vi.spyOn(world.sun, 'dispose');
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    world.scene.getObjectByName('Environment effects')!.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry);
        materials.add(object.material as THREE.Material);
      }
    });
    const disposals = [...geometries, ...materials].map((resource) => vi.spyOn(resource, 'dispose'));
    world.environment.setTime('night', DATE);
    visual.update(world.environment.frame, OPTIONS, 100);
    visual.dispose();
    visual.dispose();
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
    expect(lightDispose).not.toHaveBeenCalled();
    expect(world.scene.background).toBe(world.background);
    expect(world.scene.fog).toBe(originalFog);
    expect(world.sun.intensity).toBe(3);
    expect(world.hemisphere.intensity).toBe(2.4);
    expect(world.windows.emissive).toEqual(originalWindow);
    expect(world.windows.emissiveIntensity).toBe(0.2);
    expect(world.scene.getObjectByName('Environment effects')).toBeUndefined();
    visual.update(world.environment.frame, OPTIONS, 101);
    expect(world.scene.background).toBe(world.background);
    world.dispose();
  });

  it('tolerates a rebuilt scene with no lights or window tags and rejects invalid effect time', () => {
    const scene = new THREE.Scene();
    const visual = new EnvironmentVisual(scene);
    const environment = new EnvironmentController();
    expect(() => visual.update(environment.frame, OPTIONS, 0)).not.toThrow();
    for (const time of [NaN, Infinity, -1]) {
      expect(() => visual.update(environment.frame, OPTIONS, time)).toThrow(RangeError);
    }
    visual.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
