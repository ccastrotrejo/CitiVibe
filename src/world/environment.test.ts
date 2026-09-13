import { describe, expect, it } from 'vitest';
import { EnvironmentController, MAX_ENVIRONMENT_STEP } from './environment';
import type { TimeMode, Weather } from './environment';
import { WEATHER_MODES } from '../content/preferences';

const DATE = new Date(2026, 8, 12, 15);

function advance(environment: EnvironmentController, seconds: number, now = DATE): void {
  for (let step = 0; step < Math.round(seconds / MAX_ENVIRONMENT_STEP); step++) {
    environment.step(MAX_ENVIRONMENT_STEP, now);
  }
}

describe('retained environment state', () => {
  it('starts Sunny/Afternoon with natural weather off and stable mutable render storage', () => {
    const environment = new EnvironmentController();
    expect(environment).toMatchObject({ weather: 'sunny', timeMode: 'afternoon', natural: false });
    expect(environment.frame).toMatchObject({ phase: 15 / 24, rain: 0, night: 0, glow: 0 });
    const frame = environment.frame;
    const palette = frame.palette;
    const colors = Object.values(palette);
    environment.setWeather('rain');
    advance(environment, 2);
    expect(environment.frame).toBe(frame);
    expect(frame.palette).toBe(palette);
    expect(Object.values(frame.palette).every((value, index) => value === colors[index])).toBe(true);
  });

  it('interpolates explicit weather for two seconds, handles interruptions, and applies static presets', () => {
    const environment = new EnvironmentController();
    environment.setNatural(true);
    environment.setWeather('rain');
    expect(environment.natural).toBe(false);
    expect(environment.frame.rain).toBe(0);
    advance(environment, 1);
    expect(environment.frame.rain).toBeCloseTo(0.5);
    environment.setWeather('mist');
    expect(environment.frame.rain).toBeCloseTo(0.5);
    advance(environment, 2);
    expect(environment.frame.rain).toBeCloseTo(0);
    expect(environment.frame.fog).toBeCloseTo(0.016);
    environment.setWeather('rain', true);
    expect(environment.frame.rain).toBe(1);
    environment.setWeather('sunny', true);
    expect(environment.frame.rain).toBe(0);
    advance(environment, 1);
    expect(environment.frame.rain).toBe(0);
  });

  it('changes natural weather deterministically every 180–360 simulation seconds without repeats', () => {
    const first = new EnvironmentController(2401);
    const second = new EnvironmentController(2401);
    first.setNatural(true);
    second.setNatural(true);
    let previous: Weather = 'sunny';
    let changedAt = 0;
    const changes: Weather[] = [];
    for (let tick = 1; tick <= 12000; tick++) {
      first.step(0.1, DATE);
      second.step(0.1, DATE);
      if (first.weather !== previous) {
        const time = tick / 10;
        expect(time - changedAt).toBeGreaterThanOrEqual(179.9);
        expect(time - changedAt).toBeLessThanOrEqual(360.1);
        expect(first.weather).not.toBe(previous);
        changes.push(first.weather);
        changedAt = time;
        previous = first.weather;
      }
      expect(first.weather).toBe(second.weather);
    }
    expect(changes.length).toBeGreaterThanOrEqual(3);
    expect(first.frame).toEqual(second.frame);
  });

  it('crossfades natural selections for twenty seconds rather than applying them abruptly', () => {
    const environment = new EnvironmentController();
    environment.setNatural(true);
    while (environment.weather === 'sunny') environment.step(0.1, DATE);
    const target = new EnvironmentController();
    target.setWeather(environment.weather, true);
    const initial = environment.frame.clouds;
    expect(initial).toBeCloseTo(0.12, 3);
    advance(environment, 10);
    expect(environment.frame.clouds).toBeGreaterThan(initial);
    expect(environment.frame.clouds).toBeLessThan(target.frame.clouds);
    advance(environment, 10);
    expect(environment.frame.clouds).toBeCloseTo(target.frame.clouds);
    expect(environment.natural).toBe(true);
  });

  it('uses twelve simulated minutes per day and freezes the cycle with zero steps', () => {
    const environment = new EnvironmentController();
    environment.setTime('cycle', DATE);
    const original = environment.frame.phase;
    advance(environment, 360);
    expect(environment.frame.phase).toBeCloseTo((original + 0.5) % 1);
    const held = structuredClone(environment.frame);
    environment.step(0, new Date(2026, 8, 13, 18));
    expect(environment.frame).toEqual(held);
    advance(environment, 360);
    expect(environment.frame.phase).toBeCloseTo(original);
    environment.setTime('night', DATE);
    advance(environment, 20);
    expect(environment.frame.phase).toBe(22 / 24);
  });

  it('initializes device local time and blends from held lighting over ten simulation seconds', () => {
    const environment = new EnvironmentController();
    environment.setTime('local', new Date(2026, 8, 12, 15));
    const held = structuredClone(environment.frame);
    const later = new Date(2026, 8, 12, 21);
    environment.resyncLocal(later);
    environment.step(0, later);
    expect(environment.frame).toEqual(held);
    advance(environment, 5, later);
    expect(environment.frame.phase).toBeCloseTo(18 / 24);
    advance(environment, 5, later);
    expect(environment.frame.phase).toBeCloseTo(21 / 24);
    environment.step(0.1, new Date(2026, 8, 12, 21, 1));
    expect(environment.frame.phase).toBeCloseTo((21 + 1 / 60) / 24);
  });

  it('resynchronizes across midnight along the short forward arc, including another interruption', () => {
    const environment = new EnvironmentController();
    environment.setTime('local', new Date(2026, 8, 12, 23, 50));
    const afterMidnight = new Date(2026, 8, 13, 0, 10);
    environment.resyncLocal(afterMidnight);
    advance(environment, 2, afterMidnight);
    expect(environment.frame.phase).toBeGreaterThan((23 + 50 / 60) / 24);
    const held = environment.frame.phase;
    environment.resyncLocal(afterMidnight);
    expect(environment.frame.phase).toBe(held);
    for (let tick = 0; tick < 100; tick++) {
      environment.step(0.1, afterMidnight);
      expect(environment.frame.phase > 0.98 || environment.frame.phase < 0.02).toBe(true);
    }
    expect(environment.frame.phase).toBeCloseTo(10 / 1440);
  });

  it('keeps all time/weather combinations finite, bounded, and night-readable', () => {
    const environment = new EnvironmentController();
    for (const weather of WEATHER_MODES) {
      for (const mode of ['afternoon', 'night', 'local', 'cycle'] as const) {
        environment.setWeather(weather, true);
        environment.setTime(mode, DATE);
        const { palette, temperatureC, ...scalars } = environment.frame;
        expect(temperatureC).toBeGreaterThanOrEqual(-8);
        expect(temperatureC).toBeLessThanOrEqual(22);
        for (const value of Object.values(scalars)) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
        for (const shade of Object.values(palette)) {
          for (const channel of Object.values(shade)) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(1);
          }
        }
        expect(environment.frame.ambientIntensity).toBeGreaterThan(0.8);
        expect(environment.frame.brightness).toBeGreaterThan(0.25);
        expect(environment.frame.rain).toBeLessThanOrEqual(1);
        if (mode === 'night') expect(environment.frame.glow).toBeGreaterThan(0.8);
      }
    }
  });

  it('rejects invalid inputs, caps large deltas, and never advances on resync in other modes', () => {
    const environment = new EnvironmentController();
    for (const dt of [NaN, Infinity, -Infinity, -1]) expect(() => environment.step(dt, DATE)).toThrow(RangeError);
    for (const seed of [NaN, -1, 0x100000000, 1.5]) expect(() => new EnvironmentController(seed)).toThrow(RangeError);
    expect(() => environment.setTime('future' as TimeMode, DATE)).toThrow(RangeError);
    expect(() => environment.setWeather('hail' as Weather)).toThrow(RangeError);
    expect(() => environment.setTime('local', new Date(NaN))).toThrow(RangeError);
    expect(() => environment.resyncLocal(new Date(NaN))).toThrow(RangeError);
    environment.setTime('cycle', DATE);
    environment.step(5000, DATE);
    expect(environment.frame.phase).toBeCloseTo(15 / 24 + 0.1 / 720);
    const held = structuredClone(environment.frame);
    environment.resyncLocal(new Date(2026, 8, 13));
    expect(environment.frame).toEqual(held);
  });
});
