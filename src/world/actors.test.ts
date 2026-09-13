// @vitest-environment node
import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PARK_BOUNDS, PARK_PATHS, PARK_ROUTES, sampleParkRoute } from '../content/park';
import { STREET_X, STREET_Z, TRAFFIC_ACTORS } from '../content/streets';
import { ActorSimulation } from './actors';

const DT = 1 / 30;
const outsidePark = ({ x, z }: { x: number; z: number }) => Math.abs(x) > PARK_BOUNDS.x || Math.abs(z) > PARK_BOUNDS.z;

describe('connected car-free park', () => {
  it('connects continuous walking routes through real gates and outside sidewalks', () => {
    const before = new Vector3();
    const after = new Vector3();
    for (const route of PARK_ROUTES) {
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
      ...Array.from({ length: 8 }, (_, index) => `walker-${index + 1}`),
      ...TRAFFIC_ACTORS.map(({ id }) => id),
    ]);
    expect(simulation.getActor('square-bus')).toBeUndefined();
    expect(simulation.getActor('car-1')).toBeUndefined();
    expect(Object.isFrozen(simulation.actors)).toBe(true);
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
    const walkers = simulation.actors.slice(0, 8);
    const transitions = new Uint16Array(8);
    const wasOutside = walkers.map(({ position }) => outsidePark(position));
    const previous = walkers.map(({ position }) => new Vector3(position.x, 0, position.z));
    const longestIdle = new Float64Array(8);
    const idle = new Float64Array(8);
    for (let tick = 0; tick < 18_000; tick++) {
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
      for (const actor of simulation.traffic.actors) {
        if (actor.kind === 'car' || actor.kind === 'bus' || actor.kind === 'cyclist') {
          if (!outsidePark(actor.position)) throw new Error(`Vehicle entered the park: ${actor.id}.`);
        }
      }
    }
    transitions.forEach((count) => expect(count).toBeGreaterThanOrEqual(4));
    longestIdle.forEach((seconds) => expect(seconds).toBeLessThan(25));
    expect(simulation.elapsed).toBeCloseTo(simulation.traffic.elapsed);
  }, 30_000);
});
