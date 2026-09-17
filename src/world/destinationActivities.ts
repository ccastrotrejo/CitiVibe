import type { Position } from '../content/city';
import { PERSON_SPACE } from '../content/people';
import type { ActorState } from './actors';
import { canWalkTo } from './parkVisitors';

export interface ActivityDestination {
  id: string;
  activity: 'reading' | 'window-shopping' | 'civic-duty' | 'resting';
  entry: Position;
  pocket: Position;
  heading: number;
  duration: number;
  pauseAfter?: number;
  waitBeforeUse?: number;
}

export interface DestinationVisit {
  destination: ActivityDestination;
  phase: 'approaching' | 'awaiting' | 'using' | 'departing' | 'merging';
  along: number;
  elapsed: number;
  blocked: number;
  cancelled: boolean;
  /** Latched only after the route owner has drained the upstream merge hold lines. */
  departureReady: boolean;
}

const EPSILON = 1e-7;
export const ACTIVITY_BLOCKED_TIMEOUT = 12;

/** A small, retained reservation controller; route owners keep their own entry/merge coordinates. */
export class DestinationActivities {
  private readonly reservations = new Map<string, ActorState>();
  private readonly next: Position = { x: 0, y: 0, z: 0 };

  reserved(id: string): boolean {
    return this.reservations.has(id);
  }

  begin(actor: ActorState, destination: ActivityDestination, neighbors: readonly ActorState[]): boolean {
    if (actor.visit || this.reserved(destination.id) ||
      Math.hypot(actor.position.x - destination.entry.x, actor.position.z - destination.entry.z) > EPSILON) return false;
    const { entry, pocket } = destination;
    const length = Math.hypot(pocket.x - entry.x, pocket.z - entry.z);
    if (length < PERSON_SPACE.length / 2 + PERSON_SPACE.width / 2 + 0.1) return false;
    const heading = Math.atan2(pocket.x - entry.x, pocket.z - entry.z);
    // Reserve the entire short spur before leaving the route, not just an apparently free seat.
    for (let distance = 0; distance <= length + EPSILON; distance += 0.2) {
      const along = Math.min(length, distance);
      Object.assign(this.next, { x: entry.x + (pocket.x - entry.x) * along / length, y: 0,
        z: entry.z + (pocket.z - entry.z) * along / length });
      if (!canWalkTo(actor, this.next, heading, neighbors) || neighbors.some((other) => other !== actor &&
        Math.hypot(other.position.x - this.next.x, other.position.z - this.next.z) < PERSON_SPACE.headway)) return false;
    }
    if (neighbors.some((other) => other !== actor &&
      Math.hypot(other.position.x - pocket.x, other.position.z - pocket.z) < PERSON_SPACE.headway)) return false;
    this.reservations.set(destination.id, actor);
    actor.visit = { destination, phase: 'approaching', along: 0, elapsed: 0, blocked: 0,
      cancelled: false, departureReady: false };
    actor.speed = 0;
    actor.state = 'waiting';
    return true;
  }

  /** Clear an in-progress approach before returning, so cancellation cannot trap through-walkers. */
  cancel(actor: ActorState): void {
    const visit = actor.visit;
    if (!visit) return;
    visit.cancelled = true;
    if (visit.phase !== 'approaching' && visit.phase !== 'merging') visit.phase = 'departing';
    visit.elapsed = 0;
  }

  step(actor: ActorState, dt: number, pace: number, neighbors: readonly ActorState[], allowed = true,
    departureAllowed = true, ready = true): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Activity delta must be finite and nonnegative.');
    const visit = actor.visit;
    if (!visit || dt === 0) return;
    dt = Math.min(dt, 1 / 30);
    if (!allowed && !visit.cancelled) this.cancel(actor);
    actor.speed = 0;
    actor.state = 'waiting';
    actor.activityTime = visit.elapsed;
    actor.activity = visit.phase === 'awaiting' ? 'resting' : visit.phase === 'using'
      ? visit.elapsed >= (visit.destination.pauseAfter ?? Infinity) ? 'resting' : visit.destination.activity
      : 'walking';
    if (visit.phase === 'awaiting') {
      actor.heading = visit.destination.heading;
      visit.elapsed += dt;
      actor.activityTime = visit.elapsed;
      if (ready) {
        visit.phase = 'using';
        visit.elapsed = 0;
      } else if (visit.elapsed >= visit.destination.waitBeforeUse!) this.cancel(actor);
      return;
    }
    if (visit.phase === 'using') {
      visit.elapsed += dt;
      actor.activityTime = visit.elapsed;
      actor.state = 'dwelling';
      actor.heading = visit.destination.heading;
      if (visit.elapsed >= visit.destination.duration) {
        visit.phase = 'departing';
        visit.elapsed = 0;
      }
      return;
    }
    if (visit.phase === 'merging') return;
    if (visit.phase === 'departing') {
      if (!departureAllowed && !visit.departureReady) return;
      visit.departureReady = true;
    }
    const { entry, pocket } = visit.destination;
    const length = Math.hypot(pocket.x - entry.x, pocket.z - entry.z);
    const outward = visit.phase === 'approaching';
    const advance = Math.min(pace * (actor.weather?.pace ?? 1) * dt, outward ? length - visit.along : visit.along);
    const along = visit.along + (outward ? advance : -advance);
    const heading = Math.atan2((pocket.x - entry.x) * (outward ? 1 : -1), (pocket.z - entry.z) * (outward ? 1 : -1));
    Object.assign(this.next, { x: entry.x + (pocket.x - entry.x) * along / length,
      y: 0, z: entry.z + (pocket.z - entry.z) * along / length });
    if (!canWalkTo(actor, this.next, heading, neighbors)) {
      visit.blocked += dt;
      if (visit.blocked >= ACTIVITY_BLOCKED_TIMEOUT && outward) {
        this.cancel(actor);
        visit.phase = 'departing';
      }
      return;
    }
    visit.blocked = 0;
    visit.along = along;
    Object.assign(actor.position, this.next);
    actor.heading = heading;
    actor.travelDistance = (actor.travelDistance ?? 0) + advance;
    actor.speed = advance / dt;
    actor.state = advance > EPSILON ? 'moving' : 'waiting';
    if (outward && length - along < EPSILON) {
      visit.phase = visit.cancelled ? 'departing' : visit.destination.waitBeforeUse ? 'awaiting' : 'using';
      visit.elapsed = 0;
    } else if (!outward && along < EPSILON) visit.phase = 'merging';
  }

  /** Release only after the caller has checked the downstream route and restored its heading. */
  finish(actor: ActorState): boolean {
    if (actor.visit?.phase !== 'merging') return false;
    this.reservations.delete(actor.visit.destination.id);
    actor.visit = undefined;
    actor.activity = 'walking';
    actor.activityTime = 0;
    return true;
  }
}
