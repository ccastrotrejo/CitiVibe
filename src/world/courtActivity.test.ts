// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL, netHeightAt } from '../content/courts';
import { SIDEWALK_HALF_WIDTH, STREET_BLOCKS } from '../content/streets';
import {
  CourtActivity, COURT_TIMING as T, createBasketballPossessionPlan, createPickleballRallyPlan, pickleballRallyIndex,
  pickleballRallyStart, planBasketballPossession, planPickleballRally, type BasketballPossessionPlan, type CourtPlayerRig,
  type PickleballId, type PickleballRallyPlan,
} from './courtActivity';
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

const RIM_Y = BASKETBALL.surfaceY + BASKETBALL.hoopHeight;
const otherPickleballer = (id: PickleballId): PickleballId => id === 'pickleball-west' ? 'pickleball-east' : 'pickleball-west';

function rig(value: CourtFixture, id: string): CourtPlayerRig {
  return value.rigs.find(({ definition }) => definition.id === id)!;
}

function paddle(value: CourtFixture, id: PickleballId): Vector3 {
  return rig(value, id).group.getObjectByName('Pickleball paddle')!.getWorldPosition(new Vector3());
}

/** Possession-local floor landing after the rim, recomputed from the actual release hand for makes. */
function basketballLandTime(value: CourtFixture, plan: BasketballPossessionPlan, groundLift = 0): number {
  if (plan.outcome !== 'make') return plan.rim + plan.kick;
  const base = plan.index * T.basketballPeriod;
  value.update(base + plan.shotRelease, false, groundLift);
  const release = contact(rig(value, 'court-shooter'));
  const duration = plan.rim - plan.shotRelease;
  const velocity = (RIM_Y - release.y - 9.81 * duration ** 2 / 2) / duration;
  const fall = RIM_Y - (BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius);
  return plan.rim + (velocity + Math.sqrt(velocity ** 2 + 2 * 9.81 * fall)) / 9.81;
}

interface PickleballShot {
  striker: PickleballId;
  receiver: PickleballId;
  strike: number;
  bounce: number;
  next: number;
}

function pickleballShots(plan: PickleballRallyPlan): PickleballShot[] {
  return Array.from({ length: plan.shots }, (_, shot) => {
    const striker = shot % 2 === 0 ? plan.server : otherPickleballer(plan.server);
    const strike = plan.start + plan.strikeTimes[shot];
    const next = plan.start + plan.strikeTimes[shot + 1];
    return { striker, receiver: otherPickleballer(striker), strike, next, bounce: strike + (next - strike) * plan.bounceFractions[shot] };
  });
}

/** Ball x is linear in time before the bounce, so bisection finds the exact net crossing. */
function netCrossing(value: CourtFixture, shot: PickleballShot, groundLift = 0): number {
  let low = shot.strike;
  let high = shot.bounce;
  const west = shot.striker === 'pickleball-west';
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    value.update(middle, false, groundLift);
    if ((value.pickleball.position.x < PICKLEBALL.x) === west) low = middle;
    else high = middle;
  }
  value.update(low, false, groundLift);
  return low;
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

  it('hits the moving paddles on every seeded shot, clears the net and bounces beyond the kitchen', () => {
    const value = fixture();
    const { pickleball, update } = value;
    const plan = createPickleballRallyPlan();
    const counts = new Set<number>();
    const depths = [0, 0];
    const offsets: number[] = [];
    for (let index = 0; index < 60; index += 1) {
      planPickleballRally(index, plan);
      expect(plan.start).toBe(pickleballRallyStart(index));
      expect(plan.start + plan.duration).toBe(pickleballRallyStart(index + 1));
      expect(plan.shots).toBeGreaterThanOrEqual(3);
      expect(plan.shots).toBeLessThanOrEqual(8);
      expect(plan.pause).toBeGreaterThanOrEqual(1);
      expect(plan.pause).toBeLessThanOrEqual(2.8 + 1e-9);
      expect(plan.holder).toBe(planPickleballRally(index + 1).server);
      counts.add(plan.shots);
      update(plan.start, false);
      expect(pickleball.position.distanceTo(paddle(value, plan.server))).toBeLessThan(1e-8);
      pickleballShots(plan).forEach((shot, index) => {
        expect(shot.next - shot.strike).toBeGreaterThanOrEqual(T.pickleballStrokeMin - 1e-9);
        expect(shot.next - shot.strike).toBeLessThanOrEqual(T.pickleballStrokeMax + 1e-9);
        depths[plan.deep[index]] += 1;
        update(shot.strike, false);
        expect(pickleball.position.distanceTo(paddle(value, shot.striker)), `rally ${plan.index} shot ${index}`).toBeLessThan(1e-8);
        offsets.push(rig(value, shot.striker).group.position.z - PICKLEBALL.z - rig(value, shot.striker).definition.z);
        netCrossing(value, shot);
        expect(pickleball.position.x).toBeCloseTo(PICKLEBALL.x, 6);
        expect(pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
        expect(pickleball.position.y - PICKLEBALL.ballRadius)
          .toBeGreaterThan(PICKLEBALL.surfaceY + netHeightAt(pickleball.position.z - PICKLEBALL.z));
        update(shot.bounce, false);
        expect(pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + PICKLEBALL.ballRadius, 8);
        expect(Math.sign(pickleball.position.x - PICKLEBALL.x)).toBe(shot.striker === 'pickleball-west' ? 1 : -1);
        expect(Math.abs(pickleball.position.x - PICKLEBALL.x)).toBeGreaterThan(PICKLEBALL.kitchenDepth);
      });
      for (const time of [plan.strikeTimes[plan.shots], plan.strikeTimes[plan.shots] + plan.pause / 2, plan.duration - 1e-6]) {
        update(plan.start + time, false);
        expect(pickleball.position.distanceTo(paddle(value, plan.holder))).toBeLessThan(1e-8);
      }
    }
    expect(counts.size).toBeGreaterThanOrEqual(5);
    expect(Math.min(...depths)).toBeGreaterThan(20);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(1.5);
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
    for (let index = 0; index < 4; index += 1) {
      const plan = planPickleballRally(index);
      for (const shot of pickleballShots(plan)) {
        snowy.update(shot.strike, false, groundLift);
        expect(snowy.pickleball.position.distanceTo(paddle(snowy, shot.striker))).toBeLessThan(1e-8);
        const netTime = netCrossing(snowy, shot, groundLift);
        dry.update(netTime, false);
        expect(snowy.pickleball.position.y).toBeCloseTo(dry.pickleball.position.y, 8);
        expect(snowy.pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
        snowy.update(shot.bounce, false, groundLift);
        expect(snowy.pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + groundLift + PICKLEBALL.ballRadius, 8);
      }
    }
    for (let possession = 1; possession < 12; possession += 1) {
      const plan = planBasketballPossession(possession);
      snowy.update(possession * T.basketballPeriod + plan.rim, false, groundLift);
      expect(snowy.basketball.position.distanceTo(new Vector3(plan.targetX, RIM_Y, plan.targetZ))).toBeLessThan(1e-8);
      snowy.update(possession * T.basketballPeriod + basketballLandTime(snowy, plan, groundLift), false, groundLift);
      expect(snowy.basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius, 7);
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
    const boundaries: number[] = [];
    for (let possession = 0; possession < 12; possession += 1) {
      const plan = planBasketballPossession(possession);
      const base = possession * T.basketballPeriod;
      for (const time of [0, plan.passStart, plan.passEnd, plan.shotRelease, plan.rim, basketballLandTime(value, plan, groundLift),
        plan.reboundCatch, plan.returnStart, plan.returnEnd]) boundaries.push(base + time);
    }
    for (let index = 0; index < 27; index += 1) {
      const plan = planPickleballRally(index);
      boundaries.push(plan.start, plan.start + plan.strikeTimes[plan.shots]);
      for (const shot of pickleballShots(plan)) boundaries.push(shot.strike, shot.bounce);
    }
    const delta = 1e-6;
    for (const boundary of boundaries) {
      value.update(Math.max(0, boundary - delta), false, groundLift);
      const players = value.players.map(({ position }) => position.clone());
      const basketball = value.basketball.position.clone();
      const pickleball = value.pickleball.position.clone();
      value.update(boundary + delta, false, groundLift);
      value.players.forEach(({ position }, index) => expect(position.distanceTo(players[index])).toBeLessThan(4 * delta + 1e-8));
      expect(value.basketball.position.distanceTo(basketball), `basketball at ${boundary}`).toBeLessThan(24 * delta + 1e-8);
      expect(value.pickleball.position.distanceTo(pickleball), `pickleball at ${boundary}`).toBeLessThan(24 * delta + 1e-8);
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
    const basketballObjects = [...first.players.slice(0, 4), first.basketball];
    const pickleballObjects = [...first.players.slice(4), first.pickleball];
    first.update(0, false);
    const initial = snapshot(basketballObjects);
    const serve = snapshot(pickleballObjects);
    const westServe = Array.from({ length: 40 }, (_, index) => planPickleballRally(index + 1))
      .find(({ server }) => server === 'pickleball-west')!;
    const close = (actual: number[][][], expected: number[][][]) => actual.forEach((parts, index) => parts.forEach((values, part) =>
      values.forEach((value, component) => expect(value).toBeCloseTo(expected[index][part][component], 9))));
    first.update(168, false);
    close(snapshot(basketballObjects), initial);
    first.update(westServe.start, false);
    close(snapshot(pickleballObjects), serve);
  });

  it('seeds possession outcomes, timing, resets and effort without changing the reference possession', () => {
    const plan = createBasketballPossessionPlan();
    const outcomes = new Map<string, number>();
    const releases: number[] = [];
    const shooterScales: number[] = [];
    let resets = 0;
    expect(planBasketballPossession(0)).toMatchObject({
      outcome: 'make', reset: false, passStart: T.passStart, passEnd: T.passEnd, shotRelease: T.shotRelease,
      reboundCatch: T.reboundCatch, returnStart: T.returnStart, returnEnd: T.returnEnd,
    });
    expect(planBasketballPossession(0).rim).toBeCloseTo(T.rim, 12);
    for (let index = 0; index < 30; index += 1) {
      planBasketballPossession(index, plan);
      expect(planBasketballPossession(index)).toEqual(plan);
      outcomes.set(plan.outcome, (outcomes.get(plan.outcome) ?? 0) + 1);
      releases.push(plan.shotRelease - plan.passEnd);
      shooterScales.push(plan.scale['court-shooter']);
      if (plan.reset) resets += 1;
      expect(plan.passStart).toBeGreaterThanOrEqual(T.passStart);
      expect(plan.shotRelease - plan.passEnd).toBeGreaterThanOrEqual(0.4 - 1e-9);
      expect(plan.returnEnd).toBeLessThan(T.basketballPeriod - 8);
      for (const scale of Object.values(plan.scale)) {
        expect(scale).toBeGreaterThanOrEqual(0.8);
        expect(scale).toBeLessThanOrEqual(1.15);
      }
      const rimOffset = Math.hypot(plan.targetX - BASKETBALL.x - BASKETBALL.hoopOffset, plan.targetZ - BASKETBALL.z);
      expect(rimOffset).toBeLessThanOrEqual(BASKETBALL.rimRadius + 0.1);
      if (plan.outcome === 'make') expect(rimOffset).toBe(0);
      else expect(rimOffset).toBeGreaterThan(BASKETBALL.rimRadius * 0.9);
    }
    expect([...outcomes.keys()].sort()).toEqual(['make', 'rim-out', 'short']);
    expect(Math.min(...outcomes.values())).toBeGreaterThanOrEqual(4);
    expect(resets).toBeGreaterThan(0);
    expect(Math.max(...releases) - Math.min(...releases)).toBeGreaterThan(0.4);
    expect(Math.max(...shooterScales) - Math.min(...shooterScales)).toBeGreaterThan(0.15);
  });

  it.each([0, 0.45])('keeps every seeded possession on moving hands, fixed rim contacts and ballistic caroms with %sm snow', (groundLift) => {
    const value = fixture();
    const { basketball, update } = value;
    const delta = 1e-4;
    for (let index = 0; index < 30; index += 1) {
      const plan = planBasketballPossession(index);
      const base = index * T.basketballPeriod;
      for (const [time, id] of [[0, 'court-passer'], [plan.passStart, 'court-passer'], [plan.passEnd, 'court-shooter'],
        [(plan.passEnd + plan.shotRelease) / 2, 'court-shooter'], [plan.shotRelease, 'court-shooter'],
        [plan.reboundCatch, 'court-rebounder'], [plan.reboundCatch + 1, 'court-rebounder'], [plan.returnStart, 'court-rebounder'],
        [plan.returnEnd, 'court-passer'], [T.basketballPeriod - 1e-7, 'court-passer']] as const) {
        update(base + time, false, groundLift);
        expect(basketball.position.distanceTo(contact(rig(value, id))), `possession ${index} ${id} at ${time}`).toBeLessThan(1e-6);
      }
      update(base + plan.rim, false, groundLift);
      expect(basketball.position.distanceTo(new Vector3(plan.targetX, RIM_Y, plan.targetZ))).toBeLessThan(1e-8);
      const land = basketballLandTime(value, plan, groundLift);
      update(base + land, false, groundLift);
      expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius, 7);
      if (plan.outcome !== 'make') {
        expect(basketball.position.x).toBeCloseTo(plan.landingX, 7);
        expect(basketball.position.z).toBeCloseTo(plan.landingZ, 7);
        expect(Math.hypot(plan.landingX - BASKETBALL.x - BASKETBALL.hoopOffset, plan.landingZ - BASKETBALL.z)).toBeGreaterThan(0.6);
      }
      expect(plan.reboundCatch - land).toBeGreaterThan(0.6);
      for (const time of [(plan.shotRelease + plan.rim) / 2, (plan.rim + land) / 2, (land + plan.reboundCatch) / 2]) {
        update(base + time - delta, false, groundLift);
        const before = basketball.position.y;
        update(base + time, false, groundLift);
        const center = basketball.position.y;
        update(base + time + delta, false, groundLift);
        expect((basketball.position.y - 2 * center + before) / delta ** 2).toBeCloseTo(-9.81, 2);
      }
    }
  });

  it('keeps both balls continuous and in a hand or flight across many possessions and rallies', () => {
    const value = fixture();
    const { basketball, pickleball, players, update } = value;
    const priorBalls = [basketball.position.clone(), pickleball.position.clone()];
    const priorPlayers = players.map(({ position }) => position.clone());
    let possessionSeams = 0;
    let rallySeams = 0;
    let rally = 0;
    for (let tick = 1; tick <= 360 * 120; tick += 1) {
      const time = tick / 120;
      update(time, false);
      expect(basketball.position.distanceTo(priorBalls[0]), `basketball at ${time}`).toBeLessThan(0.1);
      expect(pickleball.position.distanceTo(priorBalls[1]), `pickleball at ${time}`).toBeLessThan(0.1);
      players.forEach(({ position, name }, index) => expect(position.distanceTo(priorPlayers[index]), name).toBeLessThan(2 / 120));
      priorBalls[0].copy(basketball.position);
      priorBalls[1].copy(pickleball.position);
      players.forEach(({ position }, index) => priorPlayers[index].copy(position));
      if (tick % (T.basketballPeriod * 120) === 0) {
        possessionSeams += 1;
        expect(basketball.position.distanceTo(contact(rig(value, 'court-passer')))).toBeLessThan(1e-8);
      }
      const current = pickleballRallyIndex(time);
      if (current !== rally) {
        expect(current).toBe(rally + 1);
        rally = current;
        rallySeams += 1;
        const plan = planPickleballRally(current);
        expect(time).toBeGreaterThanOrEqual(plan.start);
        update(plan.start, false);
        expect(pickleball.position.distanceTo(paddle(value, plan.server))).toBeLessThan(1e-8);
        update(plan.start - 1e-7, false);
        expect(pickleball.position.distanceTo(paddle(value, planPickleballRally(current - 1).holder))).toBeLessThan(1e-6);
        update(time, false);
      }
    }
    expect(possessionSeams).toBe(15);
    expect(rallySeams).toBeGreaterThan(30);
  }, 30_000);

  it('does not phase-lock players between consecutive possessions and rallies', () => {
    const value = fixture();
    const sample = (time: number) => {
      value.update(time, false);
      return value.rigs.map(({ group, rig: walker }) =>
        [group.position.x, group.position.z, walker.arms[0].rotation.x, walker.arms[1].rotation.z, walker.torso.rotation.y]);
    };
    for (let index = 1; index < 12; index += 1) {
      let difference = 0;
      for (const local of [3, 5.5, 6.8, 8, 9.5, 11, 15, 19]) {
        const current = sample(index * T.basketballPeriod + local).slice(0, 4);
        const next = sample((index + 1) * T.basketballPeriod + local).slice(0, 4);
        current.forEach((values, player) => values.forEach((component, part) =>
          (difference = Math.max(difference, Math.abs(component - next[player][part])))));
      }
      expect(difference, `possession ${index}`).toBeGreaterThan(0.05);
    }
    for (let index = 0; index < 12; index += 1) {
      const current = planPickleballRally(index);
      const next = planPickleballRally(index + 1);
      let difference = 0;
      for (const local of [1.5, 3, 4.5, 6]) {
        const a = [...sample(current.start + local).slice(4).flat(), ...value.pickleball.position.toArray()];
        const b = [...sample(next.start + local).slice(4).flat(), ...value.pickleball.position.toArray()];
        a.forEach((component, part) => (difference = Math.max(difference, Math.abs(component - b[part]))));
      }
      expect(difference, `rally ${index}`).toBeGreaterThan(0.05);
    }
  });

  it('adds brief celebrations, dejection, contests, rebound reads and reset surveys', () => {
    const value = fixture();
    const shooter = rig(value, 'court-shooter').rig;
    const defender = rig(value, 'court-defender').rig;
    const rebounder = rig(value, 'court-rebounder').rig;
    const passer = rig(value, 'court-passer').rig;
    const plans = Array.from({ length: 30 }, (_, index) => planBasketballPossession(index));
    const make = plans.find(({ outcome, index }) => outcome === 'make' && index > 0)!;
    const miss = plans.find(({ outcome }) => outcome !== 'make')!;
    const reset = plans.find(({ reset: surveying }) => surveying)!;
    value.update(make.index * T.basketballPeriod + make.rim + 0.9, false);
    expect(shooter.arms[0].rotation.x).toBeLessThan(-2.3);
    expect(shooter.arms[0].rotation.z).toBe(0);
    value.update(miss.index * T.basketballPeriod + miss.rim + 1.5, false);
    expect(shooter.arms[0].rotation.x).toBeGreaterThan(-0.5);
    expect(shooter.arms[1].rotation.z).toBeGreaterThan(0.4);
    expect(shooter.arms[0].rotation.z).toBeLessThan(-0.4);
    value.update(miss.index * T.basketballPeriod + miss.shotRelease + 1, false);
    expect(defender.torso.rotation.y).toBeGreaterThan(0.3);
    expect(defender.arms[0].rotation.x).toBeLessThan(-1.5);
    value.update(miss.index * T.basketballPeriod + miss.reboundCatch, false);
    expect(rebounder.arms[0].rotation.x).toBeCloseTo(-2.4, 8);
    value.update(miss.index * T.basketballPeriod + miss.reboundCatch + 2, false);
    expect(rebounder.arms[0].rotation.x).toBeCloseTo(-1.2, 8);
    let survey = 0;
    for (let local = 0; local < reset.passStart; local += 0.1) {
      value.update(reset.index * T.basketballPeriod + local, false);
      survey = Math.max(survey, Math.abs(passer.torso.rotation.y));
      expect(value.basketball.position.x).toBeCloseTo(contact(rig(value, 'court-passer')).x, 8);
    }
    expect(survey).toBeGreaterThan(0.15);
    for (const index of [1, 7, 23]) {
      value.update(index * T.basketballPeriod, false);
      for (const walker of [shooter, defender, rebounder, passer]) {
        expect(walker.torso.rotation.y).toBe(0);
        expect(walker.arms[0].rotation.z).toBe(0);
      }
    }
  });

  it('reconstructs identical poses from elapsed time regardless of update history', () => {
    const sequential = fixture();
    const jumped = fixture();
    const objects = (value: CourtFixture) => [...value.players, value.basketball, value.pickleball];
    for (let tick = 0; tick <= 200 * 60; tick += 1) sequential.update(tick / 60, false);
    jumped.update(9000.25, false);
    jumped.update(37.1, false, 0.2);
    jumped.update(200, false);
    expect(snapshot(objects(jumped))).toEqual(snapshot(objects(sequential)));
    for (const time of [1234.5, 86_400.75]) {
      sequential.update(time, false);
      jumped.update(time + 50, false);
      jumped.update(time, false);
      expect(snapshot(objects(jumped))).toEqual(snapshot(objects(sequential)));
    }
    expect(planPickleballRally(41)).toEqual(planPickleballRally(41));
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
