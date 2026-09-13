// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  BIKE_OFFSET, CITY_EXTENT, INTERSECTION_GATE, INTERSECTIONS, ROAD_HALF_WIDTH,
  SIDEWALK_HALF_WIDTH, SIDEWALK_OFFSET, STOP_LINE_OFFSET, STREET_BLOCKS, STREET_X, STREET_Z, TRAFFIC_ACTORS, VEHICLE_OFFSET,
} from '../content/streets';
import { ActorSimulation, type ActorState } from './actors';
import {
  CityTraffic, sampleTrafficRoute, SIDEWALK_ROUTES, TRAFFIC, TRAFFIC_LENGTHS, TRAFFIC_ROUTES,
  type TrafficRoute, type TrafficSegment,
} from './traffic';

const DT = TRAFFIC.maxStep;

function travel(from: number, to: number, length: number): number {
  return (to - from + length) % length;
}

function angleDifference(first: number, second: number): number {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
}

function actorRoute(index: number): TrafficRoute {
  if (index < 24) return TRAFFIC_ROUTES[index % 6];
  if (index < 36) return TRAFFIC_ROUTES[6 + (index - 24) % 6];
  return SIDEWALK_ROUTES[Math.floor((index - 36) / 3)];
}

function actorSegment(actor: ActorState, route: TrafficRoute): TrafficSegment {
  let index = 0;
  while (index < route.segments.length - 1 && actor.distance >= route.segments[index + 1].start) index += 1;
  return route.segments[index];
}

function halfLength(index: number): number {
  const type = TRAFFIC_ACTORS[index].vehicleType;
  return type ? TRAFFIC_LENGTHS[type] / 2 : 0.35;
}

function halfWidth(index: number): number {
  const kind = TRAFFIC_ACTORS[index].kind;
  return kind === 'pedestrian' ? 0.35 : kind === 'cyclist' ? 0.4 : kind === 'bus' ? 1.1 : 0.9;
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

  it('fixes the streets, protected lanes, eight peripheral blocks, and bounded manifest', () => {
    expect(STREET_X).toEqual([-60, -30, 30, 60]);
    expect(STREET_Z).toEqual([-54, -26, 26, 54]);
    expect(ROAD_HALF_WIDTH).toBe(5);
    expect(SIDEWALK_HALF_WIDTH).toBe(7);
    expect(BIKE_OFFSET).toBe(4);
    expect(CITY_EXTENT).toEqual({ x: 68, z: 62 });
    expect(INTERSECTIONS).toHaveLength(16);
    expect(new Set(INTERSECTIONS.map(({ id }) => id)).size).toBe(16);
    expect(STREET_BLOCKS).toHaveLength(8);
    expect(STREET_BLOCKS.some(({ id }) => id === 'block-1-1')).toBe(false);
    expect(TRAFFIC_ACTORS).toHaveLength(60);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'car')).toHaveLength(20);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'bus')).toHaveLength(4);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'cyclist')).toHaveLength(12);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian')).toHaveLength(24);
    expect(new Set(TRAFFIC_ACTORS.map(({ id }) => id)).size).toBe(60);
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
    expect(visited.size).toBe(16);
    expect([...lanes.values()].some((count) => count > 1)).toBe(true);
    expect(lanes.size).toBeGreaterThanOrEqual(40);
  });

  it('has continuous position and tangent at every link, turn, and closed seam', () => {
    const before = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const after = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const epsilon = 0.00001;
    for (const route of [...TRAFFIC_ROUTES, ...SIDEWALK_ROUTES]) {
      for (const segment of route.segments) {
        sampleTrafficRoute(route, segment.start - epsilon, before);
        sampleTrafficRoute(route, segment.start + epsilon, after);
        expect(Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z), route.id)
          .toBeLessThanOrEqual(epsilon * 2 + 1e-9);
        expect(angleDifference(before.heading, after.heading), route.id).toBeLessThanOrEqual(epsilon * 2 + 1e-9);
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
      const offset = route.id.startsWith('cycle') ? BIKE_OFFSET : VEHICLE_OFFSET;
      for (const segment of route.segments) {
        if (segment.kind !== 'link') continue;
        const center = INTERSECTIONS[segment.intersection];
        const signedOffset = (segment.x - center.x) * -segment.dz + (segment.z - center.z) * segment.dx;
        expect(signedOffset).toBeCloseTo(offset, 7);
      }
    }
  });
});

describe('CityTraffic', () => {
  it('retains actors, position objects, and authoritative signal states through integration', () => {
    const simulation = new ActorSimulation();
    const traffic = simulation.traffic;
    const actors = [...traffic.actors];
    const positions = actors.map(({ position }) => position);
    const signals = traffic.signals;
    const heads = [...signals];
    expect(traffic.actors.map(({ id }) => id)).toEqual(TRAFFIC_ACTORS.map(({ id }) => id));
    expect(signals.map(({ id }) => id)).toEqual(INTERSECTIONS.map(({ id }) => id));
    expect(simulation.actors.slice(8)).toEqual(actors);
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
    for (let seed = 0; seed < 128; seed += 1) {
      const traffic = new CityTraffic(seed * 7919);
      const occupied = new Set<string>();
      for (let index = 0; index < 36; index += 1) {
        const actor = traffic.actors[index];
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
      for (let index = 0; index < 36; index++) {
        const actor = traffic.actors[index];
        const segment = actorSegment(actor, actorRoute(index));
        if (actor.state !== 'waiting' || segment.kind !== 'link') continue;
        const front = actor.distance - segment.start + halfLength(index);
        const paintedBar = segment.length - (STOP_LINE_OFFSET - INTERSECTION_GATE);
        expect(front, actor.id).toBeLessThanOrEqual(paintedBar - TRAFFIC.stopBuffer + 1e-6);
        stopped.add(TRAFFIC_ACTORS[index].vehicleType!);
      }
    }
    expect(stopped).toEqual(new Set(['sedan', 'taxi', 'van', 'truck', 'bus', 'bicycle']));
  });

  it.each([0, 1, 4, 14, 42, 91, 2401, 0xffffffff])('keeps seed %s safe and live for at least ten simulated minutes', (seed) => {
    const traffic = new CityTraffic(seed);
    const actors = traffic.actors;
    const routes = actors.map((_, index) => actorRoute(index));
    const previous = actors.map((actor) => ({ ...actor.position, distance: actor.distance, speed: actor.speed, heading: actor.heading }));
    const segments = actors.map((actor, index) => actorSegment(actor, routes[index]));
    const totals = new Float64Array(actors.length);
    const idle = new Float64Array(actors.length);
    const longestIdle = new Float64Array(actors.length);
    const waits = new Uint32Array(36);
    const crossings = new Uint32Array(16);
    const stopLines = new Uint32Array(36);
    const phases = new Set<string>();
    let maxAcceleration = 0;
    let maxBraking = 0;
    for (let tick = 0; tick < 18_000; tick += 1) {
      traffic.step(DT);
      for (let index = 0; index < actors.length; index += 1) {
        const actor = actors[index];
        const before = previous[index];
        const movement = travel(before.distance, actor.distance, actor.routeLength);
        const displacement = Math.hypot(actor.position.x - before.x, actor.position.z - before.z);
        const topSpeed = index < 24 ? TRAFFIC.maxVehicleSpeed : index < 36 ? TRAFFIC.maxBicycleSpeed : 1.1;
        if (!Number.isFinite(actor.position.x + actor.position.z + actor.distance + actor.heading + actor.speed) ||
          actor.distance < 0 || actor.distance >= actor.routeLength || actor.position.y !== 0 ||
          displacement > topSpeed * DT + 1e-7 || movement > topSpeed * DT + 1e-7 ||
          angleDifference(before.heading, actor.heading) > 0.04 ||
          Math.abs(actor.position.x) > CITY_EXTENT.x || Math.abs(actor.position.z) > CITY_EXTENT.z) {
          throw new Error(`Discontinuous ${actor.id}, seed ${seed}, tick ${tick}`);
        }
        totals[index] += movement;
        idle[index] = movement > 0.0001 ? 0 : idle[index] + DT;
        longestIdle[index] = Math.max(longestIdle[index], idle[index]);
        segments[index] = actorSegment(actor, routes[index]);
        if (index < 36) {
          maxAcceleration = Math.max(maxAcceleration, (actor.speed - before.speed) / DT);
          maxBraking = Math.max(maxBraking, (before.speed - actor.speed) / DT);
          if (actor.state === 'waiting') {
            waits[index] += 1;
            const segment = segments[index];
            if (segment.kind === 'link') {
              const frontToLine = segment.start + segment.length - actor.distance - halfLength(index) -
                (STOP_LINE_OFFSET - INTERSECTION_GATE);
              if (frontToLine < TRAFFIC.stopBuffer - 1e-6) throw new Error(`${actor.id} stopped past its stop line`);
              if (Math.abs(frontToLine - TRAFFIC.stopBuffer) < 0.001) stopLines[index] += 1;
            } else {
              throw new Error(`${actor.id} queued inside a reserved intersection, seed ${seed}, tick ${tick}`);
            }
          }
        }
        before.x = actor.position.x;
        before.z = actor.position.z;
        before.distance = actor.distance;
        before.heading = actor.heading;
        before.speed = actor.speed;
      }
      for (let intersection = 0; intersection < INTERSECTIONS.length; intersection += 1) {
        const center = INTERSECTIONS[intersection];
        const phase = traffic.signals[intersection].phase;
        phases.add(phase);
        let occupied = -1;
        for (let index = 0; index < 36; index += 1) {
          const actor = actors[index];
          if (Math.abs(actor.position.x - center.x) > 11 || Math.abs(actor.position.z - center.z) > 11) continue;
          if (!overlap(actor.position.x, actor.position.z, actor.heading, halfLength(index), halfWidth(index),
            center.x, center.z, 0, INTERSECTION_GATE, INTERSECTION_GATE)) continue;
          if (occupied >= 0 || phase === 'pedestrians') {
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
          if (Math.abs(a.position.x - b.position.x) > 7 || Math.abs(a.position.z - b.position.z) > 7) continue;
          if (overlap(a.position.x, a.position.z, a.heading, halfLength(first), halfWidth(first),
            b.position.x, b.position.z, b.heading, halfLength(second), halfWidth(second))) {
            throw new Error(`Actor overlap ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
          }
          const sa = segments[first];
          const sb = segments[second];
          if (first < 36 && second < 36 && sa.kind === 'link' && sb.kind === 'link' && sa.lane === sb.lane) {
            const gap = Math.abs((a.distance - sa.start) - (b.distance - sb.start)) - halfLength(first) - halfLength(second);
            const required = first < 24 ? TRAFFIC.vehicleGap : TRAFFIC.bicycleGap;
            if (gap < required - 1e-6) {
              throw new Error(`Headway ${gap} ${a.id}/${b.id}, seed ${seed}, tick ${tick}`);
            }
          }
        }
      }
      if (actors.length !== 60 || traffic.signals.length !== 16) throw new Error('Unbounded population');
    }
    expect(traffic.elapsed).toBeCloseTo(600, 6);
    expect(phases).toEqual(new Set(['north-south', 'east-west', 'clearance', 'pedestrians']));
    expect(maxAcceleration).toBeLessThanOrEqual(TRAFFIC.acceleration + 1e-6);
    expect(maxBraking).toBeLessThanOrEqual(TRAFFIC.braking + 1e-4);
    for (let index = 0; index < actors.length; index += 1) {
      expect(totals[index] / actors[index].routeLength, `${actors[index].id} must complete a full circuit`).toBeGreaterThan(1);
      expect(longestIdle[index], `${actors[index].id} must never starve`).toBeLessThan(100);
      if (index < 36) {
        expect(waits[index], `${actors[index].id} must stop at a light`).toBeGreaterThan(0);
        expect(stopLines[index], `${actors[index].id} must stop with its bumper at a painted line`).toBeGreaterThan(0);
      }
    }
    for (let index = 0; index < crossings.length; index += 1) {
      expect(crossings[index], `${INTERSECTIONS[index].id} must carry traffic`).toBeGreaterThan(100);
    }
  }, 30_000);
});
