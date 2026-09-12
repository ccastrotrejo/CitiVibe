import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { LANDMARKS } from '../content/city';
import { WorldModel } from '../world/model';
import type { WorldCommand } from '../world/types';
import { loadPreferences, savePreferences } from '../content/preferences';
import type { Preferences } from '../content/preferences';
import { CityStage } from './CityStage';
import { Controls } from './Controls';
import { Help } from './Help';
import { Icon } from './Icon';
import { Settings } from './Settings';
import { useCityAudio } from './useCityAudio';
import { useCityRuntime } from './useCityRuntime';
import { useFullscreen } from './useFullscreen';

const AUDIO_STATUS_LABELS = {
  off: 'Sound off',
  enabling: 'Enabling sound…',
  on: 'Sound on',
  muted: 'Sound muted',
  blocked: 'Sound blocked',
  error: 'Sound error',
} as const;

export function App() {
  const [startup] = useState(loadPreferences);
  const [preferences, setPreferences] = useState(startup.value);
  const [storageNotice, setStorageNotice] = useState(startup.notice);
  const [model] = useState(() => new WorldModel(startup.value.motion === 'reduced' ||
    (startup.value.motion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches), {
    weather: startup.value.weather, timeMode: startup.value.timeMode,
    natural: startup.value.natural, quality: startup.value.quality,
  }));
  const { status, lifecycle, detail, attempt, canvas, send, retry } = useCityRuntime(model);
  const [panel, setPanel] = useState<'help' | 'settings' | null>(null);
  const root = useRef<HTMLElement>(null);
  const screenMode = useFullscreen(root);
  const live = lifecycle === 'ready';
  const audio = useCityAudio({ paused: status.paused, live, weather: status.weather, volume: preferences.volume });

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
    setPreferences(next);
    setStorageNotice(savePreferences(next));
    if (change.motion) send({ type: 'set-reduced-motion', reduced: change.motion === 'reduced' ||
      (change.motion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) });
    if (change.weather) send({ type: 'set-weather', weather: change.weather });
    if (change.timeMode) send({ type: 'set-time', time: change.timeMode });
    if (change.natural !== undefined) send({ type: 'set-natural', natural: change.natural });
    if (change.quality) send({ type: 'set-quality', quality: change.quality });
  }
  function openPanel(next: 'help' | 'settings') {
    send({ type: 'open-panel' });
    setPanel(next);
  }
  function closePanel() {
    send({ type: 'close-panel' });
    setPanel(null);
  }
  function cycle(direction: number) {
    const current = LANDMARKS.findIndex(({ id }) => id === model.selectedId);
    const next = current < 0 ? (direction > 0 ? 0 : LANDMARKS.length - 1) : (current + direction + LANDMARKS.length) % LANDMARKS.length;
    send({ type: 'focus-landmark', id: LANDMARKS[next].id });
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.nativeEvent.isComposing || event.altKey || event.metaKey || event.ctrlKey || panel) return;
    const key = event.key.toLowerCase();
    if (key === '?') { event.preventDefault(); openPanel('help'); return; }
    if (key === 'f') { event.preventDefault(); if (!event.repeat) void screenMode.toggle(); return; }
    if (key === '[' || key === ']') { event.preventDefault(); cycle(key === ']' ? 1 : -1); return; }
    if (key === 'escape') {
      if (screenMode.blocksEscape()) return;
      event.preventDefault();
      if (screenMode.expanded) screenMode.exitExpanded();
      else send({ type: status.view ? 'stop' : 'clear-selection' });
      return;
    }
    if (key === 'r') { event.preventDefault(); send({ type: 'reset' }); return; }
    if (!live) return;
    const commands: Record<string, WorldCommand> = {
      arrowup: { type: 'navigate', panZ: -2 }, arrowdown: { type: 'navigate', panZ: 2 },
      arrowleft: { type: 'navigate', panX: -2 }, arrowright: { type: 'navigate', panX: 2 },
      '+': { type: 'navigate', zoom: 0.15 }, '=': { type: 'navigate', zoom: 0.15 }, '-': { type: 'navigate', zoom: -0.15 },
      q: { type: 'navigate', rotate: -0.2 }, e: { type: 'navigate', rotate: 0.2 },
      w: { type: 'navigate', tilt: 0.1 }, s: { type: 'navigate', tilt: -0.1 },
      ' ': { type: 'set-paused', paused: !model.paused },
      t: { type: status.view ? 'stop' : 'start-tour' },
    };
    if (commands[key]) {
      event.preventDefault();
      if (!event.repeat || commands[key].type === 'navigate') send(commands[key]);
    }
  }

  return <main ref={root} className={`city-app${screenMode.expanded ? ' is-expanded' : ''}`} data-reduced-motion={status.reducedMotion}>
    <header className="app-header">
      <div className="wordmark"><Icon name="leaf" /><span>LivingCity<span className="wordmark-dot">.</span></span></div>
      <p className="header-caption">A small world of its own</p>
      <button className="help-button" onClick={() => openPanel('help')}><Icon name="help" /><span>Field guide</span></button>
    </header>
    <div className="world-layout">
      <CityStage canvas={canvas} attempt={attempt} live={live} guide={preferences.guide} status={status} send={send} onCycle={cycle} onDismissGuide={() => changePreferences({ guide: false })} onKeyDown={keyDown} />
      {!live ? <div className="lifecycle-panel" role="status"><div><strong>{lifecycle === 'loading' ? 'Growing a little city' : lifecycle === 'lost' || lifecycle === 'restoring' ? 'Restoring city' : 'Live city unavailable'}</strong><p>{detail}</p></div><div className="lifecycle-actions">{lifecycle !== 'loading' && lifecycle !== 'lost' && lifecycle !== 'restoring' ? <button onClick={retry}>Retry live city</button> : null}</div></div> : null}
      <Controls status={status} live={live} send={send} onSettings={() => openPanel('settings')} fullscreenLabel={screenMode.label} onFullscreen={() => { void screenMode.toggle(); }} />
      {screenMode.message ? <div className="view-notice" role="status"><span>{screenMode.message}</span>{!screenMode.expanded && !screenMode.fullscreen ? <button onClick={screenMode.expand}>Use expanded view</button> : null}</div> : null}
      {storageNotice && panel !== 'settings' ? <p className="view-notice" role="status">{storageNotice}</p> : null}
    </div>
    <footer className="app-footer"><span className={`run-status ${live && !status.paused ? 'is-running' : ''}`}><span aria-hidden="true" />{!live ? 'Live city loading' : status.paused ? 'City paused' : 'City is living'}</span><span className="camera-status">{status.cameraMode === 'tour' ? 'Tour view' : status.cameraMode === 'focus' ? 'Landmark view' : status.cameraMode === 'free' ? 'Free view' : 'Overview'}</span><span>{AUDIO_STATUS_LABELS[audio.status.state]}</span></footer>
    <p id="navigation-hint" className="sr-only">Drag to pan; Command or Control-drag to rotate and tilt. Focus here to use arrow keys to pan, plus and minus to zoom, Q and E to rotate, W and S to tilt, brackets to visit landmarks, Space to pause, R to reset, T for tours, F for fullscreen, and question mark for help.</p>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{status.message}</p>
    {panel === 'help' ? <Help reduced={status.reducedMotion} onClose={closePanel} onReducedChange={(reduced) => changePreferences({ motion: reduced ? 'reduced' : 'full' })} /> : null}
    {panel === 'settings' ? <Settings preferences={preferences} audioStatus={audio.status} onChange={changePreferences} onEnableSound={audio.enable} onSetMuted={audio.setMuted} notice={storageNotice} onClose={closePanel} /> : null}
  </main>;
}
