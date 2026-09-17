// @vitest-environment node
import { BoxGeometry, Group, IcosahedronGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CIVIC_SERVICES } from '../content/civicServices';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import { STREET_BLOCKS } from '../content/streets';
import { STREET_BENCHES, benchAccessPocket } from '../content/streetFurniture';
import { civicActivities, CIVIC_WORK_ALONG } from './civicActivities';
import { buildingFrontPoint, buildingFrontSpan } from './buildingFabric';
import { STREET_BUILDINGS } from './streetscape';
import { CityTraffic, sampleTrafficRoute, SIDEWALK_WALKING_ROUTES } from './traffic';
import { canWalkTo } from './parkVisitors';
import { buildPersonRig } from './person';
import { poseWalkerRig, WALKER } from './locomotion';

describe('retained civic staff activity', () => {
  it('connects both sidewalk directions to three exclusive, door-clear workplace pockets', () => {
    const stops = civicActivities(SIDEWALK_WALKING_ROUTES);
    expect(stops).toHaveLength(6);
    expect(new Set(stops.map(({ destination }) => destination.id)).size).toBe(3);
    for (const service of CIVIC_SERVICES) {
      const building = STREET_BUILDINGS.find(({ id }) => id === service.buildingId)!;
      const along = CIVIC_WORK_ALONG[service.kind];
      expect(Math.abs(along - service.entry.along) - PERSON_SPACE.width / 2)
        .toBeGreaterThan(service.entry.width / 2 + 0.25);
      if (service.kind === 'fire-station') {
        const span = buildingFrontSpan(building);
        expect(along - PERSON_SPACE.width / 2).toBeGreaterThan(-span * 0.2 + Math.min(4.4, span * 0.48) / 2 + 0.23);
      }
      const point = buildingFrontPoint(building, along, 1.05);
      for (const stop of stops.filter(({ destination }) => destination.id === `${service.id}-staff`)) {
        expect(stop.destination.pocket).toEqual({ ...point, y: 0 });
        const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
        sampleTrafficRoute(SIDEWALK_WALKING_ROUTES[stop.block][stop.lane], stop.distance, pose);
        expect(Math.hypot(pose.position.x - stop.destination.entry.x, pose.position.z - stop.destination.entry.z)).toBeLessThan(1e-7);
        expect(Math.hypot(point.x - pose.position.x, point.z - pose.position.z)).toBeGreaterThan(1.15);
      }
    }
  });

  it('keeps staff approaches and turning bodies clear of relocated benches and their users', () => {
    const radius = Math.hypot(PERSON_SPACE.width, PERSON_SPACE.length) / 2 + 0.04;
    for (const { destination } of civicActivities(SIDEWALK_WALKING_ROUTES)) {
      const { entry, pocket } = destination;
      const swept = {
        minX: Math.min(entry.x, pocket.x) - radius, maxX: Math.max(entry.x, pocket.x) + radius,
        minZ: Math.min(entry.z, pocket.z) - radius, maxZ: Math.max(entry.z, pocket.z) + radius,
      };
      for (const bench of STREET_BENCHES) {
        const { seat, approach, companion } = benchAccessPocket(bench, 2.65);
        for (const area of [seat, approach, companion]) {
          expect(swept.maxX < area.minX || swept.minX > area.maxX ||
            swept.maxZ < area.minZ || swept.minZ > area.maxZ, `${destination.id}/${bench.id}`).toBe(true);
        }
      }
    }
  });

  it.each([0, 2401])('reuses all twelve staff at their facilities with actual work, pause, departure and safe merges: seed %s', (seed) => {
    const traffic = new CityTraffic(seed);
    const people = traffic.pedestrians.actors;
    const staff = CIVIC_SERVICES.flatMap((service) => service.staff.map(({ id }) => ({
      service, actor: people.find((actor) => actor.id === id)!,
      phases: new Set<string>(), completed: false,
    })));
    const positions = staff.map(({ actor }) => actor.position);
    const previous = staff.map(({ actor }) => ({ x: actor.position.x, z: actor.position.z,
      distance: actor.travelDistance!, visiting: false }));
    for (let tick = 0; tick < 27_000; tick++) {
      traffic.step(1 / 30);
      const occupied = new Set<string>();
      staff.forEach(({ actor, service, phases }, index) => {
        const before = previous[index];
        const moved = actor.travelDistance! - before.distance;
        if (Math.abs(moved - actor.speed / 30) > 1e-7 ||
          Math.hypot(actor.position.x - before.x, actor.position.z - before.z) > moved + 1e-7) {
          throw new Error(`Discontinuous civic trip: ${actor.id}`);
        }
        const block = STREET_BLOCKS.find(({ id }) => id === service.blockId)!;
        if (actor.position.x < block.minX + 5 || actor.position.x > block.maxX - 5 ||
          actor.position.z < block.minZ + 5 || actor.position.z > block.maxZ - 5) {
          throw new Error(`Staff left their connected workplace block: ${actor.id}`);
        }
        if (before.visiting && !actor.visit) staff[index].completed = true;
        if (actor.visit) {
          const visit = actor.visit;
          expect(visit.destination.id).toBe(`${service.id}-staff`);
          if (occupied.has(service.id)) throw new Error(`Double workplace reservation: ${service.id}`);
          occupied.add(service.id);
          if (!canWalkTo(actor, actor.position, actor.heading, people)) throw new Error(`Civic body overlap: ${actor.id}`);
          phases.add(visit.phase);
          if (actor.activity === 'civic-duty' || actor.activity === 'resting') phases.add(actor.activity);
          if (!phases.has(`retained-${visit.phase}`)) {
            const held = JSON.stringify(actor);
            traffic.step(0);
            expect(JSON.stringify(actor)).toBe(held);
            expect(traffic.pedestrians.activities.reserved(visit.destination.id)).toBe(true);
            phases.add(`retained-${visit.phase}`);
          }
        }
        Object.assign(before, { x: actor.position.x, z: actor.position.z, distance: actor.travelDistance!, visiting: !!actor.visit });
      });
    }
    expect(people).toHaveLength(200);
    staff.forEach(({ actor, phases, completed }, index) => {
      expect(actor.position).toBe(positions[index]);
      expect(completed, actor.id).toBe(true);
      for (const phase of ['approaching', 'using', 'departing', 'civic-duty', 'resting']) {
        expect(phases.has(phase), `${actor.id}/${phase}`).toBe(true);
      }
    });
  }, 60_000);

  it.each([false, true])('grounds every employee during work and pause, reduced motion=%s', (reducedMotion) => {
    const art = { box: new BoxGeometry(), head: new IcosahedronGeometry(), material: new MeshBasicMaterial() };
    try {
      for (const { id } of CIVIC_SERVICES.flatMap(({ staff }) => staff)) {
        const group = new Group();
        const rig = buildPersonRig(group, createPersonProfile(id, 'street'), art);
        for (const activity of ['civic-duty', 'resting'] as const) {
          poseWalkerRig(rig, { activity, distance: 137, speed: 0, blend: 1, activityTime: 1, reducedMotion });
          group.updateMatrixWorld(true);
          for (const leg of rig.legs) {
            expect(leg.knee.localToWorld(new Vector3(0, -WALKER.shank, 0)).y).toBeCloseTo(0, 8);
          }
          expect(rig.torso.rotation.y === 0).toBe(reducedMotion || activity === 'resting');
        }
      }
    } finally {
      art.box.dispose(); art.head.dispose(); art.material.dispose();
    }
  });

  it('cancels outdoor duty in wet weather without stranding staff or bypassing merge clearance', () => {
    const traffic = new CityTraffic(91);
    const staff = CIVIC_SERVICES.flatMap(({ staff }) => staff)
      .map(({ id }) => traffic.pedestrians.actors.find((actor) => actor.id === id)!);
    const idle = staff.map(() => 0);
    let cancellations = 0;
    for (let tick = 0; tick < 18_000; tick++) {
      const wet = Math.floor(tick / 173) % 2 === 1;
      staff.forEach((actor) => {
        actor.weather = { equipment: wet ? 'umbrella' : 'dry', umbrellaOpen: wet ? 1 : 0, cautious: false, pace: wet ? 0.8 : 1 };
      });
      traffic.step(1 / 30);
      staff.forEach((actor, index) => {
        if (actor.visit?.cancelled) cancellations++;
        idle[index] = actor.speed === 0 ? idle[index] + 1 / 30 : 0;
        if (idle[index] > 25) throw new Error(`Weather-stranded civic staff: ${actor.id}/${actor.visit?.phase}`);
        if (actor.visit && !canWalkTo(actor, actor.position, actor.heading, traffic.pedestrians.actors)) {
          throw new Error(`Wet civic merge overlap: ${actor.id}`);
        }
        if (wet) expect(actor.activity).not.toBe('civic-duty');
      });
    }
    expect(cancellations).toBeGreaterThan(0);
  }, 60_000);
});
