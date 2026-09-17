// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ActorState } from './actors';
import { ACTIVITY_BLOCKED_TIMEOUT, DestinationActivities, type ActivityDestination } from './destinationActivities';

const DT = 1 / 30;
const destination: ActivityDestination = {
  id: 'bench-pocket', activity: 'reading', entry: { x: 0, y: 0, z: 0 }, pocket: { x: 3.3, y: 0, z: 0 },
  heading: Math.PI / 2, duration: 2,
};
const person = (id: string, x = 0, z = 0): ActorState => ({
  id, kind: 'pedestrian', position: { x, y: 0, z }, heading: 0, state: 'moving',
  distance: 10, travelDistance: 20, routeLength: 100, speed: 1,
});

describe('retained destination reservations', () => {
  it('actually approaches, uses and departs without changing route progress or identity', () => {
    const activities = new DestinationActivities();
    const actor = person('existing-walker');
    const position = actor.position;
    expect(activities.begin(actor, destination, [actor])).toBe(true);
    const phases = new Set<string>();
    for (let tick = 0; tick < 900 && actor.visit; tick++) {
      const before = { ...actor.position };
      const distance = actor.travelDistance!;
      phases.add(actor.visit.phase);
      activities.step(actor, DT, 1, [actor]);
      expect(Math.hypot(actor.position.x - before.x, actor.position.z - before.z)).toBeCloseTo(actor.speed * DT, 8);
      expect(actor.travelDistance! - distance).toBeCloseTo(actor.speed * DT, 8);
      if (actor.activity === 'reading') {
        expect(actor.position.x).toBeCloseTo(destination.pocket.x, 8);
        expect(actor.position.z).toBeCloseTo(destination.pocket.z, 8);
        expect(actor.sitting).toBeUndefined();
        expect(actor.state).toBe('dwelling');
        expect(actor.heading).toBe(destination.heading);
      }
      if (actor.visit?.phase === 'merging') {
        phases.add('merging');
        expect(activities.reserved(destination.id)).toBe(true);
        activities.finish(actor);
      }
    }
    expect(phases).toEqual(new Set(['approaching', 'using', 'departing', 'merging']));
    expect(actor.position).toBe(position);
    expect(actor.position.x).toBeCloseTo(0, 8);
    expect(actor.distance).toBe(10);
    expect(actor.travelDistance).toBeCloseTo(26.6, 8);
    expect(actor.id).toBe('existing-walker');
    expect(activities.reserved(destination.id)).toBe(false);
  });

  it('exclusively reserves a pocket and refuses an occupied approach without a phantom visit', () => {
    const activities = new DestinationActivities();
    const first = person('first');
    const second = person('second');
    expect(activities.begin(first, destination, [first, person('blocking', 2.5)])).toBe(false);
    expect(first.visit).toBeUndefined();
    expect(activities.begin(first, destination, [first])).toBe(true);
    expect(activities.begin(second, destination, [second])).toBe(false);
    expect(activities.finish(first)).toBe(false);
    expect(activities.reserved(destination.id)).toBe(true);
  });

  it('clears cancelled approaches or reverses blocked ones physically and retains ownership until merge', () => {
    for (const weather of [false, true]) {
      const activities = new DestinationActivities();
      const actor = person('existing');
      activities.begin(actor, destination, [actor]);
      for (let tick = 0; tick < 30; tick++) activities.step(actor, DT, 1, [actor]);
      const obstacle = person('other', actor.position.x + 1.25);
      for (let tick = 0; tick < (ACTIVITY_BLOCKED_TIMEOUT + 2) / DT; tick++) {
        const previous = actor.position.x;
        activities.step(actor, DT, 1, weather ? [actor] : [actor, obstacle], !weather);
        expect(Math.abs(actor.position.x - previous)).toBeLessThanOrEqual(DT + 1e-7);
        expect(actor.activity).not.toBe('reading');
      }
      expect(actor.visit?.cancelled).toBe(true);
      expect(actor.visit?.phase).toBe('merging');
      expect(actor.position.x).toBeCloseTo(0, 8);
      expect(activities.reserved(destination.id)).toBe(true);
      activities.finish(actor);
      expect(activities.reserved(destination.id)).toBe(false);
    }
  });

  it('finishes clearing the walking channel on cancellation before waiting for a drained return', () => {
    const activities = new DestinationActivities();
    const actor = person('cancelled-in-walking-channel');
    activities.begin(actor, destination, [actor]);
    for (let tick = 0; tick < 30; tick++) activities.step(actor, DT, 1, [actor]);
    const interrupted = actor.position.x;
    for (let tick = 0; tick < 150; tick++) {
      activities.step(actor, DT, 1, [actor], false, false);
      expect(actor.position.x).toBeGreaterThanOrEqual(interrupted);
      expect(actor.activity).not.toBe('reading');
    }
    expect(actor.position.x).toBeCloseTo(destination.pocket.x, 8);
    expect(actor.visit).toMatchObject({ phase: 'departing', cancelled: true, departureReady: false });
    expect(activities.reserved(destination.id)).toBe(true);
    for (let tick = 0; tick < 150; tick++) activities.step(actor, DT, 1, [actor], false, true);
    expect(actor.visit?.phase).toBe('merging');
    expect(actor.position.x).toBeCloseTo(destination.entry.x, 8);
    expect(activities.finish(actor)).toBe(true);
  });

  it('freezes all approach/use/depart timers on zero-time redraws and resumes exactly', () => {
    const activities = new DestinationActivities();
    const actor = person('retained');
    activities.begin(actor, destination, [actor]);
    for (let tick = 0; tick < 300; tick++) {
      activities.step(actor, DT, 1, [actor]);
      const before = JSON.stringify(actor);
      for (let redraw = 0; redraw < 3; redraw++) activities.step(actor, 0, 1, [actor], false);
      expect(JSON.stringify(actor)).toBe(before);
    }
  });

  it('waits rather than overlapping a newly blocked departure and keeps the pocket reserved', () => {
    const activities = new DestinationActivities();
    const actor = person('existing');
    activities.begin(actor, destination, [actor]);
    while (actor.visit?.phase !== 'using') activities.step(actor, DT, 1, [actor]);
    activities.cancel(actor);
    const blocker = person('passing-neighbor', 2);
    for (let tick = 0; tick < 900; tick++) {
      activities.step(actor, DT, 1, [actor, blocker]);
      expect(actor.position.x - blocker.position.x).toBeGreaterThanOrEqual(1.02 - 1e-7);
    }
    expect(actor.visit?.phase).toBe('departing');
    expect(actor.state).toBe('waiting');
    expect(activities.reserved(destination.id)).toBe(true);
    for (let tick = 0; tick < 150; tick++) activities.step(actor, DT, 1, [actor]);
    expect(actor.visit?.phase).toBe('merging');
    expect(activities.finish(actor)).toBe(true);
  });

  it('retains a bounded off-flow readiness wait without falsely completing the requested activity', () => {
    for (const becomesReady of [false, true]) {
      const activities = new DestinationActivities();
      const actor = person('existing');
      const waitingDestination = { ...destination, waitBeforeUse: 3 };
      activities.begin(actor, waitingDestination, [actor]);
      while (actor.visit?.phase !== 'awaiting') activities.step(actor, DT, 1, [actor], true, true, false);
      const arrival = { ...actor.position };
      for (let tick = 0; tick < 45; tick++) {
        activities.step(actor, DT, 1, [actor], true, true, false);
        expect(actor.visit?.phase).toBe('awaiting');
        expect(actor.activity).not.toBe('reading');
        expect(actor.position).toEqual(arrival);
        const held = JSON.stringify(actor);
        activities.step(actor, 0, 1, [actor], true, true, true);
        expect(JSON.stringify(actor)).toBe(held);
      }
      let used = false;
      for (let tick = 0; tick < 300; tick++) {
        activities.step(actor, DT, 1, [actor], true, true, becomesReady);
        used ||= actor.activity === 'reading';
        activities.finish(actor);
      }
      expect(used).toBe(becomesReady);
      expect(actor.visit).toBeUndefined();
      expect(activities.reserved(destination.id)).toBe(false);
      expect(actor.position.x).toBeCloseTo(destination.entry.x, 8);
    }
  });
});
