import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EnvironmentController } from './environment';
import { EnvironmentVisual } from './environmentVisual';
import { createWindowLightingMaterial, getWindowPhase, setWindowPhase, windowActivity } from './windowLighting';

describe('use-aware retained window schedules', () => {
  it('distinguishes office floors, homes, shops and unscheduled civic glazing', () => {
    expect(windowActivity('office', 12 / 24, 0, 0.5)).toBe(1);
    expect(windowActivity('office', 22 / 24, 0, 0.5)).toBe(0.06);
    expect(windowActivity('office', 22 / 24, 0, 0.02)).toBeGreaterThan(0.3);
    expect(windowActivity('residential', 22 / 24, 0, 0.5)).toBe(1);
    expect(windowActivity('residential', 3 / 24, 0, 0.5)).toBe(0.06);
    expect(windowActivity('storefront', 22 / 24, 0, 0.5)).toBeGreaterThan(0.06);
    expect(windowActivity('storefront', 23.5 / 24, 0, 0.5)).toBe(0.06);
    expect(windowActivity('civic', 3 / 24, 0, 0.5)).toBe(1);
    expect(windowActivity('hospital', 3 / 24, 0, 0.5)).toBeGreaterThan(0.4);
    expect(windowActivity('station', 3 / 24, 0, 0.5)).toBeGreaterThan(0.25);
  });

  it('is bounded, continuous across midnight and offset by building rather than synchronized', () => {
    for (const use of ['office', 'residential', 'storefront', 'civic', 'hospital', 'station'] as const) {
      for (let hour = 0; hour <= 24; hour += 0.25) {
        const value = windowActivity(use, hour / 24, 0.4, 0.5);
        expect(value).toBeGreaterThanOrEqual(0.06);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(windowActivity(use, 1 - 1e-6, 0, 0.5)).toBeCloseTo(windowActivity(use, 1e-6, 0, 0.5), 5);
    }
    expect(windowActivity('office', 19 / 24, -0.7, 0.5))
      .toBeGreaterThan(windowActivity('office', 19 / 24, 0.7, 0.5));
    expect(() => windowActivity('office', NaN, 0, 0)).toThrow(RangeError);
  });

  it('projects one clock uniform, survives reconstruction and restores borrowed material state', () => {
    const source = new THREE.MeshStandardMaterial();
    source.userData.window = true;
    const material = createWindowLightingMaterial(source);
    const geometry = new THREE.BoxGeometry();
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const environment = new EnvironmentController();
    environment.setTime('night', new Date(2026, 8, 16, 22));
    const visual = new EnvironmentVisual(scene);
    const options = { lightweight: false, reducedMotion: false };
    visual.update(environment.frame, options, environment.physics);
    expect(getWindowPhase(material)).toBe(22 / 24);
    const retained = environment.frame.phase;
    visual.update(environment.frame, options, environment.physics);
    expect(environment.frame.phase).toBe(retained);
    visual.dispose();
    expect(getWindowPhase(material)).toBe(15 / 24);
    const restored = new EnvironmentVisual(scene);
    restored.update(environment.frame, { ...options, reducedMotion: true }, environment.physics);
    expect(getWindowPhase(material)).toBe(retained);
    expect(getWindowPhase(source)).toBeUndefined();
    expect(() => setWindowPhase(material, Infinity)).toThrow(RangeError);
    restored.dispose();
    material.dispose();
    source.dispose();
    geometry.dispose();
  });

  it('configures reflective glazing and injects 3D parallax interior shader hooks in valid GLSL order', () => {
    const source = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    const material = createWindowLightingMaterial(source);
    expect(material.roughness).toBe(0.14);
    expect(material.metalness).toBe(0.18);
    expect(source.roughness).toBe(0.5);

    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.uniforms.windowPhase).toBeDefined();
    expect(shader.vertexShader).toContain('isOrthographic');
    expect(shader.fragmentShader).toContain('evalWindowInterior(');
    const declIndex = shader.fragmentShader.indexOf('vec3 winDayInterior = vec3(0.5);');
    const useIndex = shader.fragmentShader.indexOf('diffuseColor.rgb *= mix(winDayInterior');
    expect(declIndex).toBeGreaterThan(0);
    expect(useIndex).toBeGreaterThan(declIndex);
    material.dispose();
    source.dispose();
  });
});
