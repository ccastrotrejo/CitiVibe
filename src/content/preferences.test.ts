import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, loadPreferences, PREFERENCE_KEY, savePreferences } from './preferences';

describe('versioned local preferences', () => {
  it('uses defaults without writing storage or restoring sound consent', () => {
    const getItem = vi.fn(() => null);
    expect(loadPreferences(() => ({ getItem }))).toEqual({ value: DEFAULT_PREFERENCES, notice: '' });
    expect(getItem).toHaveBeenCalledWith(PREFERENCE_KEY);
    expect(Object.keys(DEFAULT_PREFERENCES)).not.toContain('enabled');
  });

  it('round trips only the allowlisted preferences', () => {
    const next = { ...DEFAULT_PREFERENCES, weather: 'rain' as const, motion: 'reduced' as const, muted: false };
    const setItem = vi.fn();
    expect(savePreferences(next, () => ({ setItem }))).toBe('');
    const saved: string = setItem.mock.calls[0][1];
    expect(loadPreferences(() => ({ getItem: () => saved }))).toEqual({ value: next, notice: '' });
    const unexpected = { ...next, consent: true };
    expect(() => savePreferences(unexpected, () => ({ setItem }))).toThrow('Invalid');
  });

  it.each([
    '{', 'null', '[]',
    JSON.stringify({ ...DEFAULT_PREFERENCES, version: 2 }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, volume: -1 }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, volume: 1.1 }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, motion: 'maybe' }),
    JSON.stringify({ ...DEFAULT_PREFERENCES, quality: 'unbounded' }),
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
