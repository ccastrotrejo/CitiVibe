import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAINTENANCE_STRIPS } from '../content/civicUtilities';
import { CIVIC_MAINTENANCE_GLSL, civicSnowRetentionAt } from './civicMaintenance';
import { applyCivicMaintenanceCapture } from './civicUtilities';
import { SnowVolumeVisual } from './snowVolumeVisual';
import { SurfaceVisual } from './surfaceVisual';
import { WeatherPhysics } from './weatherPhysics';
import { WeatherSurface } from './weatherSurface';

describe('maintained ground snow', () => {
  it('keeps cleared-strip foot support and visual retention at zero without clearing overhead roofs', () => {
    for (const strip of MAINTENANCE_STRIPS) {
      expect(strip.snowRetention).toBe(0);
      const x = (strip.minX + strip.maxX) / 2;
      const z = (strip.minZ + strip.maxZ) / 2;
      const surface = new WeatherSurface();
      surface.heights.fill(strip.surfaceY);
      surface.retention.fill(1);
      applyCivicMaintenanceCapture(surface);
      const physics = new WeatherPhysics();
      physics.bindSurface(surface.heightAt, surface.snowRetentionAt);
      physics.surface.snowSweMm = 6;
      expect(physics.snowSupportAt(x, z, strip.surfaceY)).toBe(0);
      expect(civicSnowRetentionAt(x, strip.surfaceY, z, 1)).toBe(0);
      expect(civicSnowRetentionAt(x, strip.surfaceY + 3, z, 1)).toBe(1);
      expect(civicSnowRetentionAt(strip.maxX + 1, strip.surfaceY, z, 1)).toBe(1);
    }
  });

  it('clears snow color, shell and shadow per fragment even inside a large unsplit ground face', () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    material.userData.weatherSurface = true;
    const geometry = new THREE.BoxGeometry(20, 0.1, 20);
    const source = new THREE.Mesh(geometry, material);
    scene.add(source);
    const surface = new SurfaceVisual(scene, new WeatherSurface());
    const volume = new SnowVolumeVisual([source], surface.heightTexture);
    const compile = (target: THREE.Material, library: typeof THREE.ShaderLib.standard) => {
      const shader = {
        uniforms: THREE.UniformsUtils.clone(library.uniforms),
        vertexShader: library.vertexShader,
        fragmentShader: library.fragmentShader,
      };
      target.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
      expect(shader.fragmentShader).toContain(CIVIC_MAINTENANCE_GLSL);
      return shader;
    };
    try {
      const tint = compile(material, THREE.ShaderLib.standard);
      expect(tint.fragmentShader).toContain('civicSnowRetention(vWeatherPosition, snowRetention)');
      expect(tint.fragmentShader).toContain('weatherSnow * localRetention');
      const shell = volume.group.children[0];
      if (!(shell instanceof THREE.Mesh) || Array.isArray(shell.material) || !shell.customDepthMaterial) {
        throw new Error('Missing snow color and shadow materials.');
      }
      for (const [target, library] of [
        [shell.material, THREE.ShaderLib.standard],
        [shell.customDepthMaterial, THREE.ShaderLib.depth],
      ] as const) {
        expect(compile(target, library).fragmentShader)
          .toContain('if (civicSnowRetention(vSnowBase, snowRetention) == 0.0) discard;');
      }
      expect(shell.geometry).toBe(geometry);
    } finally {
      volume.dispose();
      surface.dispose();
      material.dispose();
      geometry.dispose();
    }
  });
});
