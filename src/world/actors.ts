import { CITY, ROUTE_LENGTH, sampleRoute, type Position } from '../content/city';

export interface ActorState {
  id: string;
  kind: 'bus' | 'car' | 'pedestrian';
  position: Position;
  heading: number;
  state: 'moving' | 'waiting' | 'dwelling';
  distance: number;
  speed: number;
  routeLength: number;
}

export const ACTIVITY = {
  seed: 2401,
  maxStep: 1 / 30,
  busStop: 5,
  busDwell: 3,
  vehicleGap: 2,
  acceleration: 1.4,
  braking: 2.4,
  vehiclePhase: 16,
  pedestrianEntry: 6,
  pedestrianPhase: 12,
  crossingStart: 11,
  crossingEnd: 17,
  crossingBuffer: 0.3,
  busLength: 4.8,
  carLength: 2.8,
} as const;

type Signal = 'vehicles' | 'clearance' | 'pedestrians';

interface Vehicle {
  actor: ActorState;
  desiredSpeed: number;
  length: number;
  stopRemaining: number;
  dwellRemaining: number;
  clearanceRemaining: number;
  advance: number;
}

interface Walker {
  actor: ActorState;
  crossing: boolean;
  desiredSpeed: number;
  restDuration: number;
  restRemaining: number;
  stopRemaining: number;
  crossingRemaining: number;
  advance: number;
}

const EPSILON = 1e-7;
const WALK_GAP = 1.2;
const OUTER_RADIUS = 10;
const OUTER_ARC = Math.PI * OUTER_RADIUS / 2;
const OUTER_LENGTH = 96 + 4 * OUTER_ARC;
const OUTER_SEGMENTS = [28, OUTER_ARC, 20, OUTER_ARC, 28, OUTER_ARC, 20, OUTER_ARC];
const CROSS_RADIUS = 0.45;
// Keep the north turnaround 0.75m clear of the outer sidewalk's centerline.
const CROSS_NORTH = -18.8;
const CROSS_SOUTH = -12.45;
const CROSS_STRAIGHT = CROSS_SOUTH - CROSS_NORTH;
const CROSS_HALF = CROSS_STRAIGHT + Math.PI * CROSS_RADIUS;
const CROSS_LENGTH = CROSS_HALF * 2;
const CROSS_NORTH_GATE = -18.7 - CROSS_NORTH;
const CROSS_SOUTH_GATE = CROSS_SOUTH - -13.3;
const CROSS_TRAVEL = CROSS_STRAIGHT - CROSS_NORTH_GATE - CROSS_SOUTH_GATE;

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function ahead(from: number, to: number, length: number): number {
  const distance = wrap(to - from, length);
  return distance < EPSILON || length - distance < EPSILON ? 0 : distance;
}

function randomSequence(seed: number): () => number {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function actor(id: string, kind: ActorState['kind'], distance: number, routeLength: number): ActorState {
  return { id, kind, distance, routeLength, position: { x: 0, y: 0, z: 0 }, heading: 0, state: 'moving', speed: 0 };
}

function placeRoadActor(state: ActorState): void {
  const point = sampleRoute(state.distance);
  Object.assign(state.position, { x: point.x, y: 0, z: point.z });
  state.heading = point.heading;
}

function placeOuterWalker(state: ActorState): void {
  let distance = state.distance;
  let roadDistance = 0;
  let segment = 0;
  while (segment < OUTER_SEGMENTS.length - 1 && distance >= OUTER_SEGMENTS[segment]) {
    distance -= OUTER_SEGMENTS[segment];
    roadDistance += segment % 2 === 0 ? OUTER_SEGMENTS[segment] : Math.PI * 3;
    segment += 1;
  }
  const point = sampleRoute(roadDistance + (segment % 2 === 0 ? distance : distance * 6 / OUTER_RADIUS));
  state.position.x = point.x + 4 * Math.cos(point.heading);
  state.position.z = point.z - 4 * Math.sin(point.heading);
  state.heading = point.heading;
}

function placeCrossingWalker(state: ActorState): void {
  const secondHalf = state.distance >= CROSS_HALF;
  const distance = secondHalf ? state.distance - CROSS_HALF : state.distance;
  if (distance < CROSS_STRAIGHT) {
    state.position.x = secondHalf ? CROSS_RADIUS : -CROSS_RADIUS;
    state.position.z = secondHalf ? CROSS_SOUTH - distance : CROSS_NORTH + distance;
    state.heading = secondHalf ? Math.PI : 0;
    return;
  }
  const angle = (secondHalf ? 0 : Math.PI) - (distance - CROSS_STRAIGHT) / CROSS_RADIUS;
  state.position.x = Math.cos(angle) * CROSS_RADIUS;
  state.position.z = (secondHalf ? CROSS_NORTH : CROSS_SOUTH) + Math.sin(angle) * CROSS_RADIUS;
  state.heading = Math.atan2(Math.sin(angle), -Math.cos(angle));
}

function crossingGate(distance: number): number {
  return Math.min(ahead(distance, CROSS_NORTH_GATE, CROSS_LENGTH), ahead(distance, CROSS_HALF + CROSS_SOUTH_GATE, CROSS_LENGTH));
}

/** Fixed population and seeded routes. Pause/visibility are implemented by not calling step. */
export class ActorSimulation {
  readonly actors: readonly ActorState[];
  elapsed = 0;
  private phase: Signal = 'vehicles';
  private phaseElapsed = 0;
  private readonly vehicles: Vehicle[];
  private readonly walkers: Walker[];

  constructor(seed: number = ACTIVITY.seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Actor seed must be an unsigned 32-bit integer.');
    const random = randomSequence(seed);
    this.vehicles = Array.from({ length: 4 }, (_, index) => {
      const bus = index === 0;
      const distance = wrap((bus ? ROUTE_LENGTH - 14 : index * ROUTE_LENGTH / 4 - 8) + random() * 3, ROUTE_LENGTH);
      const state = actor(bus ? CITY.busId : `car-${index}`, bus ? 'bus' : 'car', distance, ROUTE_LENGTH);
      placeRoadActor(state);
      return {
        actor: state,
        desiredSpeed: bus ? CITY.busSpeed : 3.5 + random() * 0.6,
        length: bus ? ACTIVITY.busLength : ACTIVITY.carLength,
        stopRemaining: ahead(distance, ACTIVITY.busStop, ROUTE_LENGTH),
        dwellRemaining: 0,
        clearanceRemaining: 0,
        advance: 0,
      };
    });
    this.walkers = Array.from({ length: 8 }, (_, index) => {
      const crossing = index < 2;
      const length = crossing ? CROSS_LENGTH : OUTER_LENGTH;
      // Crossers start on opposite sidewalks, never inside an initially green road.
      const startClearance = index === 0 ? CROSS_NORTH_GATE / 2 : CROSS_SOUTH_GATE / 2;
      const distance = crossing ? index * CROSS_HALF + random() * startClearance : (index - 2) * length / 6 + random() * 3;
      const state = actor(`walker-${index + 1}`, 'pedestrian', distance, length);
      if (crossing) placeCrossingWalker(state);
      else placeOuterWalker(state);
      return {
        actor: state,
        crossing,
        desiredSpeed: crossing ? 0.95 + random() * 0.15 : 0.85 + random() * 0.35,
        restDuration: 2 + random() * 2,
        restRemaining: 0,
        stopRemaining: ahead(distance, wrap(36 + index * 19, length), length),
        crossingRemaining: 0,
        advance: 0,
      };
    });
    this.actors = Object.freeze([...this.vehicles.map(({ actor: state }) => state), ...this.walkers.map(({ actor: state }) => state)]);
  }

  get signal(): Signal {
    return this.phase;
  }

  getActor(id: string): ActorState | undefined {
    return this.actors.find((state) => state.id === id);
  }

  /** Rejects invalid deltas; discards time beyond one fixed tick rather than catching up. */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Actor delta must be finite and nonnegative.');
    if (dt === 0) return;
    const seconds = Math.min(dt, ACTIVITY.maxStep);
    this.elapsed += seconds;
    this.advanceSignal(seconds);
    this.advanceVehicles(seconds);
    this.advanceWalkers(seconds);
  }

  private advanceSignal(dt: number): void {
    this.phaseElapsed += dt;
    if (this.phase === 'vehicles' && this.phaseElapsed + EPSILON >= ACTIVITY.vehiclePhase) {
      this.phase = 'clearance';
      this.phaseElapsed = 0;
      for (const vehicle of this.vehicles) {
        const { actor: state } = vehicle;
        const stop = ACTIVITY.crossingStart - vehicle.length / 2 - ACTIVITY.crossingBuffer;
        const exit = ACTIVITY.crossingEnd + vehicle.length / 2 + ACTIVITY.crossingBuffer;
        const stoppingDistance = state.speed ** 2 / (2 * ACTIVITY.braking) + state.speed * dt;
        // A vehicle too close to brake gets a single clearance permit, never an abrupt red-light stop.
        if ((state.distance > stop && state.distance < exit) ||
          (state.speed > EPSILON && ahead(state.distance, stop, ROUTE_LENGTH) <= stoppingDistance)) {
          vehicle.clearanceRemaining = ahead(state.distance, exit, ROUTE_LENGTH);
        }
      }
    } else if (this.phase === 'clearance' && this.vehicles.every((vehicle) => vehicle.clearanceRemaining === 0)) {
      this.phase = 'pedestrians';
      this.phaseElapsed = 0;
    } else if (this.phase === 'pedestrians' && this.phaseElapsed + EPSILON >= ACTIVITY.pedestrianPhase &&
      this.walkers.every((walker) => walker.crossingRemaining === 0)) {
      this.phase = 'vehicles';
      this.phaseElapsed = 0;
    }
  }

  private advanceVehicles(dt: number): void {
    for (const vehicle of this.vehicles) {
      const { actor: state } = vehicle;
      vehicle.advance = 0;
      if (vehicle.dwellRemaining > 0) {
        vehicle.dwellRemaining = Math.max(0, vehicle.dwellRemaining - dt);
        if (vehicle.dwellRemaining < EPSILON) vehicle.dwellRemaining = 0;
        state.state = 'dwelling';
        state.speed = 0;
        continue;
      }
      let available = state.kind === 'bus' ? vehicle.stopRemaining : ROUTE_LENGTH;
      for (const leader of this.vehicles) {
        if (leader === vehicle) continue;
        available = Math.min(available, Math.max(0, ahead(state.distance, leader.actor.distance, ROUTE_LENGTH) -
          (vehicle.length + leader.length) / 2 - ACTIVITY.vehicleGap));
      }
      if (this.phase !== 'vehicles' && vehicle.clearanceRemaining === 0) {
        const stop = ACTIVITY.crossingStart - vehicle.length / 2 - ACTIVITY.crossingBuffer;
        available = Math.min(available, ahead(state.distance, stop, ROUTE_LENGTH));
      }
      // Reserve a full braking distance against the leader's old pose; updates cannot depend on array order.
      const brakeTick = ACTIVITY.braking * dt;
      const safeSpeed = Math.sqrt(brakeTick ** 2 + 2 * ACTIVITY.braking * available) - brakeTick;
      const desired = Math.min(vehicle.desiredSpeed, safeSpeed);
      state.speed = Math.max(0, Math.min(state.speed + ACTIVITY.acceleration * dt, Math.max(state.speed - brakeTick, desired)));
      vehicle.advance = Math.min(available, state.speed * dt);
      if (available < EPSILON) vehicle.advance = available;
      state.state = vehicle.advance > EPSILON ? 'moving' : 'waiting';
    }
    for (const vehicle of this.vehicles) {
      const { actor: state, advance } = vehicle;
      state.distance = wrap(state.distance + advance, ROUTE_LENGTH);
      vehicle.clearanceRemaining = Math.max(0, vehicle.clearanceRemaining - advance);
      if (vehicle.clearanceRemaining < EPSILON) vehicle.clearanceRemaining = 0;
      if (state.kind === 'bus' && vehicle.dwellRemaining === 0 && state.state !== 'dwelling') {
        vehicle.stopRemaining = Math.max(0, vehicle.stopRemaining - advance);
        if (vehicle.stopRemaining < EPSILON) {
          vehicle.stopRemaining = ROUTE_LENGTH;
          vehicle.dwellRemaining = ACTIVITY.busDwell;
          state.speed = 0;
          state.state = 'dwelling';
        }
      }
      placeRoadActor(state);
    }
  }

  private advanceWalkers(dt: number): void {
    const canEnter = this.phase === 'pedestrians' && this.phaseElapsed < ACTIVITY.pedestrianEntry;
    for (const walker of this.walkers) {
      const { actor: state } = walker;
      walker.advance = 0;
      if (walker.restRemaining > 0) {
        walker.restRemaining = Math.max(0, walker.restRemaining - dt);
        if (walker.restRemaining < EPSILON) walker.restRemaining = 0;
        state.speed = 0;
        state.state = 'waiting';
        continue;
      }
      let available = walker.crossing ? state.routeLength : walker.stopRemaining;
      for (const leader of this.walkers) {
        if (leader === walker || leader.crossing !== walker.crossing) continue;
        available = Math.min(available, Math.max(0, ahead(state.distance, leader.actor.distance, state.routeLength) - WALK_GAP));
      }
      if (walker.crossing && walker.crossingRemaining === 0 && !canEnter) {
        available = Math.min(available, crossingGate(state.distance));
      }
      walker.advance = Math.min(available, walker.desiredSpeed * dt);
      state.speed = walker.advance / dt;
      state.state = walker.advance > EPSILON ? 'moving' : 'waiting';
    }
    for (const walker of this.walkers) {
      const { actor: state, advance } = walker;
      if (walker.crossingRemaining > 0) {
        walker.crossingRemaining = Math.max(0, walker.crossingRemaining - advance);
        if (walker.crossingRemaining < EPSILON) walker.crossingRemaining = 0;
      } else if (walker.crossing && canEnter && advance > 0) {
        const gate = crossingGate(state.distance);
        if (gate <= advance + EPSILON) walker.crossingRemaining = CROSS_TRAVEL - (advance - gate);
      }
      state.distance = wrap(state.distance + advance, state.routeLength);
      if (walker.crossing) {
        placeCrossingWalker(state);
      } else {
        if (walker.restRemaining === 0 && advance > 0) {
          walker.stopRemaining = Math.max(0, walker.stopRemaining - advance);
          if (walker.stopRemaining < EPSILON) {
            walker.stopRemaining = OUTER_LENGTH;
            walker.restRemaining = walker.restDuration;
            state.speed = 0;
            state.state = 'waiting';
          }
        }
        placeOuterWalker(state);
      }
    }
  }
}
