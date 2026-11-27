// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createProceduralTextureSet } from './proceduralTextures';

describe('procedural PBR texture set', () => {
  it('generates deterministic, mipmapped, 16x-anisotropic DataTextures across independent calls', () => {
    const first = createProceduralTextureSet();
    const second = createProceduralTextureSet();
    try {
      expect(first.textures).toHaveLength(7);
      expect(second.textures).toHaveLength(7);
      for (let i = 0; i < first.textures.length; i++) {
        const a = first.textures[i];
        const b = second.textures[i];
        expect(a).not.toBe(b);
        expect(a.generateMipmaps).toBe(true);
        expect(a.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(a.magFilter).toBe(THREE.LinearFilter);
        expect(a.wrapS).toBe(THREE.RepeatWrapping);
        expect(a.wrapT).toBe(THREE.RepeatWrapping);
        expect(a.anisotropy).toBe(16);
        expect(a.colorSpace).toBe(THREE.NoColorSpace);
        expect(Array.from(a.image.data as Uint8Array)).toEqual(Array.from(b.image.data as Uint8Array));
      }
    } finally {
      first.textures.forEach((t) => t.dispose());
      second.textures.forEach((t) => t.dispose());
    }
  });

  it('wraps periodic torus-sampled edges without boundary steps', () => {
    const set = createProceduralTextureSet();
    try {
      const data = set.asphaltRoughness.image.data as Uint8Array;
      const size = set.asphaltRoughness.image.width;
      let maxSeamJump = 0;
      for (let y = 0; y < size; y++) {
        const left = data[(y * size) * 4];
        const right = data[(y * size + size - 1) * 4];
        maxSeamJump = Math.max(maxSeamJump, Math.abs(left - right));
      }
      expect(maxSeamJump).toBeLessThan(28);
    } finally {
      set.textures.forEach((t) => t.dispose());
    }
  });
});
