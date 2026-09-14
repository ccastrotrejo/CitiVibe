import type { KeyboardEventHandler, ReactNode, RefObject } from 'react';
import { CITY } from '../content/city';
import { WEATHER_LABELS } from '../content/preferences';
import type { WorldCommand, WorldStatus } from '../world/types';
import { Navigation, PrimaryControls } from './Controls';
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
  fullscreenLabel: string;
  onFullscreen: () => void;
}

export function CityStage({ canvas, attempt, live, guide, status, send, settings, settingsOpen, settingsTrigger, onSettings, onDismissGuide, onKeyDown, fullscreenLabel, onFullscreen }: CityStageProps) {
  return <section className="scene-shell" data-night={live && status.daylight === 'Night'} aria-label={`${CITY.name} experience`}>
    <h1 className="sr-only">{CITY.name}</h1>
    <div className="scene-navigation" role="region" aria-label="City navigation" aria-describedby="navigation-hint" tabIndex={0} onKeyDown={onKeyDown}>
      <div className={`poster-frame ${live ? 'poster-hidden' : ''}`}>
        <img className="city-poster" src={`/city/${CITY.version}.svg`} alt="Original miniature city with a reservoir running loop, lawns, woodland, a lake and bridge, and a tree-lined mall. Busy avenues and two-way bike paths surround the park; neighbors play basketball and pickleball at Juniper Court." />
      </div>
      <canvas key={attempt} ref={canvas} className={live ? 'world-canvas' : 'world-canvas canvas-hidden'} aria-hidden="true" />
    </div>
    {guide && live ? <aside className="first-guide"><p><strong>Explore every angle.</strong><span>Drag to pan. Cmd/Ctrl-drag to orbit.</span></p><button className="icon-button" aria-label="Dismiss navigation hint" onClick={onDismissGuide}><Icon name="close" /></button></aside> : null}
    <div className="scene-bottom">
      <div className="control-dock">
        <span className="control-weather"><Icon name="sun" /><span className="environment-badge">{status.daylight}<span className="badge-divider"> / </span>{WEATHER_LABELS[status.weather]}</span></span>
        <span className="control-divider" aria-hidden="true" />
        <PrimaryControls status={status} live={live} send={send} fullscreenLabel={fullscreenLabel} onFullscreen={onFullscreen} />
        <div className="settings-anchor">
          {settings}
          <button ref={settingsTrigger} className="icon-button settings-trigger" aria-expanded={settingsOpen} aria-controls="city-settings" aria-label="Settings" title="Settings" onClick={onSettings}><Icon name="settings" /></button>
        </div>
      </div>
      <Navigation live={live} send={send} />
    </div>
  </section>;
}
