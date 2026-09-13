import { GroundWater } from './groundWater';

export const GRAVITY = 9.80665;
export const WEATHER_EXTENT = 48;
export const PRECIPITATION_HEIGHT = 52;
export const RAIN_COUNT = 600;
export const SNOW_COUNT = 420;
export const SPLASH_COUNT = 48;
export const SURFACE_TIME_SCALE = 60;
export const MAX_WATER_MM = 3;
export const MAX_SNOW_SWE_MM = 18;
export const MAX_SNOW_DEPTH = 0.45;

export interface WeatherForcing {
  rain: number;
  rainIntensityMmH: number;
  snow: number;
  temperatureC: number;
  humidity: number;
  windSpeed: number;
  sunIntensity: number;
}

export interface Wind {
  x: number;
  z: number;
}

export interface SurfaceState {
  waterMm: number;
  snowSweMm: number;
}

export interface SurfaceFlux {
  rainMm: number;
  snowMm: number;
  meltMm: number;
  evaporationMm: number;
  potentialEvaporationMm: number;
  drainageMm: number;
  overflowMm: number;
  waterOverflowMm: number;
  snowOverflowMm: number;
}

export type SurfaceHeight = (x: number, z: number) => number;

/** Linear capillary-gravity wave phase speed (m/s), clean water near room temperature. */
export function waterWaveSpeed(wavelength: number, depth: number): number {
  if (!Number.isFinite(wavelength + depth) || wavelength <= 0 || depth <= 0) {
    throw new RangeError('Water wavelength and depth must be positive and finite.');
  }
  const k = 2 * Math.PI / wavelength;
  return Math.sqrt((GRAVITY / k + 0.072 * k / 1000) * Math.tanh(k * depth));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrap = (value: number, width: number) => ((value % width) + width) % width;

const RAIN_SPEEDS = [
  [0.5, 2], [0.6, 2.5], [0.8, 3.3], [1, 4], [1.2, 4.6],
  [1.4, 5.2], [1.6, 5.7], [1.8, 6.1], [2, 6.5],
] as const;

/** Rounded reference speeds from Bringi et al. (2018), Table 1 and section 2.2; mm -> m/s. */
export function rainTerminalSpeed(diameterMm: number): number {
  if (!Number.isFinite(diameterMm) || diameterMm < 0.5 || diameterMm > 2) {
    throw new RangeError('Rain diameter must be between 0.5 and 2 mm.');
  }
  for (let index = 1; index < RAIN_SPEEDS.length; index++) {
    const [diameter, speed] = RAIN_SPEEDS[index];
    const [previousDiameter, previousSpeed] = RAIN_SPEEDS[index - 1];
    if (diameterMm <= diameter) {
      return previousSpeed + (speed - previousSpeed) * (diameterMm - previousDiameter) / (diameter - previousDiameter);
    }
  }
  throw new RangeError('Rain diameter is outside the reference table.');
}

/** Exact update of the near-terminal vertical linearization of quadratic drag, tau = vt/(2g). */
export function settlingVelocity(speed: number, terminal: number, dt: number): number {
  return terminal + (speed - terminal) * Math.exp(-2 * GRAVITY * dt / terminal);
}

/** A coherent, bounded synthetic breeze, directed toward +X/+Z, not measured local wind. */
export function sampleWind(out: Wind, x: number, z: number, time: number, meanSpeed: number): void {
  const gust = 1 + 0.22 * Math.sin(time * Math.PI / 8 - x * 0.035 - z * 0.02) +
    0.1 * Math.sin(time * Math.PI / 3 + z * 0.07);
  const direction = 0.6 + 0.18 * Math.sin(time * Math.PI / 24);
  out.x = Math.cos(direction) * meanSpeed * gust;
  out.z = Math.sin(direction) * meanSpeed * gust;
}

/** Water-equivalent bookkeeping; fluxes include every source and sink, including capacity overflow. */
export function stepSurface(state: SurfaceState, flux: SurfaceFlux, forcing: WeatherForcing, seconds: number): void {
  const dt = seconds * SURFACE_TIME_SCALE;
  flux.rainMm = forcing.rain * forcing.rainIntensityMmH * dt / 3600;
  flux.snowMm = forcing.snow * 2 * dt / 3600;
  state.snowSweMm += flux.snowMm;
  // Degree-day approximation: 3 mm SWE / (degree C day); no full surface energy budget.
  flux.meltMm = Math.min(state.snowSweMm, Math.max(0, forcing.temperatureC) * 3 * dt / 86400);
  state.snowSweMm -= flux.meltMm;
  state.waterMm += flux.rainMm + flux.meltMm;
  const temperature = forcing.temperatureC;
  const saturationKpa = 0.6108 * Math.exp(17.27 * temperature / (temperature + 237.3));
  const deficitKpa = (1 - forcing.humidity) * saturationKpa;
  const evaporationPerHour = deficitKpa * (0.06 + forcing.windSpeed * 0.018 + forcing.sunIntensity * 0.02);
  flux.potentialEvaporationMm = evaporationPerHour * dt / 3600;
  flux.evaporationMm = Math.min(state.waterMm, flux.potentialEvaporationMm);
  state.waterMm -= flux.evaporationMm;
  flux.drainageMm = state.waterMm * -Math.expm1(-dt / 1800);
  state.waterMm -= flux.drainageMm;
  flux.waterOverflowMm = Math.max(0, state.waterMm - MAX_WATER_MM);
  flux.snowOverflowMm = Math.max(0, state.snowSweMm - MAX_SNOW_SWE_MM);
  flux.overflowMm = flux.waterOverflowMm + flux.snowOverflowMm;
  state.waterMm = Math.min(MAX_WATER_MM, state.waterMm);
  state.snowSweMm = Math.min(MAX_SNOW_SWE_MM, state.snowSweMm);
}

/** Fixed-size CPU pool retained across GPU loss/retry; particles never determine rainfall mass. */
export class PrecipitationPool {
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly terminal: Float32Array;
  private seed: number;

  constructor(readonly count: number, readonly kind: 'rain' | 'snow', seed: number) {
    this.seed = seed;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.terminal = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      this.terminal[index] = kind === 'rain' ? rainTerminalSpeed(0.5 + this.random() * 1.5) : 0.45 + this.random() * 0.75;
      this.spawn(index);
      this.positions[index * 3 + 1] = this.random() * PRECIPITATION_HEIGHT;
    }
  }

  spawn(index: number): void {
    const offset = index * 3;
    this.positions[offset] = (this.random() * 2 - 1) * WEATHER_EXTENT;
    this.positions[offset + 1] = PRECIPITATION_HEIGHT;
    this.positions[offset + 2] = (this.random() * 2 - 1) * WEATHER_EXTENT;
    this.velocities[offset] = 0;
    this.velocities[offset + 1] = this.terminal[index];
    this.velocities[offset + 2] = 0;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}

/** Advances only on simulation ticks. Quality changes affect drawing, never this state. */
export class WeatherPhysics {
  readonly rain = new PrecipitationPool(RAIN_COUNT, 'rain', 2401);
  readonly snow = new PrecipitationPool(SNOW_COUNT, 'snow', 2417);
  readonly groundWater = new GroundWater();
  readonly surface: SurfaceState = { waterMm: 0, snowSweMm: 0 };
  readonly flux: SurfaceFlux = {
    rainMm: 0, snowMm: 0, meltMm: 0, evaporationMm: 0, potentialEvaporationMm: 0,
    drainageMm: 0, overflowMm: 0, waterOverflowMm: 0, snowOverflowMm: 0,
  };
  readonly wind: Wind = { x: 0, z: 0 };
  readonly cloudOffset: Wind = { x: 0, z: 0 };
  readonly splashPositions = new Float32Array(SPLASH_COUNT * 3);
  readonly splashAges = new Float32Array(SPLASH_COUNT).fill(1);
  time = 0;
  revision = 0;
  private splashIndex = 0;
  private readonly localWind: Wind = { x: 0, z: 0 };
  private height: SurfaceHeight = () => -0.14;
  private retention: SurfaceHeight = () => 1;
  private surfaceBound = false;

  get wetness(): number { return Math.min(1, this.surface.waterMm / 0.6); }
  get snowCover(): number { return Math.min(1, this.surface.snowSweMm / 1.2); }
  /** Fresh-snow density 80 kg/m³, with an explicit 2x display-depth exaggeration. */
  get snowDepth(): number { return Math.min(MAX_SNOW_DEPTH, this.surface.snowSweMm * 0.025); }

  /** Only lift route actors over nearby ground snow, never onto the roof/canopy above them. */
  snowSupportAt(x: number, z: number, groundY: number): number {
    const exposure = clamp((groundY - this.height(x, z) + 0.55) / 0.45, 0, 1);
    return this.snowDepth * this.retention(x, z) * exposure ** 2 * (3 - 2 * exposure);
  }

  /** Replace only the collision sampler on restoration; retain all live CPU state. */
  bindSurface(height: SurfaceHeight, retention: SurfaceHeight = () => 1): void {
    this.height = height;
    this.retention = retention;
    if (this.surfaceBound) return;
    this.surfaceBound = true;
    for (const pool of [this.rain, this.snow]) {
      for (let index = 0; index < pool.count; index++) {
        const offset = index * 3;
        const top = height(pool.positions[offset], pool.positions[offset + 2]);
        pool.positions[offset + 1] = top + 0.05 + pool.positions[offset + 1] / PRECIPITATION_HEIGHT * (PRECIPITATION_HEIGHT - top - 0.05);
      }
    }
    this.revision++;
  }

  step(dt: number, forcing: WeatherForcing, animate = true): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Weather delta must be finite and nonnegative.');
    if (!Number.isFinite(forcing.rain + forcing.rainIntensityMmH + forcing.snow + forcing.humidity +
      forcing.windSpeed + forcing.temperatureC + forcing.sunIntensity) ||
      forcing.rain < 0 || forcing.rain > 1 || forcing.rainIntensityMmH < 0 || forcing.rainIntensityMmH > 30 ||
      forcing.snow < 0 || forcing.snow > 1 ||
      forcing.humidity < 0 || forcing.humidity > 1 || forcing.windSpeed < 0 || forcing.windSpeed > 20 ||
      forcing.sunIntensity < 0 || forcing.temperatureC < -50 || forcing.temperatureC > 60) {
      throw new RangeError('Weather forcing is outside the supported finite range.');
    }
    dt = Math.min(dt, 0.1);
    if (dt === 0) return;
    // Every synthetic wind period divides 48 seconds; wrapping here is continuous.
    this.time = wrap(this.time + dt, 4800);
    sampleWind(this.wind, 0, 0, this.time, forcing.windSpeed);
    stepSurface(this.surface, this.flux, forcing, dt);
    this.groundWater.step(dt * SURFACE_TIME_SCALE, this.flux);
    if (animate) {
      this.cloudOffset.x = wrap(this.cloudOffset.x + this.wind.x * dt * 0.15, 120);
      this.cloudOffset.z = wrap(this.cloudOffset.z + this.wind.z * dt * 0.15, 120);
      for (let index = 0; index < SPLASH_COUNT; index++) this.splashAges[index] = Math.min(1, this.splashAges[index] + dt);
      if (forcing.rain * forcing.rainIntensityMmH > 0.001) this.stepPool(this.rain, dt, forcing.windSpeed);
      if (forcing.snow > 0.001) this.stepPool(this.snow, dt, forcing.windSpeed);
    }
    this.revision++;
  }

  private stepPool(pool: PrecipitationPool, dt: number, windSpeed: number): void {
    const { positions, velocities, terminal, kind } = pool;
    for (let index = 0; index < pool.count; index++) {
      const offset = index * 3;
      const fromX = positions[offset];
      const fromY = positions[offset + 1];
      const fromZ = positions[offset + 2];
      const tau = terminal[index] / GRAVITY;
      const response = -Math.expm1(-dt / tau);
      sampleWind(this.localWind, fromX, fromZ, this.time, windSpeed);
      const flutter = kind === 'snow' ? Math.sin(this.time * Math.PI + index * 2.4) * terminal[index] * 0.1 : 0;
      const targetX = this.localWind.x + flutter;
      const targetZ = this.localWind.z - flutter * 0.6;
      const dx = targetX * dt + (velocities[offset] - targetX) * tau * response;
      const dz = targetZ * dt + (velocities[offset + 2] - targetZ) * tau * response;
      const dy = terminal[index] * dt + (velocities[offset + 1] - terminal[index]) * tau / 2 * -Math.expm1(-2 * dt / tau);
      velocities[offset] += (targetX - velocities[offset]) * response;
      velocities[offset + 2] += (targetZ - velocities[offset + 2]) * response;
      velocities[offset + 1] = settlingVelocity(velocities[offset + 1], terminal[index], dt);
      const samples = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.25));
      for (let sample = 1; sample <= samples; sample++) {
        const fraction = sample / samples;
        positions[offset] = wrap(fromX + dx * fraction + WEATHER_EXTENT, WEATHER_EXTENT * 2) - WEATHER_EXTENT;
        positions[offset + 1] = fromY - dy * fraction;
        positions[offset + 2] = wrap(fromZ + dz * fraction + WEATHER_EXTENT, WEATHER_EXTENT * 2) - WEATHER_EXTENT;
        const x = positions[offset];
        const z = positions[offset + 2];
        const top = Math.max(this.height(x, z) + this.snowDepth * this.retention(x, z),
          this.groundWater.heightAt(x, z) ?? -Infinity);
        if (positions[offset + 1] > top) continue;
        if (kind === 'rain') {
          const splash = this.splashIndex * 3;
          this.splashPositions[splash] = positions[offset];
          this.splashPositions[splash + 1] = top + 0.025;
          this.splashPositions[splash + 2] = positions[offset + 2];
          this.splashAges[this.splashIndex] = 0;
          this.splashIndex = (this.splashIndex + 1) % SPLASH_COUNT;
        }
        pool.spawn(index);
        break;
      }
      positions[offset + 1] = clamp(positions[offset + 1], -1, PRECIPITATION_HEIGHT);
    }
  }
}
