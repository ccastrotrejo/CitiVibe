// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INTERSECTIONS } from '../content/streets';
import { PERSON_SPACE } from '../content/people';
import { buildingFrontPoint, buildingFrontSpan } from './buildingFabric';
import { STREET_BUILDINGS } from './streetscape';
import { canWalkTo } from './parkVisitors';
import { StreetPedestrians } from './pedestrians';
import { SIDEWALK_WALKING_ROUTES, sampleTrafficRoute } from './traffic';
import { storefrontActivity } from './streetActivities';

describe('existing storefront destination', () => {
  it('has an actual display window, an off-line pocket and a landing-clear connection', () => {
    const stop = storefrontActivity(SIDEWALK_WALKING_ROUTES);
    const building = STREET_BUILDINGS.find(({ id }) => `${id}-window` === stop.destination.id)!;
    expect(building.storefront).not.toBeNull();
    expect(building.stoop).toBe(false);
    const pocket = buildingFrontPoint(building, Math.min(1.1, buildingFrontSpan(building) * 0.25), 1.05);
    expect(stop.destination.pocket.x).toBe(pocket.x);
    expect(stop.destination.pocket.z).toBe(pocket.z);
    const pose = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    const route = SIDEWALK_WALKING_ROUTES[stop.block][stop.lane];
    sampleTrafficRoute(route, stop.distance, pose);
    expect(pose.position.x).toBeCloseTo(stop.destination.entry.x, 8);
    expect(pose.position.z).toBeCloseTo(stop.destination.entry.z, 8);
    const link = route.segments.find(({ start, length }) => stop.distance >= start && stop.distance < start + length)!;
    expect(stop.distance - link.start).toBeGreaterThanOrEqual(5.8);
    expect(link.start + link.length - stop.distance).toBeGreaterThanOrEqual(5.8);
    expect(Math.hypot(pocket.x - pose.position.x, pocket.z - pose.position.z))
      .toBeGreaterThan(PERSON_SPACE.length / 2 + PERSON_SPACE.width / 2 + 0.1);
  });

  it('reaches, uses and leaves the reserved window with no overlaps or extra people', () => {
    const pedestrians = new StreetPedestrians(SIDEWALK_WALKING_ROUTES, 2401);
    const actors = [...pedestrians.actors];
    const positions = actors.map(({ position }) => position);
    const signals = INTERSECTIONS.map(({ id }) => ({ id, control: 'signal' as const, phase: 'clearance' as const, walk: false }));
    const seen = new Set<string>();
    let completed = false;
    for (let tick = 0; tick < 18_000 && !completed; tick++) {
      const before = actors.find(({ visit }) => visit?.destination.activity === 'window-shopping');
      pedestrians.step(1 / 30, signals);
      const visitor = actors.find(({ visit }) => visit?.destination.activity === 'window-shopping');
      if (before && !before.visit) completed = true;
      if (!visitor?.visit) continue;
      const visit = visitor.visit;
      seen.add(visit.phase);
      expect(canWalkTo(visitor, visitor.position, visitor.heading, actors), visitor.id).toBe(true);
      expect(pedestrians.activities.reserved(visit.destination.id)).toBe(true);
      if (visitor.activity === 'window-shopping') {
        expect(visitor.position.x).toBeCloseTo(visit.destination.pocket.x, 8);
        expect(visitor.position.z).toBeCloseTo(visit.destination.pocket.z, 8);
        expect(visitor.speed).toBe(0);
      }
      if (tick % 20 === 0) {
        const held = JSON.stringify(pedestrians);
        pedestrians.step(0, signals);
        expect(JSON.stringify(pedestrians)).toBe(held);
      }
    }
    expect(completed).toBe(true);
    for (const phase of ['approaching', 'using', 'departing']) expect(seen.has(phase)).toBe(true);
    expect(actors).toHaveLength(200);
    actors.forEach((actor, index) => {
      expect(pedestrians.actors[index]).toBe(actor);
      expect(actor.position).toBe(positions[index]);
    });
  }, 30_000);
});
