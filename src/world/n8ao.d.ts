declare module 'n8ao' {
  import type * as THREE from 'three';
  import { Pass } from 'postprocessing';

  export type N8AOQualityMode =
    | 'Performance'
    | 'Low'
    | 'Medium'
    | 'High'
    | 'Ultra'
    | 'Neural-Performance'
    | 'Neural-Low'
    | 'Neural-Medium'
    | 'Neural-High';

  export type N8AODisplayMode = 'Combined' | 'AO' | 'No AO' | 'Split' | 'Split AO';

  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    aoTones: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    denoiseIterations: number;
    renderMode: 0 | 1 | 2 | 3 | 4;
    biasOffset: number;
    biasMultiplier: number;
    color: THREE.Color;
    gammaCorrection: boolean;
    depthBufferType: 1 | 2 | 3;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    colorMultiply: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
    autoRenderBeauty: boolean;
    stencil: boolean;
    neuralDenoise: boolean;
  }

  export class N8AOPostPass extends Pass {
    scene: THREE.Scene;
    camera: THREE.Camera;
    width: number;
    height: number;
    autosetGamma: boolean;
    configuration: N8AOConfiguration;
    writeTargetInternal?: THREE.WebGLRenderTarget;
    readTargetInternal?: THREE.WebGLRenderTarget;
    outputTargetInternal?: THREE.WebGLRenderTarget;
    accumulationRenderTarget?: THREE.WebGLRenderTarget;
    depthDownsampleTarget?: { dispose(): void };
    bluenoise?: THREE.DataTexture;

    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    setSize(width: number, height: number): void;
    setQualityMode(mode: N8AOQualityMode): void;
    setDisplayMode(mode: N8AODisplayMode): void;
  }
}
