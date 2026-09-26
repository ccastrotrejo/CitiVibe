import { Vector3, type Group } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL } from '../content/courts';
import { poseWalkerRig, WALKER, type WalkerPose, type WalkerRig } from './locomotion';

export interface CourtPlayerRig {
  definition: typeof COURT_PLAYERS[number];
  group: Group;
  rig: WalkerRig;
}

type PlayerId = typeof COURT_PLAYERS[number]['id'];
type BasketballId = Extract<typeof COURT_PLAYERS[number], { sport: 'basketball' }>['id'];
export type PickleballId = Extract<typeof COURT_PLAYERS[number], { sport: 'pickleball' }>['id'];
export type ShotOutcome = 'make' | 'rim-out' | 'short';

/**
 * Basketball keys describe the unvaried reference possession (possession 0); later
 * possessions shift and scale them deterministically. Pickleball rallies start near
 * multiples of the spacing, offset by a bounded seeded jitter.
 */
export const COURT_TIMING = {
  basketballPeriod: 24,
  passStart: 4,
  passEnd: 5.2,
  shotRelease: 6,
  rim: 7.25,
  reboundCatch: 9,
  returnStart: 12,
  returnEnd: 13.5,
  pickleballRallySpacing: 10.7,
  pickleballRallyJitter: 1.45,
  pickleballServe: 0.8,
  pickleballStrokeMin: 1.2,
  pickleballStrokeMax: 1.6,
  pickleballPauseMin: 1.6,
  pickleballPauseMax: 2.2,
  pickleballSwing: 0.65,
  pickleballMaxShots: 8,
} as const;
const T = COURT_TIMING;
const PADDLE_REACH = 0.65;
const GRAVITY = 9.81;
const TAU = Math.PI * 2;
const HOOP_X = BASKETBALL.x + BASKETBALL.hoopOffset;
const HOOP_Z = BASKETBALL.z;
const RIM_Y = BASKETBALL.surfaceY + BASKETBALL.hoopHeight;
const DRIVE_RANGE: Record<BasketballId, number> = {
  'court-shooter': 4, 'court-rebounder': 2.4, 'court-defender': 4, 'court-passer': 3,
};
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);
/** Smooth 0 -> 1 -> 0 envelope over [start, start + duration]. */
const bump = (time: number, start: number, duration: number) => {
  const progress = (time - start) / duration;
  return progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * progress) ** 2;
};

/** Small integer avalanche hash in [0, 1); no ambient randomness. */
function hash01(index: number, salt: number): number {
  let value = Math.imul(index | 0, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

/** Up to eight eased position keys, reused without allocation. */
class Keys {
  private readonly times = new Float64Array(8);
  private readonly values = new Float64Array(8);
  private count = 0;

  clear(): this {
    this.count = 0;
    return this;
  }

  add(time: number, value: number): this {
    this.times[this.count] = time;
    this.values[this.count] = value;
    this.count += 1;
    return this;
  }

  sample(time: number): number {
    for (let index = 1; index < this.count; index += 1) {
      if (time > this.times[index]) continue;
      const start = this.times[index - 1];
      const end = this.times[index];
      if (end <= start) return this.values[index];
      return mix(this.values[index - 1], this.values[index], smooth(clamp((time - start) / (end - start), 0, 1)));
    }
    return this.values[this.count - 1];
  }
}

export interface BasketballPossessionPlan {
  index: number;
  outcome: ShotOutcome;
  /** The passer dribbles and surveys longer before the play starts. */
  reset: boolean;
  passStart: number;
  passEnd: number;
  shotRelease: number;
  rim: number;
  /** Rim-contact target; its height is always the fixed rim height. */
  targetX: number;
  targetZ: number;
  /** Floor landing after a miss (hoop centre for makes); duration of the carom flight. */
  landingX: number;
  landingZ: number;
  kick: number;
  reboundCatch: number;
  returnStart: number;
  returnEnd: number;
  scale: Record<BasketballId, number>;
}

export function createBasketballPossessionPlan(): BasketballPossessionPlan {
  return {
    index: -1, outcome: 'make', reset: false, passStart: 0, passEnd: 0, shotRelease: 0, rim: 0,
    targetX: HOOP_X, targetZ: HOOP_Z, landingX: HOOP_X, landingZ: HOOP_Z, kick: 0,
    reboundCatch: 0, returnStart: 0, returnEnd: 0,
    scale: { 'court-shooter': 1, 'court-rebounder': 1, 'court-defender': 1, 'court-passer': 1 },
  };
}

/** Pure seeded plan for one 24 s possession; possession 0 is the unvaried reference make. */
export function planBasketballPossession(index: number, plan = createBasketballPossessionPlan()): BasketballPossessionPlan {
  const reference = index === 0;
  const roll = (salt: number) => hash01(index, salt);
  const outcomeRoll = roll(1);
  plan.index = index;
  plan.outcome = reference || outcomeRoll < 0.45 ? 'make' : outcomeRoll < 0.75 ? 'rim-out' : 'short';
  plan.reset = !reference && roll(2) < 0.2;
  const delay = plan.reset ? mix(1.1, 1.6, roll(3)) : 0;
  const jitter = reference ? 0 : (roll(4) * 2 - 1) * 0.4;
  plan.passStart = T.passStart + delay;
  plan.passEnd = T.passEnd + delay;
  plan.shotRelease = T.shotRelease + delay + jitter;
  plan.rim = plan.shotRelease + (reference ? T.rim - T.shotRelease : mix(1.15, 1.35, roll(5)));
  let catchDelay = T.reboundCatch - T.shotRelease;
  if (plan.outcome === 'make') {
    plan.targetX = plan.landingX = HOOP_X;
    plan.targetZ = plan.landingZ = HOOP_Z;
    plan.kick = 0;
  } else if (plan.outcome === 'rim-out') {
    // Back-rim contact, then a long carom toward the open floor.
    const contactAngle = mix(-1.1, 1.1, roll(6));
    plan.targetX = HOOP_X + BASKETBALL.rimRadius * Math.cos(contactAngle);
    plan.targetZ = HOOP_Z + BASKETBALL.rimRadius * Math.sin(contactAngle);
    plan.kick = mix(0.85, 1.05, roll(7));
    const distance = mix(1.2, 2.4, roll(8));
    const direction = mix(-0.5, 1.2, roll(9));
    plan.landingX = HOOP_X - distance * Math.cos(direction);
    plan.landingZ = HOOP_Z + distance * Math.sin(direction);
    catchDelay += 0.3;
  } else {
    // Front-rim clank that drops short of the basket.
    plan.targetX = HOOP_X - BASKETBALL.rimRadius;
    plan.targetZ = HOOP_Z + (roll(6) * 2 - 1) * 0.08;
    plan.kick = mix(0.72, 0.85, roll(7));
    plan.landingX = HOOP_X - mix(0.7, 1.4, roll(8));
    plan.landingZ = HOOP_Z + (roll(9) * 2 - 1) * 0.5;
    catchDelay += 0.1;
  }
  plan.reboundCatch = plan.shotRelease + catchDelay;
  plan.returnStart = plan.reboundCatch + (T.returnStart - T.reboundCatch);
  plan.returnEnd = plan.returnStart + (T.returnEnd - T.returnStart);
  const shooter = reference ? 1 : mix(0.85, 1.15, roll(10));
  plan.scale['court-shooter'] = shooter;
  plan.scale['court-defender'] = reference ? 1 : clamp(shooter * mix(0.93, 1.05, roll(11)), 0.85, 1.15);
  plan.scale['court-passer'] = reference ? 1 : mix(0.85, 1.1, roll(12));
  // The rebounder reads the miss and crashes further in for deep caroms.
  plan.scale['court-rebounder'] = plan.outcome === 'make' ? (reference ? 1 : mix(0.9, 1, roll(13))) :
    mix(0.85, 1.05, clamp((plan.landingX - (HOOP_X - 2.4)) / 1.4, 0, 1));
  return plan;
}

export interface PickleballRallyPlan {
  index: number;
  /** Absolute start time and total length, including the closing pause. */
  start: number;
  duration: number;
  server: PickleballId;
  /** Player holding the ball through the closing pause; the next rally's server. */
  holder: PickleballId;
  shots: number;
  pause: number;
  /** Rally-local contact times: shots 0..shots-1 are strikes, index `shots` is the final catch. */
  strikeTimes: Float64Array;
  /** Fraction of each shot spent before its bounce. */
  bounceFractions: Float64Array;
  /** 1 for a deep drive, 0 for a short drop/dink just beyond the kitchen. */
  deep: Uint8Array;
  bounceDepths: Float64Array;
  /** Lateral root offsets from each contact player's base position. */
  offsets: Float64Array;
}

export function createPickleballRallyPlan(): PickleballRallyPlan {
  const contacts = T.pickleballMaxShots + 1;
  return {
    index: -1, start: 0, duration: 0, server: 'pickleball-west', holder: 'pickleball-west', shots: 0, pause: 0,
    strikeTimes: new Float64Array(contacts), bounceFractions: new Float64Array(T.pickleballMaxShots),
    deep: new Uint8Array(T.pickleballMaxShots), bounceDepths: new Float64Array(T.pickleballMaxShots),
    offsets: new Float64Array(contacts),
  };
}

export function pickleballRallyStart(index: number): number {
  return index * T.pickleballRallySpacing +
    (index === 0 ? 0 : (hash01(index, 101) * 2 - 1) * T.pickleballRallyJitter);
}

function rallyServer(index: number): PickleballId {
  return index === 0 || hash01(index, 102) < 0.5 ? 'pickleball-west' : 'pickleball-east';
}

/** Rally containing the given time; starts are bounded within half a spacing of their slot. */
export function pickleballRallyIndex(time: number): number {
  const slot = Math.floor(time / T.pickleballRallySpacing);
  if (pickleballRallyStart(slot + 1) <= time) return slot + 1;
  return pickleballRallyStart(slot) <= time ? slot : slot - 1;
}

const otherPickleballer = (id: PickleballId): PickleballId => id === 'pickleball-west' ? 'pickleball-east' : 'pickleball-west';

/** Pure seeded rally: 3-8 shots, variable cadence, dinks/drives, lateral chases and a closing pause. */
export function planPickleballRally(index: number, plan = createPickleballRallyPlan()): PickleballRallyPlan {
  const roll = (salt: number) => hash01(index, salt);
  plan.index = index;
  plan.start = pickleballRallyStart(index);
  plan.duration = pickleballRallyStart(index + 1) - plan.start;
  plan.server = rallyServer(index);
  plan.holder = rallyServer(index + 1);
  // The final receiver must be the next server, which fixes the parity of the shot count.
  const parity = plan.server === plan.holder ? 0 : 1;
  const target = plan.duration - T.pickleballServe - mix(T.pickleballPauseMin, T.pickleballPauseMax, roll(1));
  const preferLater = roll(2) >= 0.5;
  let shots = 0;
  let bestGap = Infinity;
  for (let count = 3; count <= T.pickleballMaxShots; count += 1) {
    if (count % 2 !== parity) continue;
    const gap = Math.max(0, count * T.pickleballStrokeMin - target, target - count * T.pickleballStrokeMax);
    if (gap < bestGap - 1e-9 || (gap <= bestGap + 1e-9 && preferLater)) {
      bestGap = gap;
      shots = count;
    }
  }
  const cadence = clamp(target / shots, T.pickleballStrokeMin, T.pickleballStrokeMax);
  plan.shots = shots;
  plan.pause = plan.duration - T.pickleballServe - shots * cadence;
  // Zero-mean per-shot variation keeps every stroke inside the cadence limits.
  const spread = Math.min(0.1, (cadence - T.pickleballStrokeMin) / 2, (T.pickleballStrokeMax - cadence) / 2);
  let mean = 0;
  for (let shot = 0; shot < shots; shot += 1) mean += roll(10 + shot) * 2 - 1;
  mean /= shots;
  plan.strikeTimes[0] = T.pickleballServe;
  for (let shot = 0; shot < shots; shot += 1) {
    plan.strikeTimes[shot + 1] = plan.strikeTimes[shot] + cadence + spread * (roll(10 + shot) * 2 - 1 - mean);
    const deep = shot === 0 || roll(20 + shot) >= 0.35;
    plan.deep[shot] = deep ? 1 : 0;
    plan.bounceFractions[shot] = deep ? mix(0.64, 0.7, roll(30 + shot)) : mix(0.58, 0.64, roll(30 + shot));
    plan.bounceDepths[shot] = deep ? mix(0.6, 0.9, roll(40 + shot)) : PICKLEBALL.kitchenDepth + mix(0.15, 0.35, roll(40 + shot));
  }
  let serverSign = roll(3) < 0.5 ? -1 : 1;
  let receiverSign = roll(4) < 0.5 ? -1 : 1;
  plan.offsets[0] = 0;
  for (let contact = 1; contact <= shots; contact += 1) {
    const server = contact % 2 === 0;
    const previous = server ? serverSign : receiverSign;
    const sign = roll(50 + contact) < 0.7 ? -previous : previous;
    plan.offsets[contact] = sign * mix(0.3, 1, roll(60 + contact));
    if (server) serverSign = sign;
    else receiverSign = sign;
  }
  return plan;
}

/** Bounded games sampled from the retained simulation clock; no timers or GPU ownership. */
export class CourtActivity {
  private readonly byId = new Map<PlayerId, CourtPlayerRig>();
  private readonly possession = createBasketballPossessionPlan();
  private readonly drives: Record<BasketballId, Keys> = {
    'court-shooter': new Keys(), 'court-rebounder': new Keys(), 'court-defender': new Keys(), 'court-passer': new Keys(),
  };
  private readonly rally = createPickleballRallyPlan();
  private readonly lateral: Record<PickleballId, Keys> = { 'pickleball-west': new Keys(), 'pickleball-east': new Keys() };
  private readonly pose: WalkerPose = { distance: 0, speed: 0, blend: 1, reducedMotion: false };
  private readonly passFrom = new Vector3();
  private readonly passTo = new Vector3();
  private readonly shotFrom = new Vector3();
  private readonly reboundTo = new Vector3();
  private readonly returnFrom = new Vector3();
  private readonly returnTo = new Vector3();
  private readonly shotTarget = new Vector3();
  private readonly landing = new Vector3();
  private readonly paddleContacts = Array.from({ length: T.pickleballMaxShots + 1 }, () => new Vector3());
  private readonly pickleBounces = Array.from({ length: T.pickleballMaxShots }, () => new Vector3());
  private readonly hand = new Vector3();
  private readonly rim = new Vector3(HOOP_X, RIM_Y, HOOP_Z);
  private readonly floor = new Vector3(HOOP_X, BASKETBALL.surfaceY + BASKETBALL.ballRadius, HOOP_Z);

  constructor(
    private readonly players: readonly CourtPlayerRig[],
    private readonly basketball: Group,
    private readonly pickleball: Group,
  ) {
    for (const player of players) {
      const { definition, rig } = player;
      this.byId.set(definition.id, player);
      const travelHeading = definition.sport === 'basketball' ? definition.heading : 0;
      for (const leg of rig.legs) {
        leg.hip.rotation.order = 'YXZ';
        leg.hip.rotation.y = travelHeading - definition.heading;
      }
    }
    this.update(0, false);
  }

  update(elapsedSeconds: number, reducedMotion: boolean, groundLift = 0): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Court time must be finite and nonnegative.');
    if (!Number.isFinite(groundLift) || groundLift < 0 || groundLift > 0.45) throw new RangeError('Court ground lift must be between 0 and 0.45 metres.');
    const time = reducedMotion ? 0 : elapsedSeconds;
    let possession = Math.floor(time / T.basketballPeriod);
    let play = time - possession * T.basketballPeriod;
    if (play < 0) {
      possession -= 1;
      play += T.basketballPeriod;
    } else if (play >= T.basketballPeriod) {
      possession += 1;
      play -= T.basketballPeriod;
    }
    this.preparePossession(possession);
    this.prepareRally(pickleballRallyIndex(time));
    const rallyTime = time - this.rally.start;
    for (const player of this.players) {
      if (player.definition.sport === 'basketball') this.poseBasketballer(player, play, groundLift);
      else this.posePickleballer(player, rallyTime, groundLift);
    }
    this.basketballPlay(play, groundLift);
    this.pickleballRally(rallyTime, groundLift);
  }

  private player(id: PlayerId): CourtPlayerRig {
    return this.byId.get(id)!;
  }

  private preparePossession(index: number): void {
    if (this.possession.index === index) return;
    const plan = planBasketballPossession(index, this.possession);
    const { passStart: pass, shotRelease: release, reboundCatch: rebound, returnEnd: end, scale } = plan;
    const delay = pass - T.passStart;
    this.drives['court-shooter'].clear().add(0, 0).add(1 + delay, 0).add(release, scale['court-shooter'])
      .add(release + 3, scale['court-shooter']).add(Math.min(end + 3.5, 18.5), 0)
      .add(Math.min(end + 6.5, 21), 0.3 * scale['court-shooter']).add(T.basketballPeriod, 0);
    this.drives['court-defender'].clear().add(0, 0).add(1 + delay, 0).add(release + 0.5, scale['court-defender'])
      .add(release + 3, scale['court-defender']).add(Math.min(end + 3.5, 18.5), 0)
      .add(Math.min(end + 7.5, 21.5), 0.35 * scale['court-defender']).add(T.basketballPeriod, 0);
    const passer = this.drives['court-passer'].clear().add(0, 0);
    if (delay > 0) passer.add(delay, 0);
    passer.add(pass, scale['court-passer']).add(plan.passEnd, scale['court-passer']).add(release + 3, 0)
      .add(end + 0.5, 0).add(Math.min(end + 5.5, 20.5), 0.7 * scale['court-passer']).add(T.basketballPeriod, 0);
    this.drives['court-rebounder'].clear().add(0, 0).add(release + 0.8, 0).add(rebound, scale['court-rebounder'])
      .add(plan.returnStart, scale['court-rebounder']).add(end + 4.5, 0).add(T.basketballPeriod, 0);
    this.shotTarget.set(plan.targetX, RIM_Y, plan.targetZ);
    this.landing.set(plan.landingX, BASKETBALL.surfaceY + BASKETBALL.ballRadius, plan.landingZ);
    this.captureBasketball('court-passer', pass, this.passFrom);
    this.captureBasketball('court-shooter', plan.passEnd, this.passTo);
    this.captureBasketball('court-shooter', release, this.shotFrom);
    this.captureBasketball('court-rebounder', rebound, this.reboundTo);
    this.captureBasketball('court-rebounder', plan.returnStart, this.returnFrom);
    this.captureBasketball('court-passer', end, this.returnTo);
  }

  private prepareRally(index: number): void {
    if (this.rally.index === index) return;
    const plan = planPickleballRally(index, this.rally);
    const other = otherPickleballer(plan.server);
    const serverKeys = this.lateral[plan.server].clear().add(0, 0);
    const otherKeys = this.lateral[other].clear().add(0, 0);
    for (let contact = 0; contact <= plan.shots; contact += 1) {
      (contact % 2 === 0 ? serverKeys : otherKeys).add(plan.strikeTimes[contact], plan.offsets[contact]);
    }
    serverKeys.add(plan.duration, 0);
    otherKeys.add(plan.duration, 0);
    for (let contact = 0; contact <= plan.shots; contact += 1) {
      const player = this.player(contact % 2 === 0 ? plan.server : other);
      this.posePickleballer(player, plan.strikeTimes[contact], 0);
      this.contact(player.definition.id, PADDLE_REACH, this.paddleContacts[contact]);
    }
    for (let shot = 0; shot < plan.shots; shot += 1) {
      const from = this.paddleContacts[shot];
      const to = this.paddleContacts[shot + 1];
      const direction = (shot % 2 === 0 ? plan.server : other) === 'pickleball-west' ? 1 : -1;
      const distance = plan.deep[shot] ? Math.max(PICKLEBALL.kitchenDepth + 0.5, Math.abs(to.x - PICKLEBALL.x) - plan.bounceDepths[shot]) :
        plan.bounceDepths[shot];
      this.pickleBounces[shot].set(PICKLEBALL.x + direction * distance, PICKLEBALL.surfaceY + PICKLEBALL.ballRadius, mix(from.z, to.z, 0.7));
    }
  }

  private captureBasketball(id: BasketballId, time: number, target: Vector3): void {
    this.poseBasketballer(this.player(id), time, 0);
    this.contact(id, WALKER.armLen, target);
  }

  private poseBasketballer({ definition, group, rig }: CourtPlayerRig, play: number, groundLift: number): void {
    const id = definition.id as BasketballId;
    const plan = this.possession;
    const distance = DRIVE_RANGE[id] * this.drives[id].sample(play);
    group.position.set(BASKETBALL.x + definition.x + distance, BASKETBALL.surfaceY + groundLift, BASKETBALL.z + definition.z);
    group.rotation.y = definition.heading;
    // Signed displacement with a fixed stride also locks feet during backpedals and shuffles.
    this.pose.distance = distance * Math.sin(definition.heading);
    this.pose.speed = 1;
    poseWalkerRig(rig, this.pose);
    const make = plan.outcome === 'make';
    let arm = -1.2;
    let offArm = -0.35;
    let abduction = 0;
    let lean = 0;
    let turn = 0;
    if (id === 'court-shooter') {
      arm = play < plan.passEnd ? -1.2 : play < plan.shotRelease ?
        mix(-1.2, -2.2, smooth((play - plan.passEnd) / (plan.shotRelease - plan.passEnd))) :
        play < plan.rim ? -2.2 - 0.4 * Math.sin((play - plan.shotRelease) / (plan.rim - plan.shotRelease) * Math.PI) :
          play < plan.rim + 1.5 ? mix(-2.2, -1.2, smooth((play - plan.rim) / 1.5)) : -1.2;
      if (make) {
        arm = mix(arm, -2.9, bump(play, plan.rim + 0.15, 1.5));
      } else {
        // Hands to hips and a dropped head after a miss.
        const dejected = bump(play, plan.rim + 0.3, 2.4);
        arm = mix(arm, 0.2, dejected);
        abduction = 0.5 * dejected;
        lean = 0.18 * dejected;
      }
      offArm = arm * 0.9;
    } else if (id === 'court-defender') {
      arm = -0.4 - (play >= plan.passStart && play < plan.reboundCatch ?
        1.8 * Math.sin((play - plan.passStart) / (plan.reboundCatch - plan.passStart) * Math.PI) : 0);
      offArm = arm;
      turn = 0.55 * bump(play, plan.shotRelease - 0.3, 2.6);
      if (make) lean = 0.1 * bump(play, plan.rim + 0.3, 1.8);
    } else if (id === 'court-rebounder') {
      // Reads the shot, reaches overhead for the catch, then brings the ball down.
      const rise = plan.rim - 0.4;
      const reach = play < rise ? 0 : play < plan.reboundCatch ? smooth((play - rise) / (plan.reboundCatch - rise)) :
        play < plan.reboundCatch + 0.9 ? 1 - smooth((play - plan.reboundCatch) / 0.9) : 0;
      arm = -1.2 - 1.2 * reach;
      offArm = -0.35 - 2 * reach;
      turn = 0 - 0.35 * reach;
    } else if (plan.reset) {
      turn = 0.3 * Math.sin(TAU * play / 2.2) * bump(play, 0, plan.passStart - 2.8);
    }
    rig.arms[0].rotation.x = arm;
    rig.arms[1].rotation.x = offArm;
    rig.arms[0].rotation.z = 0 - abduction;
    rig.arms[1].rotation.z = abduction;
    rig.torso.rotation.x += lean;
    rig.torso.rotation.y = turn;
  }

  private posePickleballer({ definition, group, rig }: CourtPlayerRig, rallyTime: number, groundLift: number): void {
    const id = definition.id as PickleballId;
    const plan = this.rally;
    const offset = this.lateral[id].sample(rallyTime);
    group.position.set(PICKLEBALL.x + definition.x, PICKLEBALL.surfaceY + groundLift, PICKLEBALL.z + definition.z + offset);
    group.rotation.y = definition.heading;
    this.pose.distance = offset;
    this.pose.speed = 0.4;
    poseWalkerRig(rig, this.pose);
    let swing = 0;
    const first = id === plan.server ? 0 : 1;
    for (let shot = first; shot < plan.shots; shot += 2) {
      const stroke = (rallyTime - plan.strikeTimes[shot]) / T.pickleballSwing;
      if (stroke >= 0 && stroke < 1) {
        swing = (plan.deep[shot] ? 0.5 : 0.3) * Math.sin(TAU * stroke) * Math.sin(Math.PI * stroke) ** 2;
        break;
      }
    }
    rig.arms[0].rotation.x = -Math.PI / 2 + swing;
    rig.arms[1].rotation.x = -0.35;
    rig.arms[0].rotation.z = 0;
    rig.arms[1].rotation.z = 0;
  }

  private contact(id: PlayerId, reach: number, target: Vector3): void {
    this.player(id).rig.arms[0].localToWorld(target.set(0, -reach, 0));
  }

  private flight(ball: Group, from: Vector3, to: Vector3, progress: number, arcHeight: number, startLift = 0, endLift = startLift): void {
    ball.position.lerpVectors(from, to, progress);
    ball.position.y += mix(startLift, endLift, progress) + arcHeight * 4 * progress * (1 - progress);
  }

  private dribble(id: PlayerId, time: number, duration: number, bounces: number, groundLift: number): void {
    this.contact(id, WALKER.armLen, this.hand);
    this.basketball.position.copy(this.hand);
    this.basketball.position.y = mix(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius,
      this.hand.y, Math.abs(Math.cos(time / duration * bounces * Math.PI)));
  }

  private basketballPlay(time: number, groundLift: number): void {
    const plan = this.possession;
    const shotDuration = plan.rim - plan.shotRelease;
    const make = plan.outcome === 'make';
    let landTime = plan.rim + plan.kick;
    let rimVelocity = 0;
    if (make) {
      rimVelocity = (RIM_Y - this.shotFrom.y - groundLift - GRAVITY * shotDuration ** 2 / 2) / shotDuration;
      landTime = plan.rim + (rimVelocity + Math.sqrt(rimVelocity ** 2 +
        2 * GRAVITY * (RIM_Y - this.floor.y - groundLift))) / GRAVITY;
    }
    const finalDribble = T.basketballPeriod - plan.returnEnd;
    if (time < plan.passStart) {
      this.dribble('court-passer', time, plan.passStart, Math.max(1, Math.round(plan.passStart)), groundLift);
    } else if (time >= plan.returnEnd) {
      this.dribble('court-passer', time - plan.returnEnd, finalDribble, Math.max(1, Math.round(finalDribble / 1.05)), groundLift);
    } else if (time >= plan.reboundCatch && time < plan.returnStart) {
      this.dribble('court-rebounder', time - plan.reboundCatch, plan.returnStart - plan.reboundCatch, 3, groundLift);
    } else if (time < plan.passEnd) {
      const duration = plan.passEnd - plan.passStart;
      this.flight(this.basketball, this.passFrom, this.passTo, (time - plan.passStart) / duration, GRAVITY * duration ** 2 / 8, groundLift);
    } else if (time < plan.shotRelease) {
      this.contact('court-shooter', WALKER.armLen, this.basketball.position);
    } else if (time < plan.rim) {
      this.flight(this.basketball, this.shotFrom, this.shotTarget, (time - plan.shotRelease) / shotDuration,
        GRAVITY * shotDuration ** 2 / 8, groundLift, 0);
    } else if (time < landTime) {
      if (make) {
        const elapsed = time - plan.rim;
        this.basketball.position.copy(this.rim);
        this.basketball.position.y += rimVelocity * elapsed - GRAVITY * elapsed ** 2 / 2;
      } else {
        // Ballistic carom from the fixed rim contact to the (snow-lifted) floor.
        this.flight(this.basketball, this.shotTarget, this.landing, (time - plan.rim) / plan.kick,
          GRAVITY * plan.kick ** 2 / 8, 0, groundLift);
      }
    } else if (time < plan.reboundCatch) {
      const duration = plan.reboundCatch - landTime;
      this.flight(this.basketball, make ? this.floor : this.landing, this.reboundTo, (time - landTime) / duration,
        GRAVITY * duration ** 2 / 8, groundLift);
    } else {
      const duration = plan.returnEnd - plan.returnStart;
      this.flight(this.basketball, this.returnFrom, this.returnTo, (time - plan.returnStart) / duration,
        GRAVITY * duration ** 2 / 8, groundLift);
    }
  }

  private pickleballRally(time: number, groundLift: number): void {
    const plan = this.rally;
    if (time < plan.strikeTimes[0]) {
      // The server stands still before serving, so the captured serve contact is exact.
      this.pickleball.position.copy(this.paddleContacts[0]);
      this.pickleball.position.y += groundLift;
      return;
    }
    if (time >= plan.strikeTimes[plan.shots]) {
      this.contact(plan.holder, PADDLE_REACH, this.pickleball.position);
      return;
    }
    let shot = 0;
    while (shot < plan.shots - 1 && time >= plan.strikeTimes[shot + 1]) shot += 1;
    const from = this.paddleContacts[shot];
    const to = this.paddleContacts[shot + 1];
    const bounce = this.pickleBounces[shot];
    const duration = plan.strikeTimes[shot + 1] - plan.strikeTimes[shot];
    const bounceTime = duration * plan.bounceFractions[shot];
    const phase = time - plan.strikeTimes[shot];
    if (phase < bounceTime) {
      const netProgress = (PICKLEBALL.x - from.x) / (bounce.x - from.x);
      // Hands and bounces rise, but the clearance target over the fixed net does not.
      const arcHeight = GRAVITY * bounceTime ** 2 / 8 - groundLift / (4 * netProgress * (1 - netProgress));
      this.flight(this.pickleball, from, bounce, phase / bounceTime, arcHeight, groundLift);
    } else {
      const rise = duration - bounceTime;
      this.flight(this.pickleball, bounce, to, (phase - bounceTime) / rise, GRAVITY * rise ** 2 / 8, groundLift);
    }
  }
}
