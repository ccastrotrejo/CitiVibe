// @vitest-environment node
import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { createPersonProfile, PERSON_SPACE, type PersonProfile } from '../content/people';
import { TRAFFIC_ACTORS } from '../content/streets';
import { ActorInstances } from './actorInstances';
import { poseNeutral, poseWalkerRig, RUNNER, strideLength, type WalkerRig } from './locomotion';
import { buildPersonRig, type PersonArt } from './person';
import { CityTraffic } from './traffic';

const art: PersonArt = {
  box: new THREE.BoxGeometry(), head: new THREE.IcosahedronGeometry(1), material: new THREE.MeshStandardMaterial(),
};
afterAll(() => { art.box.dispose(); art.head.dispose(); art.material.dispose(); });
function person(profile: PersonProfile) {
  const group = new THREE.Group();
  const rig = buildPersonRig(group, profile, art);
  poseNeutral(rig);
  return { group, rig };
}
function ankle(group: THREE.Group, rig: WalkerRig, index: 0 | 1) {
  group.updateMatrixWorld(true);
  return rig.legs[index].ankle.getWorldPosition(new THREE.Vector3());
}

describe('varied articulated people', () => {
  it('renders adult, teen and child silhouettes instead of metadata-only differences', () => {
    const profiles = Array.from({ length: 150 }, (_, index) => createPersonProfile(`neighbor-${index}`, 'street'));
    const ranges = new Map<string, number[]>();
    for (const profile of profiles) {
      const { group, rig } = person(profile);
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      if (!ranges.has(profile.ageGroup)) ranges.set(profile.ageGroup, []);
      ranges.get(profile.ageGroup)!.push(size.y);
      expect(size.x).toBeLessThan(0.78);
      expect(size.y).toBeGreaterThan(1);
      expect(size.y).toBeLessThan(2.5);
      for (const leg of [0, 1] as const) expect(ankle(group, rig, leg).y).toBeCloseTo(0, 8);
    }
    const average = (group: string) => ranges.get(group)!.reduce((a, b) => a + b, 0) / ranges.get(group)!.length;
    expect(average('child')).toBeLessThan(average('adult') - 0.3);
    expect(average('teen')).toBeGreaterThan(average('child') + 0.2);
  });

  it('keeps planted feet locked to world distance for every age and at snow height', () => {
    for (const context of ['street', 'play-child', 'runner'] as const) for (let index = 0; index < 20; index++) {
      const profile = createPersonProfile(`contact-${index}`, context);
      const { group, rig } = person(profile);
      const running = context === 'runner';
      const stride = (running ? RUNNER.stride : strideLength(profile.pace / rig.scale!)) * rig.scale!;
      for (const support of [0, 0.35]) {
        const points: THREE.Vector3[] = [];
        for (let phase = 0.02; phase < (running ? 0.38 : 0.58); phase += 0.02) {
          const distance = stride * phase;
          group.position.set(0, support, distance);
          poseWalkerRig(rig, { distance, speed: profile.pace, blend: 1, reducedMotion: false, running });
          points.push(ankle(group, rig, 0));
        }
        for (const point of points) {
          expect(point.y).toBeCloseTo(support, 7);
          expect(point.z).toBeCloseTo(points[0].z, 7);
        }
      }
    }
  });

  it('gives every runner shorts, exposed legs, trainers and bent arms', () => {
    for (let index = 1; index <= 18; index++) {
      const { group, rig } = person(createPersonProfile(`runner-${index}`, 'runner'));
      const named: string[] = [];
      group.traverse((part) => named.push(part.name));
      for (const name of ['Shorts hem', 'Bare lower leg', 'Running shoe', 'Sport sock', 'Contrasting trainer sole']) {
        expect(named.filter((entry) => entry === name)).toHaveLength(2);
      }
      expect(rig.arms[0].getObjectByName('Forearm and hand')!.position.z).toBeGreaterThan(0.1);
      poseWalkerRig(rig, { distance: RUNNER.stride * rig.scale! * 0.45, speed: 2.5, blend: 1, reducedMotion: false, running: true });
      expect(ankle(group, rig, 0).y).toBeGreaterThan(0.03);
      expect(ankle(group, rig, 1).y).toBeGreaterThan(0.03);
    }
  });

  it('fits clothed bodies and moving limbs inside the shared pedestrian safety envelope', () => {
    for (const context of ['street', 'runner'] as const) for (let index = 1; index <= 144; index++) {
      const profile = createPersonProfile(`city-walker-${index}`, context);
      const { group, rig } = person(profile);
      for (let phase = 0; phase < 1; phase += 0.1) {
        const running = context === 'runner';
        const stride = running ? RUNNER.stride : strideLength(profile.pace / rig.scale!);
        poseWalkerRig(rig, { distance: phase * stride * rig.scale!, speed: profile.pace,
          blend: 1, reducedMotion: false, running });
        const bounds = new THREE.Box3().setFromObject(group);
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), profile.id).toBeLessThan(PERSON_SPACE.width / 2);
        expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)), profile.id).toBeLessThan(PERSON_SPACE.length / 2);
      }
    }
  });

  it('builds workwear, hair, hats, glasses and bags as actual geometry', () => {
    const names = new Set<string>();
    for (const { id, kind } of TRAFFIC_ACTORS) {
      if (kind !== 'pedestrian') continue;
      person(createPersonProfile(id, 'street')).group.traverse((part) => names.add(part.name));
    }
    for (const name of ['Tie', 'Jacket lapel', 'Hood', 'Apron bib', 'Overall bib', 'fire-helmet', 'hard-hat',
      'police-cap', 'Reflective vest stripe', 'Radio', 'Glasses lens', 'Bob haircut', 'ponytail', 'bun', 'Curls',
      'Backpack', 'briefcase', 'satchel', 'tote', 'Long clothing hem']) expect(names.has(name), name).toBe(true);
  });

  it('uploads all clothing and skin colors in two shared batches and retains them after posing', () => {
    const people = Array.from({ length: 80 }, (_, index) => person(createPersonProfile(`batch-${index}`, 'street')));
    const batches = new ActorInstances(people.map(({ group }) => group));
    try {
      expect(batches.group.children).toHaveLength(2);
      const mesh = batches.group.children[0] as THREE.InstancedMesh;
      expect(mesh.material).toBe(art.material);
      const colors = mesh.instanceColor!.array.slice();
      const sources: THREE.Mesh[] = [];
      for (const { group } of people) group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry === mesh.geometry) sources.push(object);
      });
      const color = new THREE.Color();
      sources.forEach((source, index) => {
        mesh.getColorAt(index, color);
        expect(color.r).toBeCloseTo(source.userData.instanceColor.r, 6);
        expect(color.g).toBeCloseTo(source.userData.instanceColor.g, 6);
        expect(color.b).toBeCloseTo(source.userData.instanceColor.b, 6);
      });
      for (const { rig } of people) poseWalkerRig(rig, { distance: 2.4, speed: 1.3, blend: 1, reducedMotion: false });
      batches.update();
      expect(mesh.instanceColor!.array).toEqual(colors);
    } finally { batches.dispose(); }
  });

  it('uses profile pace in actual sidewalk movement, rather than just an appearance label', () => {
    const traffic = new CityTraffic();
    for (let tick = 0; tick < 30; tick++) traffic.step(1 / 30);
    const speeds = { commute: [] as number[], tour: [] as number[] };
    for (const actor of traffic.actors) {
      if (actor.kind !== 'pedestrian') continue;
      const profile = createPersonProfile(actor.id, 'street');
      expect(actor.speed).toBeCloseTo(profile.pace, 8);
      if (profile.purpose === 'commute' || profile.purpose === 'tour') speeds[profile.purpose].push(actor.speed);
    }
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(average(speeds.commute) - average(speeds.tour)).toBeGreaterThan(0.3);
  });
});
