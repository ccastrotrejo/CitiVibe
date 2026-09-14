import type { WorldCommand, WorldStatus } from '../world/types';
import { CAMERA_ACTIONS, cameraCommand, cityCommand } from './commands';
import { Icon } from './Icon';

interface PrimaryControlsProps {
  status: WorldStatus;
  live: boolean;
  send: (command: WorldCommand) => void;
  fullscreenLabel: string;
  onFullscreen: () => void;
}

function actionState(status: WorldStatus) {
  return { paused: status.paused, touring: Boolean(status.view) };
}

export function Navigation({ live, send }: { live: boolean; send: (command: WorldCommand) => void }) {
  return <div className="navigation" role="group" aria-label="Camera navigation">
    {CAMERA_ACTIONS.map((action) => <button key={action.id} className={`icon-button ${action.position}`} data-static="true" aria-label={action.label} title={action.label} disabled={!live && action.requiresLive} onClick={() => send(cameraCommand(action))}><Icon name={action.icon} /></button>)}
  </div>;
}

export function PrimaryControls({ status, live, send, fullscreenLabel, onFullscreen }: PrimaryControlsProps) {
  return <div className="primary-controls" role="group" aria-label="City controls">
    <button className="pause-button" disabled={!live} aria-pressed={status.paused} title={status.paused ? 'Resume city' : 'Pause city'} onClick={() => send(cityCommand('pause', actionState(status)))}>
      <span className="pause-icon" aria-hidden="true">
        <span className={status.paused ? 'icon-state' : 'icon-state is-visible'}><Icon name="pause" /></span>
        <span className={status.paused ? 'icon-state is-visible' : 'icon-state'}><Icon name="play" /></span>
      </span><span className="control-label">{status.paused ? 'Resume city' : 'Pause city'}</span>
    </button>
    <button disabled={!live || (!status.view && status.paused && !status.reducedMotion)}
      aria-describedby="tour-hint" onClick={() => send(cityCommand('tour', actionState(status)))}>
      {status.view ? 'Stop views' : status.reducedMotion ? 'Guided views' : 'Start tour'}
    </button>
    {status.view?.guided ? <>
      <button className="icon-button" aria-label="Previous view" title="Previous view" onClick={() => send({ type: 'guided-step', direction: -1 })}><Icon name="left" /></button>
      <button className="icon-button" aria-label="Next view" title="Next view" onClick={() => send({ type: 'guided-step', direction: 1 })}><Icon name="right" /></button>
    </> : null}
    <button className="icon-button" aria-label={fullscreenLabel} title={fullscreenLabel} onClick={onFullscreen}><Icon name="expand" /></button>
  </div>;
}

export function TourNote({ status, live }: { status: WorldStatus; live: boolean }) {
  return <p id="tour-hint" className="control-note">{status.view ? `${status.view.guided ? 'Guided view' : 'Tour'} ${status.view.index + 1} / ${status.view.total}: ${status.view.subject}` : !live ? 'Automatic views require live graphics.' : status.paused && !status.reducedMotion ? 'Resume the city to start a continuous tour.' : status.reducedMotion ? 'Guided views advance only when you choose.' : 'Manual navigation or opening a panel stops the tour.'}</p>;
}
