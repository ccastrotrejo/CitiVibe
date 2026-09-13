// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL } from '../content/courts';
import { SIDEWALK_HALF_WIDTH, STREET_BLOCKS } from '../content/streets';
import { CourtActivity, COURT_TIMING as T, type CourtPlayerRig } from './courtActivity';
import { WALKER, type LegRig, type WalkerRig } from './locomotion';

interface CourtFixture {
  rigs: CourtPlayerRig[];
  players: Group[];
  basketball: Group;
  pickleball: Group;
  update: (elapsedSeconds: number, reducedMotion: boolean, groundLift?: number) => void;
  dispose: () => void;
}

const fixtures: CourtFixture[] = [];
const BASKETBALL_CONTACTS = [
  [0, 'court-passer'], [1, 'court-passer'], [T.passStart, 'court-passer'],
  [T.passEnd, 'court-shooter'], [(T.passEnd + T.shotRelease) / 2, 'court-shooter'], [T.shotRelease, 'court-shooter'],
  [T.reboundCatch, 'court-rebounder'], [T.reboundCatch + 1, 'court-rebounder'], [T.returnStart, 'court-rebounder'],
  [T.returnEnd, 'court-passer'],
] as const;

function fixture(): CourtFixture {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const body = (parent: Object3D, position: readonly number[], size: readonly number[]) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(size[0], size[1], size[2]);
    parent.add(mesh);
    return mesh;
  };
  const rigs: CourtPlayerRig[] = COURT_PLAYERS.map((definition) => {
    const group = new Group();
    group.name = definition.id;
    const pelvis = new Object3D();
    const torso = new Object3D();
    group.add(pelvis);
    pelvis.add(torso);
    body(torso, [0, WALKER.torsoOffset, 0], WALKER.torsoSize);
    body(torso, [0, WALKER.headOffset, 0], WALKER.headScale.map((size) => size * 2));
    const leg = (side: number): LegRig => {
      const hip = new Object3D();
      const knee = new Object3D();
      const ankle = new Object3D();
      hip.position.x = side * WALKER.hipHalf;
      knee.position.y = -WALKER.thigh;
      ankle.position.y = -WALKER.shank;
      pelvis.add(hip);
      hip.add(knee);
      knee.add(ankle);
      body(hip, [0, -WALKER.thigh / 2, 0], WALKER.thighSize);
      body(knee, [0, -WALKER.shank / 2, 0], WALKER.shankSize);
      body(ankle, [0, WALKER.footSize[1] / 2, WALKER.footFwd], WALKER.footSize);
      return { hip, knee, ankle };
    };
    const arms: [Object3D, Object3D] = [new Object3D(), new Object3D()];
    arms.forEach((arm, index) => {
      arm.position.set((index === 0 ? -1 : 1) * WALKER.shoulderHalf, WALKER.shoulderY, 0);
      torso.add(arm);
      body(arm, [0, -WALKER.armLen / 2, 0], WALKER.armSize);
    });
    const rig: WalkerRig = { kind: 'walker', pelvis, torso, arms, legs: [leg(-1), leg(1)] };
    if (definition.sport === 'pickleball') {
      body(arms[0], [0, -0.51, 0], [0.06, 0.22, 0.06]);
      body(arms[0], [0, -0.65, 0], [0.34, 0.035, 0.44]).name = 'Pickleball paddle';
    }
    return { definition, group, rig };
  });
  const basketball = new Group();
  const pickleball = new Group();
  const activity = new CourtActivity(rigs, basketball, pickleball);
  const result = {
    rigs, players: rigs.map(({ group }) => group), basketball, pickleball,
    update: activity.update.bind(activity), dispose: () => { geometry.dispose(); material.dispose(); },
  };
  fixtures.push(result);
  return result;
}

function snapshot(objects: readonly Object3D[]) {
  return objects.map((object) => {
    const poses: number[][] = [];
    object.traverse((part) => poses.push([...part.position.toArray(), part.rotation.x, part.rotation.y, part.rotation.z]));
    return poses;
  });
}

function contact(player: CourtPlayerRig, reach: number = WALKER.armLen): Vector3 {
  return player.rig.arms[0].localToWorld(new Vector3(0, -reach, 0));
}

function basketballBounceTime(value: CourtFixture, groundLift = 0): number {
  value.update(T.shotRelease, false, groundLift);
  const release = contact(value.rigs.find(({ definition }) => definition.id === 'court-shooter')!);
  const duration = T.rim - T.shotRelease;
  const height = BASKETBALL.surfaceY + BASKETBALL.hoopHeight;
  const velocity = (height - release.y - 9.81 * duration ** 2 / 2) / duration;
  const fall = height - (BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius);
  return T.rim + (velocity + Math.sqrt(velocity ** 2 + 2 * 9.81 * fall)) / 9.81;
}

function pickleballBounceX(value: CourtFixture, shot: number, groundLift = 0): number {
  value.update((shot + 1) * T.pickleballShot, false, groundLift);
  const receiver = value.rigs.find(({ definition }) => definition.id ===
    (shot % 2 === 0 ? 'pickleball-east' : 'pickleball-west'))!;
  const receiverX = contact(receiver, 0.65).x;
  const distance = Math.max(PICKLEBALL.kitchenDepth + 0.4, Math.abs(receiverX - PICKLEBALL.x) - 1.25);
  return PICKLEBALL.x + (shot % 2 === 0 ? 1 : -1) * distance;
}

afterEach(() => fixtures.splice(0).forEach((value) => value.dispose()));

describe('Juniper court activities', () => {
  it('uses full-size court proportions inside the enlarged public parcel', () => {
    expect(BASKETBALL).toMatchObject({
      x: -18, z: 113.5, width: 28.6512, depth: 15.24, hoopOffset: 12.7254,
      hoopHeight: 3.048, ballRadius: 0.12, surfaceY: 0.04,
    });
    expect(PICKLEBALL).toMatchObject({
      x: 15, z: 113.5, width: 13.4112, depth: 6.096, kitchenDepth: 2.1336,
      netHeight: 0.9144, netCenterHeight: 0.8636, surfaceY: 0.04,
    });
    expect(BASKETBALL.width * BASKETBALL.depth).toBeGreaterThan(5 * PICKLEBALL.width * PICKLEBALL.depth);
    const parcel = STREET_BLOCKS.find(({ id }) => id === 'block-2-3')!;
    for (const court of [BASKETBALL, PICKLEBALL]) {
      expect(court.x - court.width / 2).toBeGreaterThan(parcel.minX + SIDEWALK_HALF_WIDTH);
      expect(court.x + court.width / 2).toBeLessThan(parcel.maxX - SIDEWALK_HALF_WIDTH);
      expect(court.z - court.depth / 2).toBeGreaterThan(parcel.minZ + SIDEWALK_HALF_WIDTH);
      expect(court.z + court.depth / 2).toBeLessThan(parcel.maxZ - SIDEWALK_HALF_WIDTH);
    }
    expect(PICKLEBALL.x - PICKLEBALL.width / 2 - (BASKETBALL.x + BASKETBALL.width / 2)).toBeGreaterThan(8);
  });

  it('retains human-scale bodies rather than resizing people to fit the courts', () => {
    const { players } = fixture();
    for (const player of players) {
      expect(player.scale.toArray()).toEqual([1, 1, 1]);
      const height = new Box3().setFromObject(player).getSize(new Vector3()).y;
      expect(height).toBeGreaterThan(1.5);
      expect(height).toBeLessThan(1.9);
      expect(BASKETBALL.hoopHeight / height).toBeGreaterThan(1.65);
    }
  });

  it('retains all six player groups and starts them at the shared definitions', () => {
    const { players, update } = fixture();
    const positions = players.map(({ position }) => position);
    expect(players).toHaveLength(6);
    expect(COURT_PLAYERS.filter(({ sport }) => sport === 'basketball')).toHaveLength(4);
    COURT_PLAYERS.forEach((definition, index) => {
      const court = definition.sport === 'basketball' ? BASKETBALL : PICKLEBALL;
      expect(players[index].position.x).toBe(court.x + definition.x);
      expect(players[index].position.z).toBe(court.z + definition.z);
      expect(players[index].name).toBe(definition.id);
    });
    expect(players.filter((player) => player.getObjectByName('Pickleball paddle'))).toHaveLength(2);
    update(100, false);
    players.forEach((player, index) => expect(player.position).toBe(positions[index]));
  });

  it('drives and passes between moving hands, shoots through the rim, rebounds and returns', () => {
    const value = fixture();
    const { basketball, rigs, update } = value;
    for (const [time, id] of BASKETBALL_CONTACTS) {
      update(time, false);
      expect(basketball.position.distanceTo(contact(rigs.find(({ definition }) => definition.id === id)!))).toBeLessThan(1e-8);
    }
    for (const time of [0.5, 1.5, basketballBounceTime(value), T.reboundCatch + 0.5, T.returnStart - 0.5,
      T.returnEnd + (T.basketballPeriod - T.returnEnd) / 20]) {
      update(time, false);
      expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + BASKETBALL.ballRadius, 8);
    }
    update(T.rim, false);
    expect(basketball.position.toArray()).toEqual([BASKETBALL.x + BASKETBALL.hoopOffset,
      BASKETBALL.surfaceY + BASKETBALL.hoopHeight, BASKETBALL.z]);
    update(0, false);
    const initial = basketball.position.clone();
    update(T.basketballPeriod, false);
    expect(basketball.position).toEqual(initial);
  });

  it('hits the actual moving paddles, clears the net with the full ball, and bounces on each side', () => {
    const value = fixture();
    const { pickleball, rigs, update } = value;
    const contactZ: number[] = [];
    for (let shot = 0; shot < 40; shot += 1) {
      const time = shot * T.pickleballShot;
      const bounceX = pickleballBounceX(value, shot);
      const player = rigs.find(({ definition }) => definition.id === (shot % 2 === 0 ? 'pickleball-west' : 'pickleball-east'))!;
      update(time, false);
      const paddle = player.group.getObjectByName('Pickleball paddle')!;
      expect(pickleball.position.distanceTo(paddle.getWorldPosition(new Vector3()))).toBeLessThan(1e-8);
      contactZ.push(pickleball.position.z);
      const startX = pickleball.position.x;
      update(time + T.pickleballBounce * (PICKLEBALL.x - startX) / (bounceX - startX), false);
      expect(pickleball.position.x).toBeCloseTo(PICKLEBALL.x, 8);
      expect(pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
      update(time + T.pickleballBounce, false);
      expect(pickleball.position.x).toBeCloseTo(bounceX, 8);
      expect(pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + PICKLEBALL.ballRadius, 8);
      expect(Math.abs(bounceX - PICKLEBALL.x)).toBeGreaterThan(PICKLEBALL.kitchenDepth);
    }
    expect(Math.abs(contactZ[0] - contactZ[2])).toBeGreaterThan(1.3);
  });

  it.each([0, 0.45])('moves grounded full bodies and bounded balls for 168 seconds with %sm snow', (groundLift) => {
    const { basketball, pickleball, rigs, players, update } = fixture();
    update(0, false, groundLift);
    const bounds = players.map(() => new Box3());
    const previousRoots = players.map(({ position }) => position.clone());
    const minimums = players.map(({ position }) => position.clone());
    const maximums = players.map(({ position }) => position.clone());
    const previousFeet = rigs.map(({ rig }) => rig.legs.map(({ ankle }) => ankle.getWorldPosition(new Vector3())));
    const plantedSteps = new Uint32Array(players.length);
    const peakRootSpeeds = new Float64Array(players.length);
    const peakBallSpeeds = new Float64Array(2);
    const priorBalls = [basketball.position.clone(), pickleball.position.clone()];
    const foot = new Vector3();
    const soleBounds = new Box3();
    const balls = [basketball, pickleball];
    const courts = [BASKETBALL, PICKLEBALL];
    for (let tick = 1; tick <= 168 * 120; tick += 1) {
      update(tick / 120, false, groundLift);
      for (let index = 0; index < players.length; index += 1) {
        const player = players[index];
        const court = rigs[index].definition.sport === 'basketball' ? BASKETBALL : PICKLEBALL;
        const moved = player.position.distanceTo(previousRoots[index]);
        expect(moved, player.name).toBeLessThan(2 / 120);
        peakRootSpeeds[index] = Math.max(peakRootSpeeds[index], moved * 120);
        minimums[index].min(player.position);
        maximums[index].max(player.position);
        bounds[index].setFromObject(player);
        expect(bounds[index].min.x, player.name).toBeGreaterThan(court.x - court.width / 2);
        expect(bounds[index].max.x, player.name).toBeLessThan(court.x + court.width / 2);
        expect(bounds[index].min.z, player.name).toBeGreaterThan(court.z - court.depth / 2);
        expect(bounds[index].max.z, player.name).toBeLessThan(court.z + court.depth / 2);
        for (let leg = 0; leg < 2; leg += 1) {
          rigs[index].rig.legs[leg].ankle.getWorldPosition(foot);
          soleBounds.setFromObject(rigs[index].rig.legs[leg].ankle);
          expect(soleBounds.min.y, `${player.name} sole`).toBeGreaterThanOrEqual(court.surfaceY + groundLift - 1e-7);
          expect(foot.y).toBeGreaterThanOrEqual(court.surfaceY + groundLift - 1e-7);
          if (moved > 1e-6 && Math.abs(foot.y - court.surfaceY - groundLift) < 1e-8 &&
            Math.abs(previousFeet[index][leg].y - court.surfaceY - groundLift) < 1e-8) {
            expect(foot.distanceTo(previousFeet[index][leg]), `${player.name} support foot must not skate`).toBeLessThan(1e-6);
            plantedSteps[index] += 1;
          }
          previousFeet[index][leg].copy(foot);
        }
        previousRoots[index].copy(player.position);
      }
      for (let first = 0; first < bounds.length; first += 1) {
        for (let second = first + 1; second < bounds.length; second += 1) {
          expect(bounds[first].intersectsBox(bounds[second]), `${players[first].name}/${players[second].name}`).toBe(false);
        }
      }
      for (let index = 0; index < balls.length; index += 1) {
        const ball = balls[index];
        const court = courts[index];
        expect(Math.abs(ball.position.x - court.x) + court.ballRadius).toBeLessThan(court.width / 2);
        expect(Math.abs(ball.position.z - court.z) + court.ballRadius).toBeLessThan(court.depth / 2);
        expect(ball.position.y).toBeGreaterThanOrEqual(court.surfaceY + groundLift + court.ballRadius - 1e-8);
        expect(ball.position.distanceTo(priorBalls[index])).toBeLessThan(0.1);
        peakBallSpeeds[index] = Math.max(peakBallSpeeds[index], ball.position.distanceTo(priorBalls[index]) * 120);
        if (index === 1 && Math.abs(ball.position.x - court.x) <= court.ballRadius) {
          expect(ball.position.y - court.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
        }
        priorBalls[index].copy(ball.position);
      }
    }
    players.forEach((player, index) => {
      const span = maximums[index].distanceTo(minimums[index]);
      const basketballPlayer = rigs[index].definition.sport === 'basketball';
      expect(span, player.name).toBeGreaterThanOrEqual(basketballPlayer ? 2.3 : 1.3);
      expect(peakRootSpeeds[index], player.name).toBeGreaterThan(basketballPlayer ? 1 : 0.75);
      expect(peakRootSpeeds[index], player.name).toBeLessThan(1.7);
      expect(plantedSteps[index], `${player.name} must actually take grounded steps`).toBeGreaterThan(100);
    });
    expect(peakBallSpeeds[0]).toBeGreaterThan(10);
    expect(peakBallSpeeds[1]).toBeGreaterThan(7);
  }, 30_000);

  it('raises moving contacts and bounces in maximum snow without lifting the rim or net target', () => {
    const dry = fixture();
    const snowy = fixture();
    const groundLift = 0.45;
    for (const [time, id] of BASKETBALL_CONTACTS) {
      snowy.update(time, false, groundLift);
      const player = snowy.rigs.find(({ definition }) => definition.id === id)!;
      expect(snowy.basketball.position.distanceTo(contact(player))).toBeLessThan(1e-8);
      expect(player.group.position.y).toBe(BASKETBALL.surfaceY + groundLift);
    }
    for (const time of [0.5, 1.5, basketballBounceTime(snowy, groundLift), T.reboundCatch + 0.5, T.returnStart - 0.5,
      T.returnEnd + (T.basketballPeriod - T.returnEnd) / 20]) {
      snowy.update(time, false, groundLift);
      expect(snowy.basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius, 8);
    }
    snowy.update(T.rim, false, groundLift);
    expect(snowy.basketball.position.toArray()).toEqual([
      BASKETBALL.x + BASKETBALL.hoopOffset, BASKETBALL.surfaceY + BASKETBALL.hoopHeight, BASKETBALL.z,
    ]);
    for (let shot = 0; shot < 8; shot += 1) {
      const time = shot * T.pickleballShot;
      const bounceX = pickleballBounceX(snowy, shot, groundLift);
      snowy.update(time, false, groundLift);
      const index = shot % 2;
      const player = snowy.rigs.find(({ definition }) => definition.id === (index === 0 ? 'pickleball-west' : 'pickleball-east'))!;
      const paddle = player.group.getObjectByName('Pickleball paddle')!;
      expect(snowy.pickleball.position.distanceTo(paddle.getWorldPosition(new Vector3()))).toBeLessThan(1e-8);
      const netTime = time + T.pickleballBounce * (PICKLEBALL.x - snowy.pickleball.position.x) / (bounceX - snowy.pickleball.position.x);
      snowy.update(netTime, false, groundLift);
      dry.update(netTime, false);
      expect(snowy.pickleball.position.y).toBeCloseTo(dry.pickleball.position.y, 8);
      expect(snowy.pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
      snowy.update(time + T.pickleballBounce, false, groundLift);
      expect(snowy.pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + groundLift + PICKLEBALL.ballRadius, 8);
    }
  });

  it.each([0, 0.45])('uses believable gravity through the fixed rim and a continuous bounce with %sm snow', (groundLift) => {
    const value = fixture();
    const { basketball, update } = value;
    const delta = 1e-4;
    for (const time of [T.shotRelease + 0.5, T.rim + 0.1]) {
      update(time - delta, false, groundLift);
      const before = basketball.position.y;
      update(time, false, groundLift);
      const center = basketball.position.y;
      update(time + delta, false, groundLift);
      const after = basketball.position.y;
      expect((after - 2 * center + before) / delta ** 2).toBeCloseTo(-9.81, 4);
    }
    update(T.rim - delta, false, groundLift);
    const approach = basketball.position.y;
    update(T.rim + delta, false, groundLift);
    const descent = basketball.position.y;
    const rimY = BASKETBALL.surfaceY + BASKETBALL.hoopHeight;
    expect(Math.abs((rimY - approach) / delta - (descent - rimY) / delta)).toBeLessThan(0.002);
    const bounce = basketballBounceTime(value, groundLift);
    expect(bounce).toBeGreaterThan(T.rim + 0.3);
    expect(bounce).toBeLessThan(T.rim + 0.5);
    update(bounce, false, groundLift);
    expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius, 8);
  });

  it.each([0, 0.45])('has no position jumps at contacts, bounces or loop seams with %sm snow', (groundLift) => {
    const value = fixture();
    const boundaries = [0, T.passStart, T.passEnd, T.shotRelease, T.rim, basketballBounceTime(value, groundLift),
      T.reboundCatch, T.returnStart, T.returnEnd, T.basketballPeriod];
    for (let stroke = 0; stroke <= 4; stroke += 1) {
      boundaries.push(stroke * T.pickleballShot, stroke * T.pickleballShot + T.pickleballBounce);
    }
    const delta = 1e-6;
    for (const boundary of boundaries) {
      value.update(168 + boundary - delta, false, groundLift);
      const players = value.players.map(({ position }) => position.clone());
      const basketball = value.basketball.position.clone();
      const pickleball = value.pickleball.position.clone();
      value.update(168 + boundary + delta, false, groundLift);
      value.players.forEach(({ position }, index) => expect(position.distanceTo(players[index])).toBeLessThan(4 * delta + 1e-8));
      expect(value.basketball.position.distanceTo(basketball)).toBeLessThan(24 * delta + 1e-8);
      expect(value.pickleball.position.distanceTo(pickleball)).toBeLessThan(24 * delta + 1e-8);
    }
  });

  it('preserves zero-lift defaults and reconstructs lifted stills independently of previous updates', () => {
    const first = fixture();
    const second = fixture();
    const objects = (value: CourtFixture) => [...value.players, value.basketball, value.pickleball];
    first.update(3.7, false);
    second.update(3.7, false, 0);
    expect(snapshot(objects(second))).toEqual(snapshot(objects(first)));
    first.update(17.35, false, 0.45);
    const moving = snapshot(objects(first));
    second.update(0, false, 0.1);
    second.update(17.35, false, 0.45);
    expect(snapshot(objects(second))).toEqual(moving);
    first.update(999, true, 0.45);
    const still = snapshot(objects(first));
    first.update(9999, true, 0.45);
    expect(snapshot(objects(first))).toEqual(still);
    first.update(17.35, false, 0.45);
    expect(snapshot(objects(first))).toEqual(moving);
  });

  it('is frame-rate independent, repeatable after recovery, pause-safe and fixed under reduced motion', () => {
    const first = fixture();
    const second = fixture();
    const restored = fixture();
    const objects = (value: ReturnType<typeof fixture>) => [...value.players, value.basketball, value.pickleball];
    for (let tick = 0; tick < 73.35 * 30; tick += 1) first.update(tick / 30, false);
    for (let tick = 0; tick < 73.35 * 144; tick += 1) second.update(tick / 144, false);
    first.update(73.35, false);
    second.update(73.35, false);
    restored.update(73.35, false);
    const before = snapshot(objects(first));
    expect(snapshot(objects(second))).toEqual(before);
    expect(snapshot(objects(restored))).toEqual(before);
    first.update(73.35, false);
    expect(snapshot(objects(first))).toEqual(before);
    first.update(44, true);
    const still = snapshot(objects(first));
    first.update(3000, true);
    expect(snapshot(objects(first))).toEqual(still);
    first.update(73.35, false);
    expect(snapshot(objects(first))).toEqual(before);
    first.update(0, false);
    const initial = snapshot(objects(first));
    first.update(168, false);
    const repeated = snapshot(objects(first));
    repeated.forEach((parts, index) => parts.forEach((values, part) =>
      values.forEach((value, component) => expect(value).toBeCloseTo(initial[index][part][component], 9))));
  });

  it('does not consult ambient randomness or wall time during updates', () => {
    const value = fixture();
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Random'); });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Clock'); });
    try {
      for (let tick = 0; tick < 672; tick += 1) value.update(tick / 4, false);
      expect(random).not.toHaveBeenCalled();
      expect(clock).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
      clock.mockRestore();
    }
  });

  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid elapsed time %s before changing poses', (time) => {
    const { players, basketball, pickleball, update } = fixture();
    const before = snapshot([...players, basketball, pickleball]);
    expect(() => update(time, false)).toThrow(RangeError);
    expect(snapshot([...players, basketball, pickleball])).toEqual(before);
  });

  it.each([NaN, Infinity, -Infinity, -0.01, 0.4501, 1])('rejects ground lift %s before changing any poses', (groundLift) => {
    const { players, basketball, pickleball, update } = fixture();
    const before = snapshot([...players, basketball, pickleball]);
    expect(() => update(3, false, groundLift)).toThrow(RangeError);
    expect(() => update(3, true, groundLift)).toThrow(RangeError);
    expect(snapshot([...players, basketball, pickleball])).toEqual(before);
  });
});
