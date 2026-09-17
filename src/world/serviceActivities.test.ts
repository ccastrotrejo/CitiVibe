// @vitest-environment node
import { Box3, BoxGeometry, CylinderGeometry, DodecahedronGeometry, Group, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BIKE_SHARE_POCKETS, JUNIPER_ACCESS_CROSSING } from '../content/bikeShare';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import { INTERSECTIONS } from '../content/streets';
import { LOADING_STOP, type TrafficServiceState } from '../content/transitService';
import { buildStreetscape, type StreetscapeBuilder } from './streetscape';
import { StreetPedestrians } from './pedestrians';
import { buildPersonRig } from './person';
import { poseWalkerRig, WALKER } from './locomotion';
import { canWalkTo } from './parkVisitors';
import { CityTraffic, sampleTrafficRoute, SIDEWALK_WALKING_ROUTES } from './traffic';
import { serviceActivities, serviceVisitAllowed, serviceVisitReady, SERVICE_VISITOR_ID, SERVICE_VISIT_ID, SERVICE_VISIT_POCKET } from './serviceActivities';

const DT = 1 / 30;
const services = (): TrafficServiceState[] => [{
  id: LOADING_STOP.id, actorId: LOADING_STOP.actorId, phase: 'dwelling', remaining: 16, completedCycles: 0,
}];

describe('retained service-associated sidewalk visit', () => {
  it('connects both directions while clearing the actual low facade, bike reservations and landing hold lines', () => {
    const stops = serviceActivities(SIDEWALK_WALKING_ROUTES);
    expect(stops).toHaveLength(2);
    expect(SERVICE_VISIT_POCKET).toEqual({ x: LOADING_STOP.x, y: 0, z: 104.25 });
    expect(createPersonProfile(SERVICE_VISITOR_ID, 'street').age).toBeGreaterThanOrEqual(18);
    const box = new BoxGeometry();
    const cylinder = new CylinderGeometry(1, 1, 1, 10);
    const crown = new DodecahedronGeometry(1);
    const material = new MeshStandardMaterial();
    const palette: StreetscapeBuilder['palette'] = {
      sand: material, stone: material, paving: material, road: material, line: material,
      cream: material, clay: material, teal: material, roof: material, copper: material,
      copperEdge: material, glass: material, wood: material, leaf: material, leafLight: material,
      water: material, bus: material, rubber: material, taxi: material, facade: material,
    };
    const obstacles: Box3[] = [];
    const transform = new Object3D();
    const add: StreetscapeBuilder['add'] = (shape, _surface, position, scale, rotation = [0, 0, 0]) => {
      transform.position.set(...position); transform.scale.set(...scale); transform.rotation.set(...rotation);
      transform.updateMatrix();
      if (!shape.boundingBox) shape.computeBoundingBox();
      const bounds = shape.boundingBox!.clone().applyMatrix4(transform.matrix);
      if (bounds.max.y > 0.1 && bounds.min.y < 2.4 && bounds.max.x > SERVICE_VISIT_POCKET.x - 1 &&
        bounds.min.x < SERVICE_VISIT_POCKET.x + 1 && bounds.max.z > 100 &&
        bounds.min.z < SERVICE_VISIT_POCKET.z + 2) obstacles.push(bounds);
    };
    const art = buildStreetscape({ box, cylinder, crown, palette, add,
      block: (surface, x, y, z, width, height, depth, yaw = 0) =>
        add(box, surface, [x, y, z], [width, height, depth], [0, yaw, 0]),
    });
    try {
      expect(obstacles.length).toBeGreaterThan(0);
      for (const stop of stops) {
        expect(stop.destination.pocket).toBe(SERVICE_VISIT_POCKET);
        const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
        const route = SIDEWALK_WALKING_ROUTES[stop.block][stop.lane];
        sampleTrafficRoute(route, stop.distance, pose);
        expect(pose.position.x).toBeCloseTo(stop.destination.entry.x, 8);
        expect(pose.position.z).toBeCloseTo(stop.destination.entry.z, 8);
        const link = route.segments.find((segment) => stop.distance >= segment.start &&
          stop.distance <= segment.start + segment.length)!;
        expect(Math.min(stop.distance - link.start, link.start + link.length - stop.distance) - 2.1 -
          PERSON_SPACE.length / 2).toBeGreaterThan(2);
        for (let z = pose.position.z; z <= SERVICE_VISIT_POCKET.z + 0.01; z += 0.01) {
          const centerZ = Math.min(z, SERVICE_VISIT_POCKET.z);
          const body = new Box3(new Vector3(SERVICE_VISIT_POCKET.x - 0.44, 0.1, centerZ - 0.64),
            new Vector3(SERVICE_VISIT_POCKET.x + 0.44, 2.1, centerZ + 0.64));
          expect(obstacles.some((bounds) => bounds.intersectsBox(body))).toBe(false);
          for (const bounds of [...Object.values(BIKE_SHARE_POCKETS), JUNIPER_ACCESS_CROSSING]) {
            expect(body.min.x < bounds.maxX && body.max.x > bounds.minX &&
              body.min.z < bounds.maxZ && body.max.z > bounds.minZ).toBe(false);
          }
          expect(body.min.z).toBeGreaterThan(100);
        }
      }
      // The actual planted stance also clears the wall throughout the turn toward the curb.
      const group = new Group();
      const rig = buildPersonRig(group, createPersonProfile(SERVICE_VISITOR_ID, 'street'),
        { box, head: crown, material });
      group.position.set(SERVICE_VISIT_POCKET.x, 0, SERVICE_VISIT_POCKET.z);
      for (const reducedMotion of [false, true]) {
        poseWalkerRig(rig, { activity: 'resting', distance: 12, speed: 0, blend: 1, reducedMotion });
        for (let heading = 0; heading <= Math.PI + 0.01; heading += 0.1) {
          group.rotation.y = heading;
          group.updateMatrixWorld(true);
          const bounds = new Box3().setFromObject(group);
          expect(obstacles.some((obstacle) => obstacle.intersectsBox(bounds))).toBe(false);
          for (const leg of rig.legs) expect(leg.knee.localToWorld(new Vector3(0, -WALKER.shank, 0)).y).toBeCloseTo(0, 8);
        }
      }
    } finally {
      art.dispose(); box.dispose(); cylinder.dispose(); crown.dispose(); material.dispose();
    }
  });

  it('requires a sufficiently long parked service and never treats an approach as arrival', () => {
    const { destination } = serviceActivities(SIDEWALK_WALKING_ROUTES)[0];
    const state = services();
    expect(serviceVisitAllowed(destination, [])).toBe(false);
    expect(serviceVisitReady(destination, [])).toBe(false);
    for (const phase of ['circulating', 'approaching', 'dwelling', 'departing'] as const) {
      state[0].phase = phase;
      expect(serviceVisitAllowed(destination, state)).toBe(true);
      expect(serviceVisitReady(destination, state)).toBe(phase === 'dwelling');
      expect(serviceVisitAllowed(destination, state, 'using')).toBe(phase === 'dwelling');
    }
    state[0].phase = 'dwelling'; state[0].remaining = 7.9;
    expect(serviceVisitReady(destination, state)).toBe(false);
    expect(serviceVisitAllowed(destination, state)).toBe(true);
    state[0].remaining = 8;
    expect(serviceVisitReady(destination, state)).toBe(true);
  });

  it.each([0, 2401])('physically approaches, pauses and merges with retained identities in seed %s', (seed) => {
    const pedestrians = new StreetPedestrians(SIDEWALK_WALKING_ROUTES, seed);
    const state = services();
    const signals = INTERSECTIONS.map(({ id }) => ({ id, control: 'signal' as const, phase: 'clearance' as const, walk: false }));
    const actor = pedestrians.actors.find(({ id }) => id === SERVICE_VISITOR_ID)!;
    const identities = pedestrians.actors.slice();
    const position = actor.position;
    const stop = serviceActivities(SIDEWALK_WALKING_ROUTES)[seed & 1];
    actor.distance = stop.distance - 4;
    sampleTrafficRoute(SIDEWALK_WALKING_ROUTES[stop.block][stop.lane], actor.distance, actor);
    const phases = new Set<string>();
    let completed = false;
    for (let tick = 0; tick < 1_200; tick++) {
      const previous = { ...actor.position };
      const hadVisit = !!actor.visit;
      const distance = actor.travelDistance!;
      pedestrians.step(DT, signals, undefined, state);
      state[0].remaining = Math.max(0, state[0].remaining - DT);
      if (state[0].remaining === 0) state[0].phase = 'departing';
      expect(Math.hypot(actor.position.x - previous.x, actor.position.z - previous.z)).toBeLessThanOrEqual(actor.speed * DT + 1e-7);
      expect(actor.travelDistance! - distance).toBeCloseTo(actor.speed * DT, 8);
      if (actor.visit) {
        expect(actor.visit.destination.id).toBe(SERVICE_VISIT_ID);
        phases.add(actor.visit.phase);
        if (actor.activity === 'resting') phases.add('resting');
        expect(canWalkTo(actor, actor.position, actor.heading, pedestrians.actors)).toBe(true);
        expect(pedestrians.actors.filter(({ visit }) => visit?.destination.id === SERVICE_VISIT_ID)).toHaveLength(1);
        const snapshot = JSON.stringify(actor);
        pedestrians.step(0, signals, undefined, []);
        expect(JSON.stringify(actor)).toBe(snapshot);
      }
      if (hadVisit && !actor.visit) { completed = true; break; }
    }
    expect(completed).toBe(true);
    expect(phases).toEqual(new Set(['approaching', 'awaiting', 'using', 'resting', 'departing']));
    expect(pedestrians.activities.reserved(SERVICE_VISIT_ID)).toBe(false);
    expect(actor.position).toBe(position);
    expect(pedestrians.actors).toHaveLength(200);
    pedestrians.actors.forEach((actor, index) => expect(actor).toBe(identities[index]));
  });

  it.each(['van-departure', 'wet-weather'])('cancels %s without a teleport, stranded reservation or phantom pause', (cause) => {
    const pedestrians = new StreetPedestrians(SIDEWALK_WALKING_ROUTES, 2401);
    const state = services();
    const signals = INTERSECTIONS.map(({ id }) => ({ id, control: 'signal' as const, phase: 'clearance' as const, walk: false }));
    const actor = pedestrians.actors.find(({ id }) => id === SERVICE_VISITOR_ID)!;
    const stop = serviceActivities(SIDEWALK_WALKING_ROUTES)[1];
    actor.distance = stop.distance;
    sampleTrafficRoute(SIDEWALK_WALKING_ROUTES[stop.block][stop.lane], actor.distance, actor);
    let cancelled = false;
    for (let tick = 0; tick < 900; tick++) {
      if (actor.visit?.phase === 'using') {
        if (cause === 'van-departure') state[0].phase = 'departing';
        else actor.weather = { equipment: 'umbrella', umbrellaOpen: 1, cautious: false, pace: 0.8 };
      }
      const before = { ...actor.position };
      pedestrians.step(DT, signals, undefined, state);
      cancelled ||= !!actor.visit?.cancelled;
      expect(Math.hypot(actor.position.x - before.x, actor.position.z - before.z)).toBeLessThanOrEqual(actor.speed * DT + 1e-7);
      expect(canWalkTo(actor, actor.position, actor.heading, pedestrians.actors)).toBe(true);
      if (cancelled) expect(actor.activity).not.toBe('resting');
      if (cancelled && !actor.visit) break;
    }
    expect(cancelled).toBe(true);
    expect(actor.visit).toBeUndefined();
    expect(pedestrians.activities.reserved(SERVICE_VISIT_ID)).toBe(false);
  });

  it.each([0, 2401])('naturally encounters the live service without repositioning either actor: seed %s', (seed) => {
    const traffic = new CityTraffic(seed);
    const actor = traffic.pedestrians.actors.find(({ id }) => id === SERVICE_VISITOR_ID)!;
    const van = traffic.actors.find(({ id }) => id === LOADING_STOP.actorId)!;
    const position = actor.position;
    const phases = new Set<string>();
    let completed = false;
    for (let tick = 0; tick < 90_000; tick++) {
      const hadVisit = !!actor.visit;
      traffic.step(DT);
      if (actor.visit) {
        const service = traffic.services.find(({ id }) => id === LOADING_STOP.id)!;
        phases.add(actor.visit.phase);
        if (actor.visit.phase === 'using' && actor.activity === 'resting') {
          phases.add('resting');
          expect(service.phase).toBe('dwelling');
          expect(van.speed).toBe(0);
          expect(van.position.x).toBeCloseTo(LOADING_STOP.x, 5);
          expect(van.position.z).toBeCloseTo(LOADING_STOP.z, 5);
          if (actor.visit.elapsed === 0) expect(service.remaining).toBeGreaterThanOrEqual(8);
        }
        expect(actor.visit.destination.id).toBe(SERVICE_VISIT_ID);
        expect(actor.position.z - PERSON_SPACE.length / 2).toBeGreaterThan(100);
        expect(canWalkTo(actor, actor.position, actor.heading, traffic.pedestrians.actors)).toBe(true);
        const held = JSON.stringify([actor, traffic.services]);
        traffic.step(0);
        expect(JSON.stringify([actor, traffic.services])).toBe(held);
      }
      if (hadVisit && !actor.visit && phases.has('using')) { completed = true; break; }
    }
    expect(completed).toBe(true);
    for (const phase of ['approaching', 'using', 'resting', 'departing']) expect(phases.has(phase)).toBe(true);
    expect(actor.position).toBe(position);
    expect(traffic.pedestrians.actors).toHaveLength(200);
  }, 60_000);
});
