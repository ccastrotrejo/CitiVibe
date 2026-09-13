import { WEATHER_MODES } from '../content/preferences';
import type { Weather } from '../content/preferences';
import { WeatherPhysics } from './weatherPhysics';
import type { WeatherForcing } from './weatherPhysics';

export type { Weather } from '../content/preferences';
export type TimeMode = 'afternoon' | 'night' | 'local' | 'cycle';

/** Linear RGB channels, suitable for Three's Color.setRGB(). */
export interface EnvironmentColor {
  r: number;
  g: number;
  b: number;
}

export interface EnvironmentFrame extends WeatherForcing {
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
const WEATHERS = WEATHER_MODES;
const TIMES: readonly TimeMode[] = ['afternoon', 'night', 'local', 'cycle'];
const AFTERNOON = 15 / 24;
const NIGHT = 22 / 24;
const WEATHER_BLEND_RATE = 0.85;
const NATURAL_BLEND_RATE = 0.17;
const WEATHER_SETTLED = 1e-6;

function color(hex: number): EnvironmentColor {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return { r: linear(hex >> 16), g: linear((hex >> 8) & 255), b: linear(hex & 255) };
}

const PRESETS = {
  sunny: { sky: color(0xdfe5df), clouds: 0.12, fog: 0.0015, sun: 1, temperature: 22, humidity: 0.45, wind: 1.2 },
  cloudy: { sky: color(0xb8c2c5), clouds: 0.75, fog: 0.003, sun: 0.5, temperature: 16, humidity: 0.65, wind: 2.8 },
  rain: { sky: color(0x889fa9), clouds: 1, fog: 0.007, sun: 0.3, temperature: 10, humidity: 0.94, wind: 3.5 },
  mist: { sky: color(0xc5cecc), clouds: 0.6, fog: 0.016, sun: 0.4, temperature: 8, humidity: 0.98, wind: 0.4 },
  snow: { sky: color(0xcbd5dc), clouds: 0.9, fog: 0.009, sun: 0.35, temperature: -4, humidity: 0.85, wind: 2.2 },
  windy: { sky: color(0xb6c8ce), clouds: 0.4, fog: 0.0025, sun: 0.75, temperature: 18, humidity: 0.5, wind: 7 },
} satisfies Record<Weather, { sky: EnvironmentColor; clouds: number; fog: number; sun: number; temperature: number; humidity: number; wind: number }>;
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
  readonly physics = new WeatherPhysics();
  readonly frame: EnvironmentFrame = {
    phase: AFTERNOON, brightness: 1, fog: 0, rain: 0, rainIntensityMmH: 8, wetness: 0, night: 0, glow: 0,
    clouds: 0, ambientIntensity: 2.4, sunIntensity: 3,
    snow: 0, temperatureC: 22, humidity: 0.45, windSpeed: 1.2,
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
  private readonly weights = new Float64Array(WEATHERS.length);
  private readonly weatherInput = new Float64Array(WEATHERS.length);
  private weatherInputRate = WEATHER_BLEND_RATE;
  private weatherTransitioning = false;
  private localStart = AFTERNOON;
  private localElapsed = 10;

  constructor(seed = 2401, now: Date = new Date()) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('Environment seed must be an unsigned 32-bit integer.');
    }
    localPhase(now);
    this.seed = seed;
    this.weights[WEATHERS.indexOf('sunny')] = 1;
    this.weatherInput.set(this.weights);
    this.renderFrame();
  }

  get weather(): Weather { return this.preset; }
  get rainIntensityMmH(): number { return this.frame.rainIntensityMmH; }
  get timeMode(): TimeMode { return this.mode; }
  get natural(): boolean { return this.automatic; }

  /** Explicit selection cancels natural weather; paused/reduced-motion callers pass immediate. */
  setWeather(preset: Weather, immediate = false): void {
    if (!WEATHERS.includes(preset)) throw new RangeError('Unknown weather preset.');
    this.automatic = false;
    this.transitionWeather(preset, immediate ? 0 : WEATHER_BLEND_RATE);
    this.renderFrame();
  }

  /** Physical input rate, independent of preset transitions and visual particle counts. */
  setRainIntensity(millimetersPerHour: number): void {
    if (!Number.isFinite(millimetersPerHour) || millimetersPerHour < 0 || millimetersPerHour > 30) {
      throw new RangeError('Rain intensity must be between 0 and 30 millimeters per hour.');
    }
    this.frame.rainIntensityMmH = millimetersPerHour;
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
  step(dt: number, now: Date, animate = true): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Environment delta must be finite and nonnegative.');
    const local = localPhase(now);
    dt = Math.min(dt, MAX_ENVIRONMENT_STEP);
    if (dt === 0) return;
    if (this.automatic) {
      this.untilWeather -= dt;
      if (this.untilWeather <= 0) {
        const current = WEATHERS.indexOf(this.preset);
        const next = (current + 1 + Math.floor(this.random() * (WEATHERS.length - 1))) % WEATHERS.length;
        this.transitionWeather(WEATHERS[next], NATURAL_BLEND_RATE);
        this.untilWeather += 180 + this.random() * 180;
      }
    }
    this.stepWeather(dt);
    if (this.mode === 'cycle') this.frame.phase = wrap(this.frame.phase + dt / 720);
    if (this.mode === 'local') {
      this.localElapsed = Math.min(10, this.localElapsed + dt);
      // Unwrap along the short arc: 23:59 -> 00:01 must not sweep backward through noon.
      const difference = wrap(local - this.localStart + 0.5) - 0.5;
      this.frame.phase = this.localElapsed < 10
        ? wrap(this.localStart + difference * smooth(this.localElapsed / 10)) : local;
    }
    this.renderFrame();
    this.physics.step(dt, this.frame, animate);
    this.frame.wetness = this.physics.wetness;
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

  private transitionWeather(preset: Weather, inputRate: number): void {
    this.preset = preset;
    this.weatherTransitioning = inputRate > 0;
    this.weatherInputRate = inputRate;
    if (inputRate === 0) {
      this.weights.fill(0);
      this.weights[WEATHERS.indexOf(preset)] = 1;
      this.weatherInput.set(this.weights);
    }
  }

  private stepWeather(dt: number): void {
    if (!this.weatherTransitioning) return;
    const inputDecay = Math.exp(-this.weatherInputRate * dt);
    const outputDecay = Math.exp(-WEATHER_BLEND_RATE * dt);
    // Exact cascaded exponential filters. Retaining both stages preserves blend
    // velocity on retarget; a fixed output rate also smooths natural/manual handoff.
    const coupling = this.weatherInputRate === WEATHER_BLEND_RATE
      ? WEATHER_BLEND_RATE * dt * outputDecay
      : WEATHER_BLEND_RATE * (inputDecay - outputDecay) / (WEATHER_BLEND_RATE - this.weatherInputRate);
    const targetIndex = WEATHERS.indexOf(this.preset);
    let settled = true;
    for (let index = 0; index < WEATHERS.length; index++) {
      const target = index === targetIndex ? 1 : 0;
      const inputOffset = this.weatherInput[index] - target;
      this.weights[index] = Math.min(1, Math.max(0,
        target + (this.weights[index] - target) * outputDecay + inputOffset * coupling));
      this.weatherInput[index] = target + inputOffset * inputDecay;
      if (Math.abs(this.weights[index] - target) > WEATHER_SETTLED ||
        Math.abs(this.weatherInput[index] - target) > WEATHER_SETTLED) settled = false;
    }
    if (settled) {
      this.weights.fill(0);
      this.weights[targetIndex] = 1;
      this.weatherInput.set(this.weights);
      this.weatherTransitioning = false;
    }
  }

  private renderFrame(): void {
    const frame = this.frame;
    const weights = this.weights;
    const elevation = Math.cos((frame.phase - 0.5) * Math.PI * 2);
    frame.night = 1 - smooth((elevation + 0.15) / 0.4);
    frame.brightness = 1 - frame.night * 0.72;
    frame.rain = weights[WEATHERS.indexOf('rain')];
    frame.snow = weights[WEATHERS.indexOf('snow')];
    frame.wetness = this.physics.wetness;
    frame.clouds = 0;
    frame.fog = 0;
    frame.temperatureC = 0;
    frame.humidity = 0;
    frame.windSpeed = 0;
    let sunlight = 0;
    for (let index = 0; index < WEATHERS.length; index++) {
      const preset = PRESETS[WEATHERS[index]];
      const weight = weights[index];
      frame.clouds += preset.clouds * weight;
      frame.fog += preset.fog * weight;
      frame.temperatureC += preset.temperature * weight;
      frame.humidity += preset.humidity * weight;
      frame.windSpeed += preset.wind * weight;
      sunlight += preset.sun * weight;
    }
    frame.temperatureC -= frame.night * 4;
    frame.glow = frame.night * 0.85;
    frame.ambientIntensity = (2.4 - frame.night * 1.35) * (1 - frame.clouds * 0.12);
    frame.sunIntensity = (3 - frame.night * 2.5) * sunlight;
    const palette = frame.palette;
    palette.sky.r = 0;
    palette.sky.g = 0;
    palette.sky.b = 0;
    for (let index = 0; index < WEATHERS.length; index++) {
      const sky = PRESETS[WEATHERS[index]].sky;
      palette.sky.r += sky.r * weights[index];
      palette.sky.g += sky.g * weights[index];
      palette.sky.b += sky.b * weights[index];
    }
    mix(palette.sky, palette.sky, NIGHT_SKY, frame.night);
    mix(palette.fog, palette.sky, palette.sky, 0);
    mix(palette.ambient, DAY_AMBIENT, NIGHT_AMBIENT, frame.night);
    mix(palette.ground, DAY_GROUND, NIGHT_GROUND, frame.night);
    mix(palette.sun, DAY_SUN, NIGHT_SUN, frame.night);
    mix(palette.cloud, CLOUD, NIGHT_CLOUD, frame.night);
  }
}
