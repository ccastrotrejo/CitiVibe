import { Color, HalfFloatType, NeutralToneMapping, NoToneMapping } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export interface CityPostProcessing {
  setSize(width: number, height: number): void;
  render(deltaSeconds: number): void;
  dispose(): void;
}

/** True only for a live browser WebGL2 renderer (not lightweight unit-test mocks). */
function supportsPostProcessing(renderer: WebGLRenderer): boolean {
  const candidate = renderer as Partial<WebGLRenderer>;
  return typeof candidate.getContext === 'function' && Boolean(candidate.capabilities?.isWebGL2);
}

/**
 * Build the fast laptop/desktop post-processing pipeline:
 * RenderPass -> N8AOPostPass (Performance half-res denoised horizon AO) -> Neutral ToneMapping -> SMAA.
 * Omits multi-pass mipmap bloom to preserve 60 FPS fillrate on Retina laptops; lamp halos are instanced in-scene.
 */
export function createCityPostProcessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
): CityPostProcessing | null {
  if (!supportsPostProcessing(renderer)) return null;

  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
  const renderPass = new RenderPass(scene, camera);
  const aoPass = new N8AOPostPass(scene, camera, 512, 512);
  aoPass.setQualityMode('Performance');
  aoPass.autosetGamma = false;
  aoPass.configuration.gammaCorrection = false;
  aoPass.configuration.halfRes = true;
  aoPass.configuration.transparencyAware = false;
  aoPass.configuration.denoiseIterations = 1;
  aoPass.configuration.aoRadius = 1.45;
  aoPass.configuration.distanceFalloff = 1.0;
  aoPass.configuration.intensity = 1.55;
  aoPass.configuration.aoTones = 0.0;
  aoPass.configuration.color = new Color(0x141a21);

  const toneMappingEffect = new ToneMappingEffect({
    mode: ToneMappingMode.NEUTRAL,
  });
  const smaaEffect = new SMAAEffect({
    preset: SMAAPreset.MEDIUM,
  });
  const tonePass = new EffectPass(camera, toneMappingEffect);
  const aaPass = new EffectPass(camera, smaaEffect);

  composer.addPass(renderPass);
  composer.addPass(aoPass);
  composer.addPass(tonePass);
  composer.addPass(aaPass);

  let disposed = false;
  return {
    setSize(width: number, height: number) {
      if (disposed || width <= 0 || height <= 0) return;
      composer.setSize(width, height, false);
    },
    render(deltaSeconds: number) {
      if (disposed) return;
      renderer.toneMapping = NoToneMapping;
      composer.render(deltaSeconds);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      aoPass.writeTargetInternal?.dispose();
      aoPass.readTargetInternal?.dispose();
      aoPass.outputTargetInternal?.dispose();
      aoPass.accumulationRenderTarget?.dispose();
      aoPass.depthDownsampleTarget?.dispose();
      aoPass.bluenoise?.dispose();
      composer.dispose();
      renderer.toneMapping = NeutralToneMapping;
    },
  };
}
