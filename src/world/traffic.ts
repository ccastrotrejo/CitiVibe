import {
  BIKE_OFFSET, INTERSECTION_GATE, INTERSECTIONS, SIDEWALK_OFFSET, STOP_LINE_OFFSET, STREET_BLOCKS,
  TRAFFIC_ACTORS, VEHICLE_OFFSET, type TrafficSignalState, type TrafficVehicleType,
} from '../content/streets';
import type { ActorState } from './actors';

export type { TrafficSignalState } from '../content/streets';

export const TRAFFIC = {
  maxStep: 1 / 30,
  acceleration: 1.5,
  braking: 2.5,
  vehicleGap: 2,
  bicycleGap: 1.2,
  stopBuffer: 0.3,
  greenSeconds: 8,
  clearanceSeconds: 1,
  pedestrianSeconds: 3,
  maxVehicleSpeed: 4.8,
  maxBicycleSpeed: 3.4,
} as const;

export const TRAFFIC_LENGTHS: Record<TrafficVehicleType, number> = {
  sedan: 2.8, taxi: 2.8, van: 3.5, truck: 4.6, bus: 4.8, bicycle: 2,
};

interface Point { x: number; z: number }

export interface TrafficSegment {
  kind: 'link' | 'junction';
  start: number;
  length: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  radius: number;
  turn: number;
  centerX: number;
  centerZ: number;
  /** Directed shared lane identity, or the intersection index for a turn. */
  lane: string;
  intersection: number;
  axis: 'north-south' | 'east-west';
}

export interface TrafficRoute {
  id: string;
  length: number;
  segments: readonly TrafficSegment[];
}

interface Motion {
  actor: ActorState;
  route: TrafficRoute;
  segment: number;
  length: number;
  desiredSpeed: number;
  bicycle: boolean;
  advance: number;
  permit: number;
  releaseRemaining: number;
  requestSince: number;
}

interface Junction extends TrafficSignalState {
  owner: Motion | null;
  elapsed: number;
  stage: number;
}

const EPSILON = 1e-7;
// Stop before the painted bar without changing the tighter, road-contained turn arcs.
const STOP_APPROACH_BUFFER = STOP_LINE_OFFSET - INTERSECTION_GATE + TRAFFIC.stopBuffer;
const QUARTER_TURN = Math.PI / 2;
const PHASES = ['north-south', 'clearance', 'east-west', 'clearance', 'pedestrians', 'clearance'] as const;

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function ahead(from: number, to: number, length: number): number {
  const distance = wrap(to - from, length);
  return distance < EPSILON || length - distance < EPSILON ? 0 : distance;
}

function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function rectangleNodes(left: number, top: number, right: number, bottom: number, reverse = false): number[] {
  const nodes: number[] = [];
  for (let column = left; column < right; column += 1) nodes.push(top * 4 + column);
  for (let row = top; row < bottom; row += 1) nodes.push(row * 4 + right);
  for (let column = right; column > left; column -= 1) nodes.push(bottom * 4 + column);
  for (let row = bottom; row > top; row -= 1) nodes.push(row * 4 + left);
  return reverse ? nodes.reverse() : nodes;
}

const CIRCUITS = [
  rectangleNodes(0, 0, 3, 3),
  rectangleNodes(0, 0, 3, 3, true),
  rectangleNodes(0, 0, 2, 2),
  rectangleNodes(1, 1, 3, 3),
  rectangleNodes(0, 1, 3, 2, true),
  rectangleNodes(1, 0, 2, 3, true),
];

function direction(from: Point, to: Point): Point {
  return { x: Math.sign(to.x - from.x), z: Math.sign(to.z - from.z) };
}

function makeRoute(nodes: readonly number[], offset: number, id: string): TrafficRoute {
  const segments: TrafficSegment[] = [];
  let length = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const previous = INTERSECTIONS[nodes[(index + nodes.length - 1) % nodes.length]];
    const intersection = nodes[index];
    const current = INTERSECTIONS[intersection];
    const nextIndex = nodes[(index + 1) % nodes.length];
    const next = INTERSECTIONS[nextIndex];
    const incoming = direction(previous, current);
    const outgoing = direction(current, next);
    const turn = incoming.x * outgoing.z - incoming.z * outgoing.x;
    const radius = INTERSECTION_GATE - turn * offset;
    const x = current.x - incoming.x * INTERSECTION_GATE - incoming.z * offset;
    const z = current.z - incoming.z * INTERSECTION_GATE + incoming.x * offset;
    const junctionLength = turn === 0 ? INTERSECTION_GATE * 2 : QUARTER_TURN * radius;
    segments.push({
      kind: 'junction', start: length, length: junctionLength, x, z,
      dx: incoming.x, dz: incoming.z, radius, turn,
      centerX: x + outgoing.x * radius, centerZ: z + outgoing.z * radius,
      lane: '', intersection, axis: incoming.x === 0 ? 'north-south' : 'east-west',
    });
    length += junctionLength;
    const linkLength = Math.abs(next.x - current.x) + Math.abs(next.z - current.z) - INTERSECTION_GATE * 2;
    segments.push({
      kind: 'link', start: length, length: linkLength,
      x: current.x + outgoing.x * INTERSECTION_GATE - outgoing.z * offset,
      z: current.z + outgoing.z * INTERSECTION_GATE + outgoing.x * offset,
      dx: outgoing.x, dz: outgoing.z, radius: 0, turn: 0, centerX: 0, centerZ: 0,
      lane: `${nodes[index]}>${nextIndex}:${offset}`,
      intersection: nextIndex, axis: outgoing.x === 0 ? 'north-south' : 'east-west',
    });
    length += linkLength;
  }
  return { id, length, segments };
}

/** Connected circuits share directed graph edges, including both driving directions. */
export const TRAFFIC_ROUTES: readonly TrafficRoute[] = [
  ...CIRCUITS.map((nodes, index) => makeRoute(nodes, VEHICLE_OFFSET, `motor-${index}`)),
  ...CIRCUITS.map((nodes, index) => makeRoute(nodes, BIKE_OFFSET, `cycle-${index}`)),
];

function makeFootpath(block: typeof STREET_BLOCKS[number]): TrafficRoute {
  const left = block.minX + SIDEWALK_OFFSET;
  const right = block.maxX - SIDEWALK_OFFSET;
  const top = block.minZ + SIDEWALK_OFFSET;
  const bottom = block.maxZ - SIDEWALK_OFFSET;
  const radius = 1;
  const vertices = [{ x: left, z: top }, { x: right, z: top }, { x: right, z: bottom }, { x: left, z: bottom }];
  const segments: TrafficSegment[] = [];
  let length = 0;
  for (let index = 0; index < 4; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % 4];
    const incoming = direction(vertices[(index + 3) % 4], current);
    const outgoing = direction(current, next);
    const x = current.x - incoming.x * radius;
    const z = current.z - incoming.z * radius;
    const arcLength = QUARTER_TURN * radius;
    segments.push({
      kind: 'junction', start: length, length: arcLength, x, z,
      dx: incoming.x, dz: incoming.z, radius, turn: 1,
      centerX: x + outgoing.x * radius, centerZ: z + outgoing.z * radius,
      lane: block.id, intersection: -1, axis: 'east-west',
    });
    length += arcLength;
    const linkLength = Math.abs(next.x - current.x) + Math.abs(next.z - current.z) - 2 * radius;
    segments.push({
      kind: 'link', start: length, length: linkLength,
      x: current.x + outgoing.x * radius, z: current.z + outgoing.z * radius,
      dx: outgoing.x, dz: outgoing.z, radius: 0, turn: 0, centerX: 0, centerZ: 0,
      lane: block.id, intersection: -1, axis: 'east-west',
    });
    length += linkLength;
  }
  return { id: block.id, length, segments };
}

export const SIDEWALK_ROUTES: readonly TrafficRoute[] = STREET_BLOCKS.map(makeFootpath);

/** Samples into a retained actor; distance and heading are continuous at every join. */
export function sampleTrafficRoute(route: TrafficRoute, distance: number, target: Pick<ActorState, 'position' | 'heading'>): void {
  const along = wrap(distance, route.length);
  let index = 0;
  while (index < route.segments.length - 1 && along >= route.segments[index + 1].start) index += 1;
  place(route.segments[index], along - route.segments[index].start, target);
}

function place(segment: TrafficSegment, distance: number, target: Pick<ActorState, 'position' | 'heading'>): void {
  if (segment.turn === 0) {
    target.position.x = segment.x + segment.dx * distance;
    target.position.z = segment.z + segment.dz * distance;
    target.heading = Math.atan2(segment.dx, segment.dz);
  } else {
    const angle = segment.turn * distance / segment.radius;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = segment.x - segment.centerX;
    const z = segment.z - segment.centerZ;
    target.position.x = segment.centerX + x * cos - z * sin;
    target.position.z = segment.centerZ + x * sin + z * cos;
    target.heading = Math.atan2(segment.dx * cos - segment.dz * sin, segment.dx * sin + segment.dz * cos);
  }
  target.position.y = 0;
}

function createActor(id: string, kind: ActorState['kind'], route: TrafficRoute, distance: number): ActorState {
  const actor: ActorState = {
    id, kind, position: { x: 0, y: 0, z: 0 }, heading: 0,
    state: 'moving', distance, speed: 0, routeLength: route.length,
  };
  sampleTrafficRoute(route, distance, actor);
  return actor;
}

/** Fixed-clock traffic. Reservations cover turns, cyclists, and the downstream exit. */
export class CityTraffic {
  readonly actors: readonly ActorState[];
  readonly signals: readonly TrafficSignalState[];
  elapsed = 0;
  private readonly junctions: Junction[];
  private readonly motions: Motion[];
  private readonly walkers: Motion[];

  constructor(seed = 2401) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Traffic seed must be an unsigned 32-bit integer.');
    const random = sequence(seed);
    this.junctions = INTERSECTIONS.map(({ id }, index) => ({
      id, phase: index % 2 === 0 ? 'north-south' : 'east-west',
      owner: null, elapsed: random() * 3, stage: index % 2 === 0 ? 0 : 2,
    }));
    this.signals = Object.freeze(this.junctions);
    const occupiedLanes = new Set<string>();
    this.motions = TRAFFIC_ACTORS.slice(0, 36).map((definition, index) => {
      const bicycle = definition.kind === 'cyclist';
      const route = TRAFFIC_ROUTES[bicycle ? 6 + (index - 24) % 6 : index % 6];
      const length = TRAFFIC_LENGTHS[definition.vehicleType!];
      const linkCount = route.segments.length / 2;
      const startLink = Math.floor(random() * linkCount);
      let segment = -1;
      for (let attempt = 0; attempt < linkCount; attempt += 1) {
        const candidate = ((startLink + attempt) % linkCount) * 2 + 1;
        if (!occupiedLanes.has(route.segments[candidate].lane)) {
          segment = candidate;
          break;
        }
      }
      if (segment < 0) throw new Error(`No safe initial lane for ${definition.id}.`);
      const link = route.segments[segment];
      occupiedLanes.add(link.lane);
      const distance = link.start + Math.min(link.length / 2, length / 2 + 1.5 + random());
      return {
        actor: createActor(definition.id, definition.kind, route, distance),
        route, segment, length, bicycle,
        desiredSpeed: bicycle ? 2.8 + random() * 0.6 : 3.8 + random(),
        advance: 0, permit: -1, releaseRemaining: 0, requestSince: -1,
      };
    });
    this.walkers = TRAFFIC_ACTORS.slice(36).map((definition, index) => {
      const route = SIDEWALK_ROUTES[Math.floor(index / 3)];
      const distance = (index % 3) * route.length / 3 + random();
      return {
        actor: createActor(definition.id, definition.kind, route, distance),
        route, segment: 0, length: 0.7, bicycle: false, desiredSpeed: 0.85 + random() * 0.25,
        advance: 0, permit: -1, releaseRemaining: 0, requestSince: -1,
      };
    });
    this.actors = Object.freeze([...this.motions.map(({ actor }) => actor), ...this.walkers.map(({ actor }) => actor)]);
  }

  /** Invalid time is rejected; an oversized delta is discarded, not caught up. */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Traffic delta must be finite and nonnegative.');
    if (dt === 0) return;
    const seconds = Math.min(dt, TRAFFIC.maxStep);
    this.elapsed += seconds;
    this.advanceSignals(seconds);
    this.reserveIntersections(seconds);
    this.planMovement(seconds);
    for (const motion of this.motions) {
      this.move(motion);
      if (motion.permit >= 0) {
        motion.releaseRemaining -= motion.advance;
        if (motion.releaseRemaining <= EPSILON) {
          this.junctions[motion.permit].owner = null;
          motion.permit = -1;
          motion.releaseRemaining = 0;
        }
      }
    }
    this.advanceWalkers(seconds);
  }

  private advanceSignals(dt: number): void {
    for (const junction of this.junctions) {
      junction.elapsed += dt;
      const green = junction.stage === 0 || junction.stage === 2;
      const duration = green ? TRAFFIC.greenSeconds : junction.stage === 4 ? TRAFFIC.pedestrianSeconds : TRAFFIC.clearanceSeconds;
      if (junction.elapsed + EPSILON < duration || (!green && junction.owner !== null)) continue;
      junction.stage = (junction.stage + 1) % PHASES.length;
      junction.phase = PHASES[junction.stage];
      junction.elapsed = 0;
    }
  }

  private reserveIntersections(dt: number): void {
    for (const motion of this.motions) {
      if (motion.permit >= 0) continue;
      const segment = motion.route.segments[motion.segment];
      if (segment.kind !== 'link') continue;
      const remaining = segment.start + segment.length - motion.actor.distance - motion.length / 2 - STOP_APPROACH_BUFFER;
      const requestDistance = motion.actor.speed ** 2 / (2 * TRAFFIC.braking) + motion.actor.speed * dt + 0.5;
      if (remaining <= requestDistance && motion.requestSince < 0) motion.requestSince = this.elapsed;
    }
    for (let index = 0; index < this.junctions.length; index += 1) {
      const junction = this.junctions[index];
      if (junction.owner || junction.phase === 'clearance' || junction.phase === 'pedestrians') continue;
      let chosen: Motion | null = null;
      for (const motion of this.motions) {
        if (motion.permit >= 0 || motion.requestSince < 0) continue;
        const segment = motion.route.segments[motion.segment];
        if (segment.intersection !== index || segment.axis !== junction.phase) continue;
        if (!this.exitAvailable(motion)) continue;
        if (!chosen || motion.requestSince < chosen.requestSince) chosen = motion;
      }
      if (!chosen) continue;
      const turn = chosen.route.segments[(chosen.segment + 1) % chosen.route.segments.length];
      junction.owner = chosen;
      chosen.permit = index;
      chosen.requestSince = -1;
      chosen.releaseRemaining = ahead(chosen.actor.distance, turn.start, chosen.route.length) +
        turn.length + chosen.length / 2 + TRAFFIC.stopBuffer;
    }
  }

  private exitAvailable(motion: Motion): boolean {
    const route = motion.route;
    const incoming = route.segments[motion.segment];
    const outgoing = route.segments[(motion.segment + 2) % route.segments.length];
    // Reserve a body, a gap, and stopping room so the junction never becomes a queue.
    const needed = motion.length / 2 + TRAFFIC.stopBuffer +
      motion.desiredSpeed ** 2 / (2 * TRAFFIC.braking) + motion.desiredSpeed * TRAFFIC.maxStep;
    for (const other of this.motions) {
      if (other === motion) continue;
      const segment = other.route.segments[other.segment];
      if (segment.kind !== 'link') continue;
      if (segment.lane === incoming.lane &&
        other.actor.distance - segment.start > motion.actor.distance - incoming.start) return false;
      if (segment.lane !== outgoing.lane) continue;
      const clearance = other.actor.distance - segment.start - other.length / 2 - motion.length / 2 - this.gap(motion);
      if (clearance < needed) return false;
    }
    return true;
  }

  private gap(motion: Motion): number {
    return motion.bicycle ? TRAFFIC.bicycleGap : TRAFFIC.vehicleGap;
  }

  private planMovement(dt: number): void {
    for (const motion of this.motions) {
      const actor = motion.actor;
      const segment = motion.route.segments[motion.segment];
      let available = motion.route.length;
      if (segment.kind === 'link') {
        const along = actor.distance - segment.start;
        if (motion.permit !== segment.intersection) {
          available = Math.max(0, segment.length - along - motion.length / 2 - STOP_APPROACH_BUFFER);
        }
        for (const leader of this.motions) {
          if (leader === motion) continue;
          const leaderSegment = leader.route.segments[leader.segment];
          if (leaderSegment.kind !== 'link' || leaderSegment.lane !== segment.lane) continue;
          const difference = leader.actor.distance - leaderSegment.start - along;
          if (difference > 0) available = Math.min(available, Math.max(0, difference -
            (motion.length + leader.length) / 2 - this.gap(motion)));
        }
      }
      const brakeTick = TRAFFIC.braking * dt;
      const safeSpeed = Math.sqrt(brakeTick ** 2 + 2 * TRAFFIC.braking * available) - brakeTick;
      const desired = Math.min(motion.desiredSpeed, safeSpeed);
      actor.speed = Math.max(0, Math.min(actor.speed + TRAFFIC.acceleration * dt, Math.max(actor.speed - brakeTick, desired)));
      motion.advance = Math.min(available, actor.speed * dt);
      if (available < EPSILON) {
        motion.advance = available;
        actor.speed = 0;
      }
      actor.state = motion.advance > EPSILON ? 'moving' : 'waiting';
    }
  }

  private move(motion: Motion): void {
    const actor = motion.actor;
    actor.distance = wrap(actor.distance + motion.advance, motion.route.length);
    const segments = motion.route.segments;
    let index = motion.segment;
    if (actor.distance < segments[index].start) index = 0;
    while (index < segments.length - 1 && actor.distance >= segments[index + 1].start) index += 1;
    motion.segment = index;
    place(segments[index], actor.distance - segments[index].start, actor);
  }

  private advanceWalkers(dt: number): void {
    for (const walker of this.walkers) {
      let available = walker.route.length;
      for (const other of this.walkers) {
        if (other === walker || other.route !== walker.route) continue;
        available = Math.min(available, Math.max(0, ahead(walker.actor.distance, other.actor.distance, walker.route.length) - 1.2));
      }
      walker.advance = Math.min(available, walker.desiredSpeed * dt);
      walker.actor.speed = walker.advance / dt;
      walker.actor.state = walker.advance > EPSILON ? 'moving' : 'waiting';
    }
    for (const walker of this.walkers) this.move(walker);
  }
}
