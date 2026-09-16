import * as THREE from 'three';
import { createWeatherTraits, type PersonProfile } from '../content/people';
import type { WalkerRig } from './locomotion';
import type { PersonWeatherState } from './peopleWeather';

type Triple = readonly [number, number, number];
type AddPart = (parent: THREE.Object3D, name: string, color: string, position: Triple, size: Triple, rounded?: boolean) => THREE.Mesh;
interface CoveredPart { object: THREE.Object3D; scale: THREE.Vector3 }

export interface PersonWeatherRig {
  coat: THREE.Object3D;
  hood: THREE.Object3D;
  beanie: THREE.Object3D;
  scarf: THREE.Object3D;
  sleeves: THREE.Object3D[];
  trousers: THREE.Object3D[];
  umbrella: THREE.Object3D;
  canopy: THREE.Object3D;
  shaft?: THREE.Mesh;
  clothes: CoveredPart[];
  headwear: CoveredPart[];
  bareLegs: CoveredPart[];
  bodyScale: THREE.Vector3;
  winterHat: 'beanie' | 'hood';
  safetyHelmet: boolean;
  armSwing: number;
  hand: THREE.Vector3;
  tip: THREE.Vector3;
  direction: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);
const covered = (objects: THREE.Object3D[]): CoveredPart[] => objects.map((object) => ({ object, scale: object.scale.clone() }));
function showParts(parts: CoveredPart[], show: boolean): void {
  for (const { object, scale } of parts) object.scale.copy(scale).multiplyScalar(show ? 1 : 0);
}

/** Preallocate low-poly equipment with the person's two existing shared geometries/material. */
export function buildPersonWeather(rig: WalkerRig, profile: PersonProfile, head: THREE.Object3D, add: AddPart): PersonWeatherRig | undefined {
  if (!['street', 'park', 'runner', 'resting'].includes(profile.context)) return undefined;
  const root = rig.pelvis.parent!;
  const optional = (parent: THREE.Object3D) => {
    const group = new THREE.Object3D();
    group.scale.setScalar(0);
    parent.add(group);
    return group;
  };
  const clothes = covered(rig.torso.children.filter((part) => part instanceof THREE.Mesh &&
    !['Neck', 'Backpack', 'Backpack strap', 'Bag strap', profile.bag].includes(part.name)));
  const headwear = covered(head.children.filter((part) => part instanceof THREE.Mesh &&
    !['Face', 'Glasses bridge', 'Glasses lens'].includes(part.name)));
  for (const arm of rig.arms) clothes.push(...covered(arm.children.filter((part) => part.name === 'Sleeve')));
  const coat = optional(rig.torso);
  add(coat, 'Weather coat', profile.top, [0, 0.17, 0.0075], [0.415, 0.63, 0.3]);
  const running = profile.context === 'runner';
  const traits = createWeatherTraits(profile.id);
  const sleeves: THREE.Object3D[] = [];
  const trousers: THREE.Object3D[] = [];
  const bareLegs: CoveredPart[] = [];
  for (const arm of rig.arms) {
    const sleeve = optional(arm);
    sleeves.push(sleeve);
    add(sleeve, 'Weather sleeve', profile.top, [0, running ? -0.125 : -0.215, 0],
      [0.14, running ? 0.25 : 0.43, 0.175]);
    if (running) add(sleeve, 'Weather forearm sleeve', profile.top, [0, -0.27, 0.075], [0.13, 0.14, 0.21]);
  }
  const hood = optional(head);
  add(hood, 'Weather hood', profile.top, [0, 0.065, -0.065], [0.235, 0.285, 0.22], true);
  const beanie = optional(head);
  add(beanie, 'Winter beanie', profile.accent, [0, 0.2, -0.01], [0.21, 0.145, 0.215], true);
  const scarf = optional(rig.torso);
  add(scarf, 'Winter scarf', profile.accent, [0, 0.49, 0.015], [0.25, 0.105, 0.22]);
  add(scarf, 'Scarf end', profile.accent, [0.07, 0.36, 0.157], [0.07, 0.22, 0.025]);
  if (profile.shorts) for (const leg of rig.legs) {
    bareLegs.push(...covered([...leg.hip.children, ...leg.knee.children].filter((part) =>
      ['Exposed thigh', 'Shorts hem', 'Bare lower leg'].includes(part.name))));
    const thigh = optional(leg.hip);
    const shank = optional(leg.knee);
    add(thigh, 'Winter trouser thigh', profile.bottom, [0, -0.22, 0], [0.175, 0.44, 0.195]);
    add(shank, 'Winter trouser shank', profile.bottom, [0, -0.22, 0], [0.13, 0.44, 0.15]);
    trousers.push(thigh, shank);
  }
  const umbrella = optional(root);
  const canopy = new THREE.Object3D();
  umbrella.add(canopy);
  let shaft: THREE.Mesh | undefined;
  if (!running && traits.rainProtection === 'umbrella') {
    for (let panel = 0; panel < 6; panel++) {
      const angle = panel * Math.PI / 3;
      const facet = add(canopy, 'Umbrella canopy panel', panel % 2 ? profile.top : profile.accent,
        [Math.sin(angle) * 0.18, -0.06, Math.cos(angle) * 0.18], [0.31, 0.025, 0.285]);
      facet.rotation.set(0, angle, 0);
      facet.rotateX(0.38);
    }
    add(canopy, 'Umbrella crown', profile.accent, [0, -0.008, 0], [0.23, 0.035, 0.23]);
    shaft = add(umbrella, 'Umbrella shaft', '#46515a', [0, 0, 0], [0.016, 1, 0.016]);
  }
  return { coat, hood, beanie, scarf, sleeves, trousers, umbrella, canopy, shaft, clothes, headwear, bareLegs,
    bodyScale: root.scale.clone(), winterHat: traits.winterHat,
    safetyHelmet: ['hard-hat', 'fire-helmet', 'cycle-helmet'].includes(profile.hat),
    armSwing: 0, hand: new THREE.Vector3(), tip: new THREE.Vector3(), direction: new THREE.Vector3() };
}

/** Apply retained equipment after a pose, including paused changes; never advance simulation or allocate meshes. */
export function applyPersonWeather(rig: WalkerRig, state?: PersonWeatherState): void {
  const art = rig.weatherArt;
  if (!art) return;
  const winter = state?.equipment === 'winter';
  const jacket = winter || state?.equipment === 'raincoat';
  const hood = jacket && !art.safetyHelmet && (!winter || art.winterHat === 'hood');
  const beanie = winter && !art.safetyHelmet && art.winterHat === 'beanie';
  art.coat.scale.setScalar(jacket ? 1 : 0);
  art.hood.scale.setScalar(hood ? 1 : 0);
  art.beanie.scale.setScalar(beanie ? 1 : 0);
  art.scarf.scale.setScalar(winter ? 1 : 0);
  for (const sleeve of art.sleeves) sleeve.scale.setScalar(jacket ? 1 : 0);
  for (const trouser of art.trousers) trouser.scale.setScalar(winter ? 1 : 0);
  showParts(art.clothes, !jacket);
  showParts(art.headwear, !hood && !beanie);
  showParts(art.bareLegs, !winter);
  const open = art.shaft && state?.equipment === 'umbrella' ? Math.min(1, Math.max(0, state.umbrellaOpen)) : 0;
  art.umbrella.scale.setScalar(open > 0 ? 1 : 0);
  rig.arms[1].rotation.x = open > 0 ? -0.5 : art.armSwing;
  if (open === 0 || !art.shaft) return;
  // Anchor in rig coordinates, not world coordinates: actor turns cannot detach the shaft.
  art.hand.set(0, -0.465, 0)
    .applyEuler(rig.arms[1].rotation).add(rig.arms[1].position)
    .applyEuler(rig.torso.rotation).add(rig.torso.position)
    .applyEuler(rig.pelvis.rotation).add(rig.pelvis.position);
  art.tip.set(0, rig.pelvis.position.y + 1.345, 0);
  art.canopy.position.copy(art.tip);
  // The canopy keeps a fixed narrow physical width even on the tallest/broadest neighbor.
  art.canopy.scale.set((0.16 + 0.84 * open) / art.bodyScale.x, 1 / art.bodyScale.y,
    (0.16 + 0.84 * open) / art.bodyScale.z);
  art.direction.subVectors(art.tip, art.hand);
  art.shaft.scale.set(0.016, art.direction.length(), 0.016);
  art.shaft.position.copy(art.hand).addScaledVector(art.direction, 0.5);
  art.shaft.quaternion.setFromUnitVectors(UP, art.direction.normalize());
}
