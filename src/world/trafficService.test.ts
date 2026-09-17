// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CURB_VEHICLES } from '../content/streetFurniture';
import { PERSON_SPACE } from '../content/people';
import { INTERSECTION_GATE, INTERSECTIONS, ROAD_HALF_WIDTH, STOP_LINE_OFFSET, TRAFFIC_ACTORS } from '../content/streets';
import { BUS_STOP, BUS_STOP_MARKER, LOADING_STOP, TRAFFIC_SERVICES } from '../content/transitService';
import { CityTraffic, SIDEWALK_WALKING_OFFSETS, TRAFFIC, TRAFFIC_LENGTHS } from './traffic';

const DT = TRAFFIC.maxStep;
const EPSILON = 1e-6;

function advance(traffic: CityTraffic, seconds: number, traction = 1): void {
  for (let tick = 0; tick < Math.round(seconds / DT); tick++) traffic.step(DT, traction);
}

function boundaryOwner(committed: 'junction' | 'approach' | 'clearing' | 'stoppable') {
  const traffic = new CityTraffic();
  for (let tick = 0; tick < 120 / DT; tick++) {
    traffic.step(DT);
    const owner = traffic['motions'].find((motion) => {
      if (motion.permit < 0 || traffic.signals[motion.permit].control !== 'signal') return false;
      const signal = traffic.signals[motion.permit];
      if (signal.phase !== 'north-south' && signal.phase !== 'east-west') return false;
      const segment = motion.route.segments[motion.segment];
      if (committed === 'junction') return segment.kind === 'junction';
      if (committed === 'clearing') return segment.kind === 'link' && segment.intersection !== motion.permit &&
        motion.releaseRemaining > motion.actor.speed * DT + EPSILON;
      if (segment.kind !== 'link' || segment.intersection !== motion.permit) return false;
      const remaining = segment.start + segment.length - motion.actor.distance - motion.length / 2 -
        (STOP_LINE_OFFSET - INTERSECTION_GATE + TRAFFIC.stopBuffer);
      const stopping = motion.actor.speed ** 2 / (2 * TRAFFIC.braking) + motion.actor.speed * DT;
      return committed === 'stoppable' ? remaining > stopping + EPSILON : remaining < stopping - EPSILON;
    });
    if (owner) {
      const junction = traffic['junctions'][owner.permit];
      junction.elapsed = TRAFFIC.greenSeconds - DT;
      return { traffic, owner, junction };
    }
  }
  throw new Error(`No ${committed} boundary fixture found.`);
}

describe('yellow transition and protected ownership', () => {
  it('keeps eight-second greens, three-second yellow and a separate all-red interval', () => {
    const traffic = new CityTraffic();
    const junction = traffic['junctions'].find(({ control }) => control === 'signal')!;
    junction.elapsed = 0;
    const initial = junction.phase;
    advance(traffic, TRAFFIC.greenSeconds - DT);
    expect(junction.phase).toBe(initial);
    traffic.step(DT);
    expect(junction.phase).toBe(`${initial}-yellow`);
    advance(traffic, TRAFFIC.yellowSeconds - DT);
    expect(junction.phase).toBe(`${initial}-yellow`);
    traffic.step(DT);
    expect(junction.phase).toBe('clearance');
    expect(junction.walk).toBe(false);
    advance(traffic, TRAFFIC.clearanceSeconds - DT);
    expect(junction.phase).toBe('clearance');
  });

  it('grants no new signal reservations throughout yellow, including its last tick', () => {
    const traffic = new CityTraffic();
    for (const signal of traffic['junctions']) {
      if (signal.control !== 'signal') continue;
      signal.phase = 'north-south-yellow';
      signal.stage = 1;
      signal.elapsed = 0;
    }
    for (let tick = 0; tick < TRAFFIC.yellowSeconds / DT; tick++) {
      traffic.step(DT);
      for (const signal of traffic['junctions']) {
        if (signal.control !== 'signal') continue;
        expect(signal.owner).toBe(null);
        expect(signal.walk).toBe(false);
      }
    }
    expect(traffic.signals.filter(({ control }) => control === 'signal').every(({ phase }) => phase === 'clearance')).toBe(true);
  });

  it.each(['junction', 'approach', 'clearing'] as const)('retains already-committed %s ownership at yellow', (kind) => {
    const { traffic, owner, junction } = boundaryOwner(kind);
    const before = owner.actor.distance;
    const permit = owner.permit;
    traffic.step(DT);
    expect(junction.phase).toMatch(/-yellow$/);
    expect(junction.owner).toBe(owner);
    expect(owner.permit).toBe(permit);
    expect(owner.actor.distance).not.toBe(before);
    let cleared = false;
    for (let tick = 0; tick < 30 / DT; tick++) {
      traffic.step(DT);
      if (owner.permit !== permit) {
        cleared = true;
        break;
      }
      expect(junction.phase).not.toBe('pedestrians');
      expect(junction.walk).toBe(false);
      expect(junction.owner).toBe(owner);
    }
    expect(cleared).toBe(true);
  });

  it('revokes a green reservation at yellow only when the driver can still stop', () => {
    const { traffic, owner, junction } = boundaryOwner('stoppable');
    const speed = owner.actor.speed;
    traffic.step(DT);
    expect(junction.phase).toMatch(/-yellow$/);
    expect(junction.owner).toBe(null);
    expect(owner.permit).toBe(-1);
    expect(owner.actor.speed).toBeGreaterThanOrEqual(speed - TRAFFIC.braking * DT - EPSILON);
    advance(traffic, 2);
    expect(owner.permit).toBe(-1);
    expect(owner.actor.speed).toBe(0);
    const segment = owner.route.segments[owner.segment];
    const remaining = segment.start + segment.length - owner.actor.distance - owner.length / 2;
    expect(remaining).toBeGreaterThanOrEqual(STOP_LINE_OFFSET - INTERSECTION_GATE + TRAFFIC.stopBuffer - EPSILON);
  });

  it('ends yellow on time and holds all-red until a slow committed body clears', () => {
    const { traffic, owner, junction } = boundaryOwner('junction');
    owner.actor.speed = 0.5;
    owner.desiredSpeed = 0.5;
    traffic.step(DT);
    expect(junction.phase).toMatch(/-yellow$/);
    advance(traffic, TRAFFIC.yellowSeconds);
    expect(junction.phase).toBe('clearance');
    expect(junction.owner).toBe(owner);
    advance(traffic, TRAFFIC.clearanceSeconds + 2);
    expect(junction.phase).toBe('clearance');
    expect(junction.owner).toBe(owner);
    expect(junction.walk).toBe(false);
    advance(traffic, 60);
    expect(junction.owner).not.toBe(owner);
  });
});

describe('retained bus stop and reserved loading pocket', () => {
  it('keeps the actual bus marker pole outside both walking lanes and the protected track', () => {
    const poleRadius = 0.045;
    for (const offset of SIDEWALK_WALKING_OFFSETS) {
      expect(Math.abs(BUS_STOP_MARKER.x - (-46 - offset))).toBeGreaterThan(PERSON_SPACE.width / 2 + poleRadius);
    }
    expect(Math.abs(BUS_STOP_MARKER.x - (-46 - 4))).toBeGreaterThan(0.4 + poleRadius);
    expect(Math.abs(BUS_STOP_MARKER.x - BUS_STOP.x)).toBeGreaterThan(1.1 + poleRadius);
  });

  it('reuses one of six buses and a regular van without changing the manifest', () => {
    const traffic = new CityTraffic();
    expect(traffic.services).toHaveLength(2);
    expect(TRAFFIC_ACTORS.find(({ id }) => id === BUS_STOP.actorId)?.vehicleType).toBe('bus');
    expect(TRAFFIC_ACTORS.find(({ id }) => id === LOADING_STOP.actorId)?.vehicleType).toBe('van');
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'bus')).toHaveLength(6);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'bus' || kind === 'car')).toHaveLength(48);
    expect(CURB_VEHICLES).toHaveLength(12);
    expect(CURB_VEHICLES.map(({ id, x, z, yaw }) => ({ id, x, z, yaw }))).toEqual([-1, 1].flatMap((side) =>
      [-21, -14, -7, 7, 14, 21].map((x, index) => ({
        id: `parked-car-${side}-${index}`, x, z: side * 98.85, yaw: -side * Math.PI / 2,
      }))));
    for (const definition of TRAFFIC_SERVICES) {
      const motion = traffic['motions'].find(({ actor }) => actor.id === definition.actorId)!;
      const segment = motion.route.segments.find(({ lane }) => lane === definition.lane)!;
      const along = motion.service!.distance - segment.start;
      expect(along - definition.maneuverLength - motion.length / 2).toBeGreaterThan(TRAFFIC.stopBuffer);
      expect(segment.length - along - definition.maneuverLength - motion.length / 2).toBeGreaterThan(STOP_LINE_OFFSET - INTERSECTION_GATE);
    }
  });

  it.each([
    { seed: 2401, traction: 1 },
    { seed: 42, traction: 0.3 },
  ])('completes real approaches, finite dwells and departures with safe queues at seed $seed/grip $traction', ({ seed, traction }) => {
    const traffic = new CityTraffic(seed);
    const phases = traffic.services.map(() => new Set<string>());
    const dwellStarts = traffic.services.map(() => -1);
    const decelerated = traffic.services.map(() => false);
    const motors = traffic['motions'].filter(({ bicycle }) => !bicycle);
    const previousSpeeds = motors.map(({ actor }) => actor.speed);
    for (let tick = 0; tick < 1800 / DT; tick++) {
      traffic.step(DT, traction);
      for (const [index, motion] of motors.entries()) {
        const previousSpeed = previousSpeeds[index];
        const acceleration = (motion.actor.speed - previousSpeed) / DT;
        if (acceleration > TRAFFIC.acceleration * traction + EPSILON ||
          acceleration < -TRAFFIC.braking * traction - EPSILON) {
          throw new Error(`Unbounded service/queue acceleration ${motion.actor.id} at ${traffic.elapsed}: ${acceleration}`);
        }
        previousSpeeds[index] = motion.actor.speed;
        if (!motion.service) continue;
        const serviceIndex = traffic.services.indexOf(motion.service.state);
        const state = motion.service.state;
        const definition = motion.service.definition;
        phases[serviceIndex].add(state.phase);
        if (state.phase === 'approaching' && motion.actor.speed < previousSpeed) decelerated[serviceIndex] = true;
        if (state.phase === 'dwelling') {
          if (dwellStarts[serviceIndex] < 0) dwellStarts[serviceIndex] = traffic.elapsed;
          expect(motion.actor.speed).toBe(0);
          expect(motion.actor.state).toBe('dwelling');
          expect(motion.actor.lighting?.braking).toBe(true);
          expect(motion.actor.position.x).toBeCloseTo(definition.x, 5);
          expect(motion.actor.position.z).toBeCloseTo(definition.z, 5);
        } else if (state.phase === 'departing' && dwellStarts[serviceIndex] >= 0) {
          expect(traffic.elapsed - dwellStarts[serviceIndex]).toBeCloseTo(definition.dwellSeconds, 5);
          dwellStarts[serviceIndex] = -1;
        }
        if (definition.kind === 'loading') {
          // The service's full body stays on the non-cycling side, never across a sidewalk.
          const yaw = Math.abs(motion.actor.heading - Math.PI / 2);
          if (motion.route.segments[motion.segment].lane === definition.lane) {
            expect(motion.actor.position.z).toBeLessThanOrEqual(95 + ROAD_HALF_WIDTH - 0.9 + EPSILON);
            const halfZ = Math.abs(Math.sin(yaw)) * motion.length / 2 + Math.abs(Math.cos(yaw)) * 0.9;
            expect(motion.actor.position.z + halfZ).toBeLessThan(100);
            for (const parked of CURB_VEHICLES.filter(({ z }) => z > 0)) {
              const halfX = Math.abs(Math.cos(yaw)) * motion.length / 2 + Math.abs(Math.sin(yaw)) * 0.9;
              if (Math.abs(motion.actor.position.z - parked.z) < halfZ + parked.width / 2) {
                expect(Math.abs(motion.actor.position.x - parked.x)).toBeGreaterThan(halfX + parked.length / 2);
              }
            }
          }
        }
      }
      const lanes = new Map<string, typeof motors>();
      for (const motion of motors) {
        const segment = motion.route.segments[motion.segment];
        if (segment.kind !== 'link') continue;
        const lane = lanes.get(segment.lane) ?? [];
        lane.push(motion);
        lanes.set(segment.lane, lane);
      }
      for (const lane of lanes.values()) {
        lane.sort((a, b) => {
          const segment = a.route.segments[a.segment];
          return (a.actor.position.x - b.actor.position.x) * segment.dx + (a.actor.position.z - b.actor.position.z) * segment.dz;
        });
        for (let index = 1; index < lane.length; index++) {
          const follower = lane[index - 1];
          const leader = lane[index];
          const segment = leader.route.segments[leader.segment];
          const clearance = (leader.actor.position.x - follower.actor.position.x) * segment.dx +
            (leader.actor.position.z - follower.actor.position.z) * segment.dz - (leader.length + follower.length) / 2;
          if (clearance < TRAFFIC.vehicleGap - EPSILON) throw new Error(`Queue overlap ${follower.actor.id}/${leader.actor.id}: ${clearance}`);
        }
      }
      for (const [index, signal] of traffic['junctions'].entries()) {
        if (signal.owner && traffic.pedestrians.isCrossingOccupied(index)) throw new Error(`Conflicting crossing ownership at ${INTERSECTIONS[index].id}`);
        if (signal.walk && signal.control === 'signal') expect(signal.phase).toBe('pedestrians');
      }
    }
    for (const [index, state] of traffic.services.entries()) {
      expect(state.completedCycles, state.id).toBeGreaterThanOrEqual(2);
      expect(phases[index]).toEqual(new Set(['circulating', 'approaching', 'dwelling', 'departing']));
      expect(decelerated[index]).toBe(true);
    }
  }, 40_000);

  it.each([1, 0.3])('queues a following bus safely during the stop and restarts it at grip %s', (traction) => {
    const traffic = new CityTraffic();
    const leader = traffic['motions'].find(({ actor }) => actor.id === BUS_STOP.actorId)!;
    const follower = traffic['motions'].find(({ actor }) => actor.id === 'city-vehicle-12')!;
    leader.actor.distance = leader.service!.distance;
    leader.service!.state.phase = 'dwelling';
    leader.service!.state.remaining = BUS_STOP.dwellSeconds;
    leader.actor.state = 'dwelling';
    follower.actor.distance = leader.actor.distance - 12;
    follower.actor.speed = 2;
    for (const motion of [leader, follower]) {
      motion.segment = motion.route.segments.findIndex(({ lane }) => lane === BUS_STOP.lane);
      traffic['move'](motion);
    }
    let queued = false;
    let restarted = false;
    for (let tick = 0; tick < 12 / DT; tick++) {
      const previousSpeed = follower.actor.speed;
      traffic.step(DT, traction);
      const gap = leader.actor.position.z - follower.actor.position.z - (leader.length + follower.length) / 2;
      expect(gap).toBeGreaterThanOrEqual(TRAFFIC.vehicleGap - EPSILON);
      expect(follower.actor.speed).toBeGreaterThanOrEqual(previousSpeed - TRAFFIC.braking * traction * DT - EPSILON);
      if (leader.service!.state.phase === 'dwelling' && follower.actor.speed === 0) queued = true;
      if (queued && leader.service!.state.phase !== 'dwelling' && follower.actor.speed > 0.1) restarted = true;
    }
    expect(queued).toBe(true);
    expect(restarted).toBe(true);
  });

  it('freezes every service phase and resumes identical retained objects without wall time', () => {
    const first = new CityTraffic();
    const second = new CityTraffic();
    const observed = new Set<string>();
    const services = [...first.services];
    for (let tick = 0; tick < 500 / DT; tick++) {
      first.step(DT);
      second.step(DT);
      for (const state of first.services) {
        const key = `${state.id}:${state.phase}`;
        if (observed.has(key)) continue;
        observed.add(key);
        const snapshot = JSON.stringify(first);
        for (let pause = 0; pause < 40; pause++) first.step(0);
        expect(JSON.stringify(first)).toBe(snapshot);
        expect(first).toEqual(second);
        expect(first.services.find(({ id }) => id === state.id)).toBe(services.find(({ id }) => id === state.id));
      }
    }
    expect(observed.size).toBe(8);
    expect(TRAFFIC_LENGTHS.bus).toBe(4.8);
  }, 20_000);
});
