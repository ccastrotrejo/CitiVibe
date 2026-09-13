import { useEffect, useRef } from 'react';
import { MOTION_MODES, QUALITY_MODES, TIME_MODES, WEATHER_MODES, WEATHER_LABELS, optionValue } from '../content/preferences';
import type { Preferences } from '../content/preferences';
import type { AudioStatus } from '../world/audio';
import { Icon } from './Icon';

interface SettingsProps {
  preferences: Preferences;
  audioStatus: AudioStatus;
  onChange: (change: Partial<Preferences>) => void;
  onEnableSound: () => Promise<void>;
  onSetMuted: (muted: boolean) => Promise<void>;
  onClose: () => void;
  notice: string;
}

const TIME_LABELS: Record<Preferences['timeMode'], string> = {
  afternoon: 'Afternoon', night: 'Night', local: 'Match my clock', cycle: 'Slow day/night cycle',
};
const QUALITY_LABELS: Record<Preferences['quality'], string> = {
  automatic: 'Automatic', high: 'High detail', lightweight: 'Lightweight',
};

export function Settings({ preferences, audioStatus, onChange, onEnableSound, onSetMuted, onClose, notice }: SettingsProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);
  const needsEnable = audioStatus.state === 'off' || audioStatus.state === 'blocked' || audioStatus.state === 'error';
  const setMuted = (muted: boolean) => {
    void onSetMuted(muted);
    onChange({ muted });
  };

  return <section id="city-settings" className="settings-dock" aria-labelledby="settings-title" onKeyDown={(event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }}>
    <div className="settings-heading"><h2 id="settings-title">City settings</h2><button ref={closeButton} className="icon-button" aria-label="Close settings" onClick={onClose}><Icon name="close" /></button></div>
    <div className="settings-scroll">
      <label className="setting-field"><span>Weather</span><select value={preferences.weather} aria-describedby="weather-description" onChange={(event) => onChange({ weather: optionValue(event.target.value, WEATHER_MODES) })}>
        {WEATHER_MODES.map((mode) => <option key={mode} value={mode}>{WEATHER_LABELS[mode]}</option>)}
      </select></label>
      <p id="weather-description" className="muted">Fictional weather, not live data. Rain falls, snow settles and wind moves foliage; wetness and snow clear gradually.</p>
      <label className="motion-control"><input type="checkbox" checked={preferences.natural} onChange={(event) => onChange({ natural: event.target.checked })} /><span>Let the weather drift on its own</span></label>
      {preferences.weather === 'rain' || preferences.natural ? <div className="rain-intensity-control">
        <div className="rain-intensity-heading"><label htmlFor="rain-intensity">Rain intensity</label><output htmlFor="rain-intensity" aria-live="off">{preferences.rainIntensityMmH} mm/h</output></div>
        <input id="rain-intensity" type="range" min="0" max="30" step="1" value={preferences.rainIntensityMmH} aria-valuetext={`${preferences.rainIntensityMmH} millimeters per hour`} aria-describedby="rain-intensity-description" onChange={(event) => onChange({ rainIntensityMmH: Number(event.target.value) })} />
        <p id="rain-intensity-description" className="muted">Fictional rain rate, applied only during rain. Existing water clears gradually.</p>
      </div> : null}
      <label className="setting-field"><span>Time of day</span><select value={preferences.timeMode} onChange={(event) => onChange({ timeMode: optionValue(event.target.value, TIME_MODES) })}>
        {TIME_MODES.map((mode) => <option key={mode} value={mode}>{TIME_LABELS[mode]}</option>)}
      </select></label>
      <section className="settings-sound" aria-labelledby="sound-settings-title">
        <div className="settings-sound-heading">
          <h3 id="sound-settings-title">Sound</h3>
          {needsEnable ? <button type="button" aria-describedby="sound-status" onClick={() => { void onEnableSound(); onChange({ muted: false }); }}>Enable sound</button> :
            <label className="motion-control"><input type="checkbox" checked={preferences.muted} onChange={(event) => setMuted(event.target.checked)} /><span>Mute sound</span></label>}
        </div>
        {!needsEnable ? <label className="setting-field"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value={preferences.volume} aria-describedby="sound-status" onChange={(event) => onChange({ volume: Number(event.target.value) })} /></label> : null}
        <p id="sound-status" className="muted">{audioStatus.message}</p>
      </section>
      <details className="settings-more">
        <summary>More controls</summary>
        <label className="setting-field"><span>Motion</span><select value={preferences.motion} aria-describedby="motion-description" onChange={(event) => onChange({ motion: optionValue(event.target.value, MOTION_MODES) })}>
          <option value="system">Use computer preference</option><option value="reduced">Reduced motion</option><option value="full">Full motion</option>
        </select></label>
        <p id="motion-description" className="muted">Reduced motion starts paused and keeps guided views manual. Street activity can still resume.</p>
        <label className="setting-field"><span>Graphics quality</span><select value={preferences.quality} onChange={(event) => onChange({ quality: optionValue(event.target.value, QUALITY_MODES) })}>
          {QUALITY_MODES.map((mode) => <option key={mode} value={mode}>{QUALITY_LABELS[mode]}</option>)}
        </select></label>
        <label className="motion-control"><input type="checkbox" checked={preferences.guide} onChange={(event) => onChange({ guide: event.target.checked })} /><span>Show navigation hint</span></label>
        <p className="muted">Saved on this computer only. Sound needs a fresh enable action each visit.</p>
      </details>
      {notice ? <p role="status" className="settings-notice">{notice}</p> : null}
    </div>
  </section>;
}
