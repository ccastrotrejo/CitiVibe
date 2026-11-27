// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NeutralToneMapping, NoToneMapping, OrthographicCamera, Scene, type WebGLRenderer } from 'three';

const mocks = vi.hoisted(() => {
  const composerSetSize = vi.fn();
  const composerRender = vi.fn();
  const composerDispose = vi.fn();
  const quadMatDispose = vi.fn();
  const targetDispose = vi.fn();
  let lastAoPass: Record<string, unknown> | null = null;
  return {
    composerSetSize,
    composerRender,
    composerDispose,
    quadMatDispose,
    targetDispose,
    getLastAoPass: () => lastAoPass,
    setLastAoPass: (pass: Record<string, unknown>) => { lastAoPass = pass; },
  };
});

vi.mock('postprocessing', () => ({
  EffectComposer: class {
    addPass = vi.fn();
    setSize = mocks.composerSetSize;
    render = mocks.composerRender;
    dispose = mocks.composerDispose;
  },
  RenderPass: class {},
  EffectPass: class {},
  ToneMappingEffect: class {},
  ToneMappingMode: { NEUTRAL: 7 },
  SMAAEffect: class {},
  SMAAPreset: { MEDIUM: 1 },
}));

vi.mock('n8ao', () => ({
  N8AOPostPass: class {
    autosetGamma = true;
    autoDetectTransparency = true;
    configuration = {
      gammaCorrection: true,
      halfRes: false,
      transparencyAware: false,
      denoiseIterations: 2,
      aoRadius: 5,
      distanceFalloff: 1,
      intensity: 5,
      aoTones: 0,
      color: null,
    };
    writeTargetInternal = { dispose: mocks.targetDispose };
    readTargetInternal = { dispose: mocks.targetDispose };
    outputTargetInternal = { dispose: mocks.targetDispose };
    accumulationRenderTarget = { dispose: mocks.targetDispose };
    depthMipAtlas = { dispose: mocks.targetDispose };
    effectShaderQuad = { material: { dispose: mocks.quadMatDispose } };
    setQualityMode = vi.fn();
    constructor() {
      mocks.setLastAoPass(this as unknown as Record<string, unknown>);
    }
  },
}));

import { createCityPostProcessing, isLiveWebGL2Renderer } from './postProcessing';

describe('city post-processing wrapper', () => {
  it('returns null for lightweight unit-test renderer stubs', () => {
    const stub = { toneMapping: NeutralToneMapping } as unknown as WebGLRenderer;
    expect(isLiveWebGL2Renderer(stub)).toBe(false);
    expect(createCityPostProcessing(stub, new Scene(), new OrthographicCamera())).toBeNull();
  });

  it('locks autoDetectTransparency off, forwards CSS dimensions without double-DPR, guards NaN, and disposes all GPU targets once', () => {
    mocks.composerSetSize.mockClear();
    mocks.composerRender.mockClear();
    mocks.composerDispose.mockClear();
    mocks.targetDispose.mockClear();
    mocks.quadMatDispose.mockClear();

    const liveRenderer = {
      toneMapping: NeutralToneMapping,
      getContext: () => ({}),
      capabilities: { isWebGL2: true },
    } as unknown as WebGLRenderer;

    const pipeline = createCityPostProcessing(liveRenderer, new Scene(), new OrthographicCamera());
    expect(pipeline).not.toBeNull();
    expect(mocks.getLastAoPass()?.autoDetectTransparency).toBe(false);

    pipeline!.setSize(1440, 900);
    expect(mocks.composerSetSize).toHaveBeenCalledWith(1440, 900, false);

    pipeline!.setSize(NaN, 900);
    pipeline!.setSize(0, 900);
    expect(mocks.composerSetSize).toHaveBeenCalledTimes(1);

    pipeline!.render(1 / 60);
    expect(liveRenderer.toneMapping).toBe(NoToneMapping);
    expect(mocks.composerRender).toHaveBeenCalledWith(1 / 60);

    pipeline!.render(-1);
    pipeline!.render(NaN);
    expect(mocks.composerRender).toHaveBeenCalledTimes(1);

    pipeline!.dispose();
    pipeline!.dispose();
    expect(mocks.composerDispose).toHaveBeenCalledTimes(1);
    expect(mocks.targetDispose).toHaveBeenCalledTimes(5);
    expect(mocks.quadMatDispose).toHaveBeenCalledTimes(1);
    expect(liveRenderer.toneMapping).toBe(NeutralToneMapping);
  });
});
