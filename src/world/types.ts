import type { Weather, TimeMode } from './environment';
import type { QualityMode } from '../content/preferences';

export type CameraMode = 'overview' | 'free' | 'guided' | 'tour';
export type Lifecycle = 'loading' | 'ready' | 'error' | 'unsupported' | 'lost' | 'restoring';

export interface CameraPose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  zoom: number;
}

export type WorldCommand =
  | { type: 'navigate'; panX?: number; panZ?: number; rotate?: number; tilt?: number; zoom?: number }
  | { type: 'reset' }
  | { type: 'stop' }
  | { type: 'set-paused'; paused: boolean }
  | { type: 'set-reduced-motion'; reduced: boolean }
  | { type: 'start-tour' }
  | { type: 'guided-step'; direction: -1 | 1 }
  | { type: 'set-weather'; weather: Weather }
  | { type: 'set-rain-intensity'; millimetersPerHour: number }
  | { type: 'set-time'; time: TimeMode }
  | { type: 'set-natural'; natural: boolean }
  | { type: 'set-quality'; quality: QualityMode }
  | { type: 'open-panel' }
  | { type: 'close-panel' };

export interface ViewStatus {
  guided: boolean;
  index: number;
  total: number;
  subject: string;
}

export interface WorldStatus {
  cameraMode: CameraMode;
  paused: boolean;
  reducedMotion: boolean;
  view: ViewStatus | null;
  message: string;
  weather: Weather;
  rainIntensityMmH: number;
  timeMode: TimeMode;
  natural: boolean;
  quality: QualityMode;
  daylight: string;
}

export interface Runtime {
  command(command: WorldCommand): void;
  dispose(): void;
}
