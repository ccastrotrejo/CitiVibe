import { MathUtils } from 'three';
import type { Object3D } from 'three';
import type { ActorState } from './actors';
import type { EnvironmentFrame } from './environment';

export const VEHICLE_LIGHTING = { period: 0.8, duty: 0.5, edge: 0.035 } as const;

/** Continuous visibility demand; rain/mist/snow also require lights in daylight. */
export function drivingLightLevel(frame: EnvironmentFrame): number {
  return Math.max(frame.night, frame.rain * Math.min(1, frame.rainIntensityMmH / 3),
    frame.snow, MathUtils.smoothstep(frame.fog, 0.006, 0.014));
}

/** 75 flashes/minute, with short soft edges; reduced motion keeps the requested side steady. */
export function indicatorLevel(seconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const phase = ((seconds % VEHICLE_LIGHTING.period) + VEHICLE_LIGHTING.period) % VEHICLE_LIGHTING.period;
  const end = VEHICLE_LIGHTING.period * VEHICLE_LIGHTING.duty;
  return MathUtils.smoothstep(phase, 0, VEHICLE_LIGHTING.edge) *
    (1 - MathUtils.smoothstep(phase, end - VEHICLE_LIGHTING.edge, end));
}

/** Stable oscillator offsets keep different vehicles from flashing as one synchronized fleet. */
export function vehicleIndicatorPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619) >>> 0;
  return hash / 0x100000000 * VEHICLE_LIGHTING.period;
}

export interface VehicleLightLevels {
  head: number;
  tail: number;
  brake: number;
  left: number;
  right: number;
}

export interface VehicleLamp {
  mount: Object3D;
  channel: keyof VehicleLightLevels;
  size: readonly [number, number, number];
}

export interface VehicleLightingRig {
  id: string;
  body: Object3D;
  length: number;
  lamps: VehicleLamp[];
  bicycle: boolean;
}

/** Pure sample of retained simulation state, never wall time or a render-side speed estimate. */
export function sampleVehicleLights(
  actor: ActorState, frame: EnvironmentFrame, seconds: number, reducedMotion: boolean,
  target: VehicleLightLevels,
): void {
  target.head = drivingLightLevel(frame);
  target.tail = target.head * 0.3;
  target.brake = actor.lighting?.braking ? 1 : 0;
  const flash = indicatorLevel(seconds + vehicleIndicatorPhase(actor.id), reducedMotion);
  target.left = actor.lighting?.turn === 'left' ? flash : 0;
  target.right = actor.lighting?.turn === 'right' ? flash : 0;
}
