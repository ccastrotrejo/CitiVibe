// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL } from '../content/courts';
import { SIDEWALK_HALF_WIDTH, STREET_BLOCKS } from '../content/streets';
import { CourtActivity, type CourtPlayerRig } from './courtActivity';
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

function contact(player: CourtPlayerRig, reach = WALKER.armLen): Vector3 {
  return player.rig.arms[0].localToWorld(new Vector3(0, -reach, 0));
}

afterEach(() => fixtures.splice(0).forEach((value) => value.dispose()));

describe('Juniper court activities', () => {
  it('uses coherent compact court proportions inside the public parcel', () => {
    expect(BASKETBALL).toMatchObject({ x: -61, z: 119, width: 14, depth: 7.5, hoopOffset: 5.8, hoopHeight: 2.5, surfaceY: 0.04 });
    expect(PICKLEBALL).toMatchObject({ x: -61, z: 108.5, width: 6.7, depth: 3.05, kitchenDepth: 1.065, netHeight: 0.91, surfaceY: 0.04 });
    expect(BASKETBALL.width * BASKETBALL.depth).toBeGreaterThan(5 * PICKLEBALL.width * PICKLEBALL.depth);
    const parcel = STREET_BLOCKS.find(({ id }) => id === 'block-1-3')!;
    for (const court of [BASKETBALL, PICKLEBALL]) {
      expect(court.x - court.width / 2).toBeGreaterThan(parcel.minX + SIDEWALK_HALF_WIDTH);
      expect(court.x + court.width / 2).toBeLessThan(parcel.maxX - SIDEWALK_HALF_WIDTH);
      expect(court.z - court.depth / 2).toBeGreaterThan(parcel.minZ + SIDEWALK_HALF_WIDTH);
      expect(court.z + court.depth / 2).toBeLessThan(parcel.maxZ - SIDEWALK_HALF_WIDTH);
    }
    expect(BASKETBALL.z - BASKETBALL.depth / 2 - (PICKLEBALL.z + PICKLEBALL.depth / 2)).toBeGreaterThan(3);
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
    const { basketball, rigs, update } = fixture();
    for (const [time, id] of [[0, 'court-passer'], [1, 'court-passer'], [2, 'court-passer'],
      [3, 'court-shooter'], [6, 'court-rebounder'], [7, 'court-rebounder'], [8, 'court-rebounder'], [9, 'court-passer']] as const) {
      update(time, false);
      expect(basketball.position.distanceTo(contact(rigs.find(({ definition }) => definition.id === id)!))).toBeLessThan(1e-8);
    }
    for (const time of [0.5, 1.5, 5, 6.5, 7.5, 9.5]) {
      update(time, false);
      expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + BASKETBALL.ballRadius, 8);
    }
    update(4.5, false);
    expect(basketball.position.toArray()).toEqual([BASKETBALL.x + BASKETBALL.hoopOffset,
      BASKETBALL.surfaceY + BASKETBALL.hoopHeight, BASKETBALL.z]);
    update(0, false);
    const initial = basketball.position.clone();
    update(12, false);
    expect(basketball.position).toEqual(initial);
  });

  it('hits the actual moving paddles, clears the net with the full ball, and bounces on each side', () => {
    const { pickleball, rigs, update } = fixture();
    for (let rally = 0; rally < 8; rally += 1) {
      const time = rally * 2.4;
      const player = rigs.find(({ definition }) => definition.id === (rally % 2 === 0 ? 'pickleball-west' : 'pickleball-east'))!;
      update(time, false);
      const paddle = player.group.getObjectByName('Pickleball paddle')!;
      expect(pickleball.position.distanceTo(paddle.getWorldPosition(new Vector3()))).toBeLessThan(1e-8);
      const startX = pickleball.position.x;
      const bounceX = PICKLEBALL.x + (rally % 2 === 0 ? 1 : -1) * PICKLEBALL.kitchenDepth * 0.75;
      update(time + 1.8 * (PICKLEBALL.x - startX) / (bounceX - startX), false);
      expect(pickleball.position.x).toBeCloseTo(PICKLEBALL.x, 8);
      expect(pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
      update(time + 1.8, false);
      expect(pickleball.position.x).toBeCloseTo(bounceX, 8);
      expect(pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + PICKLEBALL.ballRadius, 8);
    }
  });

  it.each([0, 0.45])('moves grounded full bodies and bounded balls for 96 seconds with %sm snow', (groundLift) => {
    const { basketball, pickleball, rigs, players, update } = fixture();
    update(0, false, groundLift);
    const bounds = players.map(() => new Box3());
    const previousRoots = players.map(({ position }) => position.clone());
    const minimums = players.map(({ position }) => position.clone());
    const maximums = players.map(({ position }) => position.clone());
    const previousFeet = rigs.map(({ rig }) => rig.legs.map(({ ankle }) => ankle.getWorldPosition(new Vector3())));
    const plantedSteps = new Uint32Array(players.length);
    const priorBalls = [basketball.position.clone(), pickleball.position.clone()];
    const foot = new Vector3();
    const soleBounds = new Box3();
    const balls = [basketball, pickleball];
    const courts = [BASKETBALL, PICKLEBALL];
    for (let tick = 1; tick <= 96 * 120; tick += 1) {
      update(tick / 120, false, groundLift);
      for (let index = 0; index < players.length; index += 1) {
        const player = players[index];
        const court = rigs[index].definition.sport === 'basketball' ? BASKETBALL : PICKLEBALL;
        const moved = player.position.distanceTo(previousRoots[index]);
        expect(moved, player.name).toBeLessThan(2 / 120);
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
        if (index === 1 && Math.abs(ball.position.x - court.x) <= court.ballRadius) {
          expect(ball.position.y - court.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
        }
        priorBalls[index].copy(ball.position);
      }
    }
    players.forEach((player, index) => {
      const span = maximums[index].distanceTo(minimums[index]);
      expect(span, player.name).toBeGreaterThanOrEqual(rigs[index].definition.sport === 'basketball' ? 1 : 0.5);
      expect(plantedSteps[index], `${player.name} must actually take grounded steps`).toBeGreaterThan(100);
    });
  }, 30_000);

  it('raises moving contacts and bounces in maximum snow without lifting the rim or net target', () => {
    const dry = fixture();
    const snowy = fixture();
    const groundLift = 0.45;
    for (const [time, id] of [[0, 'court-passer'], [1, 'court-passer'], [2, 'court-passer'], [3, 'court-shooter'],
      [6, 'court-rebounder'], [8, 'court-rebounder'], [9, 'court-passer']] as const) {
      snowy.update(time, false, groundLift);
      const player = snowy.rigs.find(({ definition }) => definition.id === id)!;
      expect(snowy.basketball.position.distanceTo(contact(player))).toBeLessThan(1e-8);
      expect(player.group.position.y).toBe(BASKETBALL.surfaceY + groundLift);
    }
    for (const time of [0.5, 1.5, 5, 6.5, 7.5, 9.5]) {
      snowy.update(time, false, groundLift);
      expect(snowy.basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius, 8);
    }
    snowy.update(4.5, false, groundLift);
    expect(snowy.basketball.position.toArray()).toEqual([
      BASKETBALL.x + BASKETBALL.hoopOffset, BASKETBALL.surfaceY + BASKETBALL.hoopHeight, BASKETBALL.z,
    ]);
    for (const time of [0, 2.4, 4.8, 7.2]) {
      snowy.update(time, false, groundLift);
      const index = Math.round(time / 2.4) % 2;
      const player = snowy.rigs.find(({ definition }) => definition.id === (index === 0 ? 'pickleball-west' : 'pickleball-east'))!;
      const paddle = player.group.getObjectByName('Pickleball paddle')!;
      expect(snowy.pickleball.position.distanceTo(paddle.getWorldPosition(new Vector3()))).toBeLessThan(1e-8);
      const bounceX = PICKLEBALL.x + (index === 0 ? 1 : -1) * PICKLEBALL.kitchenDepth * 0.75;
      const netTime = time + 1.8 * (PICKLEBALL.x - snowy.pickleball.position.x) / (bounceX - snowy.pickleball.position.x);
      snowy.update(netTime, false, groundLift);
      dry.update(netTime, false);
      expect(snowy.pickleball.position.y).toBeCloseTo(dry.pickleball.position.y, 8);
      expect(snowy.pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
      snowy.update(time + 1.8, false, groundLift);
      expect(snowy.pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + groundLift + PICKLEBALL.ballRadius, 8);
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
    for (let tick = 0; tick < 17.35 * 30; tick += 1) first.update(tick / 30, false);
    for (let tick = 0; tick < 17.35 * 144; tick += 1) second.update(tick / 144, false);
    first.update(17.35, false);
    second.update(17.35, false);
    restored.update(17.35, false);
    const before = snapshot(objects(first));
    expect(snapshot(objects(second))).toEqual(before);
    expect(snapshot(objects(restored))).toEqual(before);
    first.update(17.35, false);
    expect(snapshot(objects(first))).toEqual(before);
    first.update(44, true);
    const still = snapshot(objects(first));
    first.update(3000, true);
    expect(snapshot(objects(first))).toEqual(still);
    first.update(17.35, false);
    expect(snapshot(objects(first))).toEqual(before);
    first.update(0, false);
    const initial = snapshot(objects(first));
    first.update(24, false);
    const repeated = snapshot(objects(first));
    repeated.forEach((parts, index) => parts.forEach((values, part) =>
      values.forEach((value, component) => expect(value).toBeCloseTo(initial[index][part][component], 9))));
  });

  it('does not consult ambient randomness or wall time during updates', () => {
    const value = fixture();
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Random'); });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Clock'); });
    try {
      for (let tick = 0; tick < 120; tick += 1) value.update(tick / 30, false);
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
