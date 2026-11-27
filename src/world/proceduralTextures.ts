import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const TEXTURE_SIZE = 128;

interface BakedMaps {
  masonryNormal: Uint8Array;
  masonryRoughness: Uint8Array;
  asphaltNormal: Uint8Array;
  asphaltRoughness: Uint8Array;
  concreteNormal: Uint8Array;
  concreteRoughness: Uint8Array;
  waterNormal: Uint8Array;
}

export interface ProceduralTextureSet {
  masonryNormal: THREE.DataTexture;
  masonryRoughness: THREE.DataTexture;
  asphaltNormal: THREE.DataTexture;
  asphaltRoughness: THREE.DataTexture;
  concreteNormal: THREE.DataTexture;
  concreteRoughness: THREE.DataTexture;
  waterNormal: THREE.DataTexture;
  textures: readonly THREE.DataTexture[];
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Periodic 2D torus-mapped multi-octave Simplex fBm in [-1, 1]. */
function buildSeamlessFbm(seed: number, octaves: number, baseRadius: number): Float32Array {
  const noiseA = createNoise2D(createSeededRng(seed));
  const noiseB = createNoise2D(createSeededRng(seed ^ 0x9e3779b9));
  const field = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const twoPi = Math.PI * 2;
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    const v = (y / TEXTURE_SIZE) * twoPi;
    const cy = Math.cos(v);
    const sy = Math.sin(v);
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = (x / TEXTURE_SIZE) * twoPi;
      const cx = Math.cos(u);
      const sx = Math.sin(u);
      let sum = 0;
      let amp = 0.5;
      let norm = 0;
      let freq = baseRadius;
      for (let octave = 0; octave < octaves; octave++) {
        const n1 = noiseA(cx * freq + octave * 3.7, sx * freq + cy * freq * 0.71);
        const n2 = noiseB(cy * freq - octave * 2.3, sy * freq + cx * freq * 0.71);
        sum += 0.5 * (n1 + n2) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.0;
      }
      field[y * TEXTURE_SIZE + x] = sum / norm;
    }
  }
  return field;
}

/** Convert a scalar heightfield in [0, 1] into an RGBA tangent-space normal map via a 3x3 Sobel filter. */
function heightToNormalBytes(height: Float32Array, strength: number): Uint8Array {
  const bytes = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const sample = (x: number, y: number) => {
    const wx = (x + TEXTURE_SIZE) & (TEXTURE_SIZE - 1);
    const wy = (y + TEXTURE_SIZE) & (TEXTURE_SIZE - 1);
    return height[wy * TEXTURE_SIZE + wx];
  };
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const offset = (y * TEXTURE_SIZE + x) * 4;
      bytes[offset] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      bytes[offset + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      bytes[offset + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      bytes[offset + 3] = 255;
    }
  }
  return bytes;
}

function scalarToRgbaBytes(values: Float32Array, minVal: number, maxVal: number): Uint8Array {
  const bytes = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let i = 0; i < values.length; i++) {
    const t = Math.max(0, Math.min(1, values[i] * 0.5 + 0.5));
    const v = Math.round((minVal + (maxVal - minVal) * t) * 255);
    const offset = i * 4;
    bytes[offset] = v;
    bytes[offset + 1] = v;
    bytes[offset + 2] = v;
    bytes[offset + 3] = 255;
  }
  return bytes;
}

let cachedMaps: BakedMaps | null = null;

function ensureBakedMaps(): BakedMaps {
  if (cachedMaps) return cachedMaps;
  const masonryHeight = buildSeamlessFbm(0x51a7c301, 4, 2.2);
  const asphaltHeight = buildSeamlessFbm(0x73b91f45, 5, 3.6);
  const concreteHeight = buildSeamlessFbm(0x28d40e77, 4, 2.6);
  const waterHeight = buildSeamlessFbm(0x9f12c83b, 4, 1.8);

  cachedMaps = {
    masonryNormal: heightToNormalBytes(masonryHeight, 1.35),
    masonryRoughness: scalarToRgbaBytes(masonryHeight, 0.68, 0.95),
    asphaltNormal: heightToNormalBytes(asphaltHeight, 1.55),
    asphaltRoughness: scalarToRgbaBytes(asphaltHeight, 0.62, 0.94),
    concreteNormal: heightToNormalBytes(concreteHeight, 0.95),
    concreteRoughness: scalarToRgbaBytes(concreteHeight, 0.72, 0.92),
    waterNormal: heightToNormalBytes(waterHeight, 1.15),
  };
  return cachedMaps;
}

function makeRepeatTexture(bytes: Uint8Array, repeat: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(bytes, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Allocate per-world GPU DataTextures backed by cached Simplex fBm PBR maps.
 * Trilinear mipmaps and 16x anisotropic filtering keep angled roads and walls free of shimmer.
 */
export function createProceduralTextureSet(): ProceduralTextureSet {
  const maps = ensureBakedMaps();
  const masonryNormal = makeRepeatTexture(maps.masonryNormal, 1.5);
  const masonryRoughness = makeRepeatTexture(maps.masonryRoughness, 1.5);
  const asphaltNormal = makeRepeatTexture(maps.asphaltNormal, 24);
  const asphaltRoughness = makeRepeatTexture(maps.asphaltRoughness, 24);
  const concreteNormal = makeRepeatTexture(maps.concreteNormal, 18);
  const concreteRoughness = makeRepeatTexture(maps.concreteRoughness, 18);
  const waterNormal = makeRepeatTexture(maps.waterNormal, 8);
  return {
    masonryNormal,
    masonryRoughness,
    asphaltNormal,
    asphaltRoughness,
    concreteNormal,
    concreteRoughness,
    waterNormal,
    textures: [
      masonryNormal,
      masonryRoughness,
      asphaltNormal,
      asphaltRoughness,
      concreteNormal,
      concreteRoughness,
      waterNormal,
    ],
  };
}
