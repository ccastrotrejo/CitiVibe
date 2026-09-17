import { createPersonProfile, PERSON_SPACE, type PersonProfile } from '../content/people';
import { bikeAccessStopDistance, type BikeAccessBarrier } from '../content/bikeShare';
import { INTERSECTIONS, TRAFFIC_ACTORS, type TrafficSignalState } from '../content/streets';
import type { ActorState } from './actors';
import { sampleTrafficRoute, SIDEWALK_WALKING_CORNER_INSET, type TrafficRoute } from './traffic';
import { DestinationActivities } from './destinationActivities';
import { storefrontActivity, type StreetActivityStop } from './streetActivities';
import { canWalkTo } from './parkVisitors';
import { civicActivities } from './civicActivities';
import type { TrafficServiceState } from '../content/transitService';
import { serviceActivities, serviceVisitAllowed, serviceVisitReady, SERVICE_VISITOR_ID, SERVICE_VISIT_ID } from './serviceActivities';

export const PEDESTRIAN_BEHAVIOR = { maxCrossingWait: 12, maxBlockPopulation: 11, landingClearance: 2 } as const;
const EPSILON = 1e-7;
const wrap = (distance: number, length: number) => ((distance % length) + length) % length;

export interface WalkingCrossing {
  from: number;
  to: number;
  lane: number;
  corner: number;
  intersection: number;
  departure: number;
  arrival: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  length: number;
}

interface Walker {
  actor: ActorState;
  profile: PersonProfile;
  block: number;
  lane: number;
  destination: number;
  randomState: number;
  pace: number;
  wait: number;
  activityCooldown: number;
  corner: number;
  crossing: WalkingCrossing | null;
  crossingDistance: number;
  next: Pick<ActorState, 'position' | 'heading'>;
  advance: number;
  activityStepped: boolean;
  workplace?: StreetActivityStop;
}

/** Each flow joins its corner entry to the neighboring same-direction lane's exit. */
export function makeWalkingCrossings(routes: readonly (readonly TrafficRoute[])[]): readonly WalkingCrossing[] {
  const crossings: WalkingCrossing[] = [];
  routes.forEach((lanes, from) => lanes.forEach((route, lane) => {
    route.segments.forEach((segment, corner) => {
      if (segment.kind !== 'junction') return;
      routes.forEach((neighbors, to) => {
        if (to === from) return;
        for (const landing of neighbors[lane].segments) {
          if (landing.kind !== 'link' || landing.dx !== segment.dx || landing.dz !== segment.dz) continue;
          const x = landing.x - segment.x;
          const z = landing.z - segment.z;
          const length = x * segment.dx + z * segment.dz;
          if (Math.abs(x * segment.dz - z * segment.dx) > EPSILON ||
            Math.abs(length - 2 * SIDEWALK_WALKING_CORNER_INSET) > EPSILON) continue;
          const intersection = INTERSECTIONS.findIndex((point) =>
            Math.abs(point.x - (segment.x + landing.x) / 2) <= SIDEWALK_WALKING_CORNER_INSET &&
            Math.abs(point.z - (segment.z + landing.z) / 2) <= SIDEWALK_WALKING_CORNER_INSET);
          if (intersection < 0) throw new Error(`Crosswalk ${route.id}/${neighbors[lane].id} has no signal.`);
          crossings.push({ from, to, lane, corner, intersection, departure: segment.start, arrival: landing.start,
            x: segment.x, z: segment.z, dx: segment.dx, dz: segment.dz, length });
        }
      });
    });
  }));
  return crossings;
}

function random(walker: Walker): number {
  walker.randomState = (Math.imul(walker.randomState, 1664525) + 1013904223) >>> 0;
  return walker.randomState / 0x100000000;
}

function corridorDistance(crossing: WalkingCrossing, position: ActorState['position'], clearedDistance = 0): number {
  const x = position.x - crossing.x;
  const z = position.z - crossing.z;
  const along = Math.max(clearedDistance, Math.min(crossing.length + PEDESTRIAN_BEHAVIOR.landingClearance,
    x * crossing.dx + z * crossing.dz));
  return Math.hypot(x - crossing.dx * along, z - crossing.dz * along);
}

/** Retained, seeded trips; reservations protect the crossing and its downstream merge. */
export class StreetPedestrians {
  readonly actors: readonly ActorState[];
  readonly crossings: readonly WalkingCrossing[];
  readonly activities = new DestinationActivities();
  readonly activityStop: StreetActivityStop;
  readonly activityStops: readonly StreetActivityStop[];
  private readonly activityActors: ActorState[] = [];
  private readonly activityMergeGates = new Map<string, readonly number[]>();
  private readonly stopsById: ReadonlyMap<string, StreetActivityStop>;
  private readonly walkers: Walker[];
  private readonly groups: Walker[][];
  private readonly reservations: (Walker | null)[] = INTERSECTIONS.map(() => null);
  private readonly hops: number[][];
  private readonly exits: (WalkingCrossing | undefined)[][][];

  constructor(private readonly routes: readonly (readonly TrafficRoute[])[], seed: number) {
    this.activityStop = storefrontActivity(routes);
    this.activityStops = Object.freeze([this.activityStop, ...civicActivities(routes), ...serviceActivities(routes)]);
    this.stopsById = new Map(this.activityStops.map((stop) => [stop.destination.id, stop]));
    for (const stop of this.stopsById.values()) {
      this.activityMergeGates.set(stop.destination.id, routes[stop.block].map((route) => {
        const { entry } = stop.destination;
        const segment = route.segments.find((segment) => segment.kind === 'link' &&
          Math.abs((entry.x - segment.x) * segment.dz - (entry.z - segment.z) * segment.dx) < 1.1 &&
          (entry.x - segment.x) * segment.dx + (entry.z - segment.z) * segment.dz > 0 &&
          (entry.x - segment.x) * segment.dx + (entry.z - segment.z) * segment.dz < segment.length)!;
        const along = (entry.x - segment.x) * segment.dx + (entry.z - segment.z) * segment.dz;
        return segment.start + Math.max(PEDESTRIAN_BEHAVIOR.landingClearance, along - 2.1);
      }));
    }
    this.crossings = makeWalkingCrossings(routes);
    this.exits = routes.map((lanes, block) => lanes.map((route, lane) => route.segments.map((_, corner) =>
      this.crossings.find((crossing) => crossing.from === block && crossing.lane === lane && crossing.corner === corner))));
    this.hops = routes.map((_, origin) => {
      const distances = routes.map(() => Infinity);
      distances[origin] = 0;
      const queue = [origin];
      for (let index = 0; index < queue.length; index++) {
        for (const crossing of this.crossings) {
          if (crossing.from !== queue[index] || distances[crossing.to] !== Infinity) continue;
          distances[crossing.to] = distances[crossing.from] + 1;
          queue.push(crossing.to);
        }
      }
      if (distances.some((distance) => !Number.isFinite(distance))) throw new Error('Disconnected pedestrian blocks.');
      return distances;
    });
    const definitions = TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian');
    const perBlock = Math.ceil(definitions.length / routes.length);
    this.walkers = definitions.map(({ id }, index) => {
      const block = index % routes.length;
      const lane = (Math.floor(index / routes.length) + (seed & 1)) % 2;
      const route = routes[block][lane];
      const profile = createPersonProfile(id, 'street');
      const actor: ActorState = {
        id, kind: 'pedestrian', position: { x: 0, y: 0, z: 0 }, heading: 0,
        distance: Math.floor(index / routes.length) * route.length / perBlock,
        travelDistance: 0, speed: 0, routeLength: route.length, state: 'moving',
        activity: 'walking', activityTime: 0,
      };
      const walker: Walker = {
        actor, profile, block, lane, destination: block, randomState: (seed ^ Math.imul(index + 1, 2654435761)) >>> 0,
        pace: profile.pace, wait: 0, activityCooldown: 0, corner: -1, crossing: null,
        crossingDistance: 0, next: { position: { x: 0, y: 0, z: 0 }, heading: 0 }, advance: 0, activityStepped: false,
        workplace: this.activityStops.find((stop) => stop.lane === lane &&
          stop.destination.id === (id === SERVICE_VISITOR_ID ? SERVICE_VISIT_ID : `${profile.civicServiceId}-staff`)),
      };
      actor.distance += random(walker);
      actor.travelDistance = actor.distance;
      sampleTrafficRoute(route, actor.distance, actor);
      this.chooseDestination(walker);
      return walker;
    });
    this.groups = routes.map((_, block) => this.walkers.filter((walker) => walker.block === block));
    this.actors = Object.freeze(this.walkers.map(({ actor }) => actor));
  }

  isCrossingOccupied(intersection: number): boolean {
    return this.reservations[intersection] !== null;
  }

  private chooseDestination(walker: Walker): void {
    if (walker.workplace) {
      walker.destination = walker.workplace.block;
      walker.pace = walker.profile.pace * (0.9 + random(walker) * 0.1);
      return;
    }
    const choices = this.hops[walker.block].flatMap((hops, block) => hops > 0 && hops <= 3 ? [block] : []);
    walker.destination = choices[Math.floor(random(walker) * choices.length)];
    walker.pace = walker.profile.pace * (0.9 + random(walker) * 0.1);
  }

  private canReserve(walker: Walker, crossing: WalkingCrossing, signals: readonly TrafficSignalState[]): boolean {
    if (!signals[crossing.intersection].walk || this.reservations[crossing.intersection]) return false;
    const arriving = this.reservations.filter((reservation) => reservation?.crossing?.to === crossing.to).length;
    if (this.groups[crossing.to].length + arriving >= PEDESTRIAN_BEHAVIOR.maxBlockPopulation) return false;
    return this.walkers.every((other) => other === walker ||
      corridorDistance(crossing, other.actor.position) >= PERSON_SPACE.headway);
  }

  step(dt: number, signals: readonly TrafficSignalState[], bikeAccess?: BikeAccessBarrier,
    services: readonly TrafficServiceState[] = []): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Pedestrian delta must be finite and nonnegative.');
    if (dt === 0) return;
    dt = Math.min(dt, 1 / 30);
    this.activityActors.length = 0;
    for (const { actor } of this.walkers) if (actor.visit) this.activityActors.push(actor);
    const returning = this.activityActors.filter(({ visit }) => visit?.phase === 'departing' || visit?.phase === 'merging');
    for (const walker of this.walkers) {
      const { actor } = walker;
      walker.advance = 0;
      walker.activityStepped = false;
      if (actor.visit) {
        walker.activityStepped = true;
        const neighbors = this.groups[walker.block].map(({ actor }) => actor);
        const entry = actor.visit.destination.entry;
        const facing = actor.visit.destination.heading;
        const departureAllowed = returning.includes(actor) && neighbors.every((other) => other === actor ||
          Math.hypot(other.position.x - entry.x, other.position.z - entry.z) > 3.5 ||
          Math.abs((other.position.x - entry.x) * Math.cos(facing) -
            (other.position.z - entry.z) * Math.sin(facing)) >= 2.1 - EPSILON);
        this.activities.step(actor, dt, walker.pace, neighbors,
          !actor.weather?.cautious && (!actor.weather || actor.weather.equipment === 'dry') &&
          serviceVisitAllowed(actor.visit.destination, services, actor.visit.phase), departureAllowed,
          serviceVisitReady(actor.visit.destination, services));
        if (actor.visit.phase === 'merging') {
          sampleTrafficRoute(this.routes[walker.block][walker.lane], actor.distance + 0.2, walker.next);
          if (canWalkTo(actor, actor.position, walker.next.heading, neighbors) &&
            canWalkTo(actor, walker.next.position, walker.next.heading, neighbors)) {
            this.activities.finish(actor);
            actor.heading = walker.next.heading;
          }
        }
        continue;
      }
      actor.activity = walker.crossing ? 'crossing' : 'walking';
      actor.activityTime = 0;
      let available = walker.pace * (actor.weather?.pace ?? 1) * dt;
      if (!walker.crossing) {
        const route = this.routes[walker.block][walker.lane];
        let corner = 0;
        let toCorner = Infinity;
        for (let index = 0; index < route.segments.length; index += 2) {
          if (index === walker.corner) continue;
          const distance = wrap(route.segments[index].start - actor.distance, route.length);
          if (distance < toCorner) { toCorner = distance; corner = index; }
        }
        const crossing = this.exits[walker.block][walker.lane][corner];
        const wantsCrossing = crossing && this.hops[crossing.to][walker.destination] < this.hops[walker.block][walker.destination];
        if (wantsCrossing && toCorner < EPSILON) {
          if (this.canReserve(walker, crossing, signals)) {
            walker.crossing = crossing;
            walker.crossingDistance = 0;
            this.reservations[crossing.intersection] = walker;
            actor.activity = 'crossing';
            walker.wait = 0;
          } else {
            walker.wait += dt;
            actor.activity = 'waiting-to-cross';
            available = 0;
            if (walker.wait >= PEDESTRIAN_BEHAVIOR.maxCrossingWait) {
              // Continue around the block and try another approach; never force a blocked crossing.
              walker.corner = corner;
              walker.wait = 0;
              this.chooseDestination(walker);
            }
          }
        } else if (wantsCrossing) available = Math.min(available, toCorner);
        for (const other of this.groups[walker.block]) {
          if (other === walker || other.crossing || other.actor.visit || other.lane !== walker.lane) continue;
          available = Math.min(available, Math.max(0,
            wrap(other.actor.distance - actor.distance, route.length) - PERSON_SPACE.headway));
        }
        for (const returningActor of returning) {
          const id = returningActor.visit?.destination.id;
          if (!id || walker.block !== this.stopsById.get(id)!.block) continue;
          const gate = this.activityMergeGates.get(id)![walker.lane];
          const toGate = Math.abs(gate - actor.distance) < EPSILON ? 0 : wrap(gate - actor.distance, route.length);
          available = Math.min(available, toGate);
        }
        const stop = walker.workplace ?? this.activityStop;
        if (walker.activityCooldown <= 0 && walker.block === stop.block && walker.lane === stop.lane &&
          !actor.weather?.cautious && (!actor.weather || actor.weather.equipment === 'dry') &&
          serviceVisitAllowed(stop.destination, services)) {
          const distance = wrap(stop.distance - actor.distance, route.length);
          const toStop = route.length - distance < EPSILON ? 0 : distance;
          available = Math.min(available, toStop);
          if (toStop < EPSILON) {
            walker.activityCooldown = route.length;
            if (this.activities.begin(actor, stop.destination, this.groups[walker.block].map(({ actor }) => actor))) {
              this.activityActors.push(actor);
              continue;
            }
          }
        }
      }
      if (bikeAccess) available = Math.min(available, bikeAccessStopDistance(bikeAccess,
        actor.position.x, actor.position.z, actor.heading, PERSON_SPACE.headway / 2));
      walker.advance = available;
      this.sampleNext(walker, available);
    }
    // A reservation admitted later in this tick must also constrain earlier planned walkers.
    for (const walker of this.walkers) {
      if (walker.actor.visit || walker.activityStepped) continue;
      if (!walker.crossing) for (const reservation of this.reservations) {
        // The departed tail is clear; the moving crosser and its downstream landing remain reserved.
        if (reservation?.crossing &&
          corridorDistance(reservation.crossing, walker.next.position, reservation.crossingDistance) < PERSON_SPACE.headway &&
          corridorDistance(reservation.crossing, walker.next.position, reservation.crossingDistance) <
            corridorDistance(reservation.crossing, walker.actor.position, reservation.crossingDistance)) {
          walker.advance = 0;
        }
      }
      if (!canWalkTo(walker.actor, walker.next.position, walker.next.heading, this.activityActors)) walker.advance = 0;
      this.move(walker, dt);
    }
  }

  private sampleNext(walker: Walker, advance: number): void {
    const crossing = walker.crossing;
    if (crossing) {
      const distance = walker.crossingDistance + advance;
      Object.assign(walker.next.position, { x: crossing.x + crossing.dx * distance, y: 0, z: crossing.z + crossing.dz * distance });
      walker.next.heading = Math.atan2(crossing.dx, crossing.dz);
    } else sampleTrafficRoute(this.routes[walker.block][walker.lane], walker.actor.distance + advance, walker.next);
  }

  private move(walker: Walker, dt: number): void {
    const { actor, crossing } = walker;
    this.sampleNext(walker, walker.advance);
    Object.assign(actor.position, walker.next.position);
    actor.heading = walker.next.heading;
    actor.speed = walker.advance / dt;
    actor.state = walker.advance > EPSILON ? 'moving' : 'waiting';
    actor.travelDistance = (actor.travelDistance ?? 0) + walker.advance;
    walker.activityCooldown = Math.max(0, walker.activityCooldown - walker.advance);
    if (crossing) {
      walker.crossingDistance += walker.advance;
      if (walker.crossingDistance < crossing.length + PEDESTRIAN_BEHAVIOR.landingClearance) return;
      const oldGroup = this.groups[walker.block];
      oldGroup.splice(oldGroup.indexOf(walker), 1);
      walker.block = crossing.to;
      this.groups[walker.block].push(walker);
      actor.routeLength = this.routes[walker.block][walker.lane].length;
      actor.distance = wrap(crossing.arrival + walker.crossingDistance - crossing.length, actor.routeLength);
      walker.crossing = null;
      walker.corner = -1;
      this.reservations[crossing.intersection] = null;
      if (walker.block === walker.destination) {
        this.chooseDestination(walker);
      }
    } else {
      actor.distance = wrap(actor.distance + walker.advance, actor.routeLength);
      if (walker.advance > EPSILON && walker.corner >= 0 &&
        wrap(actor.distance - this.routes[walker.block][walker.lane].segments[walker.corner].start, actor.routeLength) > 2) {
        walker.corner = -1;
      }
    }
  }
}
