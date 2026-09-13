import type { KeyboardEventHandler, RefObject } from 'react';
import { CITY, LANDMARKS } from '../content/city';
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
  onCycle: (direction: number) => void;
  onDismissGuide: () => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function CityStage({ canvas, attempt, live, guide, status, send, onCycle, onDismissGuide, onKeyDown }: CityStageProps) {
  const selected = LANDMARKS.find(({ id }) => id === status.selectedId);
  return <section className="scene-shell" aria-label={`${CITY.name} experience`}>
    <h1 className="sr-only">{CITY.name}</h1>
    <div className="scene-navigation" role="region" aria-label="City navigation" aria-describedby="navigation-hint" tabIndex={0} onKeyDown={onKeyDown}>
      <div className={`poster-frame ${live ? 'poster-hidden' : ''}`}>
        <img className="city-poster" src={`/city/${CITY.version}.svg`} alt="Original miniature city with a reservoir running loop, lawns, woodland, a lake and bridge, and a tree-lined mall. Busy avenues and two-way bike paths surround the park; neighbors play basketball and pickleball at Juniper Court." />
        {!live && selected ? <div className={`static-marker marker-${selected.id}`}><span aria-hidden="true" />{selected.name}</div> : null}
      </div>
      <canvas key={attempt} ref={canvas} className={live ? 'world-canvas' : 'world-canvas canvas-hidden'} aria-hidden="true" />
    </div>
    <div className="environment-badge"><Icon name="sun" /><span>{status.daylight}<span className="badge-divider"> / </span>{status.weather.charAt(0).toUpperCase() + status.weather.slice(1)}</span></div>
    {guide && live ? <aside className="first-guide"><p><strong>Explore every angle.</strong><span>Drag to pan. Cmd/Ctrl-drag to orbit.</span></p><button className="icon-button" aria-label="Dismiss navigation hint" onClick={onDismissGuide}><Icon name="close" /></button></aside> : null}
    <div className="scene-bottom">
      <div className="place-control">
        <div className="place-label"><span className="eyebrow">Around the neighborhood</span>{status.selectedId ? <button className="icon-button" aria-label="Clear selection" onClick={() => send({ type: 'clear-selection' })}><Icon name="close" /></button> : null}</div>
        <div className="place-heading"><button className="icon-button" aria-label="Previous landmark" onClick={() => onCycle(-1)}><Icon name="left" /></button><span>{selected?.name ?? 'Explore a little closer'}</span><button className="icon-button" aria-label="Next landmark" onClick={() => onCycle(1)}><Icon name="right" /></button></div>
        {selected ? <p className="place-description">{selected.description}</p> : null}
      </div>
      <Navigation live={live} send={send} />
    </div>
  </section>;
}
