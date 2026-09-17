// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INTERSECTIONS, ROAD_HALF_WIDTH, SIGNAL_POLE_OFFSET, STREET_BLOCKS, STREET_X, STREET_Z } from '../content/streets';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import { LAMP_GEOMETRY, STREET_LAMPS } from '../content/lighting';
import { PARKING_SIGNS } from '../content/streetFurniture';
import {
  CityTraffic, SIDEWALK_WALKING_CLEARANCE, SIDEWALK_WALKING_OFFSETS, SIDEWALK_WALKING_ROUTES,
  sampleTrafficRoute, TRAFFIC,
} from './traffic';
import { makeWalkingCrossings, PEDESTRIAN_BEHAVIOR, StreetPedestrians } from './pedestrians';

const DT = TRAFFIC.maxStep;

describe('connected pedestrian trips', () => {
  it.each([
    { kind: 'street and signal', poles: [
      ...STREET_LAMPS.map((lamp) => ({ ...lamp, radius: LAMP_GEOMETRY.poleRadius })),
      ...INTERSECTIONS.flatMap((point) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({
        id: `${point.id}-signal-${sx}-${sz}`, x: point.x + sx * SIGNAL_POLE_OFFSET,
        z: point.z + sz * SIGNAL_POLE_OFFSET, radius: 0.092,
      })))),
    ] },
    { kind: 'parking sign', poles: PARKING_SIGNS.map((sign) => ({ ...sign, radius: 0.04 })) },
  ])('clears actual $kind poles along both sidewalk flows and crossing landings', ({ poles }) => {
    const blocked = new Set<string>();
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const check = () => {
      const fx = Math.sin(pose.heading);
      const fz = Math.cos(pose.heading);
      for (const pole of poles) {
        const dx = pole.x - pose.position.x;
        const dz = pole.z - pose.position.z;
        if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;
        const forward = Math.max(0, Math.abs(dx * fx + dz * fz) - PERSON_SPACE.length / 2);
        const side = Math.max(0, Math.abs(dx * fz - dz * fx) - PERSON_SPACE.width / 2);
        if (Math.hypot(forward, side) <= pole.radius) blocked.add(pole.id);
      }
    };
    for (const route of SIDEWALK_WALKING_ROUTES.flat()) {
      for (let distance = 0; distance < route.length; distance += 0.1) {
        sampleTrafficRoute(route, distance, pose);
        check();
      }
    }
    for (const crossing of makeWalkingCrossings(SIDEWALK_WALKING_ROUTES)) {
      pose.heading = Math.atan2(crossing.dx, crossing.dz);
      for (let distance = 0; distance < crossing.length + PEDESTRIAN_BEHAVIOR.landingClearance; distance += 0.1) {
        pose.position.x = crossing.x + distance * crossing.dx;
        pose.position.z = crossing.z + distance * crossing.dz;
        check();
      }
    }
    expect([...blocked], 'Actual low poles must remain outside the full 0.8 × 1.2 m body envelope').toEqual([]);
  });

  it('fits both swept walking lanes inside the local sidewalk inset and clear of outer furniture', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    expect(SIDEWALK_WALKING_OFFSETS[1] - SIDEWALK_WALKING_OFFSETS[0]).toBe(1);
    for (const lanes of SIDEWALK_WALKING_ROUTES) for (const route of lanes) {
      for (let distance = 0; distance < route.length; distance += 0.2) {
        sampleTrafficRoute(route, distance, pose);
        const fx = Math.sin(pose.heading);
        const fz = Math.cos(pose.heading);
        for (const forward of [-1, 1]) for (const side of [-1, 1]) {
          const x = pose.position.x + forward * fx * PERSON_SPACE.length / 2 + side * fz * PERSON_SPACE.width / 2;
          const z = pose.position.z + forward * fz * PERSON_SPACE.length / 2 - side * fx * PERSON_SPACE.width / 2;
          const fromRoad = Math.min(...STREET_X.map((road) => Math.abs(road - x)),
            ...STREET_Z.map((road) => Math.abs(road - z)));
          expect(fromRoad).toBeGreaterThan(ROAD_HALF_WIDTH);
          expect(fromRoad).toBeLessThanOrEqual(SIDEWALK_WALKING_CLEARANCE + 1e-7);
          expect(Math.abs(x)).toBeLessThan(108.9);
        }
      }
    }
  });

  it.each([0, 2401])('moves opposing walkers past each other on the same sidewalk in every block for seed %s', (seed) => {
    const pedestrians = new StreetPedestrians(SIDEWALK_WALKING_ROUTES, seed);
    const signals = INTERSECTIONS.map(({ id }) => ({ id, control: 'signal' as const, phase: 'clearance' as const, walk: false }));
    const passed = new Set<number>();
    const routes = pedestrians.actors.map((_, index) => {
      const lane = (Math.floor(index / STREET_BLOCKS.length) + (seed & 1)) % 2;
      return SIDEWALK_WALKING_ROUTES[index % STREET_BLOCKS.length][lane];
    });
    for (let tick = 0; tick < 5400; tick++) {
      const previous = pedestrians.actors.map(({ position, visit }) => ({ x: position.x, z: position.z, visiting: !!visit }));
      pedestrians.step(DT, signals);
      const moving = new Map<string, number[]>();
      pedestrians.actors.forEach((actor, index) => {
        if (actor.speed < 0.1 || actor.visit || previous[index].visiting) return;
        const route = routes[index];
        const segment = route.segments.find((segment) =>
          actor.distance >= segment.start && actor.distance < segment.start + segment.length)!;
        if (segment.kind !== 'link') return;
        const dx = actor.position.x - previous[index].x;
        const dz = actor.position.z - previous[index].z;
        if (dx * segment.dx + dz * segment.dz <= 0) throw new Error('Heading reversed without actual route travel');
        const block = index % STREET_BLOCKS.length;
        const bounds = STREET_BLOCKS[block];
        const side = segment.dx === 0 ? (actor.position.x < (bounds.minX + bounds.maxX) / 2 ? 'west' : 'east') :
          (actor.position.z < (bounds.minZ + bounds.maxZ) / 2 ? 'north' : 'south');
        const key = `${block}:${side}`;
        for (const otherIndex of moving.get(key) ?? []) {
          const other = pedestrians.actors[otherIndex];
          if (Math.cos(actor.heading - other.heading) > -0.99) continue;
          const along = (other.position.x - actor.position.x) * segment.dx +
            (other.position.z - actor.position.z) * segment.dz;
          if (Math.abs(along) > 0.4) continue;
          const lateral = Math.abs((other.position.x - actor.position.x) * segment.dz -
            (other.position.z - actor.position.z) * segment.dx);
          expect(lateral).toBeCloseTo(1, 8);
          expect(lateral - PERSON_SPACE.width).toBeGreaterThanOrEqual(0.2 - 1e-7);
          passed.add(block);
        }
        moving.set(key, [...(moving.get(key) ?? []), index]);
      });
    }
    expect(passed.size).toBe(STREET_BLOCKS.length);
  });

  it('connects both sidewalk directions on all 24 blocks through 144 signal-owned crossings', () => {
    const crossings = makeWalkingCrossings(SIDEWALK_WALKING_ROUTES);
    expect(crossings).toHaveLength(144);
    for (const lane of [0, 1]) {
      const visited = new Set([0]);
      for (let pass = 0; pass < SIDEWALK_WALKING_ROUTES.length; pass++) {
        for (const crossing of crossings) if (crossing.lane === lane && visited.has(crossing.from)) visited.add(crossing.to);
      }
      expect(visited.size).toBe(SIDEWALK_WALKING_ROUTES.length);
    }
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const crossing of crossings) {
      sampleTrafficRoute(SIDEWALK_WALKING_ROUTES[crossing.from][crossing.lane], crossing.departure, pose);
      expect(pose.position.x).toBeCloseTo(crossing.x, 8);
      expect(pose.position.z).toBeCloseTo(crossing.z, 8);
      expect(Math.sin(pose.heading)).toBeCloseTo(crossing.dx, 8);
      expect(Math.cos(pose.heading)).toBeCloseTo(crossing.dz, 8);
      sampleTrafficRoute(SIDEWALK_WALKING_ROUTES[crossing.to][crossing.lane], crossing.arrival, pose);
      expect(pose.position.x).toBeCloseTo(crossing.x + crossing.dx * crossing.length, 8);
      expect(pose.position.z).toBeCloseTo(crossing.z + crossing.dz * crossing.length, 8);
      expect(Math.sin(pose.heading)).toBeCloseTo(crossing.dx, 8);
      expect(Math.cos(pose.heading)).toBeCloseTo(crossing.dz, 8);
      const signal = INTERSECTIONS[crossing.intersection];
      expect(Math.abs(crossing.dx ? crossing.z - signal.z : crossing.x - signal.x))
        .toBeCloseTo(SIDEWALK_WALKING_OFFSETS[crossing.lane], 8);
      for (let distance = 0; distance < crossing.length + PEDESTRIAN_BEHAVIOR.landingClearance; distance += 0.2) {
        const x = crossing.x + distance * crossing.dx;
        const z = crossing.z + distance * crossing.dz;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const dx = signal.x + sx * SIGNAL_POLE_OFFSET - x;
          const dz = signal.z + sz * SIGNAL_POLE_OFFSET - z;
          const forward = Math.max(0, Math.abs(dx * crossing.dx + dz * crossing.dz) - PERSON_SPACE.length / 2);
          const side = Math.max(0, Math.abs(dx * crossing.dz - dz * crossing.dx) - PERSON_SPACE.width / 2);
          expect(Math.hypot(forward, side), 'Swept crossing body must clear existing signal poles').toBeGreaterThan(0.092);
        }
      }
    }
  });

  it.each([0, 91, 2401])('varies trips over twenty-five minutes, admits only on WALK and clears every crossing for seed %s', (seed) => {
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
    const blocks = actors.map((actor) => STREET_BLOCKS.findIndex((block) =>
      actor.position.x > block.minX && actor.position.x < block.maxX &&
      actor.position.z > block.minZ && actor.position.z < block.maxZ));
    const population = new Uint16Array(STREET_BLOCKS.length);
    let sawClearance = false;
    for (let tick = 0; tick < 1500 / DT; tick++) {
      const phases = traffic.signals.map(({ phase }) => phase);
      traffic.step(DT);
      population.fill(0);
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
          const along = (actor.position.x - crossing.x) * crossing.dx + (actor.position.z - crossing.z) * crossing.dz;
          blocks[index] = along < crossing.length + PEDESTRIAN_BEHAVIOR.landingClearance ? crossing.from : crossing.to;
          if (blocks[index] === crossing.from) population[crossing.to]++;
          const state = traffic.signals[crossing.intersection];
          if (state.control === 'signal') {
            if (before.activity !== 'crossing' && state.phase !== 'pedestrians') throw new Error('Entered against WALK');
            if (state.phase !== 'pedestrians' && state.phase !== 'clearance') throw new Error('Released cars before landing cleared');
            sawClearance ||= state.phase === 'clearance' && phases[crossing.intersection] === 'clearance';
          } else if (before.activity !== 'crossing' && !state.walk) {
            // Posted corners have no phase clock: walkers may only step off once the box is free.
            throw new Error('Entered a posted crossing without right of way');
          }
          crossingTimes[index] += DT;
          if (crossingTimes[index] > 25) throw new Error(`Stranded in crossing: ${actor.id}`);
          crossed.add(actor.id);
          const signal = INTERSECTIONS[crossing.intersection];
          streets.add(crossing.dx ? `avenue:${signal.x}` : `street:${signal.z}`);
        } else {
          crossingTimes[index] = 0;
          const fromRoad = Math.min(...STREET_X.map((x) => Math.abs(x - actor.position.x)),
            ...STREET_Z.map((z) => Math.abs(z - actor.position.z)));
          if (fromRoad < SIDEWALK_WALKING_OFFSETS[0] - 1e-7) throw new Error(`Walking outside sidewalk: ${actor.id}`);
        }
        population[blocks[index]]++;
        if (actor.state === 'dwelling') {
          restTimes[index] += DT;
          rested.add(actor.id);
          if (actor.speed !== 0 || restTimes[index] > (actor.visit?.destination.duration ?? 0) + DT * 2) {
            throw new Error('Unbounded rest');
          }
        } else if (restTimes[index] > 0) {
          durations.push(restTimes[index]);
          restTimes[index] = 0;
        }
        Object.assign(before, { activity: actor.activity, distance: actor.travelDistance!, x: actor.position.x, z: actor.position.z });
      }
      if (population.some((count) => count > PEDESTRIAN_BEHAVIOR.maxBlockPopulation)) {
        throw new Error(`Block capacity, including incoming reservations, exceeded for seed ${seed}, tick ${tick}`);
      }
    }
    // Long blocks and full destinations can defer a trip; most people should still cross in this window.
    expect(crossed.size).toBeGreaterThan(actors.length / 2);
    // Only a physically reached off-line window pocket admits a dwell.
    expect(rested.size).toBeGreaterThan(0);
    expect(activities).toEqual(new Set(['walking', 'waiting-to-cross', 'crossing', 'window-shopping', 'civic-duty', 'resting']));
    expect(streets.size).toBe(8);
    expect(sawClearance).toBe(true);
    expect(durations.every((value) => [3.2, 4.5, 5.5].some((expected) =>
      value >= expected - DT && value <= expected + DT * 2))).toBe(true);
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

  it('releases a cleared departure behind a moving crosser while retaining its signal and landing reservation', () => {
    const traffic = new CityTraffic(91);
    let followedClearedTail = false;
    for (let tick = 0; tick < 1800 && !followedClearedTail; tick++) {
      traffic.step(DT);
      for (const crosser of traffic.pedestrians.actors.filter(({ activity }) => activity === 'crossing')) {
        const crossing = traffic.pedestrians.crossings.find((path) => {
          const along = (crosser.position.x - path.x) * path.dx + (crosser.position.z - path.z) * path.dz;
          return along > 0 && along < path.length &&
            Math.abs((crosser.position.x - path.x) * path.dz - (crosser.position.z - path.z) * path.dx) < 1e-7;
        });
        if (!crossing) continue;
        for (const follower of traffic.pedestrians.actors) {
          if (follower.visit || follower.activity === 'crossing' || follower.speed === 0) continue;
          const along = (follower.position.x - crossing.x) * crossing.dx +
            (follower.position.z - crossing.z) * crossing.dz;
          const lateral = Math.abs((follower.position.x - crossing.x) * crossing.dz -
            (follower.position.z - crossing.z) * crossing.dx);
          if (along >= 0 || along <= -PERSON_SPACE.headway + 1e-7 || lateral > 1e-7) continue;
          expect(traffic.pedestrians.isCrossingOccupied(crossing.intersection)).toBe(true);
          expect(Math.hypot(follower.position.x - crosser.position.x, follower.position.z - crosser.position.z))
            .toBeGreaterThanOrEqual(PERSON_SPACE.headway - 1e-7);
          followedClearedTail = true;
        }
      }
    }
    expect(followedClearedTail).toBe(true);
  });

  it('walks on after a denied crossing, including corners rounded just below their exact distance', () => {
    const pedestrians = new StreetPedestrians(SIDEWALK_WALKING_ROUTES, 2401);
    const signals = INTERSECTIONS.map(({ id }) => ({ id, control: 'signal' as const, phase: 'clearance' as const, walk: false }));
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
