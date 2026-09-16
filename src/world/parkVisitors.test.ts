// @vitest-environment node
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PARK_OUTSIDE_WALK, PARK_RESTING_VISITORS, PARK_RETURN_DISTANCE } from '../content/parkVisitors';
import { PARK_BOUNDS } from '../content/park';
import { ParkVisitors } from './parkVisitors';
import { ActorSimulation } from './actors';
import type { PeopleWeatherInput } from './peopleWeather';

const DT = 1 / 30;

describe('weather-aware resting park neighbors', () => {
  it.each([2401, 42])('merges with the real park population for seed %s without blocking departures or returns', (seed) => {
    const simulation = new ActorSimulation(seed);
    const wet: PeopleWeatherInput = {
      frame: { rain: 1, rainIntensityMmH: 8, snow: 0, temperatureC: 10, windSpeed: 3.5, wetness: 0.4 },
      sunny: false, snowCover: 0,
    };
    for (let tick = 0; tick < 400 * 30; tick++) simulation.step(DT, 1, wet);
    expect(simulation.resting.states.filter((visitor) => visitor.phase !== 'outside')
      .map(({ phase, actor }) => ({ phase, id: actor.id, ...actor.position, neighbors: simulation.actors
        .filter((other) => other !== actor && Math.hypot(actor.position.x - other.position.x, actor.position.z - other.position.z) < 3)
        .map((other) => ({ id: other.id, heading: other.heading, ...other.position })) }))).toEqual([]);
    const dry: PeopleWeatherInput = { ...wet, frame: { ...wet.frame, rain: 0, temperatureC: 22, wetness: 0 }, sunny: true };
    for (let tick = 0; tick < 900 * 30; tick++) simulation.step(DT, 1, dry);
    expect(simulation.resting.states.filter((visitor) => visitor.phase !== 'seated')
      .map(({ phase, actor }) => ({ phase, id: actor.id, ...actor.position }))).toEqual([]);
  }, 30000);

  it('stands before traveling, leaves through a gate, stays outside and returns to the same seats', () => {
    const visitors = new ParkVisitors();
    expect(visitors.actors).toHaveLength(8);
    const ids = visitors.actors.map((actor) => actor.id);
    const positions = visitors.actors.map((actor) => actor.position);
    for (let tick = 0; tick < 400 * 30; tick++) {
      const previous = visitors.actors.map((actor) => ({ ...actor.position }));
      visitors.step(DT, true, false, []);
      visitors.actors.forEach((actor, index) => {
        const travel = Math.hypot(actor.position.x - previous[index].x, actor.position.z - previous[index].z);
        expect(travel).toBeLessThan(1.5 * DT);
        if (actor.sitting! > 0) expect(travel).toBe(0);
        if (Math.abs(actor.position.x) > PARK_BOUNDS.x && Math.abs(previous[index].x) <= PARK_BOUNDS.x &&
          Math.abs(previous[index].z) < PARK_BOUNDS.z) {
          expect(Math.abs(actor.position.z)).toBeLessThan(4);
        }
      });
    }
    expect(visitors.states.filter((visitor) => visitor.phase !== 'outside')
      .map(({ phase, actor }) => ({ phase, id: actor.id, ...actor.position }))).toEqual([]);
    for (const actor of visitors.actors) {
      expect(Math.abs(actor.position.x) > PARK_BOUNDS.x || Math.abs(actor.position.z) > PARK_BOUNDS.z).toBe(true);
    }
    for (let tick = 0; tick < 850 * 30; tick++) visitors.step(DT, false, true, []);
    expect(visitors.states.filter((visitor) => visitor.phase !== 'seated')
      .map(({ phase, actor }) => ({ phase, id: actor.id, ...actor.position }))).toEqual([]);
    expect(visitors.actors.map((actor) => actor.id)).toEqual(ids);
    visitors.actors.forEach((actor, index) => {
      expect(actor.position).toBe(positions[index]);
      expect(actor.position.x).toBeCloseTo(PARK_RESTING_VISITORS[index].seat[0], 8);
      expect(actor.position.z).toBeCloseTo(PARK_RESTING_VISITORS[index].seat[1], 8);
      expect(actor.sitting).toBe(1);
    });
  });

  it('does not re-seat when precipitation restarts during a return', () => {
    const visitors = new ParkVisitors();
    for (let tick = 0; tick < 200 * 30; tick++) visitors.step(DT, true, false, []);
    for (let tick = 0; tick < 600 * 30; tick++) {
      visitors.step(DT, false, true, []);
      if (visitors.states.some((visitor) => visitor.phase === 'returning')) break;
    }
    expect(visitors.states.some((visitor) => visitor.phase === 'returning')).toBe(true);
    for (let tick = 0; tick < 250 * 30; tick++) visitors.step(DT, true, false, []);
    expect(visitors.states.filter((visitor) => visitor.phase !== 'outside')
      .map(({ phase, actor }) => ({ phase, id: actor.id, ...actor.position }))).toEqual([]);
    expect(visitors.actors.every((actor) => actor.sitting === 0)).toBe(true);
  });

  it('preserves every counter and posture on a zero step and limits excess time', () => {
    const first = new ParkVisitors();
    const second = new ParkVisitors();
    first.step(300, true, false, []);
    second.step(DT, true, false, []);
    expect(first).toEqual(second);
    const before = JSON.stringify(first);
    first.step(0, false, true, []);
    expect(JSON.stringify(first)).toBe(before);
    for (const dt of [-1, NaN, Infinity]) expect(() => first.step(dt, true, false, [])).toThrow(RangeError);
  });

  it('reverses an interrupted sit smoothly and finishes standing before moving', () => {
    const visitors = new ParkVisitors();
    const visit = visitors.states[0];
    visit.phase = 'sitting';
    visit.actor.sitting = 0;
    for (let tick = 0; tick < 12; tick++) visitors.step(DT, false, true, []);
    const sitting = visit.actor.sitting;
    const position = { ...visit.actor.position };
    visitors.step(DT, true, false, []);
    expect(visit.phase).toBe('rising');
    expect(Math.abs(visit.actor.sitting - sitting)).toBeLessThan(0.05);
    let previous = visit.actor.sitting;
    for (let tick = 0; tick < 30 && visit.actor.sitting > 0; tick++) {
      visitors.step(DT, true, false, []);
      expect(visit.actor.sitting).toBeLessThanOrEqual(previous);
      expect(visit.actor.position).toEqual(position);
      previous = visit.actor.sitting;
    }
    expect(visit.phase).toBe('departing');
    expect(visit.actor.sitting).toBe(0);
  });

  it('uses static posture transitions under reduced motion without advancing travel', () => {
    const visitors = new ParkVisitors();
    const visit = visitors.states[0];
    visit.phase = 'rising';
    const position = { ...visit.actor.position };
    visitors.step(DT, true, false, [], true);
    expect(visit.phase).toBe('departing');
    expect(visit.actor.sitting).toBe(0);
    expect(visit.actor.position).toEqual(position);
    expect(visit.actor.travelDistance).toBe(0);
    visit.phase = 'sitting';
    visit.phaseSeconds = 0;
    visitors.step(DT, false, true, [], true);
    expect(visit.phase).toBe('seated');
    expect(visit.actor.sitting).toBe(1);
    expect(visit.actor.position).toEqual(position);
  });

  it('keeps the complete exterior circuit outside the fence and clear of motor lanes', () => {
    const point = new Vector3();
    for (let distance = 0; distance < PARK_OUTSIDE_WALK.getLength(); distance += 0.2) {
      PARK_OUTSIDE_WALK.getPoint(distance / PARK_OUTSIDE_WALK.getLength(), point);
      expect(Math.abs(point.x) >= 39.6 || Math.abs(point.z) >= 88.6).toBe(true);
      expect(Math.abs(point.x)).toBeLessThan(40.5);
      expect(Math.abs(point.z)).toBeLessThan(89.5);
    }
    for (const definition of PARK_RESTING_VISITORS) {
      expect(definition.outward.getPointAt(1).distanceTo(PARK_OUTSIDE_WALK.getPoint(0))).toBeLessThan(1e-8);
      expect(definition.homeward.getPointAt(0).distanceTo(
        PARK_OUTSIDE_WALK.getPoint(PARK_RETURN_DISTANCE / PARK_OUTSIDE_WALK.getLength()))).toBeLessThan(1e-8);
    }
  });
});
