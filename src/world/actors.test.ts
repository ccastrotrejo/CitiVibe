// @vitest-environment node
import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PARK_ACTORS, PARK_BOUNDS, PARK_PATHS, PARK_ROUTES, PARK_RUNNING_ROUTE, sampleParkRoute } from '../content/park';
import { STREET_X, STREET_Z, TRAFFIC_ACTORS } from '../content/streets';
import { ActorSimulation } from './actors';

const DT = 1 / 30;
const outsidePark = ({ x, z }: { x: number; z: number }) => Math.abs(x) > PARK_BOUNDS.x || Math.abs(z) > PARK_BOUNDS.z;

describe('connected car-free park', () => {
  it('connects continuous walking routes through real gates and outside sidewalks', () => {
    const before = new Vector3();
    const after = new Vector3();
    for (const route of [...PARK_ROUTES, PARK_RUNNING_ROUTE]) {
      for (const segment of route.segments) {
        sampleParkRoute(route, segment.start - 0.0001, before);
        sampleParkRoute(route, segment.start + 0.0001, after);
        expect(before.distanceTo(after)).toBeLessThan(0.001);
      }
    }
    for (const path of PARK_PATHS) {
      for (const point of path.curve.getSpacedPoints(200)) {
        const fromRoad = Math.min(
          ...STREET_X.map((x) => Math.abs(x - point.x)),
          ...STREET_Z.map((z) => Math.abs(z - point.z)),
        );
        expect(fromRoad, path.id).toBeGreaterThan(5.3);
      }
    }
  });

  it('retains stable actors and positions without any former park vehicles', () => {
    const simulation = new ActorSimulation();
    const actors = [...simulation.actors];
    const positions = actors.map(({ position }) => position);
    expect(actors.map(({ id }) => id)).toEqual([
      ...PARK_ACTORS.map(({ id }) => id),
      ...TRAFFIC_ACTORS.map(({ id }) => id),
    ]);
    expect(simulation.getActor('square-bus')).toBeUndefined();
    expect(simulation.getActor('car-1')).toBeUndefined();
    expect(Object.isFrozen(simulation.actors)).toBe(true);
    expect(actors).toHaveLength(126);
    expect(actors.filter(({ kind }) => kind === 'car' || kind === 'bus')).toHaveLength(36);
    expect(actors.filter(({ kind }) => kind === 'cyclist')).toHaveLength(12);
    expect(actors.filter(({ kind }) => kind === 'pedestrian')).toHaveLength(78);
    simulation.step(DT);
    actors.forEach((actor, index) => {
      expect(simulation.actors[index]).toBe(actor);
      expect(actor.position).toBe(positions[index]);
      expect(simulation.getActor(actor.id)).toBe(actor);
    });
  });

  it.each([NaN, Infinity, -Infinity, -1, 1.2, 0x100000000])('rejects invalid seed %s', (seed) => {
    expect(() => new ActorSimulation(seed)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid delta %s without changing state', (dt) => {
    const simulation = new ActorSimulation();
    const before = JSON.stringify(simulation);
    expect(() => simulation.step(dt)).toThrow(RangeError);
    expect(JSON.stringify(simulation)).toBe(before);
  });

  it('discards excess delta and freezes all actor timers on zero delta', () => {
    const first = new ActorSimulation();
    const second = new ActorSimulation();
    first.step(300);
    second.step(DT);
    expect(first).toEqual(second);
    const before = JSON.stringify(first);
    for (let tick = 0; tick < 1000; tick++) first.step(0);
    expect(JSON.stringify(first)).toBe(before);
  });

  it('reduces vehicle speed in low grip without slowing the park clock', () => {
    const dry = new ActorSimulation();
    const snowy = new ActorSimulation();
    for (let tick = 0; tick < 90; tick++) {
      dry.step(DT);
      snowy.step(DT, 0.3);
    }
    const totalSpeed = (simulation: ActorSimulation) => simulation.actors
      .filter(({ kind }) => kind === 'car' || kind === 'bus').reduce((sum, actor) => sum + actor.speed, 0);
    expect(totalSpeed(snowy)).toBeLessThan(totalSpeed(dry));
    expect(snowy.getActor('walker-3')).toEqual(dry.getActor('walker-3'));
    expect(snowy.elapsed).toBe(dry.elapsed);
    for (const traction of [NaN, Infinity, 0.2, 1.1]) expect(() => snowy.step(DT, traction)).toThrow(RangeError);
  });

  it('reproduces seed and ticks without ambient randomness or wall time', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness'); });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Wall clock'); });
    try {
      const first = new ActorSimulation(91);
      const second = new ActorSimulation(91);
      for (let tick = 0; tick < 1000; tick++) { first.step(DT); second.step(DT); }
      expect(first).toEqual(second);
      expect(new ActorSimulation(92).actors).not.toEqual(new ActorSimulation(91).actors);
    } finally { random.mockRestore(); clock.mockRestore(); }
  });

  it.each([0, 1, 42, 91, 2401])('keeps seed %s car-free while every visitor enters and leaves', (seed) => {
    const simulation = new ActorSimulation(seed);
    const walkers = simulation.actors.filter(({ gait }) => gait === 'walk');
    const runners = simulation.actors.filter(({ gait }) => gait === 'run');
    const parkActors = [...walkers, ...runners];
    const transitions = new Uint16Array(walkers.length);
    const wasOutside = walkers.map(({ position }) => outsidePark(position));
    const previous = walkers.map(({ position }) => new Vector3(position.x, 0, position.z));
    const longestIdle = new Float64Array(walkers.length);
    const idle = new Float64Array(walkers.length);
    const runnerDistance = new Float64Array(runners.length);
    const expectedRunner = new Vector3();
    for (let tick = 0; tick < 27_000; tick++) {
      simulation.step(DT);
      walkers.forEach((actor, index) => {
        const next = new Vector3(actor.position.x, 0, actor.position.z);
        const movement = next.distanceTo(previous[index]);
        if (movement >= 0.037) throw new Error(`Visitor jump: ${actor.id}, seed ${seed}, tick ${tick}.`);
        const outside = outsidePark(actor.position);
        if (outside !== wasOutside[index]) transitions[index]++;
        wasOutside[index] = outside;
        idle[index] = movement < 1e-7 ? idle[index] + DT : 0;
        longestIdle[index] = Math.max(longestIdle[index], idle[index]);
        previous[index].copy(next);
        for (let other = index + 1; other < walkers.length; other++) {
          const p = walkers[other].position;
          if (Math.hypot(p.x - next.x, p.z - next.z) <= 0.7) {
            throw new Error(`Visitors overlap: ${index}/${other}, seed ${seed}, tick ${tick}.`);
          }
        }
      });
      runners.forEach((actor, index) => {
        runnerDistance[index] += actor.speed * DT;
        if (outsidePark(actor.position) || actor.speed < 0 || actor.speed > 2.651) {
          throw new Error(`Runner stopped or left the park: ${actor.id}, seed ${seed}, tick ${tick}.`);
        }
        sampleParkRoute(PARK_RUNNING_ROUTE, actor.distance, expectedRunner);
        if (Math.hypot(actor.position.x - expectedRunner.x, actor.position.z - expectedRunner.z) > 1e-8) {
          throw new Error(`Runner left the track: ${actor.id}.`);
        }
        for (const other of parkActors) {
          if (other === actor) continue;
          if (Math.hypot(other.position.x - actor.position.x, other.position.z - actor.position.z) <= 0.7) {
            throw new Error(`Runner collision: ${actor.id}/${other.id}, seed ${seed}, tick ${tick}.`);
          }
        }
      });
      for (const actor of simulation.traffic.actors) {
        if (actor.kind === 'car' || actor.kind === 'bus' || actor.kind === 'cyclist') {
          if (!outsidePark(actor.position)) throw new Error(`Vehicle entered the park: ${actor.id}.`);
        }
      }
    }
    transitions.forEach((count) => expect(count).toBeGreaterThanOrEqual(4));
    longestIdle.forEach((seconds) => expect(seconds).toBeLessThan(25));
    runnerDistance.forEach((distance) => {
      expect(distance).toBeGreaterThan(PARK_RUNNING_ROUTE.length * 10);
      expect(distance / 900).toBeGreaterThan(2.3);
    });
    expect(simulation.elapsed).toBeCloseTo(simulation.traffic.elapsed);
  }, 30_000);
});
