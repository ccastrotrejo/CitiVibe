import { Vector3 } from 'three';
import { PARK_ACTORS, PARK_PATHS, PARK_ROUTES, PARK_RUNNING_ROUTE, sampleParkRoute } from '../content/park';
import type { Position } from '../content/city';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import type { BikeShareTripState } from '../content/bikeShare';
import { CityTraffic } from './traffic';
import { PeopleWeather, type PeopleWeatherInput, type PersonWeatherState } from './peopleWeather';
import { canWalkTo, ParkVisitors } from './parkVisitors';
import { DestinationActivities, type DestinationVisit } from './destinationActivities';
import { isParkReader, PARK_MEADOW_VISIT, PARK_READING_DESTINATION, PARK_READING_ENTRY } from './parkActivities';
import { blendedStride, createGaitTraits, type GaitTraits } from './locomotion';

/**
 * Retained park-runner state. Every field advances only on simulation ticks, so
 * pause, hidden-tab catch-up limits and GPU recovery replay the same runner.
 */
export interface RunnerState {
  /** 1 running, 0 cooldown walking; ramps at a bounded rate between them. */
  effort: number;
  /** Seconds of cooldown walking still owed; 0 while running. */
  cooldown: number;
  /** Travel distance at which the next cooldown begins. */
  nextCooldown: number;
  /** Travel distance when fatigue last reset after a cooldown. */
  recovered: number;
  rests: number;
  /** 0 keep-right lane, 1 passing lane; eased between lanes over travelled distance. */
  lane: number;
  laneTarget: 0 | 1;
  /** Signed offset from the track centerline, positive to the runner's left. */
  lateral: number;
  /** Integrated gait cycles, world-metre stride and 0..1 run blend for locomotion. */
  cycle: number;
  stride: number;
  run: number;
}

export interface ActorState {
  id: string;
  kind: 'bus' | 'car' | 'cyclist' | 'pedestrian';
  gait?: 'walk' | 'run';
  position: Position;
  heading: number;
  state: 'moving' | 'waiting' | 'dwelling';
  distance: number;
  travelDistance?: number;
  activity?: 'walking' | 'crossing' | 'waiting-to-cross' | 'looking-around' | 'resting' |
    'reading' | 'window-shopping' | 'civic-duty';
  activityTime?: number;
  visit?: DestinationVisit;
  parkPath?: { id: 'meadow-walk'; distance: number };
  weather?: PersonWeatherState;
  sitting?: number;
  sharedBike?: BikeShareTripState;
  runner?: RunnerState;
  speed: number;
  routeLength: number;
  lighting?: { turn: 'left' | 'right' | null; braking: boolean };
}

export const ACTIVITY = { seed: 2401, maxStep: 1 / 30 } as const;

/** Authored runner envelope and etiquette tuning (miniature choices, not measured running data). */
export const RUNNER_PACE = {
  /** Largest combined surge/drift multiplier on a runner's profile pace. */
  maxFactor: 1.09,
  walkMin: 1.35,
  walkRange: 0.3,
  rampSeconds: 3.5,
  restMinSeconds: 10,
  restRangeSeconds: 15,
  restMinLaps: 1.6,
  restRangeLaps: 2.2,
  /** Distance travelled while easing fully across to the other lane. */
  laneChange: 6,
  followGap: 2.6,
  followGain: 0.8,
  passLook: 6,
  passMargin: 0.08,
} as const;

const TAU = Math.PI * 2;
const RUNNING_TRACK = PARK_PATHS.find(({ id }) => id === 'reservoir-track')!;
/** Two keep-right/passing lanes fit only if side-by-side bodies clear personal space. */
export const RUNNER_LANE_OFFSET = (RUNNING_TRACK.width - PERSON_SPACE.width) / 2;
const LANE_CLEAR = PERSON_SPACE.clearance + 0.01;
const LANES = 2 * RUNNER_LANE_OFFSET >= LANE_CLEAR;
const laneLateral = (lane: number) => LANES ? RUNNER_LANE_OFFSET * (2 * lane * lane * (3 - 2 * lane) - 1) : 0;

function runnerSample(id: string, feature: string): number {
  let hash = 2166136261;
  for (const char of `${id}:runner:${feature}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0x100000000;
}

interface RunnerPace {
  readonly id: string;
  readonly base: number;
  readonly walk: number;
  readonly surgeAmp: number;
  readonly surgePeriod: number;
  readonly surgePhase: number;
  readonly driftAmp: number;
  readonly driftPeriod: number;
  readonly driftPhase: number;
  readonly fatigueAmp: number;
  readonly fatigueDistance: number;
  /** Matches the non-court person rig scale, so world strides map to rig-local strides. */
  readonly scale: number;
  readonly traits: GaitTraits;
}

function createRunnerPace(id: string, base: number, stature: number): RunnerPace {
  return {
    id, base, walk: RUNNER_PACE.walkMin + runnerSample(id, 'walk') * RUNNER_PACE.walkRange,
    surgeAmp: 0.03 + runnerSample(id, 'surge') * 0.03,
    surgePeriod: 140 + runnerSample(id, 'surge-period') * 200,
    surgePhase: runnerSample(id, 'surge-phase'),
    driftAmp: 0.015 + runnerSample(id, 'drift') * 0.015,
    driftPeriod: 500 + runnerSample(id, 'drift-period') * 500,
    driftPhase: runnerSample(id, 'drift-phase'),
    fatigueAmp: 0.03 + runnerSample(id, 'fatigue') * 0.05,
    fatigueDistance: 500 + runnerSample(id, 'fatigue-distance') * 500,
    scale: stature / 1.7,
    traits: createGaitTraits(id),
  };
}

/** Running pace from travelled distance: interval surges, slow drift and fatigue since the last cooldown. */
function runningPace(pace: RunnerPace, runner: RunnerState, travel: number): number {
  const surge = Math.sin(TAU * (travel / pace.surgePeriod + pace.surgePhase));
  const drift = Math.sin(TAU * (travel / pace.driftPeriod + pace.driftPhase));
  const tired = Math.min(1, Math.max(0, (travel - runner.recovered) / pace.fatigueDistance));
  return pace.base * (1 + pace.surgeAmp * (surge > 0 ? surge * surge : 0) + pace.driftAmp * drift -
    pace.fatigueAmp * tired * tired * (3 - 2 * tired));
}

interface ParkVisitor {
  actor: ActorState;
  readonly route: typeof PARK_ROUTES[number];
  next: Vector3;
  desiredSpeed: number;
  advance: number;
  untilReading: number;
  untilMeadow: number;
  meadowDistance: number | null;
  nextHeading: number;
  activityStepped: boolean;
  readonly pace?: RunnerPace;
  nextLane: number;
}

/** Street traffic stays outside the park; park visitors walk through gates to city sidewalks. */
export class ActorSimulation {
  readonly actors: readonly ActorState[];
  readonly traffic: CityTraffic;
  readonly weather: PeopleWeather;
  readonly resting = new ParkVisitors();
  readonly activities = new DestinationActivities();
  elapsed = 0;
  private readonly walkers: ParkVisitor[];
  private readonly routeGroups = new Map<ParkVisitor['route'], ParkVisitor[]>();
  private readonly parkActors: readonly ActorState[];
  private readonly parkNeighbors: readonly ActorState[];
  private readonly lookAhead = new Vector3();
  private readonly meadowExit = new Vector3();
  private meadowMerge: { walker: ParkVisitor; ready: boolean } | null = null;

  constructor(seed: number = ACTIVITY.seed) {
    this.traffic = new CityTraffic(seed);
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const occupied: Vector3[] = [];
    this.walkers = PARK_ACTORS.map(({ id, gait }, index) => {
      const running = gait === 'run';
      const person = createPersonProfile(id, running ? 'runner' : 'park');
      const route = running ? PARK_RUNNING_ROUTE : PARK_ROUTES[index % PARK_ROUTES.length];
      const group = PARK_ACTORS.filter((actor) => actor.gait === gait);
      const ordinal = group.findIndex((actor) => actor.id === id);
      let distance = (ordinal + random() * 0.3) / group.length * route.length;
      const lateral = running ? laneLateral(0) : 0;
      const position = new Vector3();
      let heading = 0;
      let placed = false;
      for (let attempt = 0; attempt < 32; attempt++) {
        sampleParkRoute(route, distance, position);
        sampleParkRoute(route, distance + 0.2, this.lookAhead);
        heading = Math.atan2(this.lookAhead.x - position.x, this.lookAhead.z - position.z);
        position.x += Math.cos(heading) * lateral;
        position.z -= Math.sin(heading) * lateral;
        if (occupied.every((other) => other.distanceTo(position) > PERSON_SPACE.headway)) { placed = true; break; }
        distance = (distance + 3) % route.length;
      }
      if (!placed) throw new Error('Unable to place park visitors with safe spacing.');
      occupied.push(position);
      const actor: ActorState = {
        id, kind: 'pedestrian', gait, position, heading,
        state: 'moving', distance, travelDistance: distance, speed: 0, routeLength: route.length,
      };
      const pace = running ? createRunnerPace(id, person.pace, person.stature) : undefined;
      if (pace) {
        actor.runner = {
          effort: 1, cooldown: 0, rests: 0,
          nextCooldown: distance + route.length * (0.4 + runnerSample(id, 'first-rest') * 2.4),
          recovered: distance - runnerSample(id, 'initial-fatigue') * pace.fatigueDistance,
          lane: 0, laneTarget: 0, lateral, cycle: 0, stride: 0, run: 1,
        };
        actor.runner.stride = pace.scale * blendedStride(runningPace(pace, actor.runner, distance) / pace.scale, 1, pace.traits);
      }
      return {
        actor, route, next: position.clone(), desiredSpeed: person.pace,
        advance: 0,
        untilReading: isParkReader(id) ? (PARK_READING_ENTRY - distance + route.length) % route.length : Infinity,
        untilMeadow: !running && index % 10 === 0 ? (PARK_MEADOW_VISIT.entry - distance + route.length) % route.length : Infinity,
        meadowDistance: null, nextHeading: actor.heading, activityStepped: false, pace, nextLane: 0,
      };
    });
    for (const walker of this.walkers) {
      const group = this.routeGroups.get(walker.route);
      if (group) group.push(walker);
      else this.routeGroups.set(walker.route, [walker]);
    }
    this.parkActors = this.walkers.map(({ actor }) => actor);
    PARK_MEADOW_VISIT.sample(PARK_MEADOW_VISIT.length, this.meadowExit);
    this.parkNeighbors = [...this.parkActors, ...this.resting.actors];
    this.actors = Object.freeze([...this.parkActors, ...this.traffic.actors, ...this.resting.actors]);
    this.weather = new PeopleWeather(this.actors);
  }

  /** Advance a runner's retained cooldown/effort envelope by one tick and return its desired dry-weather pace. */
  private paceRunner(pace: RunnerPace, runner: RunnerState, travel: number, dt: number): number {
    if (runner.cooldown === 0 && travel >= runner.nextCooldown) {
      runner.cooldown = RUNNER_PACE.restMinSeconds + runnerSample(pace.id, `rest-time:${runner.rests}`) * RUNNER_PACE.restRangeSeconds;
    }
    if (runner.cooldown > 0) {
      runner.effort = Math.max(0, runner.effort - dt / RUNNER_PACE.rampSeconds);
      if (runner.effort === 0) {
        runner.cooldown = Math.max(0, runner.cooldown - dt);
        if (runner.cooldown === 0) {
          runner.rests += 1;
          runner.recovered = travel;
          runner.nextCooldown = travel + PARK_RUNNING_ROUTE.length * (RUNNER_PACE.restMinLaps +
            runnerSample(pace.id, `rest-gap:${runner.rests}`) * RUNNER_PACE.restRangeLaps);
        }
      }
    } else runner.effort = Math.min(1, runner.effort + dt / RUNNER_PACE.rampSeconds);
    const run = runner.effort * runner.effort * (3 - 2 * runner.effort);
    const desired = pace.walk + (runningPace(pace, runner, travel) - pace.walk) * run;
    runner.run = run;
    return desired;
  }

  /** Whether a lane is free of other runners within an along-track window around this runner. */
  private laneClear(walker: ParkVisitor, lane: 0 | 1, behind: number, ahead: number): boolean {
    const target = laneLateral(lane);
    const length = walker.route.length;
    for (const other of this.routeGroups.get(walker.route)!) {
      const lateral = other.actor.runner?.lateral;
      if (other === walker || lateral === undefined || Math.abs(lateral - target) >= LANE_CLEAR) continue;
      const signed = ((other.actor.distance - walker.actor.distance) % length + length * 1.5) % length - length / 2;
      if (signed > -behind && signed < ahead) return false;
    }
    return true;
  }

  getActor(id: string): ActorState | undefined {
    return this.actors.find((actor) => actor.id === id);
  }

  step(delta: number, traction = 1, weather?: PeopleWeatherInput, reducedMotion = false): void {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Actor delta must be finite and nonnegative.');
    if (!Number.isFinite(traction) || traction < 0.3 || traction > 1) throw new RangeError('Road traction must be between 0.3 and 1.');
    if (delta === 0) return;
    const dt = Math.min(delta, ACTIVITY.maxStep);
    const clearance = PERSON_SPACE.clearance;
    const clearanceSquared = clearance * clearance;
    this.elapsed += dt;
    if (weather) this.weather.step(dt, weather);
    this.traffic.step(dt, traction);
    const neighbors = this.parkNeighbors;
    if (this.meadowMerge && this.meadowMerge.walker.meadowDistance === null &&
      this.meadowMerge.walker.actor.distance - PARK_MEADOW_VISIT.exit >= 3.5) this.meadowMerge = null;
    if (!this.meadowMerge) {
      const walker = this.walkers.find(({ meadowDistance }) => meadowDistance !== null &&
        PARK_MEADOW_VISIT.length - meadowDistance <= 5 + 1e-7);
      if (walker) this.meadowMerge = { walker, ready: false };
    }
    if (this.meadowMerge && !this.meadowMerge.ready) {
      const owner = this.meadowMerge.walker.actor;
      // Drain everyone already past the hold line before releasing the other approach.
      this.meadowMerge.ready = this.walkers.every((other) => {
        if (other.actor === owner) return true;
        if (other.route === PARK_ROUTES[0] && other.meadowDistance === null && !other.actor.visit) {
          return other.actor.distance <= PARK_MEADOW_VISIT.exit - 5 + 1e-7 ||
            other.actor.distance >= PARK_MEADOW_VISIT.exit + 3.5;
        }
        return Math.hypot(other.actor.position.x - this.meadowExit.x, other.actor.position.z - this.meadowExit.z) >= 3.4;
      });
    }
    const returningReader = this.walkers.find(({ actor }) =>
      actor.visit?.phase === 'departing' || actor.visit?.phase === 'merging');
    for (const walker of this.walkers) {
      walker.advance = 0;
      walker.activityStepped = false;
      const { actor } = walker;
      if (actor.visit) {
        walker.activityStepped = true;
        const departureAllowed = (actor.visit.cancelled && actor.visit.along < 2.3) || this.walkers.every((other) =>
          other === walker || other.route !== walker.route || other.meadowDistance !== null ||
          other.actor.distance <= PARK_READING_ENTRY - 3.5 + 1e-7 || other.actor.distance >= PARK_READING_ENTRY + 2.3);
        this.activities.step(actor, dt, walker.desiredSpeed, neighbors, !this.weather.adverse, departureAllowed);
        if (actor.visit.phase === 'merging') {
          sampleParkRoute(walker.route, actor.distance + 0.2, this.lookAhead);
          const heading = Math.atan2(this.lookAhead.x - actor.position.x, this.lookAhead.z - actor.position.z);
          if (canWalkTo(actor, actor.position, heading, neighbors) && canWalkTo(actor, this.lookAhead, heading, neighbors)) {
            actor.heading = heading;
            this.activities.finish(actor);
            walker.untilReading = walker.route.length;
          }
        }
        continue;
      }
      if (walker.untilReading <= 1e-7) {
        walker.untilReading = walker.route.length;
        if (!this.weather.adverse && this.activities.begin(actor, PARK_READING_DESTINATION, neighbors)) continue;
      }
      if (walker.untilMeadow <= 1e-7 && walker.meadowDistance === null) {
        walker.meadowDistance = 0;
        actor.parkPath = { id: 'meadow-walk', distance: 0 };
        walker.untilMeadow = walker.route.length;
      }
      let available = Math.min(walker.untilReading, walker.untilMeadow);
      if (walker.meadowDistance !== null) {
        available = PARK_MEADOW_VISIT.length - walker.meadowDistance;
        if (this.meadowMerge?.walker !== walker || !this.meadowMerge.ready) available = Math.max(0, available - 5);
      } else if (walker.route === PARK_ROUTES[0]) {
        for (const gate of [this.meadowMerge && this.meadowMerge.walker !== walker ? PARK_MEADOW_VISIT.exit - 5 : null,
          returningReader && returningReader !== walker ? PARK_READING_ENTRY - 3.5 : null]) {
          if (gate === null) continue;
          const ahead = Math.abs(gate - actor.distance) < 1e-7 ? 0 : (gate - actor.distance + actor.routeLength) % actor.routeLength;
          available = Math.min(available, ahead);
        }
      }
      const runner = actor.runner;
      let desired = walker.desiredSpeed;
      let leader: ParkVisitor | null = null;
      let leaderGap = Infinity;
      if (runner && walker.pace) desired = this.paceRunner(walker.pace, runner, actor.travelDistance ?? 0, dt);
      desired *= actor.weather?.pace ?? 1;
      if (runner && walker.pace) runner.stride = walker.pace.scale * blendedStride(desired / walker.pace.scale, runner.run, walker.pace.traits);
      for (const other of this.routeGroups.get(walker.route)!) {
        if (other === walker || other.actor.visit ||
          (other.meadowDistance === null) !== (walker.meadowDistance === null)) continue;
        if (walker.meadowDistance !== null && other.meadowDistance !== null) {
          const gap = other.meadowDistance - walker.meadowDistance;
          if (gap >= 0) available = Math.min(available, Math.max(0, gap - PERSON_SPACE.headway));
          continue;
        }
        // Runners in fully separated lanes pass side by side; radial clearance below still applies.
        if (runner && other.actor.runner && Math.abs(runner.lateral - other.actor.runner.lateral) >= LANE_CLEAR) continue;
        const gap = (other.actor.distance - walker.actor.distance + walker.route.length) % walker.route.length;
        available = Math.min(available, Math.max(0, gap - PERSON_SPACE.headway));
        if (gap < leaderGap) { leaderGap = gap; leader = other; }
      }
      walker.nextLane = runner?.lane ?? 0;
      if (runner && leader && leaderGap < RUNNER_PACE.passLook) {
        const leaderSpeed = leader.actor.speed;
        // Lane changes start only from a settled lane, so heading eases without reversal snaps.
        if (LANES && runner.laneTarget === 0 && runner.lane === 0 && leaderSpeed < desired - RUNNER_PACE.passMargin &&
          this.laneClear(walker, 1, 4, leaderGap + 3)) runner.laneTarget = 1;
        // Keep a comfortable gap and match the leader's pace until the passing lane opens.
        desired = Math.min(desired, Math.max(0, leaderSpeed + (leaderGap - RUNNER_PACE.followGap) * RUNNER_PACE.followGain));
      }
      if (runner && runner.laneTarget === 1 && runner.lane === 1 &&
        this.laneClear(walker, 0, PERSON_SPACE.headway + 1.2, RUNNER_PACE.passLook)) runner.laneTarget = 0;
      walker.advance = Math.min(desired * dt, available);
      if (runner && runner.lane !== runner.laneTarget) {
        // Diagonal lane easing shares the runner's ground speed rather than adding to it.
        const slope = RUNNER_LANE_OFFSET * 12 * runner.lane * (1 - runner.lane) / RUNNER_PACE.laneChange;
        walker.advance /= Math.hypot(1, slope);
      }
      if (walker.meadowDistance !== null) {
        PARK_MEADOW_VISIT.sample(walker.meadowDistance + walker.advance, walker.next);
        PARK_MEADOW_VISIT.sample(walker.meadowDistance + walker.advance + 0.2, this.lookAhead);
      } else {
        sampleParkRoute(walker.route, walker.actor.distance + walker.advance, walker.next);
        sampleParkRoute(walker.route, walker.actor.distance + walker.advance + 0.2, this.lookAhead);
      }
      walker.nextHeading = Math.hypot(this.lookAhead.x - walker.next.x, this.lookAhead.z - walker.next.z) > 1e-7
        ? Math.atan2(this.lookAhead.x - walker.next.x, this.lookAhead.z - walker.next.z) : actor.heading;
      if (runner) {
        const step = walker.advance / RUNNER_PACE.laneChange;
        walker.nextLane = runner.laneTarget === 1 ? Math.min(1, runner.lane + step) : Math.max(0, runner.lane - step);
        const lateral = laneLateral(walker.nextLane);
        walker.next.x += Math.cos(walker.nextHeading) * lateral;
        walker.next.z -= Math.sin(walker.nextHeading) * lateral;
        if (walker.advance > 0) walker.nextHeading += Math.atan2(lateral - runner.lateral, walker.advance);
      }
      if (!canWalkTo(walker.actor, walker.next, walker.actor.heading, this.resting.actors)) walker.advance = 0;
      const { position } = actor;
      const nextX = walker.next.x, nextZ = walker.next.z;
      for (const other of this.parkActors) {
        if (other === actor) continue;
        const dx = nextX - other.position.x;
        if (Math.abs(dx) >= clearance) continue;
        const dz = nextZ - other.position.z;
        if (Math.abs(dz) >= clearance) continue;
        const next = dx * dx + dz * dz;
        if (next >= clearanceSquared) continue;
        const current = (position.x - other.position.x) ** 2 + (position.z - other.position.z) ** 2;
        if (next < current) {
          walker.advance = 0;
          break;
        }
      }
    }
    for (const walker of this.walkers) {
      if (walker.actor.visit || walker.activityStepped) continue;
      const { actor } = walker;
      actor.speed = walker.advance / dt;
      actor.state = walker.advance > 0 ? 'moving' : 'waiting';
      if (walker.advance === 0) continue;
      const { runner } = actor;
      if (runner) {
        // Lanes bend with the track, so gait and pace use the true ground displacement.
        const moved = Math.hypot(walker.next.x - actor.position.x, walker.next.z - actor.position.z);
        actor.speed = moved / dt;
        actor.travelDistance = (actor.travelDistance ?? 0) + moved;
        runner.cycle += moved / runner.stride;
        runner.lane = walker.nextLane;
        runner.lateral = laneLateral(runner.lane);
        actor.distance = (actor.distance + walker.advance) % actor.routeLength;
        Object.assign(actor.position, { x: walker.next.x, y: 0, z: walker.next.z });
        actor.heading = walker.nextHeading;
        continue;
      }
      actor.travelDistance = (actor.travelDistance ?? 0) + walker.advance;
      if (walker.meadowDistance !== null) {
        walker.meadowDistance += walker.advance;
        actor.parkPath!.distance = walker.meadowDistance;
        Object.assign(actor.position, { x: walker.next.x, y: 0, z: walker.next.z });
        actor.heading = walker.nextHeading;
        if (PARK_MEADOW_VISIT.length - walker.meadowDistance <= 1e-7) {
          actor.distance = PARK_MEADOW_VISIT.exit;
          actor.parkPath = undefined;
          walker.meadowDistance = null;
          walker.untilMeadow = (PARK_MEADOW_VISIT.entry - actor.distance + actor.routeLength) % actor.routeLength;
        }
        continue;
      }
      actor.distance = (actor.distance + walker.advance) % actor.routeLength;
      Object.assign(actor.position, { x: walker.next.x, y: 0, z: walker.next.z });
      actor.heading = walker.nextHeading;
      walker.untilReading -= walker.advance;
      walker.untilMeadow -= walker.advance;
    }
    this.resting.step(dt, this.weather.adverse, this.weather.returnAllowed, this.parkActors, reducedMotion);
  }
}
