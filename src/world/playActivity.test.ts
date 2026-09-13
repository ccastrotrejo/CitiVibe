// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, IcosahedronGeometry, MeshBasicMaterial, type Object3D, Vector3 } from 'three';
import { createPersonProfile } from '../content/people';
import { PLAY_AREA, PLAY_PEOPLE, type PlayChild } from '../content/play';
import { RUNNER } from './locomotion';
import { buildPersonRig, type PersonArt } from './person';
import { PlayActivity, type PlayPersonRig } from './playActivity';

const art: PersonArt = {
  box: new BoxGeometry(), head: new IcosahedronGeometry(1), material: new MeshBasicMaterial(),
};
afterAll(() => { art.box.dispose(); art.head.dispose(); art.material.dispose(); });

function fixture() {
  const people: PlayPersonRig[] = PLAY_PEOPLE.map((definition) => {
    const group = new Group();
    group.name = definition.id;
    const rig = buildPersonRig(group, createPersonProfile(definition.id, definition.context), art);
    return { definition, group, rig };
  });
  const activity = new PlayActivity(people);
  return { people, activity };
}

function snapshot(people: readonly PlayPersonRig[]) {
  return people.map(({ group }) => {
    const poses: number[][] = [];
    group.traverse((part) => poses.push([...part.position.toArray(), ...part.quaternion.toArray(), ...part.scale.toArray()]));
    return poses;
  });
}

function transforms(group: Object3D): number[] {
  group.updateMatrixWorld(true);
  const values: number[] = [];
  group.traverse((part) => values.push(...part.matrixWorld.elements));
  return values;
}

describe('south meadow play', () => {
  it('casts six shorter children in three dephased opposite pairs and two adult guardians', () => {
    const { people } = fixture();
    const children = PLAY_PEOPLE.filter((person): person is PlayChild => person.context === 'play-child');
    const guardians = PLAY_PEOPLE.filter(({ context }) => context === 'play-guardian');
    expect(PLAY_PEOPLE).toHaveLength(8);
    expect(new Set(PLAY_PEOPLE.map(({ id }) => id)).size).toBe(8);
    expect(children).toHaveLength(6);
    expect(guardians).toHaveLength(2);
    expect([...new Set(children.map(({ x }) => x))]).toEqual([13, 18, 23]);
    expect(new Set(children.filter((_, index) => index % 2 === 0).map(({ phase }) => phase)).size).toBe(3);
    for (let index = 0; index < children.length; index += 2) {
      const first = children[index];
      const second = children[index + 1];
      expect(second).toMatchObject({ x: first.x, z: 69, radius: 0.9, speed: first.speed, direction: first.direction });
      expect(second.phase - first.phase).toBeCloseTo(Math.PI, 12);
    }
    const adultHeights = guardians.map(({ id, context }) => createPersonProfile(id, context).stature);
    for (const child of children) {
      const profile = createPersonProfile(child.id, child.context);
      expect(profile.ageGroup).toBe('child');
      expect(profile.stature).toBeGreaterThan(1.1);
      expect(profile.stature).toBeLessThan(Math.min(...adultHeights) - 0.1);
    }
    for (const guardian of guardians) {
      expect(createPersonProfile(guardian.id, guardian.context).age).toBeGreaterThanOrEqual(18);
    }
    const heights = people.map(({ group }) => new Box3().setFromObject(group).getSize(new Vector3()).y);
    expect(Math.max(...heights.slice(0, 6))).toBeLessThan(Math.min(...heights.slice(6)) - 0.1);
  });

  it.each([0, 0.45])('keeps complete bodies separated, bounded and grounded over two minutes at 30 Hz with %sm lift', (lift) => {
    const { people, activity } = fixture();
    activity.update(0, false, lift);
    const bounds = people.map(() => new Box3());
    const previous = people.map(({ group }) => group.position.clone());
    const min = previous.map((point) => point.clone());
    const max = previous.map((point) => point.clone());
    const peakSpeed = people.map(() => 0);
    const planted = people.map(() => 0);
    const airborne = people.map(() => 0);
    const foot = new Vector3();
    const sole = new Box3();
    let minimumGap = Infinity;
    const floor = PLAY_AREA.surfaceY + lift;
    for (let tick = 0; tick <= 120 * 30; tick += 1) {
      activity.update(tick / 30, false, lift);
      people.forEach(({ definition, group, rig }, index) => {
        const speed = group.position.distanceTo(previous[index]) * 30;
        peakSpeed[index] = Math.max(peakSpeed[index], speed);
        min[index].min(group.position);
        max[index].max(group.position);
        bounds[index].setFromObject(group);
        expect(bounds[index].min.x, definition.id).toBeGreaterThan(PLAY_AREA.minX);
        expect(bounds[index].max.x, definition.id).toBeLessThan(PLAY_AREA.maxX);
        expect(bounds[index].min.z, definition.id).toBeGreaterThan(PLAY_AREA.minZ);
        expect(bounds[index].max.z, definition.id).toBeLessThan(PLAY_AREA.maxZ);
        expect(group.position.y).toBe(floor);
        if (definition.context === 'play-child') {
          expect(Math.hypot(group.position.x - definition.x, group.position.z - definition.z)).toBeCloseTo(definition.radius, 10);
          if (tick > 0) {
            expect(speed).toBeGreaterThan(1.15);
            expect(speed).toBeLessThan(1.6);
          }
        } else {
          expect(speed).toBe(0);
        }
        let touching = 0;
        for (const { ankle } of rig.legs) {
          ankle.getWorldPosition(foot);
          sole.setFromObject(ankle);
          expect(sole.min.y).toBeGreaterThanOrEqual(floor - 1e-8);
          expect(foot.y).toBeLessThan(floor + 0.25);
          if (Math.abs(foot.y - floor) < 1e-8) touching += 1;
        }
        if (touching > 0) planted[index] += 1;
        else airborne[index] += 1;
        previous[index].copy(group.position);
      });
      for (let first = 0; first < people.length; first += 1) {
        for (let second = first + 1; second < people.length; second += 1) {
          const a = bounds[first];
          const b = bounds[second];
          const gap = Math.hypot(Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0),
            Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0));
          minimumGap = Math.min(minimumGap, gap);
          expect(a.intersectsBox(b), `${people[first].definition.id}/${people[second].definition.id}`).toBe(false);
        }
      }
      for (let first = 0; first < 6; first += 2) {
        expect(people[first].group.position.distanceTo(people[first + 1].group.position)).toBeCloseTo(1.8, 10);
      }
    }
    expect(minimumGap).toBeGreaterThan(0.65);
    people.forEach(({ definition }, index) => {
      expect(planted[index]).toBeGreaterThan(2000);
      if (definition.context === 'play-child') {
        expect(max[index].x - min[index].x).toBeGreaterThan(1.79);
        expect(max[index].z - min[index].z).toBeGreaterThan(1.79);
        expect(peakSpeed[index]).toBeGreaterThan(1.15);
        expect(airborne[index]).toBeGreaterThan(300);
      } else {
        expect(max[index]).toEqual(min[index]);
        expect(airborne[index]).toBe(0);
      }
    });
  }, 20_000);

  it('moves roots, hips, knees, arms and torsos while guardians keep a fixed stance', () => {
    const { people, activity } = fixture();
    const initial = snapshot(people);
    activity.update(0.23, false);
    const moved = snapshot(people);
    people.forEach(({ definition, group, rig }, index) => {
      expect(transforms(group).every(Number.isFinite)).toBe(true);
      if (definition.context === 'play-guardian') {
        expect(moved[index]).toEqual(initial[index]);
        return;
      }
      expect(moved[index][0]).not.toEqual(initial[index][0]);
      const before = [rig.pelvis.position.y, rig.torso.rotation.x, rig.torso.rotation.z,
        ...rig.legs.flatMap(({ hip, knee }) => [hip.rotation.x, knee.rotation.x]),
        ...rig.arms.map((arm) => arm.rotation.x)];
      activity.update(0.47, false);
      const after = [rig.pelvis.position.y, rig.torso.rotation.x, rig.torso.rotation.z,
        ...rig.legs.flatMap(({ hip, knee }) => [hip.rotation.x, knee.rotation.x]),
        ...rig.arms.map((arm) => arm.rotation.x)];
      expect(after.filter((value, part) => Math.abs(value - before[part]) > 1e-5).length).toBeGreaterThanOrEqual(7);
      activity.update(0.23, false);
    });
  });

  it('has continuous full-rig transforms and velocity across circuit and gait seams', () => {
    const { people, activity } = fixture();
    const epsilon = 1e-6;
    for (const person of people) {
      const { definition, group, rig } = person;
      if (definition.context !== 'play-child') continue;
      const period = Math.PI * 2 * definition.radius / definition.speed;
      const stridePeriod = RUNNER.stride * rig.scale! / definition.speed;
      for (const time of [period, period * 20, stridePeriod, stridePeriod * 30]) {
        activity.update(time - epsilon, false);
        const before = transforms(group);
        const rootBefore = group.position.clone();
        activity.update(time, false);
        const rootAt = group.position.clone();
        activity.update(time + epsilon, false);
        const after = transforms(group);
        expect(Math.max(...after.map((value, index) => Math.abs(value - before[index])))).toBeLessThan(0.0001);
        const velocityBefore = rootAt.clone().sub(rootBefore).divideScalar(epsilon);
        const velocityAfter = group.position.clone().sub(rootAt).divideScalar(epsilon);
        expect(velocityBefore.distanceTo(velocityAfter)).toBeLessThan(0.0001);
      }
    }
  });

  it('uses the exact zero-time still under reduced motion and restores retained samples without drift', () => {
    const { people, activity } = fixture();
    const initial = snapshot(people);
    for (const time of [1, 45.2, 120, 10000]) {
      activity.update(time, false);
      activity.update(time, true);
      expect(snapshot(people)).toEqual(initial);
    }
    activity.update(37.23, false, 0.3);
    const paused = snapshot(people);
    for (let draw = 0; draw < 50; draw += 1) activity.update(37.23, false, 0.3);
    expect(snapshot(people)).toEqual(paused);
    const rebuilt = fixture();
    rebuilt.activity.update(37.23, false, 0.3);
    expect(snapshot(rebuilt.people)).toEqual(paused);
    activity.update(120, false);
    activity.update(37.23, false, 0.3);
    expect(snapshot(people)).toEqual(paused);
    activity.update(37.23 + 1 / 30, false, 0.3);
    rebuilt.activity.update(37.23 + 1 / 30, false, 0.3);
    expect(snapshot(people)).toEqual(snapshot(rebuilt.people));
  });

  it('applies snow support once and removes it cleanly in moving and still samples', () => {
    const { people, activity } = fixture();
    const dry = fixture();
    for (const reducedMotion of [false, true]) {
      for (const time of [0, 0.1, 0.8, 30, 120]) {
        dry.activity.update(time, reducedMotion);
        const dryMatrices = dry.people.map(({ group }) => transforms(group));
        for (const lift of [0.2, 0.45, 0.45, 0, 0.1, 0]) {
          activity.update(time, reducedMotion, lift);
          people.forEach(({ group }, index) => {
            const raised = transforms(group);
            raised.forEach((value, element) => {
              expect(value).toBeCloseTo(dryMatrices[index][element] + (element % 16 === 13 ? lift : 0), 10);
            });
          });
        }
      }
    }
  });

  it('keeps poses finite even at very large finite retained times', () => {
    const { people, activity } = fixture();
    for (const time of [1e8, Number.MAX_SAFE_INTEGER, Number.MAX_VALUE]) {
      activity.update(time, false, 0.45);
      for (const { group } of people) expect(transforms(group).every(Number.isFinite)).toBe(true);
    }
  });

  it('rejects invalid times and snow lifts before changing any pose, including reduced motion', () => {
    const { people, activity } = fixture();
    activity.update(3.2, false);
    const valid = snapshot(people);
    for (const reducedMotion of [false, true]) {
      for (const time of [-1, NaN, Infinity, -Infinity]) {
        expect(() => activity.update(time, reducedMotion)).toThrow('Play time must be finite and nonnegative.');
      }
      for (const lift of [-0.001, 0.45001, NaN, Infinity, -Infinity]) {
        expect(() => activity.update(5, reducedMotion, lift)).toThrow('Play ground lift must be between 0 and 0.45 metres.');
      }
    }
    expect(snapshot(people)).toEqual(valid);
  });
});
