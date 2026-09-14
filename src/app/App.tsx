import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { WorldModel } from '../world/model';
import { loadPreferences, savePreferences } from '../content/preferences';
import type { Preferences } from '../content/preferences';
import { CityStage } from './CityStage';
import { actionForKey } from './commands';
import { TourNote } from './Controls';
import { Help } from './Help';
import { Icon } from './Icon';
import { Settings } from './Settings';
import { useCityRuntime } from './useCityRuntime';
import { useFullscreen } from './useFullscreen';

export function App() {
  const [startup] = useState(loadPreferences);
  const [preferences, setPreferences] = useState(startup.value);
  const [storageNotice, setStorageNotice] = useState(startup.notice);
  const [model] = useState(() => new WorldModel(startup.value.motion === 'reduced' ||
    (startup.value.motion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches), {
    weather: startup.value.weather, rainIntensityMmH: startup.value.rainIntensityMmH, timeMode: startup.value.timeMode,
    natural: startup.value.natural, quality: startup.value.quality,
  }));
  const { status, lifecycle, detail, attempt, canvas, send, retry } = useCityRuntime(model);
  const [panel, setPanel] = useState<'help' | 'settings' | null>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const screenMode = useFullscreen(root);
  const live = lifecycle === 'ready';

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (preferences.motion === 'system') send({ type: 'set-reduced-motion', reduced: query.matches });
    };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, [preferences.motion, send]);

  function changePreferences(change: Partial<Preferences>) {
    const next = { ...preferences, ...change };
    if (change.weather) next.natural = false;
    setPreferences(next);
    setStorageNotice(savePreferences(next));
    if (change.motion) send({ type: 'set-reduced-motion', reduced: change.motion === 'reduced' ||
      (change.motion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) });
    if (change.weather) send({ type: 'set-weather', weather: change.weather });
    if (change.rainIntensityMmH !== undefined) send({ type: 'set-rain-intensity', millimetersPerHour: change.rainIntensityMmH });
    if (change.timeMode) send({ type: 'set-time', time: change.timeMode });
    if (change.natural !== undefined) send({ type: 'set-natural', natural: next.natural });
    if (change.quality) send({ type: 'set-quality', quality: change.quality });
  }
  function openHelp() {
    send({ type: 'open-panel' });
    setPanel('help');
  }
  function closeHelp() {
    send({ type: 'close-panel' });
    setPanel(null);
  }
  function closeSettings() {
    setPanel(null);
    settingsTrigger.current?.focus({ preventScroll: true });
  }
  function toggleSettings() {
    if (panel === 'settings') { closeSettings(); return; }
    if (panel === 'help') send({ type: 'close-panel' });
    send({ type: 'stop' });
    setPanel('settings');
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.nativeEvent.isComposing || event.altKey || event.metaKey || event.ctrlKey || panel === 'help') return;
    const key = event.key.toLowerCase();
    if (key === '?') { event.preventDefault(); openHelp(); return; }
    if (key === 'f') { event.preventDefault(); if (!event.repeat) void screenMode.toggle(); return; }
    if (key === 'escape') {
      if (screenMode.blocksEscape()) return;
      event.preventDefault();
      if (screenMode.expanded) screenMode.exitExpanded();
      else if (status.view) send({ type: 'stop' });
      return;
    }
    const action = actionForKey(key);
    if (!action || (action.requiresLive && !live)) return;
    event.preventDefault();
    if (!event.repeat || action.repeatable) send(action.command({ paused: status.paused, touring: Boolean(status.view) }));
  }

  return <main ref={root} className={`city-app${screenMode.expanded ? ' is-expanded' : ''}`} data-reduced-motion={status.reducedMotion}>
    <header className="app-header">
      <div className="wordmark"><Icon name="leaf" /><span>CitiVibe<span className="wordmark-dot">.</span></span></div>
      <p className="header-caption">A small world of its own</p>
    </header>
    <div className="world-layout">
      <CityStage canvas={canvas} attempt={attempt} live={live} guide={preferences.guide} status={status} send={send} onDismissGuide={() => changePreferences({ guide: false })} onKeyDown={keyDown}
        settingsOpen={panel === 'settings'} settingsTrigger={settingsTrigger} onSettings={toggleSettings}
        settings={panel === 'settings' ? <Settings preferences={preferences} onChange={changePreferences} notice={storageNotice} onClose={closeSettings} /> : null}
        fullscreenLabel={screenMode.label} onFullscreen={() => { void screenMode.toggle(); }} />
      {!live ? <div className="lifecycle-panel" role="status"><div><strong>{lifecycle === 'loading' ? 'Growing a little city' : lifecycle === 'lost' || lifecycle === 'restoring' ? 'Restoring city' : 'Live city unavailable'}</strong><p>{detail}</p></div><div className="lifecycle-actions">{lifecycle !== 'loading' && lifecycle !== 'lost' && lifecycle !== 'restoring' ? <button onClick={retry}>Retry live city</button> : null}</div></div> : null}
      {screenMode.message ? <div className="view-notice" role="status"><span>{screenMode.message}</span>{!screenMode.expanded && !screenMode.fullscreen ? <button onClick={screenMode.expand}>Use expanded view</button> : null}</div> : null}
      {storageNotice && panel !== 'settings' ? <p className="view-notice" role="status">{storageNotice}</p> : null}
    </div>
    <footer className="app-footer"><span className={`run-status ${live && !status.paused ? 'is-running' : ''}`}><span aria-hidden="true" />{!live ? 'Live city loading' : status.paused ? 'City paused' : 'City is living'}</span><span className="camera-status">{status.cameraMode === 'tour' ? 'Tour view' : status.cameraMode === 'guided' ? 'Guided view' : status.cameraMode === 'free' ? 'Free view' : 'Overview'}</span><TourNote status={status} live={live} /></footer>
    <p id="navigation-hint" className="sr-only">Drag to pan; Command or Control-drag to rotate and tilt. Focus here to use arrow keys to pan, plus and minus to zoom, Q and E to rotate, W and S to tilt, Space to pause, R to reset, T for tours, F for fullscreen, and question mark for help.</p>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{status.message}</p>
    {panel === 'help' ? <Help reduced={status.reducedMotion} onClose={closeHelp} onReducedChange={(reduced) => changePreferences({ motion: reduced ? 'reduced' : 'full' })} /> : null}
  </main>;
}
