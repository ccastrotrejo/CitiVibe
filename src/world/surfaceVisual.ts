import * as THREE from 'three';
import type { WeatherPhysics } from './weatherPhysics';
import { WEATHER_EXTENT } from './weatherPhysics';
import { SURFACE_RESOLUTION, WeatherSurface } from './weatherSurface';

/** Borrow tagged materials; alter only exposed surfaces, without adding geometry or render passes. */
export class SurfaceVisual {
  private readonly texture: THREE.DataTexture;
  private readonly wetness = { value: 0 };
  private readonly snow = { value: 0 };
  private readonly borrowed: {
    material: THREE.MeshStandardMaterial;
    compile: THREE.MeshStandardMaterial['onBeforeCompile'];
    key: THREE.MeshStandardMaterial['customProgramCacheKey'];
  }[] = [];
  private disposed = false;

  get heightTexture(): THREE.DataTexture { return this.texture; }

  constructor(scene: THREE.Scene, surface: WeatherSurface) {
    this.texture = new THREE.DataTexture(surface.heights, SURFACE_RESOLUTION, SURFACE_RESOLUTION, THREE.RedFormat, THREE.FloatType);
    this.texture.needsUpdate = true;
    const seen = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || material.userData.weatherSurface !== true || seen.has(material)) continue;
        seen.add(material);
        const compile = material.onBeforeCompile;
        const key = material.customProgramCacheKey;
        const retention: unknown = material.userData.snowRetention;
        this.borrowed.push({ material, compile, key });
        material.customProgramCacheKey = () => `${key.call(material)}:weather-surface-1`;
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.uniforms.weatherHeight = { value: this.texture };
          shader.uniforms.weatherWetness = this.wetness;
          shader.uniforms.weatherSnow = this.snow;
          shader.uniforms.snowRetention = { value: typeof retention === 'number' ? retention : 1 };
          shader.vertexShader = `varying vec3 vWeatherPosition;\n${shader.vertexShader}`.replace(
            '#include <project_vertex>',
            `#include <project_vertex>
            vec4 weatherPosition = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              weatherPosition = instanceMatrix * weatherPosition;
            #endif
            vWeatherPosition = (modelMatrix * weatherPosition).xyz;`,
          );
          shader.fragmentShader = `
            varying vec3 vWeatherPosition;
            uniform sampler2D weatherHeight;
            uniform float weatherWetness;
            uniform float weatherSnow;
            uniform float snowRetention;
            ${shader.fragmentShader}`.replace('#include <normal_fragment_maps>', `
              #include <normal_fragment_maps>
              vec2 weatherUv = (vWeatherPosition.xz + ${WEATHER_EXTENT.toFixed(1)}) / ${(WEATHER_EXTENT * 2).toFixed(1)};
              float weatherTop = texture2D(weatherHeight, weatherUv).r;
              float exposure = smoothstep(weatherTop - 0.65, weatherTop - 0.1, vWeatherPosition.y);
              vec3 weatherNormal = inverseTransformDirection(normal, viewMatrix);
              float upward = smoothstep(0.35, 0.85, weatherNormal.y);
              float wet = weatherWetness * exposure * (0.25 + 0.75 * upward);
              float snowGrain = 0.85 + 0.15 * sin(vWeatherPosition.x * 4.7) * sin(vWeatherPosition.z * 6.3);
              float snowCover = clamp(weatherSnow * snowRetention * snowGrain * upward * exposure, 0.0, 1.0);
              diffuseColor.rgb *= 1.0 - wet * 0.28;
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.92, 0.95), snowCover);
              roughnessFactor = mix(roughnessFactor, 0.24, wet);
              roughnessFactor = mix(roughnessFactor, 0.94, snowCover);
            `);
        };
        material.needsUpdate = true;
      }
    });
  }

  update(physics: WeatherPhysics): void {
    this.wetness.value = physics.wetness;
    this.snow.value = physics.snowCover;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { material, compile, key } of this.borrowed) {
      material.onBeforeCompile = compile;
      material.customProgramCacheKey = key;
      material.needsUpdate = true;
    }
    this.borrowed.length = 0;
    this.texture.dispose();
  }
}
