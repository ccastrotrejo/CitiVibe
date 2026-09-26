import type { Group, Object3D } from 'three';
import type { ActorState } from './actors';
import type { PersonWeatherState } from './peopleWeather';
import { applyPersonWeather, type PersonWeatherRig } from './personWeatherArt';

/**
 * Deterministic procedural locomotion.
 *
 * Every cyclic pose is a pure function of an integrated scalar the simulation
 * already produces — `distance` for feet and wheels — never wall-clock time.
 * A pose expressed as f(distance) is automatically frame-rate independent,
 * reproducible from a seed, and ground-locked: while a foot is the support
 * foot it moves backward relative to the hips at exactly body speed, so its
 * world position is constant (no sliding). Wheels use the same rolling-contact
 * identity, spin = distance / radius. Body attitude (pitch/roll) is the only
 * time-filtered term, low-passed from acceleration for a suspension feel.
 *
 * Biomechanics constants follow standard gait literature (Perry; Winter;
 * Saunders/Inman/Eberhart), tuned to this stylized miniature figure. See
 * docs/PHYSICS_AND_MOTION.md.
 */

const TAU = Math.PI * 2;

/** Stance fraction of the gait cycle (stance 60%, swing 40%). */
const DUTY = 0.6;

/** Articulated pedestrian rig dimensions and gait tuning (metres / radians). */
export const WALKER = {
  hipY: 0.8,
  thigh: 0.44,
  shank: 0.44,
  hipHalf: 0.12,
  torsoOffset: 0.22,
  torsoSize: [0.38, 0.5, 0.24] as const,
  headOffset: 0.7,
  headScale: [0.18, 0.22, 0.18] as const,
  shoulderY: 0.4,
  shoulderHalf: 0.25,
  armLen: 0.5,
  armSize: [0.12, 0.5, 0.15] as const,
  thighSize: [0.14, 0.44, 0.16] as const,
  shankSize: [0.13, 0.44, 0.15] as const,
  footSize: [0.15, 0.09, 0.26] as const,
  footFwd: 0.06,
  bobAmp: 0.018,
  stepHeight: 0.075,
  armSwing: 0.28,
  trunkLean: 0.05,
  swayAmp: 0.012,
  listAmp: 0.035,
  strideBase: 0.5,
  stridePerSpeed: 0.5,
  strideMin: 0.5,
  strideMax: 1,
  moveThreshold: 0.06,
  blendRate: 8,
} as const;

export const RUNNER = { stride: 1.55, duty: 0.4, stepHeight: 0.22, hipY: 0.76, bobAmp: 0.025, armSwing: 0.7, trunkLean: 0.16 } as const;

/** Stable per-person gait character; neutral values reproduce the shared baseline gait. */
export interface GaitTraits {
  readonly stride: number;
  readonly arm: number;
  readonly bob: number;
  readonly lean: number;
  /** Cadence phase offset, in gait cycles. */
  readonly phase: number;
}

export const NEUTRAL_GAIT: GaitTraits = Object.freeze({ stride: 1, arm: 1, bob: 1, lean: 1, phase: 0 });

function traitSample(id: string, feature: string): number {
  let hash = 2166136261;
  for (const char of `${id}:gait:${feature}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0x100000000;
}

/** ID-seeded stride, arm, bob, lean and cadence-phase character (no wall time or ambient randomness). */
export function createGaitTraits(id: string): GaitTraits {
  return Object.freeze({
    stride: 0.92 + traitSample(id, 'stride') * 0.16,
    arm: 0.85 + traitSample(id, 'arm') * 0.3,
    bob: 0.75 + traitSample(id, 'bob') * 0.5,
    lean: 0.75 + traitSample(id, 'lean') * 0.5,
    phase: traitSample(id, 'phase'),
  });
}

/**
 * Rig-local stride for a running-capable figure. `run` blends the walking and
 * running gaits (0 walk, 1 run); the simulation integrates cycles with this same
 * length so stance feet stay ground-locked while pace and gait change.
 */
export function blendedStride(localSpeed: number, run: number, traits: GaitTraits = NEUTRAL_GAIT): number {
  const walk = strideLength(localSpeed);
  return (walk + (RUNNER.stride - walk) * clamp(run, 0, 1)) * traits.stride;
}

/** Vehicle wheel radii and attitude tuning. */
export const VEHICLE = {
  busWheelRadius: 0.38,
  carWheelRadius: 0.26,
  pitchGain: 0.008,
  maxPitch: 0.026,
  rollGain: 0.05,
  maxRoll: 0.03,
  steerGain: 0.18,
  maxSteer: 0.3,
  dwellDrop: 0.02,
  tau: 0.22,
} as const;

export interface LegRig {
  hip: Object3D;
  knee: Object3D;
  ankle: Object3D;
}

export interface WalkerRig {
  kind: 'walker';
  scale?: number;
  pelvis: Object3D;
  torso: Object3D;
  legs: [LegRig, LegRig];
  arms: [Object3D, Object3D];
  weatherArt?: PersonWeatherRig;
  readingBook?: Object3D;
}

export interface WheelRig {
  steer: Object3D;
  spin: Object3D;
  front: boolean;
}

export interface VehicleRig {
  kind: 'vehicle';
  body: Object3D;
  wheels: WheelRig[];
  wheelRadius: number;
  pedals?: Object3D[];
  cyclingLegs?: { joints: LegRig; crank: Object3D; pedal: Object3D }[];
}

export type ActorRig = WalkerRig | VehicleRig;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const frac = (value: number) => ((value % 1) + 1) % 1;
const smoothstep = (u: number) => u * u * (3 - 2 * u);
/** Linear blend that returns either endpoint exactly, keeping pure walk/run poses bit-identical. */
const mix = (from: number, to: number, t: number) => t <= 0 ? from : t >= 1 ? to : from + (to - from) * t;

/** Comfortable stride length grows roughly linearly with speed, then clamps. */
export function strideLength(speed: number): number {
  return clamp(WALKER.strideBase + WALKER.stridePerSpeed * Math.abs(speed), WALKER.strideMin, WALKER.strideMax);
}

/** Signed 0..1 gait phase for a stride, offset by half a cycle for the trailing leg. */
export function gaitPhase(distance: number, stride: number, offset = 0): number {
  return frac(distance / stride + offset);
}

/**
 * Foot position in the actor's forward (z) axis relative to the hips, plus lift.
 * Stance: the foot slides from front (+A) to back (-A) at exactly body speed, so
 * d(worldZ)/d(distance) = 0 — provably no sliding. Swing: an eased forward arc
 * that returns to the ground at both ends.
 */
export function footTrajectory(phase: number, stride: number): { z: number; y: number } {
  const amplitude = 0.3 * stride;
  if (phase < DUTY) {
    return { z: amplitude - phase * stride, y: 0 };
  }

  const u = (phase - DUTY) / (1 - DUTY);
  return { z: -amplitude + smoothstep(u) * 2 * amplitude, y: WALKER.stepHeight * Math.sin(Math.PI * u) };
}

/** Shorter stance leaves a flight phase with both feet off the running track. */
export function runningFootTrajectory(phase: number): { z: number; y: number } {
  const amplitude = RUNNER.duty * RUNNER.stride / 2;
  if (phase < RUNNER.duty) return { z: amplitude - phase * RUNNER.stride, y: 0 };
  const swing = (phase - RUNNER.duty) / (1 - RUNNER.duty);
  return { z: -amplitude + smoothstep(swing) * 2 * amplitude, y: RUNNER.stepHeight * Math.sin(Math.PI * swing) };
}

/**
 * Closed-form 2-bone inverse kinematics for one leg in the sagittal plane.
 * `h` is the forward (+z) offset of the ankle from the hip; `drop` is how far
 * the ankle sits below the hip. Returns joint angles the rig applies as
 * hip.rotation.x = -hip and knee.rotation.x = knee so the ankle hits the target.
 */
export function solveLeg(h: number, drop: number): { hip: number; knee: number } {
  const l1 = WALKER.thigh;
  const l2 = WALKER.shank;
  const reach = clamp(Math.hypot(h, drop), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const legDir = Math.atan2(h, drop);
  const gamma = Math.acos(clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1));
  const interior = Math.acos(clamp((l1 * l1 + l2 * l2 - reach * reach) / (2 * l1 * l2), -1, 1));
  return { hip: legDir + gamma, knee: Math.PI - interior };
}

export interface WalkerPose {
  distance: number;
  speed: number;
  blend: number;
  reducedMotion: boolean;
  running?: boolean;
  activity?: ActorState['activity'];
  activityTime?: number;
  /** 1 seated, 0 standing; the simulation holds translation during intermediate values. */
  sitting?: number;
  weather?: PersonWeatherState;
  /** Optional per-person gait character; omitted callers keep the neutral baseline. */
  traits?: GaitTraits;
  /**
   * Optional integrated running gait (world-metre stride, cycle count and 0..1
   * run blend). Used only for animated, non-cautious runners.
   */
  gait?: { readonly cycle: number; readonly stride: number; readonly run: number };
}

let footZ = 0;
let footY = 0;
/** Allocation-free foot trajectory shared by blended walk/run cycles. */
function blendedFoot(phase: number, stride: number, duty: number, stepHeight: number): void {
  const amplitude = duty * stride / 2;
  if (phase < duty) {
    footZ = amplitude - phase * stride;
    footY = 0;
    return;
  }
  const swing = (phase - duty) / (1 - duty);
  footZ = -amplitude + smoothstep(swing) * 2 * amplitude;
  footY = stepHeight * Math.sin(Math.PI * swing);
}

/** Pose an articulated pedestrian rig from its travelled distance. */
export function poseWalkerRig(rig: WalkerRig, pose: WalkerPose): void {
  const { reducedMotion } = pose;
  const reading = pose.activity === 'reading' && pose.speed === 0;
  const observingWindow = pose.activity === 'window-shopping' && pose.speed === 0;
  const civicDuty = pose.activity === 'civic-duty' && pose.speed === 0;
  const resting = pose.activity === 'resting' && pose.speed === 0;
  if (rig.readingBook) rig.readingBook.scale.setScalar(reading ? 1 : 0);
  const sitting = smoothstep(clamp(pose.sitting ?? 0, 0, 1));
  const blend = reading || observingWindow || civicDuty || resting || sitting > 0 ||
    (pose.sitting !== undefined && pose.speed === 0) ? 0 : pose.blend;
  // Solve in rig-local metres so shorter legs take shorter steps, without skating.
  const scale = rig.scale ?? 1;
  const distance = pose.distance / scale;
  const speed = pose.speed / scale;
  const running = pose.running && !reducedMotion && !pose.weather?.cautious;
  // Reduced motion keeps the shared, calmer baseline gait for everyone.
  const traits = reducedMotion ? NEUTRAL_GAIT : pose.traits ?? NEUTRAL_GAIT;
  const integrated = running ? pose.gait : undefined;
  const run = integrated ? clamp(integrated.run, 0, 1) : running ? 1 : 0;
  const stride = integrated ? integrated.stride / scale
    : (running ? RUNNER.stride : strideLength(speed)) * traits.stride;
  const cycle = (integrated ? integrated.cycle : distance / stride) + traits.phase;
  const cyclePhase = frac(cycle);
  const bob = reducedMotion ? 0 : traits.bob * mix(WALKER.bobAmp * -Math.cos(2 * TAU * cyclePhase),
    RUNNER.bobAmp * Math.cos(2 * TAU * (cyclePhase - 0.45)), run);
  const pelvisY = WALKER.hipY - 0.36 * sitting + (mix(0, RUNNER.hipY - WALKER.hipY, run) + bob) * blend;
  rig.pelvis.position.y = pelvisY;
  // Shift the hips over planted feet, rather than dragging the feet forward to sit.
  rig.pelvis.position.z = -0.2 * sitting;

  rig.torso.rotation.x = mix(WALKER.trunkLean, RUNNER.trunkLean, run) * traits.lean * blend * (reducedMotion ? 0.4 : 1)
    + 0.08 * sitting + 0.96 * sitting * (1 - sitting);
  rig.torso.rotation.z = reducedMotion || blend === 0 ? 0 : WALKER.listAmp * Math.sin(TAU * cyclePhase) * blend;
  rig.torso.position.x = reducedMotion || blend === 0 ? 0 : WALKER.swayAmp * Math.sin(TAU * cyclePhase) * blend;
  rig.torso.rotation.y = !reducedMotion && pose.activity === 'looking-around'
    ? 0.1 * Math.sin(Math.PI * Math.min(1, (pose.activityTime ?? 0) / 1.5)) : 0;
  if (civicDuty && !reducedMotion) {
    rig.torso.rotation.y = 0.12 * Math.sin(Math.PI * Math.min(1, (pose.activityTime ?? 0) / 2.5));
  }

  const duty = mix(DUTY, RUNNER.duty, run);
  const stepHeight = mix(WALKER.stepHeight, RUNNER.stepHeight, run);
  for (let leg = 0; leg < 2; leg += 1) {
    blendedFoot(frac(cycle + (leg === 1 ? 0.5 : 0)), stride, duty, stepHeight);
    const targetZ = footZ * blend - rig.pelvis.position.z;
    const { hip, knee } = solveLeg(targetZ, pelvisY - footY * blend);
    rig.legs[leg].hip.rotation.x = -hip;
    rig.legs[leg].knee.rotation.x = knee;
    // Keep the sole flat on the ground (plantigrade): the knee node's world tilt
    // is (-hip + knee), so the ankle counter-rotates by (hip - knee) to cancel it.
    rig.legs[leg].ankle.rotation.x = hip - knee;
  }

  const swing = (reducedMotion ? 0.4 : 1) * mix(WALKER.armSwing, RUNNER.armSwing, run) * traits.arm * blend;
  rig.arms[0].rotation.x = swing * Math.cos(TAU * cyclePhase) - 0.45 * sitting;
  rig.arms[1].rotation.x = swing * Math.cos(TAU * frac(cycle + 0.5)) - 0.45 * sitting;
  if (reading) {
    rig.arms[0].rotation.x = -0.95;
    rig.arms[1].rotation.x = -0.95;
  }
  if (rig.weatherArt) rig.weatherArt.armSwing = rig.arms[1].rotation.x;
  applyPersonWeather(rig, pose.weather);
}

interface VehiclePose {
  distance: number;
  pitch: number;
  roll: number;
  steer: number;
  drop: number;
}

/** Pose a vehicle rig: wheels roll from distance, body carries filtered attitude. */
export function poseVehicleRig(rig: VehicleRig, pose: VehiclePose): void {
  rig.body.rotation.x = pose.pitch;
  rig.body.rotation.z = pose.roll;
  rig.body.position.y = -pose.drop;
  const spin = pose.distance / rig.wheelRadius;
  for (const wheel of rig.wheels) {
    wheel.spin.rotation.x = spin;
    if (wheel.front) wheel.steer.rotation.y = pose.steer;
  }
  rig.pedals?.forEach((pedal, index) => {
    pedal.rotation.x = pose.distance / 0.65 + index * Math.PI;
  });
  for (const { joints, crank, pedal } of rig.cyclingLegs ?? []) {
    const phase = crank.rotation.x;
    pedal.rotation.x = -phase;
    // Cranks and hips use the same bicycle-body coordinates; the platform stays level.
    const y = crank.position.y + pedal.position.y * Math.cos(phase) - pedal.position.z * Math.sin(phase) + 0.0225;
    const z = crank.position.z + pedal.position.y * Math.sin(phase) + pedal.position.z * Math.cos(phase);
    const angles = solveLeg(z - joints.hip.position.z, joints.hip.position.y - y);
    joints.hip.rotation.x = -angles.hip;
    joints.knee.rotation.x = angles.knee;
    joints.ankle.rotation.x = angles.hip - angles.knee;
  }
}

/** Put a freshly built rig into a resting stance so nothing pokes the ground. */
export function poseNeutral(rig: ActorRig): void {
  if (rig.kind === 'walker') {
    poseWalkerRig(rig, { distance: 0, speed: 0, blend: 0, reducedMotion: false });
  } else {
    poseVehicleRig(rig, { distance: 0, pitch: 0, roll: 0, steer: 0, drop: 0 });
  }
}

const shortestAngle = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

interface Memory {
  blend: number;
  speed: number;
  heading: number;
  pitch: number;
  roll: number;
  steer: number;
  drop: number;
  traits: GaitTraits;
}

/**
 * Per-frame locomotion driver. Gait, wheel spin, and bob are stateless functions
 * of distance; only vehicle attitude keeps a small smoothed memory per actor.
 * Freezing is implicit: when the simulation is paused the driver is not called,
 * so rigs hold their last deterministic pose.
 */
export class Locomotion {
  private readonly memory = new Map<string, Memory>();
  private readonly walkerPose: WalkerPose = {
    distance: 0, speed: 0, blend: 0, reducedMotion: false, running: false, activity: undefined, activityTime: 0,
  };
  private readonly vehiclePose: VehiclePose = { distance: 0, pitch: 0, roll: 0, steer: 0, drop: 0 };

  reset(): void {
    this.memory.clear();
  }

  /** Rebind retained poses after GPU recovery without advancing suspension or attached lamp mounts. */
  restore(actors: readonly ActorState[], groups: Map<string, Group>, reducedMotion: boolean): void {
    for (const actor of actors) {
      const rig = groups.get(actor.id)?.userData.rig as ActorRig | undefined;
      if (!rig) continue;
      const memory = this.remember(actor);
      if (rig.kind === 'walker') {
        poseWalkerRig(rig, { distance: actor.travelDistance ?? actor.distance, speed: actor.speed, blend: memory.blend, reducedMotion,
          running: actor.gait === 'run', activity: actor.activity, activityTime: actor.activityTime,
          sitting: actor.sitting, weather: actor.weather, traits: memory.traits, gait: actor.runner });
      } else {
        poseVehicleRig(rig, { distance: actor.distance, pitch: memory.pitch, roll: memory.roll,
          steer: memory.steer, drop: memory.drop });
      }
    }
  }

  private remember(actor: ActorState): Memory {
    let entry = this.memory.get(actor.id);
    if (!entry) {
      entry = { blend: 0, speed: actor.speed, heading: actor.heading, pitch: 0, roll: 0, steer: 0, drop: 0,
        traits: createGaitTraits(actor.id) };
      this.memory.set(actor.id, entry);
    }
    return entry;
  }

  update(actors: readonly ActorState[], groups: Map<string, Group>, dt: number, reducedMotion: boolean): void {
    if (!(dt > 0)) return;
    for (const actor of actors) {
      const group = groups.get(actor.id);
      const rig = group?.userData.rig as ActorRig | undefined;
      if (!rig) continue;
      const memory = this.remember(actor);
      if (rig.kind === 'walker') {
        const moving = actor.state === 'moving' && actor.speed > WALKER.moveThreshold;
        memory.blend += ((moving ? 1 : 0) - memory.blend) * Math.min(1, dt * WALKER.blendRate);
        const pose = this.walkerPose;
        pose.distance = actor.travelDistance ?? actor.distance;
        pose.speed = actor.speed;
        pose.blend = memory.blend;
        pose.reducedMotion = reducedMotion;
        pose.running = actor.gait === 'run';
        pose.activity = actor.activity;
        pose.activityTime = actor.activityTime;
        pose.sitting = actor.sitting;
        pose.weather = actor.weather;
        pose.traits = memory.traits;
        pose.gait = actor.runner;
        poseWalkerRig(rig, pose);
        continue;
      }
      const acceleration = (actor.speed - memory.speed) / dt;
      const yawRate = shortestAngle(memory.heading, actor.heading) / dt;
      const pitchTarget = clamp(-VEHICLE.pitchGain * acceleration, -VEHICLE.maxPitch, VEHICLE.maxPitch);
      const rollTarget = clamp(-VEHICLE.rollGain * actor.speed * yawRate, -VEHICLE.maxRoll, VEHICLE.maxRoll);
      const steerTarget = clamp(VEHICLE.steerGain * yawRate, -VEHICLE.maxSteer, VEHICLE.maxSteer);
      const dropTarget = actor.state === 'dwelling' ? VEHICLE.dwellDrop : 0;
      const smoothing = Math.min(1, dt / VEHICLE.tau);
      memory.pitch += ((reducedMotion ? 0 : pitchTarget) - memory.pitch) * smoothing;
      memory.roll += ((reducedMotion ? 0 : rollTarget) - memory.roll) * smoothing;
      memory.steer += ((reducedMotion ? 0 : steerTarget) - memory.steer) * smoothing;
      memory.drop += (dropTarget - memory.drop) * smoothing;
      const vehiclePose = this.vehiclePose;
      vehiclePose.distance = actor.distance;
      vehiclePose.pitch = memory.pitch;
      vehiclePose.roll = memory.roll;
      vehiclePose.steer = memory.steer;
      vehiclePose.drop = memory.drop;
      poseVehicleRig(rig, vehiclePose);
      memory.speed = actor.speed;
      memory.heading = actor.heading;
    }
  }
}
