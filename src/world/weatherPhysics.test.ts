import { describe, expect, it } from 'vitest';
import { FrameClock } from './clock';
import {
  GRAVITY, MAX_SNOW_SWE_MM, MAX_WATER_MM, PRECIPITATION_HEIGHT, RAIN_COUNT, SNOW_COUNT,
  SPLASH_COUNT, WEATHER_EXTENT, WeatherPhysics, rainTerminalSpeed, sampleWind, settlingVelocity, waterWaveSpeed,
} from './weatherPhysics';
import type { WeatherForcing } from './weatherPhysics';
import { WeatherSurface } from './weatherSurface';
import { GROUND_PUDDLES, updatePuddleDimensions } from './groundWater';
import { CITY_EXTENT } from '../content/streets';

const RAIN: WeatherForcing = { rain: 1, rainIntensityMmH: 8, snow: 0, temperatureC: 10, humidity: 0.94, windSpeed: 3.5, sunIntensity: 0.9 };
const SNOW: WeatherForcing = { rain: 0, rainIntensityMmH: 8, snow: 1, temperatureC: -4, humidity: 0.85, windSpeed: 2.2, sunIntensity: 1 };
const SUN: WeatherForcing = { rain: 0, rainIntensityMmH: 8, snow: 0, temperatureC: 22, humidity: 0.45, windSpeed: 1.2, sunIntensity: 3 };

function advance(physics: WeatherPhysics, seconds: number, forcing: WeatherForcing) {
  for (let tick = 0; tick < seconds * 30; tick++) physics.step(1 / 30, forcing);
}

describe('physically informed weather', () => {
  it('uses diameter-dependent terminal rain speeds, not unlimited gravitational acceleration', () => {
    expect(rainTerminalSpeed(0.5)).toBe(2);
    expect(rainTerminalSpeed(2)).toBe(6.5);
    expect(rainTerminalSpeed(0.9)).toBeCloseTo(3.65);
    for (const diameter of [NaN, Infinity, 0, 0.49, 2.1]) expect(() => rainTerminalSpeed(diameter)).toThrow(RangeError);
    const terminal = rainTerminalSpeed(1);
    let speed = 0;
    for (let tick = 0; tick < 100; tick++) {
      speed = settlingVelocity(speed, terminal, 0.1);
      expect(speed).toBeLessThanOrEqual(terminal);
      expect(speed).toBeGreaterThan(0);
    }
    expect(speed).toBeCloseTo(terminal, 6);
    expect(settlingVelocity(0, terminal, 0.2)).toBeCloseTo(settlingVelocity(settlingVelocity(0, terminal, 0.1), terminal, 0.1), 12);
    expect(settlingVelocity(terminal + 1, terminal, terminal / (2 * GRAVITY))).toBeCloseTo(terminal + Math.exp(-1), 12);
  });

  it.each([[0.6, 2.5], [0.8, 3.3], [1, 4], [1.2, 4.6], [1.4, 5.2], [1.6, 5.7], [1.8, 6.1]])(
    'matches the rounded published rain reference at %s mm',
    (diameter, speed) => expect(rainTerminalSpeed(diameter)).toBe(speed),
  );

  it('uses bounded coherent gusts with no discontinuity at its long-session wrap', () => {
    const wind = { x: 0, z: 0 };
    const nearby = { x: 0, z: 0 };
    for (let time = 0; time < 48; time += 0.1) {
      sampleWind(wind, 2, 3, time, 7);
      sampleWind(nearby, 2.1, 3.1, time + 0.001, 7);
      expect(Math.hypot(wind.x, wind.z)).toBeLessThanOrEqual(7 * 1.32);
      expect(Math.hypot(wind.x, wind.z)).toBeGreaterThanOrEqual(7 * 0.68);
      expect(Math.hypot(wind.x - nearby.x, wind.z - nearby.z)).toBeLessThan(0.05);
    }
    sampleWind(wind, 2, 3, 4800, 7);
    sampleWind(nearby, 2, 3, 0, 7);
    expect(wind.x).toBeCloseTo(nearby.x, 10);
    expect(wind.z).toBeCloseTo(nearby.z, 10);
  });

  it('advects rain and slower fluttering snow, without changing the fixed allocation', () => {
    const physics = new WeatherPhysics();
    const rain = physics.rain.positions;
    const snow = physics.snow.positions;
    rain[1] = snow[1] = 40;
    advance(physics, 1, { ...RAIN, snow: 1 });
    expect(40 - rain[1]).toBeGreaterThan(2);
    expect(40 - snow[1]).toBeLessThan(1.3);
    expect(physics.rain.velocities[0]).toBeGreaterThan(0);
    expect(physics.snow.velocities[0]).toBeGreaterThan(0);
    advance(physics, 90, { ...RAIN, snow: 1, windSpeed: 7 });
    expect(physics.rain.positions).toBe(rain);
    expect(physics.snow.positions).toBe(snow);
    expect(rain).toHaveLength(RAIN_COUNT * 3);
    expect(snow).toHaveLength(SNOW_COUNT * 3);
    expect(physics.splashAges).toHaveLength(SPLASH_COUNT);
    for (const pool of [physics.rain, physics.snow]) {
      for (let index = 0; index < pool.count; index++) {
        expect(Math.abs(pool.positions[index * 3])).toBeLessThanOrEqual(CITY_EXTENT.x);
        expect(Math.abs(pool.positions[index * 3 + 2])).toBeLessThanOrEqual(CITY_EXTENT.z);
        expect(pool.positions[index * 3 + 1]).toBeGreaterThan(-0.14);
        expect(pool.positions[index * 3 + 1]).toBeLessThanOrEqual(PRECIPITATION_HEIGHT);
      }
    }
  });

  it('covers the entire expanded city while retaining half-metre collision cells', () => {
    const physics = new WeatherPhysics();
    const surface = new WeatherSurface();
    expect(surface.cellSize).toBe(0.5);
    for (const pool of [physics.rain, physics.snow]) {
      for (const [axis, extent] of [[0, CITY_EXTENT.x], [2, CITY_EXTENT.z]] as const) {
        const coordinates = Array.from({ length: pool.count }, (_, index) => pool.positions[index * 3 + axis]);
        expect(Math.min(...coordinates)).toBeLessThan(-extent * 0.95);
        expect(Math.max(...coordinates)).toBeGreaterThan(extent * 0.95);
      }
    }
  });

  it('stops precipitation at rooftop height and records bounded rain impacts there', () => {
    const physics = new WeatherPhysics();
    physics.bindSurface(() => 12);
    physics.rain.positions.set([0, 12.01, 0]);
    physics.rain.velocities[0] = physics.rain.velocities[2] = 0;
    physics.step(1 / 30, { ...RAIN, windSpeed: 0 });
    expect(physics.rain.positions[1]).toBe(PRECIPITATION_HEIGHT);
    expect(physics.splashAges[0]).toBe(0);
    expect(physics.splashPositions[1]).toBeCloseTo(12.025);
    const held = physics.rain.positions.slice();
    physics.bindSurface(() => 12);
    expect(physics.rain.positions).toEqual(held);
  });

  it('samples wind-driven travel across a roof instead of checking only the endpoint', () => {
    const physics = new WeatherPhysics();
    physics.bindSurface((x) => x >= 0.25 && x < 0.75 ? 13 : 0);
    physics.rain.positions.set([0, 12, 0]);
    physics.rain.velocities.set([12, 2, 0]);
    physics.step(0.1, { ...RAIN, windSpeed: 0 });
    expect(physics.rain.positions[1]).toBe(PRECIPITATION_HEIGHT);
    expect(physics.splashPositions[0]).toBeGreaterThanOrEqual(0.25);
    expect(physics.splashPositions[0]).toBeLessThan(0.75);
    expect(physics.splashPositions[1]).toBeCloseTo(13.025);
  });

  it('conserves water-equivalent mass across rain, snow, melt, evaporation, drainage and capacity overflow', () => {
    const physics = new WeatherPhysics();
    let overflow = 0;
    for (let tick = 0; tick < 30000; tick++) {
      const before = physics.surface.waterMm + physics.surface.snowSweMm;
      physics.step(0.1, tick < 15000 ? SNOW : { ...RAIN, temperatureC: 28 }, false);
      const { rainMm, snowMm, evaporationMm, drainageMm, overflowMm } = physics.flux;
      const after = physics.surface.waterMm + physics.surface.snowSweMm;
      expect(after + evaporationMm + drainageMm + overflowMm).toBeCloseTo(before + rainMm + snowMm, 10);
      expect(physics.surface.waterMm).toBeGreaterThanOrEqual(0);
      expect(physics.surface.snowSweMm).toBeGreaterThanOrEqual(0);
      expect(physics.surface.waterMm).toBeLessThanOrEqual(MAX_WATER_MM);
      expect(physics.surface.snowSweMm).toBeLessThanOrEqual(MAX_SNOW_SWE_MM);
      overflow += overflowMm;
    }
    expect(overflow).toBeGreaterThan(0);
  });

  it('uses vapor-pressure deficit for drying and conserves degree-day melt into liquid', () => {
    const dry = new WeatherPhysics();
    dry.surface.waterMm = 1;
    dry.step(0.1, { ...SUN, temperatureC: 20, humidity: 0.5, windSpeed: 0, sunIntensity: 0 }, false);
    expect(dry.flux.evaporationMm).toBeCloseTo(2.33828 * 0.5 * 0.06 * 6 / 3600, 8);
    const humid = new WeatherPhysics();
    humid.surface.waterMm = 1;
    humid.step(0.1, { ...SUN, humidity: 1 }, false);
    expect(humid.flux.evaporationMm).toBe(0);
    const melting = new WeatherPhysics();
    melting.surface.snowSweMm = 1;
    melting.step(0.1, { ...SUN, temperatureC: 2, humidity: 1 }, false);
    expect(melting.flux.meltMm).toBeCloseTo(3 * 2 * 6 / 86400, 12);
    expect(melting.surface.snowSweMm + melting.surface.waterMm + melting.flux.drainageMm).toBeCloseTo(1, 12);
  });

  it('scales physical rain input with intensity while zero rain keeps existing water', () => {
    const physics = new WeatherPhysics();
    physics.step(0.1, { ...RAIN, rainIntensityMmH: 30 }, false);
    expect(physics.flux.rainMm).toBeCloseTo(30 * 6 / 3600, 12);
    const before = physics.surface.waterMm;
    physics.step(0.1, { ...RAIN, rainIntensityMmH: 0 });
    expect(physics.flux.rainMm).toBe(0);
    expect(physics.surface.waterMm).toBeGreaterThan(0);
    expect(physics.surface.waterMm).toBeLessThan(before);
    for (const rainIntensityMmH of [-1, 31, NaN, Infinity]) {
      expect(() => physics.step(0.1, { ...RAIN, rainIntensityMmH })).toThrow(RangeError);
    }
  });

  it('routes drainage and melt into bounded ground pools without double-counting water', () => {
    const physics = new WeatherPhysics();
    const catchment = GROUND_PUDDLES.reduce((sum, basin) => sum + basin.catchmentM2, 0);
    const area = GROUND_PUDDLES.reduce((sum, basin) => sum + Math.PI * basin.radiusX * basin.radiusZ, 0);
    const storage = () => (physics.surface.waterMm * catchment + physics.surface.snowSweMm * (catchment + area)) / 1000 +
      physics.groundWater.states.reduce((sum, pool) => sum + pool.volumeM3, 0);
    let overflow = 0;
    for (let tick = 0; tick < 9000; tick++) {
      const before = storage();
      physics.step(0.1, tick < 3000 ? SNOW : { ...RAIN, rainIntensityMmH: 30, temperatureC: 22 }, false);
      const surface = physics.flux;
      const pools = physics.groundWater.flux;
      const input = (surface.rainMm + surface.snowMm) * (catchment + area) / 1000;
      const output = surface.evaporationMm * catchment / 1000 + surface.snowOverflowMm * (catchment + area) / 1000 +
        pools.evaporationM3 + pools.drainageM3 + pools.overflowM3;
      expect(storage() + output).toBeCloseTo(before + input, 11);
      expect(pools.runoffM3).toBeCloseTo((surface.drainageMm + surface.waterOverflowMm) * catchment / 1000, 12);
      physics.groundWater.states.forEach((pool, index) => {
        expect(pool.depth).toBeLessThanOrEqual(GROUND_PUDDLES[index].maxDepth + 1e-12);
        expect(pool.volumeM3).toBeGreaterThanOrEqual(0);
      });
      overflow += pools.overflowM3;
    }
    expect(overflow).toBeGreaterThan(0);
    for (let tick = 0; tick < 12000; tick++) physics.step(0.1, SUN, false);
    expect(physics.groundWater.states.every((pool) => pool.volumeM3 === 0)).toBe(true);
  });

  it('grows pool area with depth, retains water after rainfall, and reduces it in warmth', () => {
    const physics = new WeatherPhysics();
    const identities = [...physics.groundWater.states];
    for (let tick = 0; tick < 200; tick++) physics.step(0.1, RAIN, false);
    const first = physics.groundWater.states[0].depth;
    for (let tick = 0; tick < 200; tick++) physics.step(0.1, { ...RAIN, rainIntensityMmH: 30 }, false);
    expect(physics.groundWater.states[0].depth).toBeGreaterThan(first);
    expect(physics.groundWater.states[0].radiusScale).toBeGreaterThan(0.5);
    const wet = physics.groundWater.states[0].volumeM3;
    for (let tick = 0; tick < 2400; tick++) physics.step(0.1, SUN, false);
    expect(physics.groundWater.states[0].volumeM3).toBeLessThan(wet);
    identities.forEach((state, index) => expect(physics.groundWater.states[index]).toBe(state));
    const basin = GROUND_PUDDLES[0];
    const capacity = Math.PI * basin.radiusX * basin.radiusZ * basin.maxDepth / 2;
    const pool = { volumeM3: capacity, depth: 0, radiusScale: 0 };
    updatePuddleDimensions(pool, 0);
    expect(pool).toMatchObject({ depth: basin.maxDepth, radiusScale: 1 });
    pool.volumeM3 = capacity / 4;
    updatePuddleDimensions(pool, 0);
    expect(pool.depth).toBeCloseTo(basin.maxDepth / 2);
    expect(() => updatePuddleDimensions({ ...pool, volumeM3: -1 }, 0)).toThrow(RangeError);
  });

  it('uses bounded snow depth for collisions and ground support without lifting onto canopies', () => {
    const physics = new WeatherPhysics();
    physics.bindSurface(() => 0, () => 0.45);
    physics.surface.snowSweMm = 6;
    expect(physics.snowDepth).toBeCloseTo(0.15);
    expect(physics.snowSupportAt(0, 0, 0)).toBeCloseTo(0.0675);
    physics.rain.positions.set([0, 0.06, 0]);
    physics.step(1 / 30, { ...RAIN, temperatureC: -4, windSpeed: 0 });
    expect(physics.rain.positions[1]).toBe(PRECIPITATION_HEIGHT);
    expect(physics.splashPositions[1]).toBeCloseTo(0.0675 + 0.025);
    physics.bindSurface(() => 4, () => 1);
    expect(physics.snowSupportAt(0, 0, 0)).toBe(0);
    physics.surface.snowSweMm = 100;
    expect(physics.snowDepth).toBe(0.45);
  });

  it('retains wetness after rain and snow after snowfall, then melts and dries in warm sun', () => {
    const physics = new WeatherPhysics();
    advance(physics, 30, RAIN);
    expect(physics.surface.waterMm).toBeGreaterThan(0.6);
    physics.step(1 / 30, SUN);
    expect(physics.surface.waterMm).toBeGreaterThan(0.6);
    advance(physics, 180, SUN);
    expect(physics.surface.waterMm).toBe(0);
    advance(physics, 60, SNOW);
    expect(physics.surface.snowSweMm).toBeCloseTo(2);
    physics.step(1 / 30, { ...SNOW, snow: 0 });
    expect(physics.surface.snowSweMm).toBeCloseTo(2);
    advance(physics, 1, SUN);
    expect(physics.flux.meltMm).toBeGreaterThan(0);
    expect(physics.surface.waterMm).toBeGreaterThan(0);
    advance(physics, 240, SUN);
    expect(physics.surface).toEqual({ waterMm: 0, snowSweMm: 0 });
  });

  it('produces the same weather state at 30 and 60 rendered Hz using the fixed-step clock', () => {
    const run = (hz: number) => {
      const physics = new WeatherPhysics();
      const clock = new FrameClock();
      for (let frame = 0; frame <= hz * 10; frame++) clock.advance(frame * 1000 / hz, (dt) => physics.step(dt, SNOW));
      return physics;
    };
    const a = run(30);
    const b = run(60);
    expect(a.time).toBe(b.time);
    expect(a.surface).toEqual(b.surface);
    expect(a.snow.positions).toEqual(b.snow.positions);
    expect(a.wind).toEqual(b.wind);
    expect(a.groundWater.states).toEqual(b.groundWater.states);
  });

  it('rejects invalid forcing, bounds elapsed work and freezes cosmetic state with reduced motion', () => {
    const physics = new WeatherPhysics();
    for (const dt of [NaN, Infinity, -1]) expect(() => physics.step(dt, RAIN)).toThrow(RangeError);
    for (const forcing of [
      { ...RAIN, rain: 2 }, { ...RAIN, snow: -1 }, { ...RAIN, temperatureC: NaN },
      { ...RAIN, temperatureC: -237.3 }, { ...RAIN, temperatureC: 61 }, { ...RAIN, windSpeed: 21 },
    ]) {
      expect(() => physics.step(0.1, forcing)).toThrow(RangeError);
    }
    const held = physics.snow.positions.slice();
    const clouds = { ...physics.cloudOffset };
    physics.step(600, SNOW, false);
    expect(physics.time).toBeCloseTo(0.1);
    expect(physics.surface.snowSweMm).toBeCloseTo(2 * 6 / 3600);
    expect(physics.snow.positions).toEqual(held);
    expect(physics.cloudOffset).toEqual(clouds);
    const state = { ...physics.surface };
    physics.step(0, SNOW);
    expect(physics.surface).toEqual(state);
  });

  it('uses capillary-gravity dispersion and approaches shallow-water speed for long waves', () => {
    expect(waterWaveSpeed(0.3, 0.08)).toBeGreaterThan(0.6);
    expect(waterWaveSpeed(0.3, 0.08)).toBeLessThan(0.7);
    expect(waterWaveSpeed(100, 0.08)).toBeCloseTo(Math.sqrt(GRAVITY * 0.08), 4);
    for (const value of [0, -1, Infinity, NaN]) expect(() => waterWaveSpeed(value, 0.08)).toThrow(RangeError);
  });
});

describe('static weather top-envelope', () => {
  it('rasterizes actual slopes and retains the highest roof rather than sheltered lower surfaces', () => {
    const field = new WeatherSurface();
    field.triangle(-2, 3, -2, 2, 5, -2, 2, 5, 2);
    field.triangle(-2, 3, -2, 2, 5, 2, -2, 3, 2);
    field.triangle(-2, 0, -2, 2, 0, -2, 2, 0, 2);
    expect(field.heightAt(0.25, 0.25)).toBeCloseTo(4.125);
    expect(field.heightAt(-1.75, -1.75)).toBeCloseTo(3.125);
    expect(field.heightAt(8, 8)).toBeCloseTo(-0.96);
    expect(field.heightAt(WEATHER_EXTENT + 1, 0)).toBe(-0.96);
    const held = field.heights.slice();
    field.triangle(0, 0, 0, 0, 2, 0, 0, 3, 0);
    expect(field.heights).toEqual(held);
  });
});
