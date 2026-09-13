import { DEFAULT_PREFERENCES, WEATHER_MODES } from '../content/preferences';
import type { Weather } from '../content/preferences';

export type AudioState = 'off' | 'enabling' | 'on' | 'muted' | 'blocked' | 'error';
export interface AudioStatus {
  state: AudioState;
  message: string;
}
export type AudioContextFactory = () => AudioContext;

const FADE_SECONDS = 0.15;
const RESUME_TIMEOUT_MS = 2000;
const AIR_LEVELS: Record<Weather, number> = {
  sunny: 0.18, cloudy: 0.18, rain: 0.18, mist: 0.18, snow: 0.1, windy: 0.24,
};

function browserContext(): AudioContext {
  if (typeof AudioContext === 'undefined') throw new Error('Web Audio is unavailable in this browser.');
  return new AudioContext();
}

/** One optional original synthesis graph. Call enable() only from an explicit user action. */
export class CityAudio {
  private currentStatus: AudioStatus = { state: 'off', message: 'Sound off. Enable sound to listen.' };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private air: GainNode | null = null;
  private rain: GainNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private retiringSource: AudioBufferSourceNode | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private fadePromise: Promise<void> | null = null;
  private finishFade: (() => void) | null = null;
  private cancelResume: (() => void) | null = null;
  private work: Promise<void> | null = null;
  private revision = 0;
  private consent = false;
  private muted = true;
  private running = true;
  private needsEnable = false;
  private suspending = false;
  private disposed = false;
  private level = 0.6;
  private weather: Weather = 'sunny';
  private rainIntensityMmH = DEFAULT_PREFERENCES.rainIntensityMmH;

  constructor(
    private readonly onStatus: (status: AudioStatus) => void,
    private readonly createContext: AudioContextFactory = browserContext,
  ) {}

  get status(): Readonly<AudioStatus> { return this.currentStatus; }
  get volume(): number { return this.level; }

  /** Fresh, nonpersisted consent; failures require another explicit call, never an automatic retry. */
  enable(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.consent = true;
    this.muted = false;
    this.needsEnable = false;
    this.publish('enabling', 'Enabling sound…');
    if (this.context?.state === 'closed') this.releaseContext();
    if (!this.context) {
      try {
        this.context = this.createContext();
        this.master = this.context.createGain();
        this.master.gain.setValueAtTime(0, this.context.currentTime);
        this.master.connect(this.context.destination);
        this.context.addEventListener('statechange', this.onContextState);
      } catch (error) {
        this.fail(error, 'Sound unavailable. Retry Enable sound.');
        this.releaseContext();
        return Promise.resolve();
      }
    }
    return this.requestSync();
  }

  /** Unmuting a saved preference never supplies first-visit consent or retries a blocked context. */
  setMuted(muted: boolean): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.muted = muted;
    if (!this.audible) this.silence();
    return this.requestSync();
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new RangeError('Sound volume must be between zero and one.');
    if (this.disposed) return;
    this.level = volume;
    if (!this.audible) this.silence();
    else if (this.source && this.master && this.context) this.fade(this.master.gain, this.masterLevel);
    void this.requestSync();
  }

  setRunning(running: boolean): void {
    if (this.disposed || this.running === running) return;
    this.running = running;
    if (!this.audible) this.silence();
    void this.requestSync();
  }

  setWeather(weather: Weather): void {
    if (!WEATHER_MODES.includes(weather)) throw new RangeError('Unknown sound weather preset.');
    if (this.disposed || this.weather === weather) return;
    this.weather = weather;
    if (this.air) this.fade(this.air.gain, AIR_LEVELS[weather]);
    if (this.rain) this.fade(this.rain.gain, this.rainLevel);
  }

  /** Changes only the rain layer; never grants consent or resumes an audio context. */
  setRainIntensity(millimetersPerHour: number): void {
    if (!Number.isFinite(millimetersPerHour) || millimetersPerHour < 0 || millimetersPerHour > 30) {
      throw new RangeError('Sound rain intensity must be between 0 and 30 millimeters per hour.');
    }
    if (this.disposed || this.rainIntensityMmH === millimetersPerHour) return;
    this.rainIntensityMmH = millimetersPerHour;
    if (this.rain) this.fade(this.rain.gain, this.rainLevel);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.revision++;
    this.stopSource(this.source);
    this.source = null;
    this.finishFade?.();
    this.releaseContext();
    this.cancelResume?.();
    this.currentStatus = { state: 'off', message: 'Sound off.' };
  }

  private get audible(): boolean {
    return this.consent && !this.needsEnable && !this.muted && this.running && this.level > 0 && !this.disposed;
  }

  private get masterLevel(): number { return this.level * this.level * 0.12; }

  private get rainLevel(): number {
    if (this.weather !== 'rain') return 0;
    // Preserve the original 8 mm/h mix, with a restrained heavy-rain ceiling.
    return this.rainIntensityMmH <= 8 ? this.rainIntensityMmH / 8 * 0.2 :
      0.2 + (this.rainIntensityMmH - 8) / 22 * 0.1;
  }

  private publish(state: AudioState, message: string): void {
    if (this.disposed || (state === this.currentStatus.state && message === this.currentStatus.message)) return;
    this.currentStatus = { state, message };
    this.onStatus(this.currentStatus);
  }

  private requestSync(): Promise<void> {
    this.revision++;
    if (!this.work) this.work = this.reconcile();
    return this.work;
  }

  private async reconcile(): Promise<void> {
    // Coalesce controls in the enable action's microtask rather than scheduling another task.
    await Promise.resolve();
    try {
      let revision: number;
      do {
        revision = this.revision;
        await this.applyState();
      } while (!this.disposed && revision !== this.revision);
    } finally {
      this.work = null;
    }
  }

  private async applyState(): Promise<void> {
    const context = this.context;
    if (!context || this.disposed) {
      if (!this.consent) this.publish('off', 'Sound off. Enable sound to listen.');
      return;
    }
    try {
      if (this.fadePromise) await this.fadePromise;
      if (this.disposed || context !== this.context) return;
      if (!this.audible) {
        await this.silence();
        if (this.disposed || context !== this.context || this.audible) return;
        if (context.state !== 'suspended' && context.state !== 'closed') {
          this.suspending = true;
          try { await context.suspend(); } finally { this.suspending = false; }
        }
        if (this.disposed || context !== this.context || this.audible || this.needsEnable) return;
        this.publish('muted', !this.running ? 'Sound paused with the city.' : this.level === 0 ? 'Sound muted. Volume is zero.' : 'Sound muted.');
        return;
      }
      if (context.state !== 'running') {
        this.publish('enabling', 'Resuming sound…');
        await this.resume(context);
      }
      if (this.disposed) {
        this.close(context);
        return;
      }
      if (context !== this.context) return;
      if (!this.audible) return;
      if (context.state !== 'running') throw new DOMException('Audio remained suspended.', 'NotAllowedError');
      if (!this.source) {
        this.buildBed(context);
        const source = context.createBufferSource();
        this.source = source;
        source.buffer = this.buffer;
        source.loop = true;
        source.connect(this.lowpass!);
        source.connect(this.highpass!);
        source.start();
        this.fade(this.master!.gain, this.masterLevel);
      }
      this.publish('on', 'Sound on. Original city ambience.');
    } catch (error) {
      if (this.disposed || context !== this.context) { this.close(context); return; }
      this.stopSource(this.source);
      this.source = null;
      if (this.master) {
        this.master.gain.cancelScheduledValues(context.currentTime);
        this.master.gain.setValueAtTime(0, context.currentTime);
      }
      this.fail(error, 'Sound unavailable. Retry Enable sound.');
      this.releaseContext();
    }
  }

  private buildBed(context: AudioContext): void {
    if (this.buffer) return;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 2), context.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 2401;
    for (let index = 0; index < channel.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      channel[index] = seed / 0x100000000 * 2 - 1;
    }
    this.lowpass = context.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 320;
    this.highpass = context.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 1500;
    this.air = context.createGain();
    this.air.gain.value = AIR_LEVELS[this.weather];
    this.rain = context.createGain();
    this.rain.gain.value = this.rainLevel;
    this.lowpass.connect(this.air);
    this.highpass.connect(this.rain);
    this.air.connect(this.master!);
    this.rain.connect(this.master!);
    this.buffer = buffer;
  }

  private resume(context: AudioContext): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown, failed = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.cancelResume === cancel) this.cancelResume = null;
        if (failed) reject(error);
        else resolve();
      };
      const cancel = () => finish(new DOMException('Audio disposed.', 'AbortError'), true);
      // Some browsers leave a policy-blocked resume pending instead of rejecting it.
      const timer = setTimeout(() => finish(new DOMException('Audio resume timed out.', 'NotAllowedError'), true), RESUME_TIMEOUT_MS);
      this.cancelResume = cancel;
      try {
        void context.resume().then(() => {
          if (this.disposed || context !== this.context) this.close(context);
          finish();
        }, (error: unknown) => finish(error, true));
      } catch (error) {
        finish(error, true);
      }
    });
  }

  private fade(parameter: AudioParam, target: number): void {
    const now = this.context!.currentTime;
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
    else {
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(parameter.value, now);
    }
    parameter.linearRampToValueAtTime(target, now + FADE_SECONDS);
  }

  private silence(): Promise<void> {
    if (this.fadePromise) return this.fadePromise;
    if (!this.source || !this.context || !this.master) return Promise.resolve();
    this.fade(this.master.gain, 0);
    this.retiringSource = this.source;
    this.source = null;
    this.retiringSource.stop(this.context.currentTime + FADE_SECONDS);
    this.fadePromise = new Promise((resolve) => {
      this.finishFade = () => {
        if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
        this.fadeTimer = null;
        this.stopSource(this.retiringSource);
        this.retiringSource = null;
        this.fadePromise = null;
        this.finishFade = null;
        resolve();
      };
      // Audio-clock stop bounds playback even when background wall-clock timers are throttled.
      this.fadeTimer = setTimeout(() => this.finishFade?.(), FADE_SECONDS * 1000);
    });
    return this.fadePromise;
  }

  private stopSource(source: AudioBufferSourceNode | null): void {
    if (!source) return;
    try { source.stop(); } catch { /* A partially constructed source may never have started. */ }
    source.disconnect();
  }

  private fail(error: unknown, fallback: string): void {
    this.needsEnable = true;
    const blocked = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
    this.publish(blocked ? 'blocked' : 'error', blocked
      ? 'Sound blocked by the browser. Select Enable sound to retry.'
      : error instanceof Error ? `${fallback} ${error.message}` : fallback);
  }

  private onContextState = (): void => {
    if (this.disposed || this.suspending || !this.source || !this.context || this.context.state === 'running') return;
    this.needsEnable = true;
    this.silence();
    this.publish(this.context.state === 'closed' ? 'error' : 'blocked', 'Sound interrupted. Select Enable sound to retry.');
    void this.requestSync();
  };

  private close(context: AudioContext): void {
    if (context.state !== 'closed') void context.close().catch(() => {
      if (!this.disposed && !this.context) this.publish('error', 'Sound is silent, but the browser could not close its audio context.');
    });
  }

  private releaseContext(): void {
    const context = this.context;
    if (context) {
      context.removeEventListener('statechange', this.onContextState);
      if (this.master) {
        this.master.gain.cancelScheduledValues(context.currentTime);
        this.master.gain.setValueAtTime(0, context.currentTime);
      }
    }
    this.master?.disconnect();
    this.air?.disconnect();
    this.rain?.disconnect();
    this.lowpass?.disconnect();
    this.highpass?.disconnect();
    this.master = this.air = this.rain = null;
    this.lowpass = this.highpass = null;
    this.buffer = null;
    if (context) this.close(context);
    this.context = null;
  }
}
