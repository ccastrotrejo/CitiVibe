import type { WorldCommand, WorldStatus } from '../world/types';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface ControlsProps {
  status: WorldStatus;
  live: boolean;
  send: (command: WorldCommand) => void;
  fullscreenLabel: string;
  onFullscreen: () => void;
}

const NAVIGATION: { label: string; icon: IconName; command: WorldCommand; position: string }[] = [
  { label: 'Pan up', icon: 'up', command: { type: 'navigate', panZ: -2 }, position: 'nav-up' },
  { label: 'Pan left', icon: 'left', command: { type: 'navigate', panX: -2 }, position: 'nav-left' },
  { label: 'Reset overview', icon: 'home', command: { type: 'reset' }, position: 'nav-home' },
  { label: 'Pan right', icon: 'right', command: { type: 'navigate', panX: 2 }, position: 'nav-right' },
  { label: 'Pan down', icon: 'down', command: { type: 'navigate', panZ: 2 }, position: 'nav-down' },
  { label: 'Zoom in', icon: 'plus', command: { type: 'navigate', zoom: 0.15 }, position: 'nav-plus' },
  { label: 'Zoom out', icon: 'minus', command: { type: 'navigate', zoom: -0.15 }, position: 'nav-minus' },
  { label: 'Rotate left', icon: 'rotate-left', command: { type: 'navigate', rotate: -0.2 }, position: 'nav-rotate-left' },
  { label: 'Rotate right', icon: 'rotate-right', command: { type: 'navigate', rotate: 0.2 }, position: 'nav-rotate-right' },
  { label: 'More overhead', icon: 'tilt-up', command: { type: 'navigate', tilt: 0.1 }, position: 'nav-tilt-up' },
  { label: 'More street-level', icon: 'tilt-down', command: { type: 'navigate', tilt: -0.1 }, position: 'nav-tilt-down' },
];

export function Navigation({ live, send }: Pick<ControlsProps, 'live' | 'send'>) {
  return <div className="navigation" role="group" aria-label="Camera navigation">
    {NAVIGATION.map(({ label, icon, command, position }) => <button key={label} className={`icon-button ${position}`} data-static="true" aria-label={label} title={label} disabled={!live && command.type !== 'reset'} onClick={() => send(command)}><Icon name={icon} /></button>)}
  </div>;
}

export function Controls({ status, live, send, fullscreenLabel, onFullscreen }: ControlsProps) {
  return <div className="control-bar">
    <div className="primary-controls" role="group" aria-label="City controls">
      <button className="pause-button" disabled={!live} aria-pressed={status.paused} onClick={() => send({ type: 'set-paused', paused: !status.paused })}>
        <span className="pause-icon" aria-hidden="true">
          <span className={status.paused ? 'icon-state' : 'icon-state is-visible'}><Icon name="pause" /></span>
          <span className={status.paused ? 'icon-state is-visible' : 'icon-state'}><Icon name="play" /></span>
        </span>{status.paused ? 'Resume city' : 'Pause city'}
      </button>
      <button disabled={!live || (!status.view && status.paused && !status.reducedMotion)}
        aria-describedby="tour-hint" onClick={() => send({ type: status.view ? 'stop' : 'start-tour' })}>
        {status.view ? 'Stop views' : status.reducedMotion ? 'Guided views' : 'Start tour'}
      </button>
      {status.view?.guided ? <>
        <button onClick={() => send({ type: 'guided-step', direction: -1 })}>Previous view</button>
        <button onClick={() => send({ type: 'guided-step', direction: 1 })}>Next view</button>
      </> : null}
      <button onClick={onFullscreen}>{fullscreenLabel}</button>
    </div>
    <p id="tour-hint" className="control-note">{status.view ? `${status.view.guided ? 'Guided view' : 'Tour'} ${status.view.index + 1} / ${status.view.total}: ${status.view.subject}` : !live ? 'Automatic views require live graphics.' : status.paused && !status.reducedMotion ? 'Resume the city to start a continuous tour.' : status.reducedMotion ? 'Guided views advance only when you choose.' : 'Manual navigation or opening a panel stops the tour.'}</p>
  </div>;
}
