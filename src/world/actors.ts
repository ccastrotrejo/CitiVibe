import { Vector3 } from 'three';
import { PARK_ROUTES, sampleParkRoute } from '../content/park';
import type { Position } from '../content/city';
import { CityTraffic } from './traffic';

export interface ActorState {
  id: string;
  kind: 'bus' | 'car' | 'cyclist' | 'pedestrian';
  position: Position;
  heading: number;
  state: 'moving' | 'waiting' | 'dwelling';
  distance: number;
  speed: number;
  routeLength: number;
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
  private mergeOwner: ParkVisitor | null = null;
  private mergeEntered = false;

  constructor(seed: number = ACTIVITY.seed) {
    this.traffic = new CityTraffic(seed);
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const occupied: Vector3[] = [];
    this.walkers = Array.from({ length: 8 }, (_, index) => {
      const route = PARK_ROUTES[index % PARK_ROUTES.length];
      let distance = (index + random() * 0.3) / 8 * route.length;
      const position = new Vector3();
      let placed = false;
      for (let attempt = 0; attempt < 32; attempt++) {
        sampleParkRoute(route, distance, position);
        if (occupied.every((other) => other.distanceTo(position) > 1.4)) { placed = true; break; }
        distance = (distance + 3) % route.length;
      }
      if (!placed) throw new Error('Unable to place park visitors with safe spacing.');
      occupied.push(position);
      const actor: ActorState = {
        id: `walker-${index + 1}`, kind: 'pedestrian', position, heading: 0,
        state: 'moving', distance, speed: 0, routeLength: route.length,
      };
      sampleParkRoute(route, distance + 0.2, this.lookAhead);
      actor.heading = Math.atan2(this.lookAhead.x - position.x, this.lookAhead.z - position.z);
      return {
        actor, route, next: position.clone(), desiredSpeed: 0.85 + random() * 0.2,
        advance: 0, rest: 0, restDuration: index % 3 === 0 ? 2 : 0,
        untilRest: (route.segments[0].length - distance + route.length) % route.length,
      };
    });
    this.actors = Object.freeze([...this.walkers.map(({ actor }) => actor), ...this.traffic.actors]);
  }

  getActor(id: string): ActorState | undefined {
    return this.actors.find((actor) => actor.id === id);
  }

  step(delta: number): void {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Actor delta must be finite and nonnegative.');
    if (delta === 0) return;
    const dt = Math.min(delta, ACTIVITY.maxStep);
    this.elapsed += dt;
    this.traffic.step(dt);
    const mergeDistance = (position: Position) => position.x ** 2 + (position.z - 12.5) ** 2;
    if (this.mergeOwner) {
      const distance = mergeDistance(this.mergeOwner.actor.position);
      if (distance < 1.6 ** 2) this.mergeEntered = true;
      if ((this.mergeEntered && distance > 1.7 ** 2) || distance > 2 ** 2) this.mergeOwner = null;
    }
    if (!this.mergeOwner) {
      // The south entrance joins the meadow walk here; one visitor clears the merge first.
      let nearest = 2 ** 2;
      for (const walker of this.walkers) {
        const distance = mergeDistance(walker.actor.position);
        const approaching = walker.actor.position.x * Math.sin(walker.actor.heading) +
          (walker.actor.position.z - 12.5) * Math.cos(walker.actor.heading) < 0;
        if (distance >= 1.6 ** 2 && !approaching) continue;
        if (distance < nearest) { this.mergeOwner = walker; nearest = distance; }
      }
      this.mergeEntered = nearest < 1.6 ** 2;
    }
    for (const walker of this.walkers) {
      walker.advance = 0;
      if (walker.rest > 0) {
        walker.rest = Math.max(0, walker.rest - dt);
        walker.actor.speed = 0;
        walker.actor.state = 'dwelling';
        continue;
      }
      walker.advance = Math.min(walker.desiredSpeed * dt, walker.untilRest);
      sampleParkRoute(walker.route, walker.actor.distance + walker.advance, walker.next);
      if (walker !== this.mergeOwner && mergeDistance(walker.next) < 1.6 ** 2) walker.advance = 0;
      for (const other of this.walkers) {
        if (other === walker) continue;
        const current = (walker.actor.position.x - other.actor.position.x) ** 2 +
          (walker.actor.position.z - other.actor.position.z) ** 2;
        const next = (walker.next.x - other.actor.position.x) ** 2 + (walker.next.z - other.actor.position.z) ** 2;
        if (next < 0.9 ** 2 && next < current) {
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
