// @vitest-environment node
import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { createPersonProfile, createWeatherTraits, PERSON_SPACE, type PersonContext } from '../content/people';
import { ActorInstances } from './actorInstances';
import { Locomotion, poseNeutral, poseWalkerRig, RUNNER } from './locomotion';
import type { ActorState } from './actors';
import { buildPersonRig, type PersonArt } from './person';
import { applyPersonWeather } from './personWeatherArt';
import type { PersonWeatherState, WeatherEquipment } from './peopleWeather';

const art: PersonArt = {
  box: new THREE.BoxGeometry(), head: new THREE.IcosahedronGeometry(1), material: new THREE.MeshStandardMaterial(),
};
afterAll(() => { art.box.dispose(); art.head.dispose(); art.material.dispose(); });
const weather = (equipment: WeatherEquipment, umbrellaOpen = equipment === 'umbrella' ? 1 : 0): PersonWeatherState =>
  ({ equipment, umbrellaOpen, pace: 1, cautious: equipment !== 'dry' });
function person(id: string, context: PersonContext = 'street') {
  const group = new THREE.Group();
  const profile = createPersonProfile(id, context);
  const rig = buildPersonRig(group, profile, art);
  group.userData.rig = rig;
  poseNeutral(rig);
  return { group, profile, rig };
}
function matrices(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const values: number[][] = [];
  group.traverse((part) => { if (part instanceof THREE.Mesh) values.push(part.matrixWorld.toArray()); });
  return values;
}
function shown(group: THREE.Group, name: string) {
  group.updateMatrixWorld(true);
  const part = group.getObjectByName(name)!;
  return Math.abs(part.matrixWorld.determinant()) > 1e-10;
}

describe('weather-aware procedural people', () => {
  it('preallocates weather gear only for simulated walkers and picnic neighbors', () => {
    for (const context of ['street', 'park', 'runner', 'resting'] as const) {
      expect(person(`weather-${context}`, context).rig.weatherArt).toBeDefined();
    }
    for (const context of ['cyclist', 'basketball', 'pickleball', 'play-child', 'play-guardian'] as const) {
      expect(person(`weather-${context}`, context).rig.weatherArt).toBeUndefined();
    }
  });

  it('restores identical dry matrices and is idempotent on paused weather changes', () => {
    for (const context of ['street', 'runner', 'resting'] as const) {
      const { group, rig } = person(`restore-${context}`, context);
      poseWalkerRig(rig, { distance: 1.7, speed: 1, blend: 1, reducedMotion: false, running: context === 'runner' });
      const dry = matrices(group);
      for (const equipment of ['umbrella', 'raincoat', 'winter', 'dry'] as const) {
        applyPersonWeather(rig, weather(equipment));
        const first = matrices(group);
        applyPersonWeather(rig, weather(equipment));
        expect(matrices(group)).toEqual(first);
      }
      expect(matrices(group)).toEqual(dry);
    }
  });

  it('shows jackets, seeded winter headwear, scarves and covered runner legs without hiding safety helmets', () => {
    for (let index = 0; index < 40; index++) {
      const { group, rig, profile } = person(`winter-${index}`, 'runner');
      applyPersonWeather(rig, weather('winter'));
      expect(shown(group, 'Weather coat')).toBe(true);
      expect(shown(group, 'Winter scarf')).toBe(true);
      expect(shown(group, 'Winter trouser shank')).toBe(true);
      expect(shown(group, 'Bare lower leg')).toBe(false);
      expect(shown(group, 'Winter beanie')).toBe(createWeatherTraits(profile.id).winterHat === 'beanie');
      expect(shown(group, 'Weather hood')).toBe(createWeatherTraits(profile.id).winterHat === 'hood');
      if (profile.hat !== 'none') expect(shown(group, profile.hat)).toBe(false);
      applyPersonWeather(rig, weather('raincoat'));
      expect(shown(group, 'Weather hood')).toBe(true);
      expect(shown(group, 'Winter scarf')).toBe(false);
      applyPersonWeather(rig, weather('dry'));
      expect(shown(group, 'Weather coat')).toBe(false);
      if (profile.hat !== 'none') expect(shown(group, profile.hat)).toBe(true);
    }
    for (const hat of ['hard-hat', 'fire-helmet', 'cycle-helmet'] as const) {
      const group = new THREE.Group();
      const rig = buildPersonRig(group, { ...createPersonProfile('helmet-neighbor', 'street'), hat }, art);
      poseNeutral(rig);
      for (const equipment of ['raincoat', 'winter'] as const) {
        applyPersonWeather(rig, weather(equipment));
        expect(shown(group, hat)).toBe(true);
        expect(shown(group, 'Weather hood')).toBe(false);
        expect(shown(group, 'Winter beanie')).toBe(false);
      }
    }
  });

  it('keeps open canopies above existing hats and hair, including tall workwear hats', () => {
    for (let index = 0; index < 200; index++) {
      const { group, rig, profile } = person(`hat-clearance-${index}`);
      applyPersonWeather(rig, weather('umbrella'));
      group.updateMatrixWorld(true);
      const head = new THREE.Box3().setFromObject(group.getObjectByName('Head and headwear')!);
      const canopy = new THREE.Box3().setFromObject(rig.weatherArt!.canopy);
      expect(canopy.min.y, `${profile.id} ${profile.hat}`).toBeGreaterThan(head.max.y + 0.005);
    }
  });

  it('keeps the umbrella shaft on the holding hand through gait and turns', () => {
    for (const context of ['street', 'runner', 'resting'] as const) {
      const { group, rig } = person(`grip-${context}`, context);
      for (let phase = 0; phase <= 1; phase += 0.1) {
        group.rotation.y = phase * Math.PI;
        poseWalkerRig(rig, { distance: phase * 1.3, speed: 1.5, blend: 1,
          running: context === 'runner', reducedMotion: false, weather: weather('umbrella') });
        group.updateMatrixWorld(true);
        const shaft = group.getObjectByName('Umbrella shaft')!;
        const endpoint = shaft.localToWorld(new THREE.Vector3(0, -0.5, 0));
        const hand = rig.arms[1].localToWorld(new THREE.Vector3(...(context === 'runner'
          ? [0, -0.27, 0.23] as const : [0, -0.465, 0] as const)));
        expect(endpoint.distanceTo(hand)).toBeLessThan(1e-7);
      }
    }
  });

  it('fits wet, winter and sitting poses inside existing body and overhead clearances', () => {
    for (const context of ['street', 'runner', 'resting'] as const) for (let index = 0; index < 200; index++) {
      const { group, rig, profile } = person(`envelope-${index}`, context);
      for (const equipment of ['umbrella', 'raincoat', 'winter'] as const) for (const phase of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
        poseWalkerRig(rig, { distance: phase * (rig.scale ?? 1), speed: profile.pace, blend: 1,
          running: context === 'runner', reducedMotion: false,
          sitting: context === 'resting' ? phase : undefined });
        const dryMinY = new THREE.Box3().setFromObject(group).min.y;
        applyPersonWeather(rig, weather(equipment));
        const bounds = new THREE.Box3().setFromObject(group);
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), `${profile.id} ${equipment} x`).toBeLessThan(PERSON_SPACE.width / 2);
        expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)), `${profile.id} ${equipment} z`).toBeLessThan(PERSON_SPACE.length / 2);
        expect(bounds.max.y).toBeLessThanOrEqual(2.5);
        expect(bounds.min.y, `${profile.id} ${equipment} does not worsen existing shank-box contact`).toBeGreaterThanOrEqual(dryMinY - 1e-7);
      }
    }
  });

  it('uses only the existing two batches and collapses optional gear despite invisible source meshes', () => {
    const people = Array.from({ length: 30 }, (_, index) => person(`batch-weather-${index}`));
    const batches = new ActorInstances(people.map(({ group }) => group));
    try {
      expect(batches.group.children).toHaveLength(2);
      for (const { group, rig } of people) {
        applyPersonWeather(rig, weather('umbrella'));
        expect(shown(group, 'Umbrella shaft')).toBe(true);
        applyPersonWeather(rig, weather('umbrella', 0));
        expect(shown(group, 'Umbrella shaft')).toBe(false);
        applyPersonWeather(rig, weather('winter'));
        expect(shown(group, 'Weather coat')).toBe(true);
        applyPersonWeather(rig, weather('dry'));
        expect(shown(group, 'Weather coat')).toBe(false);
        group.traverse((part) => {
          if (part instanceof THREE.Mesh) {
            expect([art.box, art.head]).toContain(part.geometry);
            expect(part.material).toBe(art.material);
            expect(part.visible).toBe(false);
          }
        });
      }
      batches.update();
    } finally { batches.dispose(); }
  });

  it('restores retained seated/weather state without advancing locomotion', () => {
    const { group, rig } = person('picnic-retained', 'resting');
    const groups = new Map([['picnic-retained', group]]);
    const actor: ActorState = { id: 'picnic-retained', kind: 'pedestrian', position: { x: 0, y: 0, z: 0 },
      heading: 0, state: 'waiting', distance: 0, speed: 0, routeLength: 1, sitting: 0.6, weather: weather('winter') };
    const locomotion = new Locomotion();
    locomotion.update([actor], groups, 1 / 30, false);
    expect(rig.pelvis.position.y).toBeLessThan(0.7);
    expect(shown(group, 'Weather coat')).toBe(true);
    const retained = matrices(group);
    poseNeutral(rig);
    locomotion.restore([actor], groups, false);
    expect(matrices(group)).toEqual(retained);
  });

  it('uses grounded walking only for cautious runners and restores that same gait', () => {
    for (const cautious of [true, false, undefined]) {
      const { group, rig } = person('cautious-runner', 'runner');
      const groups = new Map([['cautious-runner', group]]);
      const actor: ActorState = { id: 'cautious-runner', kind: 'pedestrian', gait: 'run',
        position: { x: 0, y: 0, z: 0 }, heading: 0, state: 'moving', speed: 2.5, routeLength: 10,
        distance: RUNNER.stride * rig.scale! * 0.45,
        weather: cautious === undefined ? undefined : { ...weather('winter'), cautious } };
      const locomotion = new Locomotion();
      locomotion.update([actor], groups, 1 / 8, false);
      group.updateMatrixWorld(true);
      const feet = rig.legs.map((leg) => leg.ankle.getWorldPosition(new THREE.Vector3()).y);
      if (cautious) expect(Math.min(...feet.map(Math.abs))).toBeLessThan(1e-7);
      else for (const foot of feet) expect(foot).toBeGreaterThan(0.03);
      const retained = matrices(group);
      poseNeutral(rig);
      locomotion.restore([actor], groups, false);
      expect(matrices(group)).toEqual(retained);
    }
  });

  it('grounds direct cautious runner poses and preserves them through restore', () => {
    const { group, rig } = person('runner-1', 'runner');
    const state = weather('winter');
    const pose = { distance: 0.62, speed: 1.6, blend: 1, running: true, reducedMotion: false, weather: state };
    poseWalkerRig(rig, pose);
    group.updateMatrixWorld(true);
    const feet = rig.legs.map((leg) => leg.ankle.getWorldPosition(new THREE.Vector3()).y);
    expect(Math.min(...feet.map(Math.abs))).toBeLessThan(1e-7);
    const grounded = matrices(group);
    const actor: ActorState = { id: 'runner-1', kind: 'pedestrian', gait: 'run',
      position: { x: 0, y: 0, z: 0 }, heading: 0, state: 'moving', speed: pose.speed,
      routeLength: 10, distance: pose.distance, weather: state };
    const groups = new Map([['runner-1', group]]);
    const locomotion = new Locomotion();
    locomotion.update([actor], groups, 1 / 8, false);
    poseNeutral(rig);
    locomotion.restore([actor], groups, false);
    expect(matrices(group)).toEqual(grounded);
    poseWalkerRig(rig, { ...pose, weather: { ...state, cautious: false } });
    expect(matrices(group)).not.toEqual(grounded);
  });
});
