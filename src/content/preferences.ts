export const QUALITY_MODES = ['automatic', 'high', 'lightweight'] as const;
export const MOTION_MODES = ['system', 'reduced', 'full'] as const;
export const WEATHER_MODES = ['sunny', 'cloudy', 'rain', 'mist'] as const;
export const TIME_MODES = ['afternoon', 'night', 'local', 'cycle'] as const;
export type QualityMode = typeof QUALITY_MODES[number];
export type MotionMode = typeof MOTION_MODES[number];

export interface Preferences {
  version: 1;
  motion: MotionMode;
  guide: boolean;
  quality: QualityMode;
  weather: typeof WEATHER_MODES[number];
  timeMode: typeof TIME_MODES[number];
  natural: boolean;
  volume: number;
  muted: boolean;
}

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  version: 1, motion: 'system', guide: true, quality: 'automatic',
  weather: 'sunny', timeMode: 'afternoon', natural: false, volume: 0.35, muted: true,
};
export const PREFERENCE_KEY = 'livingcity.preferences';
const keys = Object.keys(DEFAULT_PREFERENCES);

export function optionValue<T extends string>(value: string, options: readonly T[]): T {
  const option = options.find((candidate) => candidate === value);
  if (!option) throw new Error('Unsupported preference value.');
  return option;
}

function parse(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid preferences.');
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  if (Object.keys(record).some((key) => !keys.includes(key)) || keys.some((key) => !(key in record)) ||
    record.version !== 1 || typeof record.motion !== 'string' || typeof record.quality !== 'string' ||
    typeof record.weather !== 'string' || typeof record.timeMode !== 'string' ||
    typeof record.guide !== 'boolean' || typeof record.natural !== 'boolean' ||
    typeof record.muted !== 'boolean' || typeof record.volume !== 'number' ||
    !Number.isFinite(record.volume) || record.volume < 0 || record.volume > 1) throw new Error('Invalid preferences.');
  return {
    version: 1, motion: optionValue(record.motion, MOTION_MODES), guide: record.guide,
    quality: optionValue(record.quality, QUALITY_MODES), weather: optionValue(record.weather, WEATHER_MODES),
    timeMode: optionValue(record.timeMode, TIME_MODES), natural: record.natural, volume: record.volume, muted: record.muted,
  };
}

export function loadPreferences(storage: () => Pick<Storage, 'getItem'> = () => window.localStorage): { value: Preferences; notice: string } {
  let raw: string | null;
  try {
    raw = storage().getItem(PREFERENCE_KEY);
  } catch {
    return { value: { ...DEFAULT_PREFERENCES }, notice: 'Local storage is unavailable. Changes apply to this visit only.' };
  }
  if (raw === null) return { value: { ...DEFAULT_PREFERENCES }, notice: '' };
  try {
    return { value: parse(JSON.parse(raw)), notice: '' };
  } catch {
    return { value: { ...DEFAULT_PREFERENCES }, notice: 'Saved settings are invalid or from another version. Defaults are in use; changing a setting will replace them.' };
  }
}

export function savePreferences(value: Preferences, storage: () => Pick<Storage, 'setItem'> = () => window.localStorage): string {
  const allowed = parse(value);
  try {
    storage().setItem(PREFERENCE_KEY, JSON.stringify(allowed));
    return '';
  } catch {
    return 'Settings could not be saved locally. Your changes still apply to this visit.';
  }
}
