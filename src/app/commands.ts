import type { WorldCommand } from '../world/types';
import type { IconName } from './Icon';

/** Camera and city state a shortcut or button needs to build its command. */
export interface ActionState {
  paused: boolean;
  touring: boolean;
}

export interface ControlAction {
  id: string;
  label: string;
  keys: string[];
  /** Reset stays available on the static fallback; every other world action needs live graphics. */
  requiresLive: boolean;
  /** Held keys repeat only for continuous camera movement. */
  repeatable: boolean;
  command: (state: ActionState) => WorldCommand;
}

export interface CameraAction extends ControlAction {
  icon: IconName;
  position: string;
}

function fixed(command: WorldCommand) {
  return () => command;
}

type CameraActionSpec = Omit<CameraAction, 'requiresLive' | 'repeatable'>;

const CAMERA_SPECS: CameraActionSpec[] = [
  { id: 'pan-up', label: 'Pan up', icon: 'up', position: 'nav-up', keys: ['arrowup'], command: fixed({ type: 'navigate', panZ: -2 }) },
  { id: 'pan-left', label: 'Pan left', icon: 'left', position: 'nav-left', keys: ['arrowleft'], command: fixed({ type: 'navigate', panX: -2 }) },
  { id: 'reset', label: 'Reset overview', icon: 'home', position: 'nav-home', keys: ['r'], command: fixed({ type: 'reset' }) },
  { id: 'pan-right', label: 'Pan right', icon: 'right', position: 'nav-right', keys: ['arrowright'], command: fixed({ type: 'navigate', panX: 2 }) },
  { id: 'pan-down', label: 'Pan down', icon: 'down', position: 'nav-down', keys: ['arrowdown'], command: fixed({ type: 'navigate', panZ: 2 }) },
  { id: 'zoom-in', label: 'Zoom in', icon: 'plus', position: 'nav-plus', keys: ['+', '='], command: fixed({ type: 'navigate', zoom: 0.15 }) },
  { id: 'zoom-out', label: 'Zoom out', icon: 'minus', position: 'nav-minus', keys: ['-'], command: fixed({ type: 'navigate', zoom: -0.15 }) },
  { id: 'rotate-left', label: 'Rotate left', icon: 'rotate-left', position: 'nav-rotate-left', keys: ['q'], command: fixed({ type: 'navigate', rotate: -0.2 }) },
  { id: 'rotate-right', label: 'Rotate right', icon: 'rotate-right', position: 'nav-rotate-right', keys: ['e'], command: fixed({ type: 'navigate', rotate: 0.2 }) },
  { id: 'tilt-up', label: 'More overhead', icon: 'tilt-up', position: 'nav-tilt-up', keys: ['w'], command: fixed({ type: 'navigate', tilt: 0.1 }) },
  { id: 'tilt-down', label: 'More street-level', icon: 'tilt-down', position: 'nav-tilt-down', keys: ['s'], command: fixed({ type: 'navigate', tilt: -0.1 }) },
];

export const CAMERA_ACTIONS: CameraAction[] = CAMERA_SPECS.map((action) => ({
  ...action, requiresLive: action.id !== 'reset', repeatable: true,
}));

export const CITY_ACTIONS: ControlAction[] = [
  {
    id: 'pause', label: 'Pause or resume the city', keys: [' '], requiresLive: true, repeatable: false,
    command: (state) => ({ type: 'set-paused', paused: !state.paused }),
  },
  {
    id: 'tour', label: 'Start or stop automatic views', keys: ['t'], requiresLive: true, repeatable: false,
    command: (state) => ({ type: state.touring ? 'stop' : 'start-tour' }),
  },
];

export const WORLD_ACTIONS: ControlAction[] = [...CAMERA_ACTIONS, ...CITY_ACTIONS];

/** Camera commands never depend on city state; this keeps their call sites honest. */
const STATELESS: ActionState = { paused: false, touring: false };

export function cameraCommand(action: CameraAction): WorldCommand {
  return action.command(STATELESS);
}

export function cameraAction(id: string): CameraAction {
  const action = CAMERA_ACTIONS.find((entry) => entry.id === id);
  if (!action) throw new Error(`Unknown camera action: ${id}`);
  return action;
}

export function cityCommand(id: 'pause' | 'tour', state: ActionState): WorldCommand {
  const action = CITY_ACTIONS.find((entry) => entry.id === id);
  if (!action) throw new Error(`Unknown city action: ${id}`);
  return action.command(state);
}

/** Resolve a lower-cased key to the same action its on-screen control dispatches. */
export function actionForKey(key: string): ControlAction | null {
  return WORLD_ACTIONS.find((action) => action.keys.includes(key)) ?? null;
}
