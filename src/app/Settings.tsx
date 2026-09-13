import { MOTION_MODES, QUALITY_MODES, TIME_MODES, WEATHER_MODES, optionValue } from '../content/preferences';
import type { Preferences } from '../content/preferences';
import type { AudioStatus } from '../world/audio';
import { Modal } from './Modal';
import { KeyboardShortcuts } from './Help';

interface SettingsProps {
  preferences: Preferences;
  audioStatus: AudioStatus;
  onChange: (change: Partial<Preferences>) => void;
  onEnableSound: () => Promise<void>;
  onSetMuted: (muted: boolean) => Promise<void>;
  onClose: () => void;
  notice: string;
}

const WEATHER_LABELS: Record<Preferences['weather'], string> = {
  sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', mist: 'Mist',
};
const TIME_LABELS: Record<Preferences['timeMode'], string> = {
  afternoon: 'Afternoon', night: 'Night', local: 'Match my clock', cycle: 'Slow day/night cycle',
};
const QUALITY_LABELS: Record<Preferences['quality'], string> = {
  automatic: 'Automatic', high: 'High detail', lightweight: 'Lightweight',
};

export function Settings({ preferences, audioStatus, onChange, onEnableSound, onSetMuted, onClose, notice }: SettingsProps) {
  const needsEnable = audioStatus.state === 'off' || audioStatus.state === 'blocked' || audioStatus.state === 'error';
  const setMuted = (muted: boolean) => {
    void onSetMuted(muted);
    onChange({ muted });
  };

  return <Modal title="City settings" closeLabel="Close settings" onClose={onClose}>
    <label className="setting-field"><span>Motion</span><select value={preferences.motion} onChange={(event) => onChange({ motion: optionValue(event.target.value, MOTION_MODES) })}>
      <option value="system">Use computer preference</option><option value="reduced">Reduced motion</option><option value="full">Full motion</option>
    </select></label>
    <p className="muted">Reduced motion starts paused, replaces automatic tours with guided views, and removes decorative movement. You can still resume the street activity.</p>
    <label className="setting-field"><span>Weather</span><select value={preferences.weather} onChange={(event) => onChange({ weather: optionValue(event.target.value, WEATHER_MODES), natural: false })}>
      {WEATHER_MODES.map((mode) => <option key={mode} value={mode}>{WEATHER_LABELS[mode]}</option>)}
    </select></label>
    <label className="motion-control"><input type="checkbox" checked={preferences.natural} onChange={(event) => onChange({ natural: event.target.checked })} /><span>Let the weather drift on its own</span></label>
    <label className="setting-field"><span>Time of day</span><select value={preferences.timeMode} onChange={(event) => onChange({ timeMode: optionValue(event.target.value, TIME_MODES) })}>
      {TIME_MODES.map((mode) => <option key={mode} value={mode}>{TIME_LABELS[mode]}</option>)}
    </select></label>
    <label className="setting-field"><span>Graphics quality</span><select value={preferences.quality} onChange={(event) => onChange({ quality: optionValue(event.target.value, QUALITY_MODES) })}>
      {QUALITY_MODES.map((mode) => <option key={mode} value={mode}>{QUALITY_LABELS[mode]}</option>)}
    </select></label>
    <section aria-labelledby="sound-settings-title">
      <h3 id="sound-settings-title">Sound</h3>
      {needsEnable ? <button type="button" aria-describedby="sound-status" onClick={() => { void onEnableSound(); onChange({ muted: false }); }}>Enable sound</button> : <>
        <label className="motion-control"><input type="checkbox" checked={preferences.muted} onChange={(event) => setMuted(event.target.checked)} /><span>Mute sound</span></label>
        <label className="setting-field"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value={preferences.volume} aria-describedby="sound-status" onChange={(event) => onChange({ volume: Number(event.target.value) })} /></label>
      </>}
      <p id="sound-status" className="muted">{audioStatus.message}</p>
    </section>
    <label className="motion-control"><input type="checkbox" checked={preferences.guide} onChange={(event) => onChange({ guide: event.target.checked })} /><span>Show navigation hint</span></label>
    <details className="keyboard-help"><summary>Keyboard shortcuts</summary><KeyboardShortcuts /></details>
    <p className="muted">Only these non-sensitive preferences are saved on this computer. Sound requires a fresh enable action every visit.</p>
    {notice ? <p role="status" className="settings-notice">{notice}</p> : null}
  </Modal>;
}
