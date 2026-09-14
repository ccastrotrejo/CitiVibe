import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, loadPreferences, optionValue, PREFERENCE_KEY, savePreferences, WEATHER_MODES } from './preferences';
import type { Weather } from './preferences';

describe('versioned local preferences', () => {
  it('uses defaults without writing storage', () => {
    const getItem = vi.fn(() => null);
    expect(loadPreferences(() => ({ getItem }))).toEqual({ value: DEFAULT_PREFERENCES, notice: '' });
    expect(getItem).toHaveBeenCalledWith(PREFERENCE_KEY);
    expect(Object.keys(DEFAULT_PREFERENCES)).not.toContain('enabled');
    expect(DEFAULT_PREFERENCES).toMatchObject({ weather: 'sunny', timeMode: 'afternoon', natural: false });
    expect(WEATHER_MODES).toEqual(['sunny', 'cloudy', 'rain', 'mist', 'snow', 'windy']);
  });

  it.each(WEATHER_MODES)('round trips v1 %s weather using only allowlisted preferences', (weather) => {
    const next = { ...DEFAULT_PREFERENCES, weather, motion: 'reduced' as const };
    const setItem = vi.fn();
    expect(savePreferences(next, () => ({ setItem }))).toBe('');
    const saved: string = setItem.mock.calls[0][1];
    expect(loadPreferences(() => ({ getItem: () => saved }))).toEqual({ value: next, notice: '' });
    const unexpected = { ...next, consent: true };
    expect(() => savePreferences(unexpected, () => ({ setItem }))).toThrow('Invalid');
  });

  it('reads older v1 preferences without rain intensity while preserving their other choices', () => {
    const { rainIntensityMmH, ...legacy } = DEFAULT_PREFERENCES;
    expect(rainIntensityMmH).toBe(8);
    const saved = { ...legacy, weather: 'snow', natural: true };
    expect(loadPreferences(() => ({ getItem: () => JSON.stringify(saved) }))).toEqual({
      value: { ...saved, rainIntensityMmH: 8 }, notice: '',
    });
  });

  it.each([0, 8, 30])('round trips a rain intensity of %s mm/h', (rainIntensityMmH) => {
    const next = { ...DEFAULT_PREFERENCES, rainIntensityMmH };
    const setItem = vi.fn();
    expect(savePreferences(next, () => ({ setItem }))).toBe('');
    const saved: string = setItem.mock.calls[0][1];
    expect(loadPreferences(() => ({ getItem: () => saved }))).toEqual({ value: next, notice: '' });
  });

  it.each([-1, 31, NaN, Infinity, '8', null])('rejects invalid rain intensity with the existing notice policy: %s', (rainIntensityMmH) => {
    const invalid = { ...DEFAULT_PREFERENCES, rainIntensityMmH };
    const result = loadPreferences(() => ({ getItem: () => JSON.stringify(invalid) }));
    expect(result.value).toEqual(DEFAULT_PREFERENCES);
    expect(result.notice).toContain('invalid');
    const setItem = vi.fn();
    expect(() => savePreferences({ ...invalid, rainIntensityMmH: rainIntensityMmH as number }, () => ({ setItem }))).toThrow('Invalid preferences.');
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each(['storm', 'Snow', 'snowy', ''])('rejects an unsupported weather string: %s', (weather) => {
    expect(() => optionValue(weather, WEATHER_MODES)).toThrow('Unsupported preference value.');
    const setItem = vi.fn();
    expect(() => savePreferences({ ...DEFAULT_PREFERENCES, weather: weather as Weather }, () => ({ setItem })))
      .toThrow('Unsupported preference value.');
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each([
    '{', 'null', '[]',
    JSON.stringify({ ...DEFAULT_PREFERENCES, version: 2 }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, muted: true }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, volume: 0.5 }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, motion: 'maybe' }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, quality: 'unbounded' }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, weather: 'storm' }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, weather: 'Snow' }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, camera: {} }),
    JSON.stringify({ version: 1 }),
  ])('surfaces invalid saved data without silently overwriting it: %s', (raw) => {
    const result = loadPreferences(() => ({ getItem: () => raw }));
    expect(result.value).toEqual(DEFAULT_PREFERENCES);
    expect(result.notice).toContain('invalid');
  });

  it('reports blocked reads and writes while retaining session behavior', () => {
    const blocked = () => { throw new DOMException('Denied', 'SecurityError'); };
    expect(loadPreferences(blocked).notice).toContain('unavailable');
    expect(savePreferences({ ...DEFAULT_PREFERENCES }, blocked)).toContain('could not be saved');
  });
});
