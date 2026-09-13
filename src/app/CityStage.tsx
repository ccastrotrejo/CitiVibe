import type { KeyboardEventHandler, ReactNode, RefObject } from 'react';
import { CITY } from '../content/city';
import { WEATHER_LABELS } from '../content/preferences';
import type { WorldCommand, WorldStatus } from '../world/types';
import { Navigation } from './Controls';
import { Icon } from './Icon';

interface CityStageProps {
  canvas: RefObject<HTMLCanvasElement | null>;
  attempt: number;
  live: boolean;
  guide: boolean;
  status: WorldStatus;
  send: (command: WorldCommand) => void;
  settings: ReactNode;
  settingsOpen: boolean;
  settingsTrigger: RefObject<HTMLButtonElement | null>;
  onSettings: () => void;
  onDismissGuide: () => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function CityStage({ canvas, attempt, live, guide, status, send, settings, settingsOpen, settingsTrigger, onSettings, onDismissGuide, onKeyDown }: CityStageProps) {
  return <section className="scene-shell" data-night={live && status.daylight === 'Night'} aria-label={`${CITY.name} experience`}>
    <h1 className="sr-only">{CITY.name}</h1>
    <div className="scene-navigation" role="region" aria-label="City navigation" aria-describedby="navigation-hint" tabIndex={0} onKeyDown={onKeyDown}>
      <div className={`poster-frame ${live ? 'poster-hidden' : ''}`}>
        <img className="city-poster" src={`/city/${CITY.version}.svg`} alt="Original miniature city with a reservoir running loop, lawns, woodland, a lake and bridge, and a tree-lined mall. Busy avenues and two-way bike paths surround the park; neighbors play basketball and pickleball at Juniper Court." />
      </div>
      <canvas key={attempt} ref={canvas} className={live ? 'world-canvas' : 'world-canvas canvas-hidden'} aria-hidden="true" />
    </div>
    <div className="environment-badge"><Icon name="sun" /><span>{status.daylight}<span className="badge-divider"> / </span>{WEATHER_LABELS[status.weather]}</span></div>
    {guide && live ? <aside className="first-guide"><p><strong>Explore every angle.</strong><span>Drag to pan. Cmd/Ctrl-drag to orbit.</span></p><button className="icon-button" aria-label="Dismiss navigation hint" onClick={onDismissGuide}><Icon name="close" /></button></aside> : null}
    <div className="scene-bottom">
      <div className="settings-anchor">
        {settings}
        <button ref={settingsTrigger} className="settings-trigger" aria-expanded={settingsOpen} aria-controls="city-settings" onClick={onSettings}>Settings</button>
      </div>
      <Navigation live={live} send={send} />
    </div>
  </section>;
}
