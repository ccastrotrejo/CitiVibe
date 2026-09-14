// @vitest-environment node
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import * as THREE from 'three';
import { COURT_LAMPS, PARK_LAMPS, STREET_LAMPS } from '../content/lighting';
import { ActorSimulation } from './actors';
import { EnvironmentController } from './environment';
import { LightingVisual, lightPoolFalloff, localLightWeight } from './lightingVisual';
import { buildCityScene } from './scene';
import { MAX_SNOW_SWE_MM } from './weatherPhysics';

const DATE = new Date(2026, 8, 13, 15);
const OPTIONS = { lightweight: false, reducedMotion: false };

function fixture() {
  const art = buildCityScene();
  const simulation = new ActorSimulation();
  const environment = new EnvironmentController();
  const visual = new LightingVisual(art.scene, art.vehicleLights, simulation.actors, art.weatherSurface);
  const camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 850);
  camera.position.set(20, 150, 170);
  camera.lookAt(0, 0, 0);
  const focus = { x: -46, z: 10, zoom: 4 };
  const draw = (options = OPTIONS) => {
    simulation.actors.forEach((actor) => {
      const group = art.actors.get(actor.id)!;
      group.position.set(actor.position.x, actor.position.y, actor.position.z);
      group.rotation.y = actor.heading;
    });
    visual.update(environment.frame, environment.physics, simulation.elapsed, camera, focus, options);
  };
  const batch = (name: string) => {
    const mesh = visual.group.getObjectByName(name);
    if (!(mesh instanceof THREE.InstancedMesh)) throw new Error(`Missing ${name}.`);
    return mesh;
  };
  onTestFinished(() => { visual.dispose(); art.dispose(); });
  return { art, simulation, environment, visual, camera, focus, draw, batch };
}

describe('bounded city lighting renderer', () => {
  it('uses a monotonic smooth inverse-square/cosine footprint with no visible boundary step', () => {
    expect(lightPoolFalloff(0)).toBe(1);
    expect(lightPoolFalloff(1)).toBe(0);
    expect(lightPoolFalloff(2)).toBe(0);
    for (let i = 1; i <= 100; i++) expect(lightPoolFalloff(i / 100)).toBeLessThan(lightPoolFalloff((i - 1) / 100));
    expect(lightPoolFalloff(0.999)).toBeLessThan(0.00001);
    expect(localLightWeight(30, 30)).toBe(0);
    expect(localLightWeight(30.001, 30)).toBe(0);
    expect(localLightWeight(29.999, 30)).toBeLessThan(0.00001);
    expect(localLightWeight(10, 30)).toBe(1);
  });

  it('draws all 60 vehicle rigs in one lens batch and all night road pools in one batch', () => {
    const world = fixture();
    world.draw();
    expect(world.batch('Soft ground illumination').count).toBe(0);
    expect(world.batch('Vehicle lamp lenses').count).toBe(48 * 11 + 15 * 2);
    world.environment.setTime('night', DATE);
    world.draw();
    expect(world.batch('Soft ground illumination').count).toBe(STREET_LAMPS.length + PARK_LAMPS.length + COURT_LAMPS.length + 63 * 2);
    expect(world.visual.group.children.filter((object) => object instanceof THREE.InstancedMesh)).toHaveLength(3);
    for (const name of ['Soft lamp halos', 'Soft ground illumination']) {
      const mesh = world.batch(name);
      if (Array.isArray(mesh.material)) throw new Error('Expected a shared light material.');
      expect(mesh.material.depthTest).toBe(true);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.castShadow).toBe(false);
      expect(mesh.frustumCulled).toBe(false);
    }
  });

  it('keeps all eight local spotlights bounded, inverse-square and shadow-free; Lightweight preserves cues', () => {
    const world = fixture();
    world.environment.setTime('night', DATE);
    world.draw();
    const lights = world.visual.group.children.filter((object): object is THREE.SpotLight => object instanceof THREE.SpotLight);
    expect(lights).toHaveLength(8);
    expect(lights.some(({ intensity }) => intensity > 0)).toBe(true);
    for (const light of lights) {
      expect(light.decay).toBe(2);
      expect(light.penumbra).toBeGreaterThanOrEqual(0.7);
      expect(light.castShadow).toBe(false);
      expect(light.distance).toBeLessThanOrEqual(16);
    }
    const pools = world.batch('Soft ground illumination').count;
    world.draw({ ...OPTIONS, lightweight: true });
    expect(lights.every(({ intensity }) => intensity === 0)).toBe(true);
    expect(world.batch('Soft ground illumination').count).toBe(pools);
    world.focus.zoom = 1;
    world.draw();
    expect(lights.every(({ intensity }) => intensity === 0)).toBe(true);
  });

  it('keeps beams ahead of each car through rotation rather than fixed to world axes', () => {
    const world = fixture();
    world.environment.setTime('night', DATE);
    world.draw();
    const pools = world.batch('Soft ground illumination');
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    world.art.vehicleLights.forEach((rig, index) => {
      const actor = world.simulation.getActor(rig.id)!;
      // Parked shared bikes are collapsed to zero scale and cast no road beam; skip them.
      rig.body.updateWorldMatrix(true, true);
      if (new THREE.Vector3().setFromMatrixScale(rig.body.matrixWorld).x < 0.01) return;
      pools.getMatrixAt(STREET_LAMPS.length + PARK_LAMPS.length + COURT_LAMPS.length + index * 2, matrix);
      position.setFromMatrixPosition(matrix).sub(new THREE.Vector3(actor.position.x, 0, actor.position.z));
      const forward = new THREE.Vector3(Math.sin(actor.heading), 0, Math.cos(actor.heading));
      expect(position.dot(forward)).toBeGreaterThan(rig.length / 2);
      expect(position.dot(forward)).toBeLessThan(8);
    });
  });

  it('aims six recreation footprints inward and illuminates the courts without increasing the light budget', () => {
    const world = fixture();
    world.focus.x = -5;
    world.focus.z = 113.5;
    world.environment.setTime('night', DATE);
    world.draw();
    const pools = world.batch('Soft ground illumination');
    const matrix = new THREE.Matrix4();
    COURT_LAMPS.forEach((lamp, index) => {
      pools.getMatrixAt(STREET_LAMPS.length + PARK_LAMPS.length + index, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(position.x).toBeCloseTo(lamp.x);
      expect(position.z).toBeCloseTo(lamp.targetZ);
      expect(Math.abs(position.z - 113.5)).toBeLessThan(Math.abs(lamp.z - 113.5));
    });
    const lights = world.visual.group.children.filter((object): object is THREE.SpotLight =>
      object instanceof THREE.SpotLight && object.name === 'Local public light');
    expect(lights).toHaveLength(6);
    expect(lights.every((light) => light.intensity > 0 && light.target.position.z !== light.position.z)).toBe(true);
    world.environment.setTime('afternoon', DATE);
    world.draw();
    expect(pools.count).toBe(0);
    expect(lights.every(({ intensity }) => intensity === 0)).toBe(true);
  });

  it('samples snow support/retention and rejects roofs and below-grade openings in the pool shader', () => {
    const world = fixture();
    world.environment.setTime('night', DATE);
    world.environment.physics.surface.snowSweMm = MAX_SNOW_SWE_MM;
    world.draw();
    const material = world.batch('Soft ground illumination').material;
    if (!(material instanceof THREE.ShaderMaterial)) throw new Error('Missing ground-light shader.');
    expect(material.uniforms.snowDepth.value).toBe(world.environment.physics.snowDepth);
    expect(material.vertexShader).toContain('snowDepth * surface.g');
    expect(material.fragmentShader).toContain('height > 0.2 || height < -0.2');
    const texture = material.uniforms.lightSurface.value as THREE.DataTexture;
    const data = texture.image.data!;
    world.art.weatherSurface.heights.forEach((height, index) => {
      expect(data[index * 2]).toBe(height);
      expect(data[index * 2 + 1]).toBe(world.art.weatherSurface.retention[index]);
    });
  });

  it('rebuilds exact paused/reduced-motion lighting from the retained clock, without stepping anything', () => {
    const world = fixture();
    world.environment.setTime('night', DATE);
    for (let i = 0; i < 450; i++) world.simulation.step(1 / 30);
    world.draw({ ...OPTIONS, reducedMotion: true });
    const snapshot = () => ['Vehicle lamp lenses', 'Soft lamp halos', 'Soft ground illumination'].map((name) => {
      const mesh = world.batch(name);
      return { count: mesh.count, positions: Array.from(mesh.instanceMatrix.array), colors: Array.from(mesh.instanceColor!.array) };
    });
    const before = snapshot();
    const actors = structuredClone(world.simulation.actors);
    world.draw({ ...OPTIONS, reducedMotion: true });
    expect(snapshot()).toEqual(before);
    expect(world.simulation.actors).toEqual(actors);
    world.visual.dispose();
    const restored = new LightingVisual(world.art.scene, world.art.vehicleLights, world.simulation.actors, world.art.weatherSurface);
    restored.update(world.environment.frame, world.environment.physics, world.simulation.elapsed, world.camera, world.focus,
      { ...OPTIONS, reducedMotion: true });
    const after = ['Vehicle lamp lenses', 'Soft lamp halos', 'Soft ground illumination'].map((name) => {
      const mesh = restored.group.getObjectByName(name) as THREE.InstancedMesh;
      return { count: mesh.count, positions: Array.from(mesh.instanceMatrix.array), colors: Array.from(mesh.instanceColor!.array) };
    });
    expect(after).toEqual(before);
    restored.dispose();
  });

  it('disposes every owned mesh, texture, light, geometry and material once without disposing borrowed art', () => {
    const world = fixture();
    const owned = new Set<THREE.InstancedMesh | THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.SpotLight>();
    world.visual.group.traverse((object) => {
      if (object instanceof THREE.SpotLight) owned.add(object);
      if (!(object instanceof THREE.InstancedMesh) || Array.isArray(object.material)) return;
      owned.add(object); owned.add(object.geometry); owned.add(object.material);
      if (object.material instanceof THREE.MeshBasicMaterial && object.material.alphaMap) owned.add(object.material.alphaMap);
      if (object.material instanceof THREE.ShaderMaterial) owned.add(object.material.uniforms.lightSurface.value);
    });
    const spies = [...owned].map((resource) => vi.spyOn(resource, 'dispose'));
    const borrowed = vi.spyOn(world.art, 'dispose');
    world.visual.dispose();
    world.visual.dispose();
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(borrowed).not.toHaveBeenCalled();
    expect(world.art.scene.getObjectByName('City lighting')).toBeUndefined();
    world.draw();
    expect(world.visual.group.children).toHaveLength(0);
  });
});
