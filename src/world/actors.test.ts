// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CITY, ROUTE_LENGTH, sampleRoute } from '../content/city';
import { ACTIVITY, ActorSimulation, type ActorState } from './actors';

const DT = 1 / 30;

function angleDifference(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function travel(from: number, to: number, length: number): number {
  return (to - from + length) % length;
}

function vehicleLength(state: ActorState): number {
  return state.kind === 'bus' ? 4.8 : 2.8;
}

function vehicleOverlap(a: ActorState, b: ActorState): boolean {
  const forwardA = { x: Math.sin(a.heading), z: Math.cos(a.heading) };
  const forwardB = { x: Math.sin(b.heading), z: Math.cos(b.heading) };
  const rightA = { x: forwardA.z, z: -forwardA.x };
  const rightB = { x: forwardB.z, z: -forwardB.x };
  const halfWidthA = a.kind === 'bus' ? 1.1 : 0.9;
  const halfWidthB = b.kind === 'bus' ? 1.1 : 0.9;
  return [forwardA, forwardB, rightA, rightB].every((axis) => {
    const centerDistance = Math.abs((a.position.x - b.position.x) * axis.x + (a.position.z - b.position.z) * axis.z);
    const radiusA = vehicleLength(a) / 2 * Math.abs(forwardA.x * axis.x + forwardA.z * axis.z) +
      halfWidthA * Math.abs(rightA.x * axis.x + rightA.z * axis.z);
    const radiusB = vehicleLength(b) / 2 * Math.abs(forwardB.x * axis.x + forwardB.z * axis.z) +
      halfWidthB * Math.abs(rightB.x * axis.x + rightB.z * axis.z);
    return centerDistance < radiusA + radiusB - 1e-7;
  });
}

describe('authored road continuity', () => {
  const arc = Math.PI * 3;
  const joins = [0, 28, 28 + arc, 48 + arc, 48 + 2 * arc, 76 + 2 * arc, 76 + 3 * arc, 96 + 3 * arc, ROUTE_LENGTH];

  it.each(joins)('has a continuous position and tangent at distance %s', (join) => {
    const epsilon = 0.0001;
    const before = sampleRoute(join - epsilon);
    const after = sampleRoute(join + epsilon);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThanOrEqual(2 * epsilon + 1e-9);
    expect(angleDifference(before.heading, after.heading)).toBeLessThanOrEqual(2 * epsilon / 6 + 1e-9);
    expect(before.y).toBe(0);
    expect(after.y).toBe(0);
  });

  it('keeps the north bus stop and crossing aligned with the art contract', () => {
    expect(sampleRoute(ACTIVITY.busStop)).toEqual({ x: -9, y: 0, z: -16, heading: Math.PI / 2 });
    expect(sampleRoute(14)).toEqual({ x: 0, y: 0, z: -16, heading: Math.PI / 2 });
  });
});

describe('ActorSimulation', () => {
  it('allocates the bounded semantic population and retains every actor and position object', () => {
    const simulation = new ActorSimulation();
    const population = simulation.actors;
    const states = [...population];
    const positions = population.map(({ position }) => position);
    expect(population.map(({ id }) => id)).toEqual([
      'square-bus', 'car-1', 'car-2', 'car-3',
      'walker-1', 'walker-2', 'walker-3', 'walker-4', 'walker-5', 'walker-6', 'walker-7', 'walker-8',
    ]);
    expect(simulation.getActor('unavailable')).toBeUndefined();
    expect(Object.isFrozen(population)).toBe(true);
    for (let tick = 0; tick < 300; tick += 1) simulation.step(DT);
    expect(simulation.actors).toBe(population);
    for (let index = 0; index < states.length; index += 1) {
      expect(simulation.actors[index]).toBe(states[index]);
      expect(simulation.actors[index].position).toBe(positions[index]);
      expect(simulation.getActor(states[index].id)).toBe(states[index]);
    }
  });

  it('repeats the same seed without ambient randomness or wall-clock input', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness'); });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Wall clock'); });
    try {
      const first = new ActorSimulation();
      const second = new ActorSimulation(2401);
      const different = new ActorSimulation(2402);
      expect(different.actors).not.toEqual(first.actors);
      for (let tick = 0; tick < 3000; tick += 1) {
        first.step(DT);
        second.step(DT);
      }
      expect(first.actors).toEqual(second.actors);
      expect(first.signal).toBe(second.signal);
      expect(first.elapsed).toBe(second.elapsed);
      expect(random).not.toHaveBeenCalled();
      expect(clock).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
      clock.mockRestore();
    }
  });

  it.each([NaN, Infinity, -Infinity, -1])('rejects delta %s without changing state', (delta) => {
    const simulation = new ActorSimulation();
    const before = JSON.stringify(simulation);
    expect(() => simulation.step(delta)).toThrow(RangeError);
    expect(JSON.stringify(simulation)).toBe(before);
  });

  it.each([NaN, Infinity, -1, 1.2, 0x100000000])('rejects invalid seed %s', (seed) => {
    expect(() => new ActorSimulation(seed)).toThrow(RangeError);
  });

  it('discards oversized deltas and does not advance on zero delta or while externally paused', () => {
    const clamped = new ActorSimulation();
    const normal = new ActorSimulation();
    clamped.step(300);
    normal.step(DT);
    expect(clamped).toEqual(normal);
    const paused = JSON.stringify(clamped);
    for (let tick = 0; tick < 900; tick += 1) clamped.step(0);
    expect(JSON.stringify(clamped)).toBe(paused);
    expect(clamped.elapsed).toBe(DT);
    clamped.step(DT);
    normal.step(DT);
    expect(clamped).toEqual(normal);
  });

  it('dwells at the same bus stop for three seconds on repeated laps, then resumes', () => {
    const simulation = new ActorSimulation();
    const bus = simulation.getActor(CITY.busId)!;
    const dwellDurations: number[] = [];
    let started = -1;
    let priorDistance = bus.distance;
    let travelSinceDwell = 0;
    for (let tick = 0; tick < 5400; tick += 1) {
      simulation.step(DT);
      travelSinceDwell += travel(priorDistance, bus.distance, ROUTE_LENGTH);
      priorDistance = bus.distance;
      if (bus.state === 'dwelling') {
        expect(bus.position.x).toBeCloseTo(-9, 5);
        expect(bus.position.z).toBe(-16);
        expect(bus.speed).toBe(0);
        if (started < 0) {
          if (dwellDurations.length > 0) expect(travelSinceDwell).toBeCloseTo(ROUTE_LENGTH, 4);
          travelSinceDwell = 0;
          started = simulation.elapsed;
        }
      } else if (started >= 0) {
        dwellDurations.push(simulation.elapsed - started);
        started = -1;
      }
    }
    expect(dwellDurations.length).toBeGreaterThanOrEqual(2);
    for (const duration of dwellDurations) {
      expect(duration).toBeGreaterThanOrEqual(3 - 1e-7);
      expect(duration).toBeLessThanOrEqual(3 + DT + 1e-7);
    }
  });

  it.each([2401, 0, 0xffffffff])('keeps seed %s safe, continuous, bounded, and progressing for 600 seconds', (seed) => {
    const simulation = new ActorSimulation(seed);
    const actors = simulation.actors;
    const vehicles = actors.filter(({ kind }) => kind === 'bus' || kind === 'car');
    const walkers = actors.filter(({ kind }) => kind === 'pedestrian');
    const prior = actors.map((state) => ({ distance: state.distance, speed: state.speed, heading: state.heading, ...state.position }));
    const totals = actors.map(() => 0);
    const lastProgress = actors.map(() => 0);
    const maxIdle = actors.map(() => 0);
    const signals = new Set<string>();
    const states = new Set<string>();
    let crossingTicks = 0;
    let clearanceWithTraffic = 0;
    let closestGap = Infinity;
    let maxAcceleration = 0;
    let maxBraking = 0;
    let phaseStarted = 0;
    let priorSignal = simulation.signal;
    let longestPhase = 0;
    for (let tick = 0; tick < 18_000; tick += 1) {
      simulation.step(DT);
      signals.add(simulation.signal);
      if (simulation.signal !== priorSignal) {
        longestPhase = Math.max(longestPhase, simulation.elapsed - phaseStarted);
        phaseStarted = simulation.elapsed;
        priorSignal = simulation.signal;
      }
      const occupiedRoad = vehicles.some(({ position, kind }) =>
        Math.abs(position.z + 16) < 2 && Math.abs(position.x) < 3 + (kind === 'bus' ? 2.4 : 1.4));
      const occupiedCrossing = walkers.some(({ position }) =>
        Math.abs(position.x) < 3 && position.z > -18.35 && position.z < -13.65);
      if (occupiedCrossing) crossingTicks += 1;
      if (simulation.signal === 'clearance' && occupiedRoad) clearanceWithTraffic += 1;
      if (occupiedCrossing && (occupiedRoad || simulation.signal !== 'pedestrians')) {
        throw new Error(`Crossing conflict for seed ${seed}, tick ${tick}, signal ${simulation.signal}`);
      }
      if (occupiedRoad && simulation.signal === 'pedestrians') {
        throw new Error(`Pedestrian phase began before traffic cleared: seed ${seed}, tick ${tick}`);
      }
      for (let first = 0; first < vehicles.length; first += 1) {
        for (let second = first + 1; second < vehicles.length; second += 1) {
          const a = vehicles[first];
          const b = vehicles[second];
          const gap = Math.min(travel(a.distance, b.distance, ROUTE_LENGTH), travel(b.distance, a.distance, ROUTE_LENGTH)) -
            (vehicleLength(a) + vehicleLength(b)) / 2;
          closestGap = Math.min(closestGap, gap);
          if (gap < 2 - 1e-6 || vehicleOverlap(a, b)) throw new Error(`Vehicle overlap: ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
        }
      }
      for (let first = 0; first < walkers.length; first += 1) {
        for (let second = first + 1; second < walkers.length; second += 1) {
          const a = walkers[first];
          const b = walkers[second];
          // Two bounding circles enclosing the measured 0.62m × 0.338m walking bodies.
          if (Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) < 0.71) {
            throw new Error(`Pedestrian overlap: ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
          }
        }
      }
      for (let index = 0; index < actors.length; index += 1) {
        const state = actors[index];
        const before = prior[index];
        states.add(`${state.kind}:${state.state}`);
        const movement = travel(before.distance, state.distance, state.routeLength);
        totals[index] += movement;
        if (movement > 0.0001) lastProgress[index] = simulation.elapsed;
        maxIdle[index] = Math.max(maxIdle[index], simulation.elapsed - lastProgress[index]);
        const displacement = Math.hypot(state.position.x - before.x, state.position.y - before.y, state.position.z - before.z);
        const finite = [state.position.x, state.position.y, state.position.z, state.distance, state.heading, state.speed].every(Number.isFinite);
        if (!finite || state.distance < 0 || state.distance >= state.routeLength ||
          Math.abs(state.position.x) > CITY.bounds || Math.abs(state.position.z) > CITY.bounds ||
          displacement > 4.2 * DT || angleDifference(state.heading, before.heading) > 0.1) {
          throw new Error(`Discontinuous or unbounded ${state.id}, seed ${seed}, tick ${tick}`);
        }
        if (state.kind === 'bus' || state.kind === 'car') {
          maxAcceleration = Math.max(maxAcceleration, (state.speed - before.speed) / DT);
          maxBraking = Math.max(maxBraking, (before.speed - state.speed) / DT);
        } else if (state.position.y !== 0) throw new Error('Walker is not on the ground');
        Object.assign(before, { distance: state.distance, speed: state.speed, heading: state.heading, ...state.position });
      }
      if (actors.length !== 12) throw new Error('Population changed');
    }
    expect(signals).toEqual(new Set(['vehicles', 'clearance', 'pedestrians']));
    expect(states.has('bus:dwelling')).toBe(true);
    expect(states.has('car:waiting')).toBe(true);
    expect(states.has('pedestrian:waiting')).toBe(true);
    expect(crossingTicks).toBeGreaterThan(1000);
    expect(clearanceWithTraffic).toBeGreaterThan(0);
    expect(closestGap).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(maxAcceleration).toBeLessThanOrEqual(1.4 + 1e-6);
    expect(maxBraking).toBeLessThanOrEqual(2.4 + 1e-4);
    expect(longestPhase).toBeLessThan(30);
    expect(simulation.elapsed).toBeCloseTo(600, 6);
    for (let index = 0; index < actors.length; index += 1) {
      expect(totals[index] / actors[index].routeLength, `${actors[index].id} must complete at least two loops`).toBeGreaterThan(2);
      expect(maxIdle[index], `${actors[index].id} must not starve`).toBeLessThan(40);
      expect(simulation.getActor(actors[index].id)).toBe(actors[index]);
    }
  });
});
