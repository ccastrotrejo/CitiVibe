import { Vector3 } from 'three';
import { createPersonProfile, createWeatherTraits, PERSON_SPACE } from '../content/people';
import { PARK_OUTSIDE_WALK, PARK_RESTING_VISITORS, PARK_RETURN_DISTANCE } from '../content/parkVisitors';
import type { ActorState } from './actors';

type VisitPhase = 'seated' | 'rising' | 'departing' | 'outside' | 'returning' | 'sitting';
interface Visit {
  actor: ActorState;
  definition: typeof PARK_RESTING_VISITORS[number];
  phase: VisitPhase;
  phaseSeconds: number;
  distance: number;
  pace: number;
  traits: ReturnType<typeof createWeatherTraits>;
}

function overlaps(x: number, z: number, heading: number, other: ActorState): boolean {
  const dx = x - other.position.x;
  const dz = z - other.position.z;
  if (dx * dx + dz * dz > 2.5) return false;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const ox = Math.sin(other.heading), oz = Math.cos(other.heading);
  for (const [ax, az] of [[fx, fz], [fz, -fx], [ox, oz], [oz, -ox]]) {
    const radius = (PERSON_SPACE.length / 2 + 0.02) * (Math.abs(fx * ax + fz * az) + Math.abs(ox * ax + oz * az)) +
      (PERSON_SPACE.width / 2 + 0.02) * (Math.abs(fz * ax - fx * az) + Math.abs(oz * ax - ox * az));
    if (Math.abs(dx * ax + dz * az) >= radius) return false;
  }
  return true;
}

/** Full oriented body envelopes permit counterflow without treating a sidewalk as a solid cylinder. */
export function canWalkTo(actor: ActorState, next: ActorState['position'], heading: number, others: readonly ActorState[]): boolean {
  return others.every((other) => {
    if (other === actor) return true;
    const current = (actor.position.x - other.position.x) ** 2 + (actor.position.z - other.position.z) ** 2;
    if (current > 4) return true;
    const future = (next.x - other.position.x) ** 2 + (next.z - other.position.z) ** 2;
    const ahead = (other.position.x - actor.position.x) * (Math.sin(heading) + Math.sin(other.heading)) +
      (other.position.z - actor.position.z) * (Math.cos(heading) + Math.cos(other.heading));
    if (ahead > 0 && Math.cos(heading - other.heading) > 0.5 &&
      future < PERSON_SPACE.headway ** 2 && future < current) return false;
    if (!overlaps(next.x, next.z, heading, other)) return true;
    return overlaps(actor.position.x, actor.position.z, actor.heading, other) && future > current + 1e-10;
  });
}

/** Eight retained neighbors physically leave and return; timers advance only on simulation ticks. */
export class ParkVisitors {
  readonly states: readonly Visit[];
  readonly actors: readonly ActorState[];
  private readonly next = new Vector3();
  private readonly ahead = new Vector3();
  private readonly outsideLength = PARK_OUTSIDE_WALK.getLength();
  private gateOwner: Visit | null = null;

  constructor() {
    this.states = PARK_RESTING_VISITORS.map((definition): Visit => ({
      definition, phase: 'seated', phaseSeconds: 0, distance: 0,
      pace: createPersonProfile(definition.id, 'resting').pace,
      traits: createWeatherTraits(definition.id),
      actor: {
        id: definition.id, kind: 'pedestrian', position: { x: definition.seat[0], y: 0, z: definition.seat[1] },
        heading: 0, state: 'dwelling', distance: 0, travelDistance: 0, speed: 0,
        routeLength: definition.outwardLength, sitting: 1,
      },
    }));
    this.actors = Object.freeze(this.states.map(({ actor }) => actor));
  }

  private transition(visit: Visit, phase: VisitPhase): void {
    visit.phase = phase;
    visit.phaseSeconds = 0;
    visit.distance = 0;
  }

  step(dt: number, adverse: boolean, returnAllowed: boolean, neighbors: readonly ActorState[], reducedMotion = false): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Park visit delta must be finite and nonnegative.');
    if (dt === 0) return;
    dt = Math.min(dt, 1 / 30);
    for (const visit of this.states) {
      const { actor, definition } = visit;
      actor.speed = 0;
      actor.state = 'dwelling';
      visit.phaseSeconds += dt;
      if (visit.phase === 'seated') {
        if (!adverse) visit.phaseSeconds = 0;
        else if (visit.phaseSeconds >= 2 + visit.traits.reactionSeconds + definition.departureDelay) this.transition(visit, 'rising');
        continue;
      }
      if (visit.phase === 'rising' || visit.phase === 'sitting') {
        const progress = reducedMotion ? 1 : Math.min(1, visit.phaseSeconds / 1.2);
        const eased = progress * progress * (3 - 2 * progress);
        actor.sitting = visit.phase === 'rising' ? 1 - eased : eased;
        if (visit.phase === 'sitting' && adverse) {
          // Reverse from the current posture, not a fresh seated pose.
          visit.phase = 'rising';
          visit.phaseSeconds = (1 - progress) * 1.2;
        } else if (progress === 1) this.transition(visit, visit.phase === 'rising' ? 'departing' : 'seated');
        continue;
      }
      const outside = visit.phase === 'outside';
      if (outside && !returnAllowed) visit.phaseSeconds = 0;
      const curve = outside ? PARK_OUTSIDE_WALK : visit.phase === 'departing' ? definition.outward : definition.homeward;
      const length = outside ? this.outsideLength : visit.phase === 'departing' ? definition.outwardLength : definition.homewardLength;
      let advance = Math.min(visit.pace * (actor.weather?.pace ?? 1) * dt, length - visit.distance);
      const wantsReturn = outside && returnAllowed && visit.phaseSeconds >= visit.traits.returnSeconds;
      const toReturn = (PARK_RETURN_DISTANCE - visit.distance + length) % length;
      if (wantsReturn) advance = Math.min(advance, toReturn);
      if (visit.phase === 'departing' && visit.distance + advance > length - 13) {
        if (this.gateOwner === null) this.gateOwner = visit;
        if (this.gateOwner !== visit) advance = Math.max(0, length - 13 - visit.distance);
      }
      const distance = visit.distance + advance;
      curve.getPoint(distance / length, this.next);
      curve.getPoint(outside ? ((distance + 0.15) % length) / length : Math.min(1, (distance + 0.15) / length), this.ahead);
      let heading = Math.atan2(this.ahead.x - this.next.x, this.ahead.z - this.next.z);
      if (distance >= length - 0.15 && !outside) heading = Math.atan2(this.next.x - actor.position.x, this.next.z - actor.position.z);
      actor.state = 'waiting';
      if (!canWalkTo(actor, this.next, heading, this.actors) || !canWalkTo(actor, this.next, heading, neighbors)) continue;
      visit.distance = distance;
      actor.distance = distance;
      actor.travelDistance = (actor.travelDistance ?? 0) + advance;
      actor.routeLength = length;
      actor.position.x = this.next.x;
      actor.position.z = this.next.z;
      actor.heading = heading;
      actor.speed = advance / dt;
      actor.state = advance > 0 ? 'moving' : 'waiting';
      if (this.gateOwner === visit && outside && distance >= 3) {
        this.gateOwner = null;
      }
      if (wantsReturn && toReturn - advance < 1e-7) {
        this.transition(visit, 'returning');
        continue;
      }
      if (distance < length - 1e-7) continue;
      if (visit.phase === 'departing') this.transition(visit, 'outside');
      else if (outside) {
        visit.distance = 0;
      } else {
        actor.heading = 0;
        actor.speed = 0;
        actor.state = 'dwelling';
        this.transition(visit, adverse || !returnAllowed ? 'departing' : 'sitting');
      }
    }
  }
}
