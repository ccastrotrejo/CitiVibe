import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityAudio } from './audio';
import type { AudioStatus } from './audio';

class MockParam {
  value = 1;
  setValueAtTime = vi.fn<(value: number, time: number) => MockParam>((value) => { this.value = value; return this; });
  linearRampToValueAtTime = vi.fn<(value: number, time: number) => MockParam>(() => this);
  cancelScheduledValues = vi.fn<(time: number) => MockParam>(() => this);
  cancelAndHoldAtTime = vi.fn<(time: number) => MockParam>(() => this);
}

class MockNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGain extends MockNode {
  gain = new MockParam();
}

class MockFilter extends MockNode {
  type = 'lowpass';
  frequency = new MockParam();
}

class MockBuffer {
  readonly data: Float32Array;
  constructor(length: number) { this.data = new Float32Array(length); }
  getChannelData = vi.fn(() => this.data);
}

class MockSource extends MockNode {
  buffer: MockBuffer | null = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
}

class MockContext extends EventTarget {
  state: AudioContextState = 'suspended';
  sampleRate = 8000;
  currentTime = 10;
  destination = new MockNode();
  gains: MockGain[] = [];
  filters: MockFilter[] = [];
  sources: MockSource[] = [];
  buffers: MockBuffer[] = [];
  createGain = vi.fn(() => {
    const node = new MockGain();
    this.gains.push(node);
    return node;
  });
  createBiquadFilter = vi.fn(() => {
    const node = new MockFilter();
    this.filters.push(node);
    return node;
  });
  createBufferSource = vi.fn(() => {
    const node = new MockSource();
    this.sources.push(node);
    return node;
  });
  createBuffer = vi.fn<(channels: number, length: number, sampleRate: number) => MockBuffer>((_channels, length) => {
    const buffer = new MockBuffer(length);
    this.buffers.push(buffer);
    return buffer;
  });
  resume = vi.fn(async () => { this.changeState('running'); });
  suspend = vi.fn(async () => { this.changeState('suspended'); });
  close = vi.fn(async () => { this.changeState('closed'); });

  changeState(state: AudioContextState): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }

  asAudioContext(): AudioContext { return this as unknown as AudioContext; }
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const audios: CityAudio[] = [];

function fixture(context = new MockContext()) {
  const statuses: AudioStatus[] = [];
  const factory = vi.fn(() => context.asAudioContext());
  const callback = vi.fn((status: AudioStatus) => statuses.push(status));
  const audio = new CityAudio(callback, factory);
  audios.push(audio);
  return { audio, context, factory, callback, statuses };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  audios.forEach((audio) => audio.dispose());
  audios.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('consent-gated original city audio', () => {
  it('never creates or resumes a context from saved volume, unmute, weather, or lifecycle changes', async () => {
    const { audio, context, factory } = fixture();
    expect(audio.status.state).toBe('off');
    audio.setVolume(0.8);
    audio.setWeather('rain');
    audio.setRunning(false);
    audio.setRunning(true);
    await audio.setMuted(false);
    expect(factory).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(audio.status.state).toBe('off');
    await audio.enable();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.status.state).toBe('on');
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].loop).toBe(true);
    expect(context.sources[0].start).toHaveBeenCalledTimes(1);
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 10);
    expect(context.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.8 ** 2 * 0.12, 10.15);
  });

  it('reports unsupported Web Audio without pretending it enabled', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const statuses: AudioStatus[] = [];
    const audio = new CityAudio((status) => statuses.push(status));
    audios.push(audio);
    await audio.enable();
    expect(audio.status.state).toBe('error');
    expect(audio.status.message).toContain('unavailable');
    expect(statuses.some(({ state }) => state === 'on')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports failed context construction and releases partially constructed graphs', async () => {
    const { audio, context, factory } = fixture();
    context.createGain.mockImplementationOnce(() => { throw new Error('Audio device unavailable'); });
    await audio.enable();
    expect(audio.status.state).toBe('error');
    expect(audio.status.message).toContain('Audio device unavailable');
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.resume).not.toHaveBeenCalled();
    const replacement = new MockContext();
    factory.mockReturnValue(replacement.asAudioContext());
    await audio.enable();
    expect(audio.status.state).toBe('on');
  });

  it('latches rejected resume until another explicit Enable, retaining silence across automatic calls', async () => {
    const { audio, context, factory, statuses } = fixture();
    context.resume.mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'));
    await audio.enable();
    expect(audio.status.state).toBe('blocked');
    expect(audio.status.message).toContain('Enable sound');
    expect(context.sources).toHaveLength(0);
    audio.setRunning(false);
    await flush();
    audio.setRunning(true);
    audio.setVolume(0.7);
    await audio.setMuted(false);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(audio.status.state).toBe('blocked');
    expect(statuses.some(({ state }) => state === 'on')).toBe(false);
    const retry = new MockContext();
    factory.mockReturnValue(retry.asAudioContext());
    await audio.enable();
    expect(retry.resume).toHaveBeenCalledTimes(1);
    expect(audio.status.state).toBe('on');
  });

  it('does not report success when resume resolves but the browser stays suspended', async () => {
    const { audio, context } = fixture();
    context.resume.mockImplementationOnce(async () => {});
    await audio.enable();
    expect(audio.status.state).toBe('blocked');
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it('treats an undefined rejection as failure even if the context changes state before rejecting', async () => {
    const { audio, context } = fixture();
    context.resume.mockImplementationOnce(async () => {
      context.changeState('running');
      return Promise.reject(undefined);
    });
    await audio.enable();
    expect(audio.status.state).toBe('error');
    expect(context.sources).toHaveLength(0);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('turns an indefinitely pending browser resume into explicit Retry and closes late completion', async () => {
    const context = new MockContext();
    const pending = deferred();
    context.resume.mockImplementationOnce(async () => { await pending.promise; context.changeState('running'); });
    const { audio, factory } = fixture(context);
    const enabling = audio.enable();
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(2000);
    await enabling;
    expect(audio.status.state).toBe('blocked');
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    const retry = new MockContext();
    factory.mockReturnValue(retry.asAudioContext());
    await audio.enable();
    pending.resolve();
    await flush();
    expect(context.close).toHaveBeenCalledTimes(2);
    expect(retry.state).toBe('running');
    expect(audio.status.state).toBe('on');
  });

  it('fades and audio-clock-stops sources within 150ms, then suspends and resumes prior consent', async () => {
    const { audio, context } = fixture();
    await audio.enable();
    const first = context.sources[0];
    audio.setRunning(false);
    expect(first.stop).toHaveBeenCalledWith(10.15);
    expect(context.gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 10.15);
    await vi.advanceTimersByTimeAsync(149);
    expect(context.suspend).not.toHaveBeenCalled();
    expect(first.disconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.status.state).toBe('muted');
    expect(audio.status.message).toContain('paused');
    expect(vi.getTimerCount()).toBe(0);
    audio.setRunning(true);
    await flush();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.sources).toHaveLength(2);
    expect(context.buffers).toHaveLength(1);
    expect(audio.status.state).toBe('on');
  });

  it('keeps an explicitly enabled paused city silent with no scheduled sources', async () => {
    const { audio, context } = fixture();
    audio.setRunning(false);
    await audio.enable();
    expect(audio.status.state).toBe('muted');
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    audio.setRunning(true);
    await flush();
    expect(audio.status.state).toBe('on');
  });

  it('makes rapid mute/unmute latest-wins with one retiring source and no duplicate resume work', async () => {
    const { audio, context } = fixture();
    await audio.enable();
    const mute = audio.setMuted(true);
    const unmute = audio.setMuted(false);
    audio.setRunning(false);
    audio.setRunning(true);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(150);
    await Promise.all([mute, unmute]);
    expect(audio.status.state).toBe('on');
    expect(context.sources).toHaveLength(2);
    expect(context.sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(context.sources[1].disconnect).not.toHaveBeenCalled();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start a bed when a pending enable finishes after hiding or muting', async () => {
    const context = new MockContext();
    const pending = deferred();
    context.resume.mockImplementationOnce(async () => { await pending.promise; context.changeState('running'); });
    const { audio } = fixture(context);
    const enabling = audio.enable();
    await flush();
    audio.setRunning(false);
    const muting = audio.setMuted(true);
    pending.resolve();
    await Promise.all([enabling, muting]);
    expect(context.sources).toHaveLength(0);
    expect(context.state).toBe('suspended');
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(audio.status.state).toBe('muted');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('serializes resume behind an in-flight suspend without declaring its own suspension blocked', async () => {
    const context = new MockContext();
    const pending = deferred();
    context.suspend.mockImplementationOnce(async () => { await pending.promise; context.changeState('suspended'); });
    const { audio, statuses } = fixture(context);
    await audio.enable();
    audio.setRunning(false);
    await vi.advanceTimersByTimeAsync(150);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    audio.setRunning(true);
    await flush();
    expect(context.sources).toHaveLength(1);
    pending.resolve();
    await flush();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.sources).toHaveLength(2);
    expect(audio.status.state).toBe('on');
    expect(statuses.some(({ state }) => state === 'blocked')).toBe(false);
  });

  it('requires explicit Retry after an external interruption and can replace an externally closed context', async () => {
    const { audio, context, factory } = fixture();
    await audio.enable();
    context.changeState('suspended');
    expect(audio.status.state).toBe('blocked');
    await vi.advanceTimersByTimeAsync(150);
    audio.setRunning(false);
    audio.setRunning(true);
    await audio.setMuted(false);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.status.state).toBe('blocked');
    await audio.enable();
    expect(audio.status.state).toBe('on');
    context.changeState('closed');
    expect(audio.status.state).toBe('error');
    const replacement = new MockContext();
    factory.mockReturnValue(replacement.asAudioContext());
    const enabling = audio.enable();
    await vi.advanceTimersByTimeAsync(150);
    await enabling;
    expect(factory).toHaveBeenCalledTimes(2);
    expect(replacement.sources).toHaveLength(1);
    expect(audio.status.state).toBe('on');
  });

  it('validates volume, treats zero as silent, and never saves consent in a new instance', async () => {
    const { audio, context } = fixture();
    for (const volume of [-0.1, 1.1, NaN, Infinity]) expect(() => audio.setVolume(volume)).toThrow(RangeError);
    expect(audio.volume).toBe(0.6);
    audio.setVolume(0);
    await audio.enable();
    expect(context.sources).toHaveLength(0);
    expect(context.resume).not.toHaveBeenCalled();
    expect(audio.status.state).toBe('muted');
    audio.setVolume(1);
    await flush();
    expect(audio.status.state).toBe('on');
    audio.setVolume(0);
    await vi.advanceTimersByTimeAsync(150);
    expect(context.state).toBe('suspended');
    const fresh = fixture();
    fresh.audio.setVolume(1);
    await fresh.audio.setMuted(false);
    expect(fresh.factory).not.toHaveBeenCalled();
  });

  it('synthesizes reproducible noise once per context and crossfades the rain bed without new sources', async () => {
    const first = fixture();
    const second = fixture();
    await first.audio.enable();
    await second.audio.enable();
    expect(first.context.buffers[0].data).toEqual(second.context.buffers[0].data);
    expect(first.context.buffers[0].data).toHaveLength(16000);
    expect(first.context.buffers[0].data.every((value) => value >= -1 && value <= 1)).toBe(true);
    expect(first.context.filters.map((filter) => filter.type)).toEqual(['lowpass', 'highpass']);
    first.audio.setWeather('rain');
    expect(first.context.gains[2].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.2, 10.15);
    first.audio.setWeather('mist');
    expect(first.context.gains[2].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 10.15);
    expect(first.context.sources).toHaveLength(1);
    expect(first.context.buffers).toHaveLength(1);
  });

  it('keeps one graph and no active sources or timers between repeated pause/resume cycles', async () => {
    const { audio, context } = fixture();
    await audio.enable();
    for (let cycle = 0; cycle < 20; cycle++) {
      audio.setRunning(false);
      await vi.advanceTimersByTimeAsync(150);
      expect(context.sources.every((source) => source.disconnect.mock.calls.length === 1)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      audio.setRunning(true);
      await flush();
      expect(context.sources.filter((source) => source.disconnect.mock.calls.length === 0)).toHaveLength(1);
    }
    expect(context.buffers).toHaveLength(1);
    expect(context.gains).toHaveLength(3);
    expect(context.filters).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases all nodes, the state listener, and the bounded fade timer exactly once on disposal', async () => {
    const { audio, context, callback } = fixture();
    const removeListener = vi.spyOn(context, 'removeEventListener');
    await audio.enable();
    const mute = audio.setMuted(true);
    expect(vi.getTimerCount()).toBe(1);
    audio.dispose();
    audio.dispose();
    await mute;
    for (const node of [...context.gains, ...context.filters, ...context.sources]) {
      expect(node.disconnect).toHaveBeenCalledTimes(1);
    }
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    const calls = callback.mock.calls.length;
    await audio.enable();
    await audio.setMuted(false);
    audio.setRunning(true);
    context.changeState('running');
    expect(callback).toHaveBeenCalledTimes(calls);
  });

  it('closes a late resumed context after disposal without sources, timers, or late success callbacks', async () => {
    const context = new MockContext();
    const pending = deferred();
    context.resume.mockImplementationOnce(async () => { await pending.promise; context.changeState('running'); });
    const { audio, callback } = fixture(context);
    const enabling = audio.enable();
    await flush();
    audio.dispose();
    const calls = callback.mock.calls.length;
    expect(context.close).toHaveBeenCalledTimes(1);
    pending.resolve();
    await enabling;
    await flush();
    expect(context.close).toHaveBeenCalledTimes(2);
    expect(context.state).toBe('closed');
    expect(context.sources).toHaveLength(0);
    expect(callback).toHaveBeenCalledTimes(calls);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let a stale close failure overwrite a successful explicit retry', async () => {
    const context = new MockContext();
    const closing = deferred();
    context.close.mockImplementationOnce(() => closing.promise);
    context.resume.mockRejectedValueOnce(new Error('Device unavailable'));
    const { audio, factory } = fixture(context);
    await audio.enable();
    expect(audio.status.state).toBe('error');
    const next = new MockContext();
    factory.mockReturnValue(next.asAudioContext());
    await audio.enable();
    closing.reject(new Error('Old context close failed'));
    await flush();
    expect(audio.status.state).toBe('on');
    expect(next.state).toBe('running');
  });

  it('handles a late rejected resume and failed suspension without unhandled rejection or audible nodes', async () => {
    const context = new MockContext();
    const pending = deferred();
    context.resume.mockImplementationOnce(() => pending.promise);
    const { audio, callback } = fixture(context);
    const enabling = audio.enable();
    await flush();
    audio.dispose();
    const calls = callback.mock.calls.length;
    pending.reject(new Error('Device disappeared'));
    await enabling;
    expect(callback).toHaveBeenCalledTimes(calls);
    const next = fixture();
    await next.audio.enable();
    next.context.suspend.mockRejectedValueOnce(new Error('Suspension failed'));
    next.audio.setRunning(false);
    await vi.advanceTimersByTimeAsync(150);
    expect(next.audio.status.state).toBe('error');
    expect(next.context.sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(next.context.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
