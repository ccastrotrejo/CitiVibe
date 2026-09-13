export type Weather = 'sunny' | 'cloudy' | 'rain' | 'mist';
export type TimeMode = 'afternoon' | 'night' | 'local' | 'cycle';

/** Linear RGB channels, suitable for Three's Color.setRGB(). */
export interface EnvironmentColor {
  r: number;
  g: number;
  b: number;
}

export interface EnvironmentFrame {
  phase: number;
  brightness: number;
  fog: number;
  rain: number;
  wetness: number;
  night: number;
  glow: number;
  clouds: number;
  ambientIntensity: number;
  sunIntensity: number;
  palette: {
    sky: EnvironmentColor;
    fog: EnvironmentColor;
    ambient: EnvironmentColor;
    ground: EnvironmentColor;
    sun: EnvironmentColor;
    cloud: EnvironmentColor;
    rain: EnvironmentColor;
    window: EnvironmentColor;
  };
}

export const MAX_ENVIRONMENT_STEP = 0.1;
const WEATHERS: readonly Weather[] = ['sunny', 'cloudy', 'rain', 'mist'];
const TIMES: readonly TimeMode[] = ['afternoon', 'night', 'local', 'cycle'];
const AFTERNOON = 15 / 24;
const NIGHT = 22 / 24;

function color(hex: number): EnvironmentColor {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return { r: linear(hex >> 16), g: linear((hex >> 8) & 255), b: linear(hex & 255) };
}

const SKY = [color(0xdfe5df), color(0xb8c2c5), color(0x889fa9), color(0xc5cecc)];
const NIGHT_SKY = color(0x26374d);
const DAY_AMBIENT = color(0xf2f4ea);
const NIGHT_AMBIENT = color(0xabc0de);
const DAY_GROUND = color(0xa99f87);
const NIGHT_GROUND = color(0x626b82);
const DAY_SUN = color(0xfff5e8);
const NIGHT_SUN = color(0x9db7df);
const CLOUD = color(0xf0f0e8);
const NIGHT_CLOUD = color(0x61748b);

function mix(out: EnvironmentColor, a: EnvironmentColor, b: EnvironmentColor, amount: number): void {
  out.r = a.r + (b.r - a.r) * amount;
  out.g = a.g + (b.g - a.g) * amount;
  out.b = a.b + (b.b - a.b) * amount;
}

function wrap(value: number): number {
  return ((value % 1) + 1) % 1;
}

function smooth(value: number): number {
  const bounded = Math.min(1, Math.max(0, value));
  return bounded * bounded * (3 - 2 * bounded);
}

function localPhase(now: Date): number {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Environment time must be a valid date.');
  return (now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 +
    now.getMilliseconds() / 3600000) / 24;
}

/** Retain this CPU controller across renderer recovery; only step while simulation runs. */
export class EnvironmentController {
  readonly frame: EnvironmentFrame = {
    phase: AFTERNOON, brightness: 1, fog: 0, rain: 0, wetness: 0, night: 0, glow: 0,
    clouds: 0, ambientIntensity: 2.4, sunIntensity: 3,
    palette: {
      sky: color(0), fog: color(0), ambient: color(0), ground: color(0),
      sun: color(0), cloud: color(0), rain: color(0xc5d7e2), window: color(0xffc879),
    },
  };
  private preset: Weather = 'sunny';
  private mode: TimeMode = 'afternoon';
  private automatic = false;
  private seed: number;
  private untilWeather = 0;
  private weights = new Float64Array([1, 0, 0, 0]);
  private weatherStart = new Float64Array(4);
  private weatherElapsed = 0;
  private weatherDuration = 0;
  private localStart = AFTERNOON;
  private localElapsed = 10;

  constructor(seed = 2401, now: Date = new Date()) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('Environment seed must be an unsigned 32-bit integer.');
    }
    localPhase(now);
    this.seed = seed;
    this.renderFrame();
  }

  get weather(): Weather { return this.preset; }
  get timeMode(): TimeMode { return this.mode; }
  get natural(): boolean { return this.automatic; }

  /** Explicit selection cancels natural weather; paused/reduced-motion callers pass immediate. */
  setWeather(preset: Weather, immediate = false): void {
    if (!WEATHERS.includes(preset)) throw new RangeError('Unknown weather preset.');
    this.automatic = false;
    this.transitionWeather(preset, immediate ? 0 : 2);
    this.renderFrame();
  }

  /** Time selection applies immediately, including a fresh device-clock initialization. */
  setTime(mode: TimeMode, now: Date): void {
    if (!TIMES.includes(mode)) throw new RangeError('Unknown time mode.');
    const local = localPhase(now);
    this.mode = mode;
    this.localElapsed = 10;
    if (mode !== 'cycle') this.frame.phase = mode === 'afternoon' ? AFTERNOON : mode === 'night' ? NIGHT : local;
    this.renderFrame();
  }

  setNatural(enabled: boolean): void {
    if (this.automatic === enabled) return;
    this.automatic = enabled;
    if (enabled) this.untilWeather = 180 + this.random() * 180;
  }

  /** Reject invalid elapsed time; discard excess work rather than catching up hidden time. */
  step(dt: number, now: Date): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Environment delta must be finite and nonnegative.');
    const local = localPhase(now);
    dt = Math.min(dt, MAX_ENVIRONMENT_STEP);
    if (dt === 0) return;
    if (this.automatic) {
      this.untilWeather -= dt;
      if (this.untilWeather <= 0) {
        const current = WEATHERS.indexOf(this.preset);
        const next = (current + 1 + Math.floor(this.random() * 3)) % WEATHERS.length;
        this.transitionWeather(WEATHERS[next], 20);
        this.untilWeather += 180 + this.random() * 180;
      }
    }
    if (this.weatherDuration > 0) {
      this.weatherElapsed = Math.min(this.weatherElapsed + dt, this.weatherDuration);
      const blend = smooth(this.weatherElapsed / this.weatherDuration);
      const target = WEATHERS.indexOf(this.preset);
      for (let index = 0; index < 4; index++) {
        this.weights[index] = this.weatherStart[index] + ((index === target ? 1 : 0) - this.weatherStart[index]) * blend;
      }
      if (this.weatherElapsed >= this.weatherDuration) this.weatherDuration = 0;
    }
    if (this.mode === 'cycle') this.frame.phase = wrap(this.frame.phase + dt / 720);
    if (this.mode === 'local') {
      this.localElapsed = Math.min(10, this.localElapsed + dt);
      // Unwrap along the short arc: 23:59 -> 00:01 must not sweep backward through noon.
      const difference = wrap(local - this.localStart + 0.5) - 0.5;
      this.frame.phase = this.localElapsed < 10
        ? wrap(this.localStart + difference * smooth(this.localElapsed / 10)) : local;
    }
    this.renderFrame();
  }

  /** Call once on resume, not on each draw. No wall time advances other simulation systems. */
  resyncLocal(now: Date): void {
    localPhase(now);
    if (this.mode !== 'local') return;
    this.localStart = this.frame.phase;
    this.localElapsed = 0;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  private transitionWeather(preset: Weather, duration: number): void {
    this.preset = preset;
    this.weatherStart.set(this.weights);
    this.weatherElapsed = 0;
    this.weatherDuration = duration;
    if (duration === 0) {
      this.weights.fill(0);
      this.weights[WEATHERS.indexOf(preset)] = 1;
    }
  }

  private renderFrame(): void {
    const frame = this.frame;
    const weights = this.weights;
    const elevation = Math.cos((frame.phase - 0.5) * Math.PI * 2);
    frame.night = 1 - smooth((elevation + 0.15) / 0.4);
    frame.brightness = 1 - frame.night * 0.72;
    frame.rain = weights[2];
    frame.wetness = weights[2] * 0.85 + weights[3] * 0.12;
    frame.clouds = weights[0] * 0.12 + weights[1] * 0.75 + weights[2] + weights[3] * 0.6;
    frame.fog = weights[0] * 0.0015 + weights[1] * 0.003 + weights[2] * 0.007 + weights[3] * 0.016;
    frame.glow = frame.night * 0.85;
    frame.ambientIntensity = (2.4 - frame.night * 1.35) * (1 - frame.clouds * 0.12);
    frame.sunIntensity = (3 - frame.night * 2.5) *
      (weights[0] + weights[1] * 0.5 + weights[2] * 0.3 + weights[3] * 0.4);
    const palette = frame.palette;
    palette.sky.r = 0;
    palette.sky.g = 0;
    palette.sky.b = 0;
    for (let index = 0; index < 4; index++) {
      palette.sky.r += SKY[index].r * weights[index];
      palette.sky.g += SKY[index].g * weights[index];
      palette.sky.b += SKY[index].b * weights[index];
    }
    mix(palette.sky, palette.sky, NIGHT_SKY, frame.night);
    mix(palette.fog, palette.sky, palette.sky, 0);
    mix(palette.ambient, DAY_AMBIENT, NIGHT_AMBIENT, frame.night);
    mix(palette.ground, DAY_GROUND, NIGHT_GROUND, frame.night);
    mix(palette.sun, DAY_SUN, NIGHT_SUN, frame.night);
    mix(palette.cloud, CLOUD, NIGHT_CLOUD, frame.night);
  }
}
