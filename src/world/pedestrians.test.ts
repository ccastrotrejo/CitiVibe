// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INTERSECTIONS, SIDEWALK_OFFSET, STREET_X, STREET_Z } from '../content/streets';
import { createPersonProfile } from '../content/people';
import { CityTraffic, SIDEWALK_ROUTES, sampleTrafficRoute, TRAFFIC } from './traffic';
import { makeWalkingCrossings, PEDESTRIAN_BEHAVIOR, StreetPedestrians } from './pedestrians';

const DT = TRAFFIC.maxStep;

describe('connected pedestrian trips', () => {
  it('connects all 24 blocks through 72 painted, signal-owned crosswalks with matching tangents', () => {
    const crossings = makeWalkingCrossings(SIDEWALK_ROUTES);
    expect(crossings).toHaveLength(72);
    const visited = new Set([0]);
    for (let pass = 0; pass < SIDEWALK_ROUTES.length; pass++) {
      for (const crossing of crossings) if (visited.has(crossing.from)) visited.add(crossing.to);
    }
    expect(visited.size).toBe(SIDEWALK_ROUTES.length);
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const crossing of crossings) {
      sampleTrafficRoute(SIDEWALK_ROUTES[crossing.from], crossing.departure, pose);
      expect(pose.position.x).toBeCloseTo(crossing.x, 8);
      expect(pose.position.z).toBeCloseTo(crossing.z, 8);
      expect(Math.sin(pose.heading)).toBeCloseTo(crossing.dx, 8);
      expect(Math.cos(pose.heading)).toBeCloseTo(crossing.dz, 8);
      sampleTrafficRoute(SIDEWALK_ROUTES[crossing.to], crossing.arrival, pose);
      expect(pose.position.x).toBeCloseTo(crossing.x + crossing.dx * crossing.length, 8);
      expect(pose.position.z).toBeCloseTo(crossing.z + crossing.dz * crossing.length, 8);
      expect(Math.sin(pose.heading)).toBeCloseTo(crossing.dx, 8);
      expect(Math.cos(pose.heading)).toBeCloseTo(crossing.dz, 8);
      const signal = INTERSECTIONS[crossing.intersection];
      expect(Math.abs(crossing.dx ? crossing.z - signal.z : crossing.x - signal.x)).toBeCloseTo(SIDEWALK_OFFSET, 8);
    }
  });

  it.each([0, 91, 2401])('varies trips and activities, admits only on WALK and clears every crossing for seed %s', (seed) => {
    const traffic = new CityTraffic(seed);
    const actors = traffic.pedestrians.actors;
    const paces = actors.map(({ id }) => createPersonProfile(id, 'street').pace);
    const previous = actors.map((actor) => ({ activity: actor.activity, distance: actor.travelDistance!, x: actor.position.x, z: actor.position.z }));
    const crossed = new Set<string>();
    const rested = new Set<string>();
    const activities = new Set<string>();
    const streets = new Set<string>();
    const crossingTimes = new Float64Array(actors.length);
    const restTimes = new Float64Array(actors.length);
    const durations: number[] = [];
    let sawClearance = false;
    for (let tick = 0; tick < 1200 / DT; tick++) {
      const phases = traffic.signals.map(({ phase }) => phase);
      traffic.step(DT);
      for (let index = 0; index < actors.length; index++) {
        const actor = actors[index];
        const before = previous[index];
        const distance = actor.travelDistance! - before.distance;
        if (Math.abs(distance - actor.speed * DT) > 1e-7 ||
          Math.hypot(actor.position.x - before.x, actor.position.z - before.z) > distance + 1e-7 ||
          actor.speed > paces[index] + 1e-7) throw new Error(`Unbounded step: ${actor.id}`);
        activities.add(actor.activity!);
        if (actor.activity === 'crossing') {
          const crossing = traffic.pedestrians.crossings.find((path) => {
            const along = (actor.position.x - path.x) * path.dx + (actor.position.z - path.z) * path.dz;
            return Math.abs((actor.position.x - path.x) * path.dz - (actor.position.z - path.z) * path.dx) < 1e-6 &&
              along >= 0 && along <= path.length + PEDESTRIAN_BEHAVIOR.landingClearance + 0.06;
          });
          if (!crossing) throw new Error(`Walker left painted crossing: ${actor.id}`);
          const phase = traffic.signals[crossing.intersection].phase;
          if (before.activity !== 'crossing' && phase !== 'pedestrians') throw new Error('Entered against WALK');
          if (phase !== 'pedestrians' && phase !== 'clearance') throw new Error('Released cars before landing cleared');
          sawClearance ||= phase === 'clearance' && phases[crossing.intersection] === 'clearance';
          crossingTimes[index] += DT;
          if (crossingTimes[index] > 25) throw new Error(`Stranded in crossing: ${actor.id}`);
          crossed.add(actor.id);
          const signal = INTERSECTIONS[crossing.intersection];
          streets.add(crossing.dx ? `avenue:${signal.x}` : `street:${signal.z}`);
        } else {
          crossingTimes[index] = 0;
          const fromRoad = Math.min(...STREET_X.map((x) => Math.abs(x - actor.position.x)),
            ...STREET_Z.map((z) => Math.abs(z - actor.position.z)));
          if (fromRoad < SIDEWALK_OFFSET - 1e-7) throw new Error(`Walking outside sidewalk: ${actor.id}`);
        }
        if (actor.state === 'dwelling') {
          restTimes[index] += DT;
          rested.add(actor.id);
          if (actor.speed !== 0 || restTimes[index] > PEDESTRIAN_BEHAVIOR.maxRest + DT * 2) throw new Error('Unbounded rest');
        } else if (restTimes[index] > 0) {
          durations.push(restTimes[index]);
          restTimes[index] = 0;
        }
        Object.assign(before, { activity: actor.activity, distance: actor.travelDistance!, x: actor.position.x, z: actor.position.z });
      }
    }
    // Long blocks and full destinations can defer a trip; most people should still cross in this window.
    expect(crossed.size).toBeGreaterThan(actors.length / 2);
    expect(rested.size).toBeGreaterThan(actors.length / 4);
    expect(activities).toEqual(new Set(['walking', 'waiting-to-cross', 'crossing', 'looking-around', 'resting']));
    expect(streets.size).toBe(8);
    expect(sawClearance).toBe(true);
    expect(new Set(durations.map((value) => value.toFixed(1))).size).toBeGreaterThan(15);
  }, 30_000);

  it('retains active crossing reservations, choices and timers on zero-time redraws', () => {
    const traffic = new CityTraffic();
    const reference = new CityTraffic();
    for (let tick = 0; tick < 1800; tick++) {
      traffic.step(DT);
      reference.step(DT);
      if (traffic.pedestrians.actors.some(({ activity }) => activity === 'crossing')) break;
    }
    expect(traffic.pedestrians.actors.some(({ activity }) => activity === 'crossing')).toBe(true);
    const state = JSON.stringify(traffic);
    for (let tick = 0; tick < 900; tick++) traffic.step(0);
    expect(JSON.stringify(traffic)).toBe(state);
    traffic.step(DT);
    reference.step(DT);
    expect(traffic).toEqual(reference);
  });

  it('walks on after a denied crossing, including corners rounded just below their exact distance', () => {
    const pedestrians = new StreetPedestrians(SIDEWALK_ROUTES, 2401);
    const signals = INTERSECTIONS.map(({ id }) => ({ id, phase: 'clearance' as const }));
    const waiting = new Float64Array(pedestrians.actors.length);
    const initial = pedestrians.actors.map(({ travelDistance }) => travelDistance!);
    for (let tick = 0; tick < 9000; tick++) {
      pedestrians.step(DT, signals);
      pedestrians.actors.forEach((actor, index) => {
        waiting[index] = actor.activity === 'waiting-to-cross' ? waiting[index] + DT : 0;
        if (waiting[index] > PEDESTRIAN_BEHAVIOR.maxCrossingWait + 2 * DT) {
          throw new Error(`${actor.id} failed to leave a denied corner`);
        }
        if (actor.activity === 'crossing') throw new Error('Crossed against all-red');
      });
    }
    pedestrians.actors.forEach((actor, index) => {
      expect(actor.travelDistance! - initial[index], actor.id).toBeGreaterThan(120);
    });
  });
});
