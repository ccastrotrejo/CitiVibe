import { Vector3 } from 'three';
import { PARK_ACTORS, PARK_ROUTES, PARK_RUNNING_ROUTE, sampleParkRoute } from '../content/park';
import type { Position } from '../content/city';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import type { BikeShareTripState } from '../content/bikeShare';
import { CityTraffic } from './traffic';

export interface ActorState {
  id: string;
  kind: 'bus' | 'car' | 'cyclist' | 'pedestrian';
  gait?: 'walk' | 'run';
  position: Position;
  heading: number;
  state: 'moving' | 'waiting' | 'dwelling';
  distance: number;
  travelDistance?: number;
  activity?: 'walking' | 'crossing' | 'waiting-to-cross' | 'looking-around' | 'resting';
  activityTime?: number;
  sharedBike?: BikeShareTripState;
  speed: number;
  routeLength: number;
  lighting?: { turn: 'left' | 'right' | null; braking: boolean };
}

export const ACTIVITY = { seed: 2401, maxStep: 1 / 30 } as const;

interface ParkVisitor {
  actor: ActorState;
  route: typeof PARK_ROUTES[number];
  next: Vector3;
  desiredSpeed: number;
  advance: number;
  rest: number;
  restDuration: number;
  untilRest: number;
}

/** Street traffic stays outside the park; park visitors walk through gates to city sidewalks. */
export class ActorSimulation {
  readonly actors: readonly ActorState[];
  readonly traffic: CityTraffic;
  elapsed = 0;
  private readonly walkers: ParkVisitor[];
  private readonly lookAhead = new Vector3();

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
        state: 'moving', distance, speed: 0, routeLength: route.length,
      };
      sampleParkRoute(route, distance + 0.2, this.lookAhead);
      actor.heading = Math.atan2(this.lookAhead.x - position.x, this.lookAhead.z - position.z);
      return {
        actor, route, next: position.clone(), desiredSpeed: person.pace,
        advance: 0, rest: 0, restDuration: person.purpose === 'tour' ? 2.5 : 0,
        untilRest: (route.segments[0].length - distance + route.length) % route.length,
      };
    });
    this.actors = Object.freeze([...this.walkers.map(({ actor }) => actor), ...this.traffic.actors]);
  }

  getActor(id: string): ActorState | undefined {
    return this.actors.find((actor) => actor.id === id);
  }

  step(delta: number, traction = 1): void {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Actor delta must be finite and nonnegative.');
    if (!Number.isFinite(traction) || traction < 0.3 || traction > 1) throw new RangeError('Road traction must be between 0.3 and 1.');
    if (delta === 0) return;
    const dt = Math.min(delta, ACTIVITY.maxStep);
    this.elapsed += dt;
    this.traffic.step(dt, traction);
    for (const walker of this.walkers) {
      walker.advance = 0;
      if (walker.rest > 0) {
        walker.rest = Math.max(0, walker.rest - dt);
        walker.actor.speed = 0;
        walker.actor.state = 'dwelling';
        continue;
      }
      let available = walker.restDuration > 0 ? walker.untilRest : Infinity;
      for (const other of this.walkers) {
        if (other === walker || other.route !== walker.route) continue;
        const gap = (other.actor.distance - walker.actor.distance + walker.route.length) % walker.route.length;
        available = Math.min(available, Math.max(0, gap - PERSON_SPACE.headway));
      }
      walker.advance = Math.min(walker.desiredSpeed * dt, available);
      sampleParkRoute(walker.route, walker.actor.distance + walker.advance, walker.next);
      for (const other of this.walkers) {
        if (other === walker) continue;
        const current = (walker.actor.position.x - other.actor.position.x) ** 2 +
          (walker.actor.position.z - other.actor.position.z) ** 2;
        const next = (walker.next.x - other.actor.position.x) ** 2 + (walker.next.z - other.actor.position.z) ** 2;
        if (next < PERSON_SPACE.clearance ** 2 && next < current) {
          walker.advance = 0;
          break;
        }
      }
    }
    for (const walker of this.walkers) {
      if (walker.rest > 0) continue;
      const { actor } = walker;
      actor.speed = walker.advance / dt;
      actor.state = walker.advance > 0 ? 'moving' : 'waiting';
      actor.distance = (actor.distance + walker.advance) % actor.routeLength;
      sampleParkRoute(walker.route, actor.distance, walker.next);
      Object.assign(actor.position, { x: walker.next.x, y: 0, z: walker.next.z });
      sampleParkRoute(walker.route, actor.distance + 0.2, this.lookAhead);
      actor.heading = Math.atan2(this.lookAhead.x - actor.position.x, this.lookAhead.z - actor.position.z);
      walker.untilRest -= walker.advance;
      if (walker.untilRest <= 1e-7) {
        walker.rest = walker.restDuration;
        walker.untilRest = actor.routeLength;
      }
    }
  }
}
