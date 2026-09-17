import { Vector3 } from 'three';
import { PARK_ACTORS, PARK_ROUTES, PARK_RUNNING_ROUTE, sampleParkRoute } from '../content/park';
import type { Position } from '../content/city';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import type { BikeShareTripState } from '../content/bikeShare';
import { CityTraffic } from './traffic';
import { PeopleWeather, type PeopleWeatherInput, type PersonWeatherState } from './peopleWeather';
import { canWalkTo, ParkVisitors } from './parkVisitors';
import { DestinationActivities, type DestinationVisit } from './destinationActivities';
import { isParkReader, PARK_MEADOW_VISIT, PARK_READING_DESTINATION, PARK_READING_ENTRY } from './parkActivities';

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
  speed: number;
  routeLength: number;
  lighting?: { turn: 'left' | 'right' | null; braking: boolean };
}

export const ACTIVITY = { seed: 2401, maxStep: 1 / 30 } as const;

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
      const position = new Vector3();
      let placed = false;
      for (let attempt = 0; attempt < 32; attempt++) {
        sampleParkRoute(route, distance, position);
        if (occupied.every((other) => other.distanceTo(position) > PERSON_SPACE.headway)) { placed = true; break; }
        distance = (distance + 3) % route.length;
      }
      if (!placed) throw new Error('Unable to place park visitors with safe spacing.');
      occupied.push(position);
      const actor: ActorState = {
        id, kind: 'pedestrian', gait, position, heading: 0,
        state: 'moving', distance, travelDistance: distance, speed: 0, routeLength: route.length,
      };
      sampleParkRoute(route, distance + 0.2, this.lookAhead);
      actor.heading = Math.atan2(this.lookAhead.x - position.x, this.lookAhead.z - position.z);
      return {
        actor, route, next: position.clone(), desiredSpeed: person.pace,
        advance: 0,
        untilReading: isParkReader(id) ? (PARK_READING_ENTRY - distance + route.length) % route.length : Infinity,
        untilMeadow: !running && index % 10 === 0 ? (PARK_MEADOW_VISIT.entry - distance + route.length) % route.length : Infinity,
        meadowDistance: null, nextHeading: actor.heading, activityStepped: false,
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
      for (const other of this.routeGroups.get(walker.route)!) {
        if (other === walker || other.actor.visit ||
          (other.meadowDistance === null) !== (walker.meadowDistance === null)) continue;
        if (walker.meadowDistance !== null && other.meadowDistance !== null) {
          const gap = other.meadowDistance - walker.meadowDistance;
          if (gap >= 0) available = Math.min(available, Math.max(0, gap - PERSON_SPACE.headway));
          continue;
        }
        const gap = (other.actor.distance - walker.actor.distance + walker.route.length) % walker.route.length;
        available = Math.min(available, Math.max(0, gap - PERSON_SPACE.headway));
      }
      walker.advance = Math.min(walker.desiredSpeed * (walker.actor.weather?.pace ?? 1) * dt, available);
      if (walker.meadowDistance !== null) {
        PARK_MEADOW_VISIT.sample(walker.meadowDistance + walker.advance, walker.next);
        PARK_MEADOW_VISIT.sample(walker.meadowDistance + walker.advance + 0.2, this.lookAhead);
      } else {
        sampleParkRoute(walker.route, walker.actor.distance + walker.advance, walker.next);
        sampleParkRoute(walker.route, walker.actor.distance + walker.advance + 0.2, this.lookAhead);
      }
      walker.nextHeading = Math.hypot(this.lookAhead.x - walker.next.x, this.lookAhead.z - walker.next.z) > 1e-7
        ? Math.atan2(this.lookAhead.x - walker.next.x, this.lookAhead.z - walker.next.z) : actor.heading;
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
