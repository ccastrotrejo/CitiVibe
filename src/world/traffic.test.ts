// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PARK_BOUNDS } from '../content/park';
import { PERSON_SPACE } from '../content/people';
import { LAMP_GEOMETRY, STREET_LAMPS } from '../content/lighting';
import {
  BIKE_OFFSET, bikeLaneOffset, CITY_EXTENT, INTERSECTION_GATE, INTERSECTIONS, ROAD_HALF_WIDTH,
  SIDEWALK_HALF_WIDTH, SIDEWALK_OFFSET, SIGNALED_INTERSECTIONS, STOP_LINE_OFFSET, STOP_SIGN_INTERSECTIONS,
  STREET_BLOCKS, STREET_X, STREET_Z, TRAFFIC_ACTORS, VEHICLE_OFFSET, TWO_WAY_BIKE_TRACK,
} from '../content/streets';
import { ActorSimulation, type ActorState } from './actors';
import {
  CityTraffic, sampleTrafficRoute, SIDEWALK_ROUTES, SIDEWALK_WALKING_OFFSETS, SIDEWALK_WALKING_ROUTES,
  SHARED_BIKE_ROUTES, TRAFFIC, TRAFFIC_LENGTHS, TRAFFIC_ROUTES, trafficRouteForActor,
  type TrafficRoute, type TrafficSegment,
} from './traffic';

const DT = TRAFFIC.maxStep;
const SOAK_SECONDS = 1200;
const MOTOR_COUNT = TRAFFIC_ACTORS.filter(({ kind }) => kind === 'car' || kind === 'bus').length;
const CYCLIST_COUNT = TRAFFIC_ACTORS.filter(({ kind }) => kind === 'cyclist').length;
const MOTION_COUNT = MOTOR_COUNT + CYCLIST_COUNT;
const GRIP_SOAKS = [
  ...[0, 1, 4, 14, 42, 91, 2401, 0xffffffff].map((seed) => ({ seed, traction: 1, changing: false })),
  ...[0, 2401].flatMap((seed) => [
    { seed, traction: 0.75, changing: false },
    { seed, traction: 0.3, changing: false },
    { seed, traction: 0.3, changing: true },
  ]),
];
const PAIRED_TRACKS = [
  { z: -95, side: 1, east: 4.45, west: 3.45 },
  { z: 95, side: -1, east: -3.45, west: -4.45 },
];

function travel(from: number, to: number, length: number): number {
  return (to - from + length) % length;
}

function angleDifference(first: number, second: number): number {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
}

function actorRoute(index: number, seed = 2401): TrafficRoute {
  if (index < MOTION_COUNT) return trafficRouteForActor(index);
  const walker = index - MOTION_COUNT;
  const lane = (Math.floor(walker / SIDEWALK_WALKING_ROUTES.length) + (seed & 1)) % 2;
  return SIDEWALK_WALKING_ROUTES[walker % SIDEWALK_WALKING_ROUTES.length][lane];
}

function actorSegment(actor: ActorState, route: TrafficRoute): TrafficSegment {
  let index = 0;
  while (index < route.segments.length - 1 && actor.distance >= route.segments[index + 1].start) index += 1;
  return route.segments[index];
}

function minimumRadius(segment: TrafficSegment): number {
  if (segment.turn === 0) return Infinity;
  const curve = segment.ellipse;
  return curve ? Math.min(curve.incomingRadius, curve.outgoingRadius) ** 2 /
    Math.max(curve.incomingRadius, curve.outgoingRadius) : segment.radius;
}

function halfLength(index: number): number {
  const type = TRAFFIC_ACTORS[index].vehicleType;
  return type ? TRAFFIC_LENGTHS[type] / 2 : PERSON_SPACE.length / 2;
}

function halfWidth(index: number): number {
  const kind = TRAFFIC_ACTORS[index].kind;
  return kind === 'pedestrian' ? PERSON_SPACE.width / 2 : kind === 'cyclist' ? 0.4 : kind === 'bus' ? 1.1 : 0.9;
}

function isSharedBike(actor: ActorState): boolean {
  return actor.sharedBike !== undefined;
}

function overlap(
  ax: number, az: number, ah: number, al: number, aw: number,
  bx: number, bz: number, bh: number, bl: number, bw: number,
): boolean {
  const afx = Math.sin(ah);
  const afz = Math.cos(ah);
  const bfx = Math.sin(bh);
  const bfz = Math.cos(bh);
  for (let index = 0; index < 4; index += 1) {
    const x = index === 0 ? afx : index === 1 ? afz : index === 2 ? bfx : bfz;
    const z = index === 0 ? afz : index === 1 ? -afx : index === 2 ? bfz : -bfx;
    const distance = Math.abs((ax - bx) * x + (az - bz) * z);
    const radiusA = al * Math.abs(afx * x + afz * z) + aw * Math.abs(afz * x - afx * z);
    const radiusB = bl * Math.abs(bfx * x + bfz * z) + bw * Math.abs(bfz * x - bfx * z);
    if (distance >= radiusA + radiusB - 1e-7) return false;
  }
  return true;
}

describe('shared connected street graph', () => {
  it('keeps relocated street poles outside full motor and protected cycling footprints', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const blocked = new Set<string>();
    for (const route of TRAFFIC_ROUTES) {
      const bicycle = route.id.startsWith('cycle');
      for (let distance = 0; distance < route.length; distance += 0.1) {
        sampleTrafficRoute(route, distance, pose);
        for (const pole of STREET_LAMPS) {
          if (Math.abs(pose.position.x - pole.x) > 4 || Math.abs(pose.position.z - pole.z) > 4) continue;
          if (overlap(pose.position.x, pose.position.z, pose.heading, bicycle ? 1 : 2.4, bicycle ? 0.4 : 1.1,
            pole.x, pole.z, 0, LAMP_GEOMETRY.poleRadius, LAMP_GEOMETRY.poleRadius)) blocked.add(pole.id);
        }
      }
    }
    expect([...blocked]).toEqual([]);
  });

  it('reserves bounds enclosing the authored vehicles, wheels, and walking bodies', () => {
    const artBounds = {
      sedan: { length: 2.7, width: 1.45 },
      taxi: { length: 2.7, width: 1.45 },
      van: { length: 3.3, width: 1.5 },
      truck: { length: 4.5, width: 1.7 },
      bus: { length: 4.6, width: 1.9 },
      bicycle: { length: 2 * (0.64 + 0.32), width: 0.65 },
    };
    TRAFFIC_ACTORS.forEach(({ vehicleType }, index) => {
      if (vehicleType) {
        expect(halfLength(index) * 2, vehicleType).toBeGreaterThanOrEqual(artBounds[vehicleType].length);
        expect(halfWidth(index) * 2, vehicleType).toBeGreaterThanOrEqual(artBounds[vehicleType].width);
      } else {
        expect(halfWidth(index) * 2).toBeGreaterThanOrEqual(0.38);
      }
    });
  });

  it('fixes the streets, protected lanes, peripheral blocks, and bounded manifest', () => {
    expect(STREET_X).toEqual([-102, -76, -46, 46, 76, 102]);
    expect(STREET_Z).toEqual([-162, -132, -95, 95, 132, 162]);
    expect(ROAD_HALF_WIDTH).toBe(5);
    expect(SIDEWALK_HALF_WIDTH).toBe(7);
    expect(BIKE_OFFSET).toBe(4);
    expect(CITY_EXTENT).toEqual({ x: 110, z: 170 });
    expect(INTERSECTIONS).toHaveLength(36);
    expect(new Set(INTERSECTIONS.map(({ id }) => id)).size).toBe(36);
    expect(STOP_SIGN_INTERSECTIONS.map(({ id }) => id)).toEqual([
      'intersection-0-0', 'intersection-1-0', 'intersection-4-1', 'intersection-5-1',
      'intersection-4-4', 'intersection-0-5', 'intersection-1-5', 'intersection-4-5',
    ]);
    expect(SIGNALED_INTERSECTIONS).toHaveLength(28);
    expect(STOP_SIGN_INTERSECTIONS.concat(SIGNALED_INTERSECTIONS).map(({ id }) => id).sort())
      .toEqual(INTERSECTIONS.map(({ id }) => id).sort());
    // Quiet outer corners only: the park-fronting avenues and cross streets stay signalized.
    expect(STOP_SIGN_INTERSECTIONS.every(({ x, z }) => Math.abs(x) !== 46 && Math.abs(z) !== 95)).toBe(true);
    expect(new Set(STOP_SIGN_INTERSECTIONS.map(({ x, z }) => `${x > 0 ? 'e' : 'w'}${z > 0 ? 'n' : 's'}`)).size).toBe(4);
    expect(STREET_BLOCKS).toHaveLength(24);
    expect(STREET_BLOCKS.some(({ id }) => id === 'block-2-2')).toBe(false);
    expect(TRAFFIC_ACTORS).toHaveLength(231);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'car')).toHaveLength(42);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'bus')).toHaveLength(6);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'cyclist')).toHaveLength(15);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian')).toHaveLength(168);
    expect(new Set(TRAFFIC_ACTORS.map(({ id }) => id)).size).toBe(231);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian').map(({ id }) => id))
      .toEqual(Array.from({ length: 168 }, (_, index) => `city-walker-${index + 1}`));
    expect(TRAFFIC_ACTORS.filter(({ id }) => id.startsWith('bikeshare-rider-')).map(({ id }) => id))
      .toEqual(['bikeshare-rider-lantern', 'bikeshare-rider-willow', 'bikeshare-rider-juniper']);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'bus').map(({ id }) => id))
      .toEqual([6, 12, 18, 24, 30, 36].map((id) => `city-vehicle-${id}`));
    expect(TRAFFIC_ACTORS.slice(36, 48).map(({ vehicleType }) => vehicleType))
      .toEqual(Array.from({ length: 3 }, () => ['sedan', 'taxi', 'van', 'truck']).flat());
    expect(new Set(TRAFFIC_ACTORS.map(({ vehicleType }) => vehicleType).filter(Boolean)))
      .toEqual(new Set(['sedan', 'taxi', 'van', 'truck', 'bus', 'bicycle']));
  });

  it('uses shared directed links in a connected network, not disconnected decorative circuits', () => {
    const lanes = new Map<string, number>();
    const visited = new Set<number>();
    const connections = new Map<number, Set<number>>();
    for (const route of TRAFFIC_ROUTES.slice(0, 6)) {
      expect(new Set(route.segments.map(({ intersection }) => intersection)).size).toBeGreaterThanOrEqual(8);
      for (const segment of route.segments) {
        if (segment.kind !== 'link') continue;
        lanes.set(segment.lane, (lanes.get(segment.lane) ?? 0) + 1);
        const [from, to] = segment.lane.split(':')[0].split('>').map(Number);
        const adjacentColumn = Math.floor(from / STREET_X.length) === Math.floor(to / STREET_X.length) && Math.abs(from - to) === 1;
        const adjacentRow = from % STREET_X.length === to % STREET_X.length && Math.abs(from - to) === STREET_X.length;
        expect(adjacentColumn || adjacentRow, `${route.id}: ${segment.lane} must join neighboring intersections`).toBe(true);
        expect(Math.abs(segment.dx) + Math.abs(segment.dz)).toBe(1);
        if (!connections.has(from)) connections.set(from, new Set());
        connections.get(from)!.add(to);
      }
    }
    const queue = [0];
    while (queue.length > 0) {
      const node = queue.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      queue.push(...connections.get(node)!);
    }
    expect(visited.size).toBe(INTERSECTIONS.length);
    expect([...lanes.values()].some((count) => count > 1)).toBe(true);
    expect(lanes.size).toBeGreaterThanOrEqual(40);
  });

  it('has continuous position and tangent at every link, turn, and closed seam', () => {
    const before = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const after = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const epsilon = 0.00001;
    for (const route of [...TRAFFIC_ROUTES, ...SHARED_BIKE_ROUTES.map(({ route }) => route),
      ...SIDEWALK_ROUTES, ...SIDEWALK_WALKING_ROUTES.flat()]) {
      for (let index = 0; index < route.segments.length; index += 1) {
        const segment = route.segments[index];
        const previous = route.segments[(index + route.segments.length - 1) % route.segments.length];
        sampleTrafficRoute(route, segment.start - epsilon, before);
        sampleTrafficRoute(route, segment.start + epsilon, after);
        expect(Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z), route.id)
          .toBeLessThanOrEqual(epsilon * 2 + 1e-9);
        const curvature = 1 / minimumRadius(previous) + 1 / minimumRadius(segment);
        expect(angleDifference(before.heading, after.heading), route.id).toBeLessThanOrEqual(epsilon * curvature + 1e-9);
      }
    }
  });

  it('keeps motor/bike paths inside the road and sidewalk routes outside every road', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const route of [...TRAFFIC_ROUTES, ...SIDEWALK_ROUTES]) {
      for (let distance = 0; distance < route.length; distance += 0.2) {
        sampleTrafficRoute(route, distance, pose);
        const xDistance = Math.min(...STREET_X.map((x) => Math.abs(x - pose.position.x)));
        const zDistance = Math.min(...STREET_Z.map((z) => Math.abs(z - pose.position.z)));
        expect(Math.abs(pose.position.x)).toBeLessThanOrEqual(CITY_EXTENT.x);
        expect(Math.abs(pose.position.z)).toBeLessThanOrEqual(CITY_EXTENT.z);
        if (route.id.startsWith('block')) {
          expect(xDistance).toBeGreaterThanOrEqual(SIDEWALK_OFFSET - 1e-7);
          expect(zDistance).toBeGreaterThanOrEqual(SIDEWALK_OFFSET - 1e-7);
          expect(Math.min(xDistance, zDistance)).toBeLessThanOrEqual(SIDEWALK_HALF_WIDTH);
        } else {
          expect(Math.min(xDistance, zDistance)).toBeLessThanOrEqual(ROAD_HALF_WIDTH);
        }
      }
    }
    for (const route of TRAFFIC_ROUTES) {
      for (const segment of route.segments) {
        if (segment.kind !== 'link') continue;
        const center = INTERSECTIONS[segment.intersection];
        const offset = route.id.startsWith('cycle') ?
          bikeLaneOffset(segment.axis, segment.dx === 0 ? center.x : center.z, segment.dx || segment.dz) : VEHICLE_OFFSET;
        const signedOffset = (segment.x - center.x) * -segment.dz + (segment.z - center.z) * segment.dx;
        expect(signedOffset).toBeCloseTo(offset, 7);
      }
    }
  });

  it('preserves motor-lane identity, circular turns, and unmodified speed policy', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const route of TRAFFIC_ROUTES.slice(0, 6)) {
      for (const segment of route.segments) {
        expect(segment.ellipse).toBeUndefined();
        expect(segment.speedLimit).toBeUndefined();
        if (segment.kind === 'link') expect(segment.lane.endsWith(`:${VEHICLE_OFFSET}`)).toBe(true);
        if (segment.turn === 0) continue;
        expect(segment.radius).toBe(INTERSECTION_GATE - segment.turn * VEHICLE_OFFSET);
        expect(segment.length).toBe(Math.PI / 2 * segment.radius);
        for (const fraction of [0, 0.25, 0.5, 0.75]) {
          sampleTrafficRoute(route, segment.start + fraction * segment.length, pose);
          const angle = segment.turn * fraction * Math.PI / 2;
          const x = segment.x - segment.centerX;
          const z = segment.z - segment.centerZ;
          expect(pose.position.x).toBeCloseTo(segment.centerX + x * Math.cos(angle) - z * Math.sin(angle), 9);
          expect(pose.position.z).toBeCloseTo(segment.centerZ + x * Math.sin(angle) + z * Math.cos(angle), 9);
        }
      }
    }
  });

  it('places both cycling directions in their exact park-side half-track, not opposing roadside lanes', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const track of PAIRED_TRACKS) {
      const directions = new Set<number>();
      for (const route of TRAFFIC_ROUTES.slice(6)) {
        for (const segment of route.segments) {
          if (segment.kind !== 'link' || segment.dx === 0 || INTERSECTIONS[segment.intersection].z !== track.z) continue;
          directions.add(segment.dx);
          for (const fraction of [0, 0.25, 0.5, 0.75, 0.999]) {
            sampleTrafficRoute(route, segment.start + segment.length * fraction, pose);
            expect(pose.position.z).toBeCloseTo(track.z + (segment.dx === 1 ? track.east : track.west), 9);
            expect(Math.sin(pose.heading)).toBeCloseTo(segment.dx, 9);
            expect(Math.cos(pose.heading)).toBeCloseTo(0, 9);
            const parkSide = (pose.position.z - track.z) * track.side;
            const divider = TWO_WAY_BIKE_TRACK.offset;
            expect(parkSide - 0.4).toBeGreaterThan(divider - TWO_WAY_BIKE_TRACK.width / 2);
            expect(parkSide + 0.4).toBeLessThan(divider + TWO_WAY_BIKE_TRACK.width / 2);
            expect(Math.abs(parkSide - divider) - 0.4).toBeGreaterThan(0);
          }
        }
      }
      expect(directions).toEqual(new Set([-1, 1]));
    }
  });

  it('samples unequal turn offsets at unit ground speed with tangent-aligned headings', () => {
    const before = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const after = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    let ellipses = 0;
    for (const route of TRAFFIC_ROUTES.slice(6)) {
      for (const segment of route.segments) {
        if (!segment.ellipse) continue;
        ellipses += 1;
        expect(segment.speedLimit).toBeCloseTo(minimumRadius(segment) * TRAFFIC.maxBicycleTurnRate, 9);
        for (let index = 1; index < 128; index += 1) {
          const distance = segment.start + index * segment.length / 128;
          const delta = 0.0001;
          sampleTrafficRoute(route, distance - delta, before);
          sampleTrafficRoute(route, distance, pose);
          sampleTrafficRoute(route, distance + delta, after);
          const dx = after.position.x - before.position.x;
          const dz = after.position.z - before.position.z;
          expect(Math.hypot(dx, dz) / (2 * delta)).toBeCloseTo(1, 6);
          expect(angleDifference(Math.atan2(dx, dz), pose.heading)).toBeLessThan(1e-6);
        }
      }
    }
    expect(ellipses).toBeGreaterThan(0);
  });

  it('keeps complete bicycle turn footprints off all four sidewalk corners', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (const route of TRAFFIC_ROUTES.slice(6)) {
      for (const segment of route.segments) {
        if (segment.kind !== 'junction' || segment.turn === 0) continue;
        const center = INTERSECTIONS[segment.intersection];
        for (let step = 0; step <= 128; step += 1) {
          sampleTrafficRoute(route, segment.start + segment.length * step / 128, pose);
          for (const x of [-10, 10]) {
            for (const z of [-10, 10]) {
              expect(overlap(pose.position.x, pose.position.z, pose.heading, 1, 0.4,
                center.x + x, center.z + z, 0, 5, 5), `${route.id} at ${center.id}, sample ${step}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('excludes complete vehicle and cyclist footprints from the park along every route', () => {
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    for (let index = 0; index < MOTION_COUNT; index += 1) {
      const route = actorRoute(index);
      for (let distance = 0; distance < route.length; distance += 0.25) {
        sampleTrafficRoute(route, distance, pose);
        expect(overlap(pose.position.x, pose.position.z, pose.heading, halfLength(index), halfWidth(index),
          0, 0, 0, PARK_BOUNDS.z, PARK_BOUNDS.x), `${TRAFFIC_ACTORS[index].id} at ${distance}`).toBe(false);
      }
    }
  });
});

describe('CityTraffic', () => {
  it.each([0, 1, 42, 91, 2401, 0xffffffff])('places seven spaced walkers on every peripheral sidewalk for seed %s', (seed) => {
    const traffic = new CityTraffic(seed);
    const occupied = new Map<string, number>();
    for (const actor of traffic.actors) {
      if (actor.kind !== 'pedestrian') continue;
      const block = STREET_BLOCKS.find(({ minX, maxX, minZ, maxZ }) =>
        actor.position.x >= minX + SIDEWALK_WALKING_OFFSETS[0] - 1e-7 &&
        actor.position.x <= maxX - SIDEWALK_WALKING_OFFSETS[0] + 1e-7 &&
        actor.position.z >= minZ + SIDEWALK_WALKING_OFFSETS[0] - 1e-7 &&
        actor.position.z <= maxZ - SIDEWALK_WALKING_OFFSETS[0] + 1e-7);
      expect(block, actor.id).toBeDefined();
      occupied.set(block!.id, (occupied.get(block!.id) ?? 0) + 1);
    }
    expect(occupied.size).toBe(STREET_BLOCKS.length);
    for (const count of occupied.values()) expect(count).toBe(7);
    for (let first = MOTION_COUNT; first < traffic.actors.length; first += 1) {
      for (let second = first + 1; second < traffic.actors.length; second += 1) {
        if (actorRoute(first, seed) !== actorRoute(second, seed)) continue;
        const a = traffic.actors[first];
        const b = traffic.actors[second];
        const gap = Math.min(travel(a.distance, b.distance, a.routeLength), travel(b.distance, a.distance, a.routeLength));
        expect(gap).toBeGreaterThanOrEqual(a.routeLength / 7 - 1);
        expect(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)).toBeGreaterThan(1.2);
        expect(overlap(a.position.x, a.position.z, a.heading, 0.35, 0.35,
          b.position.x, b.position.z, b.heading, 0.35, 0.35)).toBe(false);
      }
    }
  });

  it('retains actors, position objects, and authoritative signal states through integration', () => {
    const simulation = new ActorSimulation();
    const traffic = simulation.traffic;
    const actors = [...traffic.actors];
    const positions = actors.map(({ position }) => position);
    const signals = traffic.signals;
    const heads = [...signals];
    expect(traffic.actors.map(({ id }) => id)).toEqual(TRAFFIC_ACTORS.map(({ id }) => id));
    expect(signals.map(({ id }) => id)).toEqual(INTERSECTIONS.map(({ id }) => id));
    expect(simulation.actors.slice(simulation.actors.length - actors.length)).toEqual(actors);
    expect(Object.isFrozen(traffic.actors)).toBe(true);
    expect(Object.isFrozen(signals)).toBe(true);
    for (let tick = 0; tick < 300; tick += 1) simulation.step(DT);
    expect(simulation.traffic).toBe(traffic);
    expect(traffic.elapsed).toBe(simulation.elapsed);
    expect(traffic.signals).toBe(signals);
    heads.forEach((head, index) => expect(signals[index]).toBe(head));
    actors.forEach((actor, index) => {
      expect(traffic.actors[index]).toBe(actor);
      expect(actor.position).toBe(positions[index]);
      expect(simulation.getActor(actor.id)).toBe(actor);
    });
  });

  it.each([NaN, Infinity, -Infinity, -1, 0x100000000, 0.5])('rejects invalid seed %s', (seed) => {
    expect(() => new CityTraffic(seed)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -Infinity, -1])('rejects delta %s before changing anything', (dt) => {
    const traffic = new CityTraffic();
    const before = JSON.stringify(traffic);
    expect(() => traffic.step(dt)).toThrow(RangeError);
    expect(JSON.stringify(traffic)).toBe(before);
  });

  it.each([NaN, Infinity, -Infinity, 0, 0.299, 1.001, 2])('rejects traction %s without changing state, even on a zero tick', (traction) => {
    const traffic = new CityTraffic();
    const before = JSON.stringify(traffic);
    expect(() => traffic.step(DT, traction)).toThrow(RangeError);
    expect(() => traffic.step(0, traction)).toThrow(RangeError);
    expect(JSON.stringify(traffic)).toBe(before);
  });

  it('retains identical default dry behavior and validates the grip limits', () => {
    const first = new CityTraffic();
    const second = new CityTraffic();
    for (let tick = 0; tick < 600; tick += 1) {
      first.step(DT);
      second.step(DT, 1);
    }
    expect(first).toEqual(second);
    const before = JSON.stringify(first);
    first.step(0, 0.3);
    expect(JSON.stringify(first)).toBe(before);
  });

  it.each([0.75, 0.3])('scales road acceleration at grip %s without slowing the signal or sidewalk clocks', (traction) => {
    const dry = new CityTraffic();
    const slippery = new CityTraffic();
    const dryWalkingClock = vi.spyOn(dry.pedestrians, 'step');
    const slipperyWalkingClock = vi.spyOn(slippery.pedestrians, 'step');
    const initialPhases = dry.signals.map(({ phase }) => phase);
    const cycling = dry.signals.map(({ control }) => control === 'signal');
    const dryChanges = new Float64Array(INTERSECTIONS.length);
    const slipperyChanges = new Float64Array(INTERSECTIONS.length);
    dry.step(DT);
    slippery.step(DT, traction);
    for (let index = 0; index < MOTION_COUNT; index += 1) {
      if (slippery.actors[index].sharedBike?.docked) {
        expect(slippery.actors[index].speed).toBe(0);
        continue;
      }
      expect(slippery.actors[index].speed).toBeCloseTo(TRAFFIC.acceleration * traction * DT, 10);
    }
    expect(slippery.pedestrians.actors).toEqual(dry.pedestrians.actors);
    for (let tick = 1; tick < 240; tick += 1) {
      dry.step(DT);
      slippery.step(DT, traction);
      for (let index = 0; index < initialPhases.length; index += 1) {
        if (dryChanges[index] === 0 && dry.signals[index].phase !== initialPhases[index]) dryChanges[index] = dry.elapsed;
        if (slipperyChanges[index] === 0 && slippery.signals[index].phase !== initialPhases[index]) slipperyChanges[index] = slippery.elapsed;
      }
    }
    // Posted corners hold a constant stop phase; only the cycling signals must keep clock time.
    expect(dryChanges.every((time, index) => time > 0 === cycling[index])).toBe(true);
    expect(slipperyChanges).toEqual(dryChanges);
    expect(slippery.elapsed).toBe(dry.elapsed);
    // Occupied wet-road crossings may defer entry; the walking clock and desired pace are not scaled.
    expect(dryWalkingClock.mock.calls.map(([dt]) => dt)).toEqual(Array(240).fill(DT));
    expect(slipperyWalkingClock.mock.calls.map(([dt]) => dt)).toEqual(Array(240).fill(DT));
  });

  it.each([0, 2401])('retains footprint and stop-line safety during abrupt grip changes for seed %s', (seed) => {
    const traffic = new CityTraffic(seed);
    const reference = new CityTraffic(seed);
    const previous = traffic.actors.map(({ distance }) => distance);
    const totals = new Float64Array(MOTION_COUNT);
    const idle = new Float64Array(MOTION_COUNT);
    const longestIdle = new Float64Array(MOTION_COUNT);
    const grips = [1, 0.3, 0.75, 1];
    for (let tick = 0; tick < 240 / DT; tick += 1) {
      traffic.step(DT, grips[Math.floor(tick * DT / 30) % grips.length]);
      reference.step(DT);
      for (let index = 0; index < MOTION_COUNT; index += 1) {
        const actor = traffic.actors[index];
        const movement = travel(previous[index], actor.distance, actor.routeLength);
        const maximumSpeed = index < MOTOR_COUNT ? TRAFFIC.maxVehicleSpeed : TRAFFIC.maxBicycleSpeed;
        if (actor.sharedBike?.docked) {
          previous[index] = actor.distance;
          continue;
        }
        if (movement > maximumSpeed * DT + 1e-7) throw new Error(`Grip change jumped ${actor.id}`);
        totals[index] += movement;
        idle[index] = movement > 0.0001 ? 0 : idle[index] + DT;
        longestIdle[index] = Math.max(longestIdle[index], idle[index]);
        previous[index] = actor.distance;
        if (overlap(actor.position.x, actor.position.z, actor.heading, halfLength(index), halfWidth(index),
          0, 0, 0, PARK_BOUNDS.z, PARK_BOUNDS.x)) throw new Error(`Grip change moved ${actor.id} into the park`);
        if (actor.state === 'waiting') {
          const segment = actorSegment(actor, actorRoute(index));
          if (segment.kind !== 'link') throw new Error(`${actor.id} stopped in a reserved junction`);
          if (segment.intersection >= 0) {
            const front = actor.distance - segment.start + halfLength(index);
            if (front > segment.length - (STOP_LINE_OFFSET - INTERSECTION_GATE) - TRAFFIC.stopBuffer + 1e-6) {
              throw new Error(`${actor.id} stopped beyond the painted bar`);
            }
          }
        }
      }
      for (let index = 0; index < INTERSECTIONS.length; index += 1) {
        const center = INTERSECTIONS[index];
        let occupied = false;
        for (let actorIndex = 0; actorIndex < MOTION_COUNT; actorIndex += 1) {
          const actor = traffic.actors[actorIndex];
          if (Math.abs(actor.position.x - center.x) > 11 || Math.abs(actor.position.z - center.z) > 11) continue;
          if (!overlap(actor.position.x, actor.position.z, actor.heading, halfLength(actorIndex), halfWidth(actorIndex),
            center.x, center.z, 0, INTERSECTION_GATE, INTERSECTION_GATE)) continue;
          if (occupied || traffic.signals[index].phase === 'pedestrians') throw new Error(`Grip-change conflict at ${center.id}`);
          occupied = true;
        }
      }
      for (let first = 0; first < traffic.actors.length; first += 1) {
        const a = traffic.actors[first];
        for (let second = first + 1; second < traffic.actors.length; second += 1) {
          const b = traffic.actors[second];
          if (isSharedBike(a) || isSharedBike(b)) continue;
          if (Math.abs(a.position.x - b.position.x) > 7 || Math.abs(a.position.z - b.position.z) > 7) continue;
          if (overlap(a.position.x, a.position.z, a.heading, halfLength(first), halfWidth(first),
            b.position.x, b.position.z, b.heading, halfLength(second), halfWidth(second))) {
            throw new Error(`Grip-change overlap ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
          }
          if (first < MOTION_COUNT && second < MOTION_COUNT) {
            const sa = actorSegment(a, actorRoute(first));
            const sb = actorSegment(b, actorRoute(second));
            if (sa.kind === 'link' && sb.kind === 'link' && sa.lane === sb.lane) {
              const gap = Math.abs((a.distance - sa.start) - (b.distance - sb.start)) - halfLength(first) - halfLength(second);
              const required = first < MOTOR_COUNT ? TRAFFIC.vehicleGap : TRAFFIC.bicycleGap;
              if (gap < required - 1e-6) throw new Error(`Grip-change headway violation ${a.id}/${b.id}`);
            }
          }
        }
      }
    }
    expect(traffic.elapsed).toBe(reference.elapsed);
    // Crossing waits now depend on vehicle clearance; weather can legitimately change a trip's timing.
    expect(traffic.pedestrians.actors.map(({ id }) => id)).toEqual(reference.pedestrians.actors.map(({ id }) => id));
    for (let index = 0; index < MOTION_COUNT; index += 1) {
      if (traffic.actors[index].sharedBike) continue;
      expect(totals[index], traffic.actors[index].id).toBeGreaterThan(50);
      expect(longestIdle[index], traffic.actors[index].id).toBeLessThan(100);
    }
    // Stop-bar dwell adds queue churn to this seed pair; keep headroom under parallel suite load.
  }, 20_000);

  it('clamps long deltas and freezes every timer on zero delta', () => {
    const first = new CityTraffic();
    const second = new CityTraffic();
    first.step(300);
    second.step(DT);
    expect(first).toEqual(second);
    const paused = JSON.stringify(first);
    for (let tick = 0; tick < 900; tick += 1) first.step(0);
    expect(JSON.stringify(first)).toBe(paused);
    first.step(DT);
    second.step(DT);
    expect(first).toEqual(second);
    first.step(DT / 2);
    expect(first.elapsed).toBeCloseTo(DT * 2.5, 9);
  });

  it('reproduces fixed seeds without wall-clock or per-frame random input', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Random'); });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Clock'); });
    try {
      const first = new CityTraffic(91);
      const second = new CityTraffic(91);
      expect(new CityTraffic(92).actors).not.toEqual(first.actors);
      for (let tick = 0; tick < 1800; tick += 1) {
        first.step(DT);
        second.step(DT);
      }
      expect(first).toEqual(second);
      expect(random).not.toHaveBeenCalled();
      expect(clock).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
      clock.mockRestore();
    }
  });

  it('initializes many seeds with unique, unoccupied incoming lanes', () => {
    for (const seed of [91, ...Array.from({ length: 128 }, (_, index) => index * 7919)]) {
      const traffic = new CityTraffic(seed);
      const occupied = new Set<string>();
      for (let index = 0; index < MOTION_COUNT; index += 1) {
        const actor = traffic.actors[index];
        if (actor.sharedBike?.docked) {
          expect(actor.state).toBe('dwelling');
          continue;
        }
        const segment = actorSegment(actor, actorRoute(index));
        expect(segment.kind).toBe('link');
        expect(occupied.has(segment.lane)).toBe(false);
        occupied.add(segment.lane);
        expect(actor.distance - segment.start).toBeGreaterThan(halfLength(index) + TRAFFIC.stopBuffer);
        expect(segment.start + segment.length - actor.distance).toBeGreaterThan(halfLength(index) + TRAFFIC.stopBuffer);
      }
    }
  });

  it('stops the full vehicle and bicycle footprints behind the painted bars', () => {
    const traffic = new CityTraffic();
    const stopped = new Set<string>();
    for (let tick = 0; tick < 5400; tick++) {
      traffic.step(DT);
      for (let index = 0; index < MOTION_COUNT; index++) {
        const actor = traffic.actors[index];
        const segment = actorSegment(actor, actorRoute(index));
        if (actor.state !== 'waiting' || segment.kind !== 'link') continue;
        if (segment.intersection < 0) {
          stopped.add(TRAFFIC_ACTORS[index].vehicleType!);
          continue;
        }
        const front = actor.distance - segment.start + halfLength(index);
        const paintedBar = segment.length - (STOP_LINE_OFFSET - INTERSECTION_GATE);
        expect(front, actor.id).toBeLessThanOrEqual(paintedBar - TRAFFIC.stopBuffer + 1e-6);
        stopped.add(TRAFFIC_ACTORS[index].vehicleType!);
      }
    }
    expect(stopped).toEqual(new Set(['sedan', 'taxi', 'van', 'truck', 'bus', 'bicycle']));
  });

  it('shows moving cyclists passing safely in opposite directions on each paired track', () => {
    const traffic = new CityTraffic(2401);
    const passed = new Set<number>();
    // Posted-stop dwells shift when opposing riders meet, so watch longer than a plain soak.
    for (let tick = 0; tick < 1800 / DT && passed.size < PAIRED_TRACKS.length; tick += 1) {
      traffic.step(DT);
      for (let first = MOTOR_COUNT; first < MOTION_COUNT; first += 1) {
        const a = traffic.actors[first];
        const sa = actorSegment(a, actorRoute(first));
        if (sa.kind !== 'link' || sa.dx === 0 || sa.intersection < 0 || a.speed <= 0.1) continue;
        for (let second = first + 1; second < MOTION_COUNT; second += 1) {
          const b = traffic.actors[second];
          const sb = actorSegment(b, actorRoute(second));
          if (sb.kind !== 'link' || sb.dx !== -sa.dx || sb.intersection < 0 ||
            b.speed <= 0.1 || Math.abs(a.position.x - b.position.x) >= 1) continue;
          PAIRED_TRACKS.forEach((track, index) => {
            if (INTERSECTIONS[sa.intersection].z !== track.z || INTERSECTIONS[sb.intersection].z !== track.z) return;
            expect(Math.abs(a.position.z - b.position.z) - 0.8).toBeGreaterThanOrEqual(0.2 - 1e-7);
            expect(overlap(a.position.x, a.position.z, a.heading, 1, 0.4,
              b.position.x, b.position.z, b.heading, 1, 0.4)).toBe(false);
            passed.add(index);
          });
        }
      }
    }
    expect(passed).toEqual(new Set([0, 1]));
  }, 30_000);

  it.each([0, 2401])('brings every driver to a full halt at a posted stop bar and clears the crosswalk for seed %s', (seed) => {
    const traffic = new CityTraffic(seed);
    const actors = traffic.actors;
    const routes = actors.map((_, index) => actorRoute(index));
    const posted = INTERSECTIONS.map(({ control }) => control === 'all-way-stop');
    const halted = new Float64Array(MOTION_COUNT);
    const inside = new Int32Array(MOTION_COUNT).fill(-1);
    const postedEntries = new Uint32Array(INTERSECTIONS.length);
    const postedWalks = new Uint32Array(INTERSECTIONS.length);
    let rolled = 0;
    for (let tick = 0; tick < 600 / DT; tick += 1) {
      traffic.step(DT);
      for (let index = 0; index < MOTION_COUNT; index += 1) {
        const actor = actors[index];
        const segment = actorSegment(actor, routes[index]);
        if (segment.kind === 'junction') {
          if (inside[index] !== segment.intersection) {
            inside[index] = segment.intersection;
            if (posted[segment.intersection]) {
              // One tick of slack: the permit lands on the same tick the dwell completes.
              expect(halted[index] + DT,
                `${actor.id} entered ${INTERSECTIONS[segment.intersection].id} without stopping`)
                .toBeGreaterThanOrEqual(TRAFFIC.stopSeconds - 1e-9);
              postedEntries[segment.intersection] += 1;
            } else if (halted[index] === 0) rolled += 1;
            halted[index] = 0;
          }
          continue;
        }
        inside[index] = -1;
        if (!posted[segment.intersection] || actor.speed > 0) continue;
        const frontToLine = segment.start + segment.length - actor.distance - halfLength(index) -
          (STOP_LINE_OFFSET - INTERSECTION_GATE);
        if (Math.abs(frontToLine - TRAFFIC.stopBuffer) < 0.01) halted[index] += DT;
      }
      for (let index = 0; index < INTERSECTIONS.length; index += 1) {
        if (!posted[index] || !traffic.pedestrians.isCrossingOccupied(index)) continue;
        postedWalks[index] += 1;
        const center = INTERSECTIONS[index];
        for (let motion = 0; motion < MOTION_COUNT; motion += 1) {
          const actor = actors[motion];
          expect(overlap(actor.position.x, actor.position.z, actor.heading, halfLength(motion), halfWidth(motion),
            center.x, center.z, 0, INTERSECTION_GATE, INTERSECTION_GATE),
          `${actor.id} failed to yield the crosswalk at ${center.id}`).toBe(false);
        }
      }
    }
    // Posted corners keep carrying drivers, walkers still use most of them, and signalized greens roll.
    INTERSECTIONS.forEach((intersection, index) => {
      if (!posted[index]) return;
      expect(postedEntries[index], `${intersection.id} must serve drivers`).toBeGreaterThan(0);
    });
    expect(postedWalks.filter((count) => count > 0).length,
      'walkers must use posted crossings').toBeGreaterThanOrEqual(4);
    expect(rolled).toBeGreaterThan(0);
  }, 30_000);

  it.each(GRIP_SOAKS)('keeps seed $seed safe and live for twenty minutes at grip $traction (changing=$changing)', ({ seed, traction: initialTraction, changing }) => {
    const traffic = new CityTraffic(seed);
    const actors = traffic.actors;
    const routes = actors.map((_, index) => actorRoute(index, seed));
    const previous = actors.map((actor) => ({ ...actor.position, distance: actor.travelDistance ?? actor.distance, speed: actor.speed, heading: actor.heading }));
    const segments = actors.map((actor, index) => actorSegment(actor, routes[index]));
    const totals = new Float64Array(actors.length);
    const idle = new Float64Array(actors.length);
    const longestIdle = new Float64Array(actors.length);
    const waits = new Uint32Array(MOTION_COUNT);
    const crossings = new Uint32Array(INTERSECTIONS.length);
    const stopLines = new Uint32Array(MOTION_COUNT);
    const trackTravel = new Float64Array(PAIRED_TRACKS.length * 2);
    const streetTravel = new Float64Array(STREET_X.length + STREET_Z.length);
    const phases = new Set<string>();
    let maxAcceleration = 0;
    let maxBraking = 0;
    for (let tick = 0; tick < SOAK_SECONDS / DT; tick += 1) {
      const traction = changing ? 0.65 + 0.35 * Math.cos(tick * DT * Math.PI * 2 / 180) : initialTraction;
      traffic.step(DT, traction);
      for (let index = 0; index < actors.length; index += 1) {
        const actor = actors[index];
        const before = previous[index];
        const movement = actor.travelDistance === undefined ? travel(before.distance, actor.distance, actor.routeLength) :
          actor.travelDistance - before.distance;
        const displacement = Math.hypot(actor.position.x - before.x, actor.position.z - before.z);
        const speedFactor = changing ? 1 : Math.sqrt(traction);
        const topSpeed = index < MOTOR_COUNT ? TRAFFIC.maxVehicleSpeed * speedFactor :
          index < MOTION_COUNT ? TRAFFIC.maxBicycleSpeed * speedFactor : 1.56;
        if (actor.sharedBike?.docked) {
          idle[index] += DT;
          longestIdle[index] = Math.max(longestIdle[index], idle[index]);
          before.x = actor.position.x;
          before.z = actor.position.z;
          before.distance = actor.travelDistance ?? actor.distance;
          before.heading = actor.heading;
          before.speed = actor.speed;
          continue;
        }
        if (!Number.isFinite(actor.position.x + actor.position.z + actor.distance + actor.heading + actor.speed) ||
          actor.distance < 0 || actor.distance >= actor.routeLength || actor.position.y !== 0 ||
          displacement > topSpeed * DT + 1e-7 || movement > topSpeed * DT + 1e-7 ||
          angleDifference(before.heading, actor.heading) >
            (index < MOTION_COUNT ? 0.04 : 1.56 * DT / routes[index].segments[0].radius) ||
          Math.abs(actor.position.x) > CITY_EXTENT.x || Math.abs(actor.position.z) > CITY_EXTENT.z) {
          throw new Error(`Discontinuous ${actor.id}, seed ${seed}, tick ${tick}`);
        }
        totals[index] += movement;
        idle[index] = movement > 0.0001 ? 0 : idle[index] + DT;
        longestIdle[index] = Math.max(longestIdle[index], idle[index]);
        segments[index] = actorSegment(actor, routes[index]);
        if (index < MOTOR_COUNT && segments[index].kind === 'link') {
          const segment = segments[index];
          const vertical = segment.dx === 0;
          const roadIndex = vertical ? segment.intersection % STREET_X.length :
            Math.floor(segment.intersection / STREET_X.length);
          const expectedRoad = vertical ? STREET_X[roadIndex] : STREET_Z[roadIndex];
          const actualRoad = vertical ? actor.position.x + segment.dz * VEHICLE_OFFSET :
            actor.position.z - segment.dx * VEHICLE_OFFSET;
          if (Math.abs(actualRoad - expectedRoad) > 1e-7) {
            throw new Error(`Motor departed its physical street ${actor.id}, seed ${seed}, tick ${tick}`);
          }
          streetTravel[(vertical ? 0 : STREET_X.length) + roadIndex] += movement;
        }
        if (actor.kind === 'cyclist') {
          if (angleDifference(before.heading, actor.heading) > TRAFFIC.maxBicycleTurnRate * DT + 1e-6) {
            throw new Error(`Excessive bicycle turn rate ${actor.id}, seed ${seed}, tick ${tick}`);
          }
          const segment = segments[index];
          if (!actor.sharedBike || segment.intersection >= 0) {
            for (let trackIndex = 0; trackIndex < PAIRED_TRACKS.length; trackIndex += 1) {
              const track = PAIRED_TRACKS[trackIndex];
              if (segment.kind !== 'link' || segment.dx === 0 || INTERSECTIONS[segment.intersection].z !== track.z) continue;
              const expectedZ = track.z + (segment.dx === 1 ? track.east : track.west);
              if (Math.abs(actor.position.z - expectedZ) > 1e-7 || Math.abs(Math.sin(actor.heading) - segment.dx) > 1e-7) {
                throw new Error(`Incorrect counterflow lane ${actor.id}, seed ${seed}, tick ${tick}`);
              }
              trackTravel[trackIndex * 2 + (segment.dx === 1 ? 0 : 1)] += movement;
            }
          }
        }
        if (index < MOTION_COUNT) {
          if (overlap(actor.position.x, actor.position.z, actor.heading, halfLength(index), halfWidth(index),
            0, 0, 0, PARK_BOUNDS.z, PARK_BOUNDS.x)) {
            throw new Error(`Vehicle footprint entered park: ${actor.id}, seed ${seed}, tick ${tick}`);
          }
          if (!actor.sharedBike) {
            maxAcceleration = Math.max(maxAcceleration, (actor.speed - before.speed) / DT / traction);
            maxBraking = Math.max(maxBraking, (before.speed - actor.speed) / DT / traction);
          }
          if (actor.state === 'waiting') {
            waits[index] += 1;
            const segment = segments[index];
            if (segment.kind === 'link' && segment.intersection >= 0) {
              const frontToLine = segment.start + segment.length - actor.distance - halfLength(index) -
                (STOP_LINE_OFFSET - INTERSECTION_GATE);
              if (frontToLine < TRAFFIC.stopBuffer - 1e-6) throw new Error(`${actor.id} stopped past its stop line`);
              if (Math.abs(frontToLine - TRAFFIC.stopBuffer) < 0.001) stopLines[index] += 1;
            } else if (segment.kind === 'link') {
              stopLines[index] += 1;
            } else {
              throw new Error(`${actor.id} queued inside a reserved intersection, seed ${seed}, tick ${tick}`);
            }
          }
        }
        before.x = actor.position.x;
        before.z = actor.position.z;
        before.distance = actor.travelDistance ?? actor.distance;
        before.heading = actor.heading;
        before.speed = actor.speed;
      }
      for (let intersection = 0; intersection < INTERSECTIONS.length; intersection += 1) {
        const center = INTERSECTIONS[intersection];
        const { phase, control, walk } = traffic.signals[intersection];
        phases.add(phase);
        // Drivers must hold clear of the box whenever a walker owns the crossing, posted or signalized.
        const walkers = control === 'signal' ? phase === 'pedestrians' :
          traffic.pedestrians.isCrossingOccupied(intersection);
        if (control === 'signal' && walk !== (phase === 'pedestrians')) {
          throw new Error(`Signal ${center.id} published a walk flag off its phase`);
        }
        let occupied = -1;
        for (let index = 0; index < MOTION_COUNT; index += 1) {
          const actor = actors[index];
          if (Math.abs(actor.position.x - center.x) > 11 || Math.abs(actor.position.z - center.z) > 11) continue;
          if (!overlap(actor.position.x, actor.position.z, actor.heading, halfLength(index), halfWidth(index),
            center.x, center.z, 0, INTERSECTION_GATE, INTERSECTION_GATE)) continue;
          if (occupied >= 0 || walkers) {
            throw new Error(`Intersection conflict ${center.id}: ${actors[occupied]?.id}/${actor.id}, ${phase}, seed ${seed}, tick ${tick}`);
          }
          occupied = index;
          crossings[intersection] += 1;
        }
      }
      for (let first = 0; first < actors.length; first += 1) {
        for (let second = first + 1; second < actors.length; second += 1) {
          const a = actors[first];
          const b = actors[second];
          if (isSharedBike(a) || isSharedBike(b)) continue;
          if (Math.abs(a.position.x - b.position.x) > 7 || Math.abs(a.position.z - b.position.z) > 7) continue;
          if (overlap(a.position.x, a.position.z, a.heading, halfLength(first), halfWidth(first),
            b.position.x, b.position.z, b.heading, halfLength(second), halfWidth(second))) {
            throw new Error(`Actor overlap ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
          }
          const sa = segments[first];
          const sb = segments[second];
          if (first < MOTION_COUNT && second < MOTION_COUNT && sa.kind === 'link' && sb.kind === 'link' && sa.lane === sb.lane) {
            const gap = Math.abs((a.distance - sa.start) - (b.distance - sb.start)) - halfLength(first) - halfLength(second);
            const required = first < MOTOR_COUNT ? TRAFFIC.vehicleGap : TRAFFIC.bicycleGap;
            if (gap < required - 1e-6) {
              throw new Error(`Headway ${gap} ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
            }
          }
        }
      }
      if (actors.length !== TRAFFIC_ACTORS.length || traffic.signals.length !== INTERSECTIONS.length) throw new Error('Unbounded population');
    }
    expect(traffic.elapsed).toBeCloseTo(SOAK_SECONDS, 6);
    expect(phases).toEqual(new Set(['north-south', 'east-west', 'clearance', 'pedestrians', 'stop']));
    expect(maxAcceleration).toBeLessThanOrEqual(TRAFFIC.acceleration + 1e-6);
    expect(maxBraking).toBeLessThanOrEqual(TRAFFIC.braking + 1e-4);
    for (let index = 0; index < actors.length; index += 1) {
      if (actors[index].sharedBike) {
        expect(totals[index], `${actors[index].id} should keep its dock trip bounded`).toBeGreaterThanOrEqual(0);
        continue;
      }
      // Real pedestrian clearance lengthens snowy cycles; retain the dry and walking wait bounds.
      const waitBound = index < MOTION_COUNT && initialTraction < 1 ? 180 : 100;
      expect(longestIdle[index], `${actors[index].id} must never starve`).toBeLessThan(waitBound);
      if (index < MOTION_COUNT) {
        expect(totals[index] / actors[index].routeLength, `${actors[index].id} must complete a full circuit`).toBeGreaterThan(1);
        expect(waits[index], `${actors[index].id} must stop at a light`).toBeGreaterThan(0);
        expect(stopLines[index], `${actors[index].id} must stop with its bumper at a painted line`).toBeGreaterThan(0);
      } else {
        expect(totals[index] / SOAK_SECONDS, `${actors[index].id} must maintain walking progress through waits and rests`).toBeGreaterThan(0.3);
      }
    }
    for (let index = 0; index < crossings.length; index += 1) {
      expect(crossings[index], `${INTERSECTIONS[index].id} must carry traffic`).toBeGreaterThan(100);
    }
    for (let index = 0; index < trackTravel.length; index += 1) {
      expect(trackTravel[index], `Paired track/direction ${index} must carry moving cyclists`).toBeGreaterThan(100);
    }
    for (let index = 0; index < streetTravel.length; index += 1) {
      const name = index < STREET_X.length ? `Avenue X=${STREET_X[index]}` : `Cross-street Z=${STREET_Z[index - STREET_X.length]}`;
      expect(streetTravel[index], `${name} must carry actual moving motor traffic`).toBeGreaterThan(100);
    }
  }, 60_000);
});
