import * as THREE from 'three';
import type { PersonProfile } from '../content/people';
import { WALKER, type LegRig, type WalkerRig } from './locomotion';

export interface PersonArt {
  box: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Shared neutral material + per-instance color: more people never means a material per outfit. */
export function personPart(
  art: PersonArt, parent: THREE.Object3D, name: string, color: string,
  position: readonly [number, number, number], size: readonly [number, number, number],
  rounded = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(rounded ? art.head : art.box, art.material);
  mesh.name = name;
  mesh.userData.instanceColor = new THREE.Color(color);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  parent.add(mesh);
  return mesh;
}

/** Original low-poly clothes attach to the same contact-correct skeleton at every age. */
export function buildPersonRig(group: THREE.Group, profile: PersonProfile, art: PersonArt): WalkerRig {
  const court = profile.context === 'basketball' || profile.context === 'pickleball';
  const scale = court ? 1 : profile.stature / 1.7;
  const root = new THREE.Object3D();
  root.name = 'Person stature and build';
  root.scale.set(scale * profile.build, scale, scale);
  group.add(root);
  group.userData.person = profile;
  const add = (parent: THREE.Object3D, name: string, color: string, p: readonly [number, number, number],
    s: readonly [number, number, number], rounded = false) => personPart(art, parent, name, color, p, s, rounded);
  const pelvis = new THREE.Object3D();
  root.add(pelvis);
  const torso = new THREE.Object3D();
  pelvis.add(torso);
  const sport = profile.outfit === 'sport';
  const running = profile.context === 'runner';
  const shortSleeve = sport || ['casual', 'scrubs', 'overalls'].includes(profile.outfit);
  const boots = profile.outfit === 'fire-gear' || (profile.outfit === 'hi-vis' && profile.purpose === 'commute');
  const buildLeg = (): LegRig => {
    const hip = new THREE.Object3D();
    add(hip, profile.shorts ? 'Exposed thigh' : 'Trouser thigh', profile.shorts ? profile.skin : profile.bottom,
      [0, -WALKER.thigh / 2, 0], WALKER.thighSize);
    if (profile.shorts) add(hip, 'Shorts hem', profile.bottom, [0, -0.11, 0], [0.17, 0.23, 0.19]);
    const knee = new THREE.Object3D();
    knee.position.y = -WALKER.thigh;
    hip.add(knee);
    add(knee, profile.shorts ? 'Bare lower leg' : 'Trouser shank', profile.shorts ? profile.skin : profile.bottom,
      [0, -WALKER.shank / 2, 0], WALKER.shankSize);
    const ankle = new THREE.Object3D();
    ankle.position.y = -WALKER.shank;
    knee.add(ankle);
    add(ankle, sport ? 'Running shoe' : 'Shoe', profile.shoes,
      [0, WALKER.footSize[1] / 2, WALKER.footFwd], WALKER.footSize);
    if (boots) add(ankle, 'Work boot shaft', profile.shoes, [0, 0.15, 0], [0.145, 0.2, 0.17]);
    if (sport) {
      add(ankle, 'Sport sock', '#e9e7d9', [0, 0.12, 0], [0.135, 0.12, 0.155]);
      add(ankle, 'Contrasting trainer sole', profile.accent, [0, 0.018, WALKER.footFwd], [0.155, 0.036, 0.27]);
    }
    if (profile.outfit === 'fire-gear') add(knee, 'Reflective trouser band', '#e1d572', [0, -0.29, 0], [0.145, 0.055, 0.165]);
    return { hip, knee, ankle };
  };
  const legs: [LegRig, LegRig] = [buildLeg(), buildLeg()];
  add(torso, 'Shirt', profile.top, [0, WALKER.torsoOffset, 0], WALKER.torsoSize);
  add(torso, 'Neck', profile.skin, [0, 0.49, 0], [0.12, 0.12, 0.13]);
  const head = new THREE.Object3D();
  head.name = 'Head and headwear';
  head.position.y = WALKER.headOffset;
  if (profile.ageGroup === 'child') head.scale.setScalar(1.13);
  torso.add(head);
  add(head, 'Face', profile.skin, [0, 0, 0], WALKER.headScale, true);
  if (profile.hair !== 'bald') {
    add(head, 'Hair crown', profile.hairColor, [0, 0.115, -0.015], [0.187, 0.125, 0.18], true);
    if (profile.hair === 'bob') add(head, 'Bob haircut', profile.hairColor, [0, -0.02, -0.12], [0.35, 0.26, 0.13]);
    if (profile.hair === 'ponytail' || profile.hair === 'bun') {
      add(head, profile.hair, profile.hairColor, [0, 0.035, -0.2],
        profile.hair === 'bun' ? [0.095, 0.09, 0.08] : [0.075, 0.2, 0.08], true);
    }
    if (profile.hair === 'curls') {
      for (const side of [-1, 1]) add(head, 'Curls', profile.hairColor, [side * 0.13, 0.05, -0.035], [0.085, 0.12, 0.135], true);
    }
  }
  if (profile.glasses) {
    add(head, 'Glasses bridge', '#303b40', [0, 0.015, 0.167], [0.28, 0.024, 0.027]);
    for (const side of [-1, 1]) add(head, 'Glasses lens', '#4b6570', [side * 0.075, 0, 0.17], [0.09, 0.064, 0.023]);
  }
  if (profile.hat !== 'none') {
    const safety = ['hard-hat', 'fire-helmet'].includes(profile.hat);
    const color = safety ? '#e7bc50' : profile.hat === 'police-cap' ? profile.top :
      profile.hat === 'chef-hat' ? '#f1e9d6' : profile.accent;
    add(head, profile.hat, color, [0, profile.hat === 'chef-hat' ? 0.3 : 0.19, 0],
      profile.hat === 'chef-hat' ? [0.19, 0.22, 0.18] : [0.205, 0.13, 0.205], true);
    if (profile.hat !== 'beanie' && profile.hat !== 'chef-hat') {
      const brimmed = profile.hat === 'sun-hat' || profile.hat === 'brimmed' || safety;
      add(head, 'Hat brim', color, [0, 0.14, brimmed ? 0 : 0.17], [brimmed ? 0.49 : 0.32, 0.035, brimmed ? 0.45 : 0.24]);
    }
  }
  const arms: [THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D()];
  [-1, 1].forEach((side, index) => {
    const arm = arms[index];
    arm.position.set(side * WALKER.shoulderHalf, WALKER.shoulderY, 0);
    torso.add(arm);
    add(arm, 'Sleeve', profile.top, [0, shortSleeve ? -0.11 : -0.22, 0],
      [0.12, shortSleeve ? 0.22 : 0.44, 0.15]);
    add(arm, 'Forearm and hand', profile.skin, running ? [0, -0.27, 0.12] :
      [0, shortSleeve ? -0.355 : -0.465, 0], running ? [0.11, 0.12, 0.3] :
        [0.105, shortSleeve ? 0.29 : 0.07, 0.125]);
    legs[index].hip.position.x = side * WALKER.hipHalf;
    pelvis.add(legs[index].hip);
  });
  if (profile.outfit === 'suit' || profile.outfit === 'office') {
    add(torso, 'Shirt inset', '#e9dfcd', [0, 0.3, 0.126], [0.13, 0.3, 0.014]);
    for (const side of [-1, 1]) {
      const lapel = add(torso, 'Jacket lapel', profile.accent, [side * 0.075, 0.32, 0.14], [0.045, 0.27, 0.02]);
      lapel.rotation.z = side * 0.22;
    }
    if (profile.outfit === 'suit') add(torso, 'Tie', profile.accent, [0, 0.28, 0.143], [0.033, 0.24, 0.02]);
  } else if (profile.outfit === 'hoodie') {
    add(torso, 'Hood', profile.top, [0, 0.49, -0.12], [0.21, 0.15, 0.14], true);
    add(torso, 'Kangaroo pocket', profile.accent, [0, 0.1, 0.132], [0.23, 0.09, 0.02]);
  } else if (profile.outfit === 'coat' || profile.outfit === 'tunic' || profile.outfit === 'apron') {
    add(torso, 'Long clothing hem', profile.outfit === 'apron' ? profile.accent : profile.top,
      [0, -0.04, 0.055], [0.4, 0.21, 0.19]);
    if (profile.outfit === 'apron') add(torso, 'Apron bib', profile.accent, [0, 0.21, 0.132], [0.27, 0.36, 0.025]);
  } else if (profile.outfit === 'overalls') {
    add(torso, 'Overall bib', profile.bottom, [0, 0.13, 0.132], [0.29, 0.3, 0.02]);
    for (const side of [-1, 1]) add(torso, 'Overall strap', profile.bottom, [side * 0.1, 0.36, 0.132], [0.045, 0.22, 0.02]);
  } else if (profile.outfit === 'fire-gear' || profile.outfit === 'hi-vis') {
    add(torso, 'High visibility waist band', '#e4e195', [0, 0.04, 0], [0.395, 0.065, 0.255]);
    for (const side of [-1, 1]) add(torso, 'Reflective vest stripe', '#e4e195', [side * 0.105, 0.29, 0.13], [0.045, 0.29, 0.025]);
  } else if (profile.outfit === 'police-uniform') {
    add(torso, 'Utility belt', '#303735', [0, 0.01, 0], [0.4, 0.055, 0.26]);
    add(torso, 'Radio', '#303735', [-0.12, 0.32, 0.155], [0.06, 0.12, 0.05]);
    add(torso, 'Plain uniform badge', '#d7c482', [0.09, 0.34, 0.133], [0.045, 0.06, 0.02]);
  } else if (sport) {
    add(torso, 'Sport shirt stripe', profile.accent, [0, 0.32, 0.126], [0.3, 0.055, 0.017]);
  }
  if (profile.bag === 'backpack') {
    add(torso, 'Backpack', profile.accent, [0, 0.22, -0.22], [0.31, 0.38, 0.19]);
    for (const side of [-1, 1]) add(torso, 'Backpack strap', profile.accent, [side * 0.12, 0.27, 0.128], [0.04, 0.34, 0.025]);
  } else if (profile.bag !== 'none') {
    add(torso, profile.bag, profile.accent, [0.12, -0.12, -0.17], [0.24, 0.29, 0.12]);
    add(torso, 'Bag strap', profile.accent, [0.07, 0.24, -0.142], [0.035, 0.48, 0.025]);
  }
  return { kind: 'walker', pelvis, torso, legs, arms, scale };
}
