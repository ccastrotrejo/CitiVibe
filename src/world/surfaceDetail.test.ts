import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SIDEWALK_HALF_WIDTH, STREET_X, STREET_Z } from '../content/streets';
import { applySurfaceDetail, BRICK_COURSE } from './surfaceDetail';

function compiled(material: THREE.MeshStandardMaterial) {
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('procedural ground finishes', () => {
  it('adds a filtered sidewalk flag grid and asphalt variation in separate programs', () => {
    const sidewalk = new THREE.MeshStandardMaterial();
    const asphalt = new THREE.MeshStandardMaterial();
    applySurfaceDetail(sidewalk, 'sidewalk');
    applySurfaceDetail(asphalt, 'asphalt');
    expect(sidewalk.customProgramCacheKey()).not.toBe(asphalt.customProgramCacheKey());
    const flags = compiled(sidewalk);
    expect(flags.vertexShader).toContain('vDetailPosition = (modelMatrix * detailPosition).xyz;');
    expect(flags.vertexShader).toContain('#include <project_vertex>');
    expect(flags.fragmentShader).toContain('fwidth(vDetailPosition.xz)');
    expect(flags.fragmentShader).toContain('/ 1.52');
    expect(compiled(asphalt).fragmentShader).toContain('float repair');
  });

  it('courses only warm masonry outside every street corridor, where vehicles share the paint', () => {
    const facade = new THREE.MeshStandardMaterial();
    applySurfaceDetail(facade, 'masonry');
    const brick = compiled(facade).fragmentShader;
    expect(brick).toContain(`float[](${STREET_X.map((x) => x.toFixed(1)).join(', ')})`);
    expect(brick).toContain(`float[](${STREET_Z.map((z) => z.toFixed(1)).join(', ')})`);
    expect(brick).toContain(`street > ${(SIDEWALK_HALF_WIDTH + 0.05).toFixed(2)}`);
    expect(brick).toContain('diffuseColor.r - diffuseColor.b > 0.07');
    expect(brick).toContain(`/ ${BRICK_COURSE.height.toFixed(3)}`);
  });

  it('chains after an existing compile hook and keeps its cache key', () => {
    const material = new THREE.MeshStandardMaterial();
    material.customProgramCacheKey = () => 'borrowed';
    material.onBeforeCompile = (shader) => { shader.fragmentShader = `// earlier\n${shader.fragmentShader}`; };
    applySurfaceDetail(material, 'asphalt');
    expect(material.customProgramCacheKey()).toBe('borrowed:surface-detail-asphalt-1');
    expect(compiled(material).fragmentShader).toContain('// earlier');
  });
});
