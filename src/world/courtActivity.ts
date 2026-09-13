import { Vector3, type Group } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL } from '../content/courts';
import { poseWalkerRig, WALKER, type WalkerRig } from './locomotion';

export interface CourtPlayerRig {
  definition: typeof COURT_PLAYERS[number];
  group: Group;
  rig: WalkerRig;
}

type PlayerId = typeof COURT_PLAYERS[number]['id'];
type MovementKeys = readonly (readonly [number, number])[];

export const COURT_TIMING = {
  basketballPeriod: 24,
  passStart: 4,
  passEnd: 5.2,
  shotRelease: 6,
  rim: 7.25,
  reboundCatch: 9,
  returnStart: 12,
  returnEnd: 13.5,
  pickleballPeriod: 5.6,
  pickleballShot: 1.4,
  pickleballBounce: 0.95,
} as const;
const T = COURT_TIMING;
const PADDLE_REACH = 0.65;
const GRAVITY = 9.81;
const TAU = Math.PI * 2;
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);
const DRIVES = {
  'court-shooter': { range: 4, keys: [[0, 0], [1, 0], [6, 1], [9, 1], [17, 0], [20, 0.3], [24, 0]] },
  'court-rebounder': { range: 2.4, keys: [[0, 0], [6.8, 0], [9, 1], [12, 1], [18, 0], [24, 0]] },
  'court-defender': { range: 4, keys: [[0, 0], [1, 0], [6.5, 1], [9, 1], [17, 0], [21, 0.35], [24, 0]] },
  'court-passer': { range: 3, keys: [[0, 0], [4, 1], [5.2, 1], [9, 0], [14, 0], [19, 0.7], [24, 0]] },
} as const;

function movement(keys: MovementKeys, time: number): number {
  for (let index = 1; index < keys.length; index += 1) {
    if (time > keys[index][0]) continue;
    const [start, from] = keys[index - 1];
    const [end, to] = keys[index];
    return mix(from, to, smooth((time - start) / (end - start)));
  }
  return keys[keys.length - 1][1];
}

/** Bounded games sampled from the retained simulation clock; no timers or GPU ownership. */
export class CourtActivity {
  private readonly passFrom = new Vector3();
  private readonly passTo = new Vector3();
  private readonly shotFrom = new Vector3();
  private readonly reboundTo = new Vector3();
  private readonly returnFrom = new Vector3();
  private readonly returnTo = new Vector3();
  private readonly paddleContacts = Array.from({ length: 4 }, () => new Vector3());
  private readonly hand = new Vector3();
  private readonly rim = new Vector3(BASKETBALL.x + BASKETBALL.hoopOffset, BASKETBALL.surfaceY + BASKETBALL.hoopHeight, BASKETBALL.z);
  private readonly floor = new Vector3(BASKETBALL.x + BASKETBALL.hoopOffset, BASKETBALL.surfaceY + BASKETBALL.ballRadius, BASKETBALL.z);
  private readonly pickleBounce = new Vector3();

  constructor(
    private readonly players: readonly CourtPlayerRig[],
    private readonly basketball: Group,
    private readonly pickleball: Group,
  ) {
    for (const { definition, rig } of players) {
      const travelHeading = definition.sport === 'basketball' ? definition.heading : 0;
      for (const leg of rig.legs) {
        leg.hip.rotation.order = 'YXZ';
        leg.hip.rotation.y = travelHeading - definition.heading;
      }
    }
    this.captureContact('court-passer', T.passStart, WALKER.armLen, this.passFrom);
    this.captureContact('court-shooter', T.passEnd, WALKER.armLen, this.passTo);
    this.captureContact('court-shooter', T.shotRelease, WALKER.armLen, this.shotFrom);
    this.captureContact('court-rebounder', T.reboundCatch, WALKER.armLen, this.reboundTo);
    this.captureContact('court-rebounder', T.returnStart, WALKER.armLen, this.returnFrom);
    this.captureContact('court-passer', T.returnEnd, WALKER.armLen, this.returnTo);
    for (let stroke = 0; stroke < this.paddleContacts.length; stroke += 1) {
      this.captureContact(stroke % 2 === 0 ? 'pickleball-west' : 'pickleball-east',
        stroke * T.pickleballShot, PADDLE_REACH, this.paddleContacts[stroke]);
    }
    this.update(0, false);
  }

  update(elapsedSeconds: number, reducedMotion: boolean, groundLift = 0): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Court time must be finite and nonnegative.');
    if (!Number.isFinite(groundLift) || groundLift < 0 || groundLift > 0.45) throw new RangeError('Court ground lift must be between 0 and 0.45 metres.');
    const time = reducedMotion ? 0 : elapsedSeconds;
    this.posePlayers(time, groundLift);
    this.basketballPlay(time % T.basketballPeriod, groundLift);
    this.pickleballRally(time % T.pickleballPeriod, groundLift);
  }

  private posePlayers(time: number, groundLift = 0): void {
    const play = time % T.basketballPeriod;
    const rally = time % T.pickleballPeriod;
    for (const { definition, group, rig } of this.players) {
      const basketball = definition.sport === 'basketball';
      const court = basketball ? BASKETBALL : PICKLEBALL;
      let distance: number;
      if (definition.sport === 'basketball') {
        const drive = DRIVES[definition.id];
        distance = drive.range * movement(drive.keys, play);
      } else {
        const direction = definition.id === 'pickleball-west' ? 1 : -1;
        distance = direction * PICKLEBALL.depth * 0.23 * (1 - Math.cos(TAU * rally / T.pickleballPeriod)) / 2;
      }
      group.position.set(court.x + definition.x + (basketball ? distance : 0), court.surfaceY + groundLift,
        court.z + definition.z + (basketball ? 0 : distance));
      group.rotation.y = definition.heading;
      // Signed displacement with a fixed stride also locks feet during backpedals and shuffles.
      const gaitDistance = basketball ? distance * Math.sin(definition.heading) : distance;
      poseWalkerRig(rig, { distance: gaitDistance, speed: basketball ? 1 : 0.4, blend: 1, reducedMotion: false });
      let arm = -1.2;
      if (definition.id === 'court-shooter') {
        arm = play < T.passEnd ? -1.2 : play < T.shotRelease ?
          mix(-1.2, -2.2, smooth((play - T.passEnd) / (T.shotRelease - T.passEnd))) :
          play < T.rim ? -2.2 - 0.4 * Math.sin((play - T.shotRelease) / (T.rim - T.shotRelease) * Math.PI) :
            play < T.rim + 1.5 ? mix(-2.2, -1.2, smooth((play - T.rim) / 1.5)) : -1.2;
      } else if (definition.id === 'court-defender') {
        arm = -0.4 - (play >= T.passStart && play < T.reboundCatch ?
          1.8 * Math.sin((play - T.passStart) / (T.reboundCatch - T.passStart) * Math.PI) : 0);
      } else if (!basketball) {
        const phase = (rally + (definition.id === 'pickleball-east' ? T.pickleballShot : 0)) % (2 * T.pickleballShot);
        const stroke = phase / 0.65;
        arm = -Math.PI / 2 + (stroke < 1 ? 0.5 * Math.sin(TAU * stroke) * Math.sin(Math.PI * stroke) ** 2 : 0);
      }
      rig.arms[0].rotation.x = arm;
      rig.arms[1].rotation.x = definition.id === 'court-shooter' ? arm * 0.9 :
        definition.id === 'court-defender' ? arm : -0.35;
    }
  }

  private contact(id: PlayerId, reach: number, target: Vector3): void {
    const player = this.players.find(({ definition }) => definition.id === id)!;
    player.rig.arms[0].localToWorld(target.set(0, -reach, 0));
  }

  private captureContact(id: PlayerId, time: number, reach: number, target: Vector3): void {
    this.posePlayers(time);
    this.contact(id, reach, target);
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
    const shotDuration = T.rim - T.shotRelease;
    const rimVelocity = (this.rim.y - this.shotFrom.y - groundLift - GRAVITY * shotDuration ** 2 / 2) / shotDuration;
    const dropDuration = (rimVelocity + Math.sqrt(rimVelocity ** 2 +
      2 * GRAVITY * (this.rim.y - this.floor.y - groundLift))) / GRAVITY;
    const bounceTime = T.rim + dropDuration;
    if (time < T.passStart) {
      this.dribble('court-passer', time, T.passStart, 4, groundLift);
    } else if (time >= T.returnEnd) {
      this.dribble('court-passer', time - T.returnEnd, T.basketballPeriod - T.returnEnd, 10, groundLift);
    } else if (time >= T.reboundCatch && time < T.returnStart) {
      this.dribble('court-rebounder', time - T.reboundCatch, T.returnStart - T.reboundCatch, 3, groundLift);
    } else if (time < T.passEnd) {
      const duration = T.passEnd - T.passStart;
      this.flight(this.basketball, this.passFrom, this.passTo, (time - T.passStart) / duration, GRAVITY * duration ** 2 / 8, groundLift);
    } else if (time < T.shotRelease) {
      this.contact('court-shooter', WALKER.armLen, this.basketball.position);
    } else if (time < T.rim) {
      this.flight(this.basketball, this.shotFrom, this.rim, (time - T.shotRelease) / shotDuration,
        GRAVITY * shotDuration ** 2 / 8, groundLift, 0);
    } else if (time < bounceTime) {
      const elapsed = time - T.rim;
      this.basketball.position.copy(this.rim);
      this.basketball.position.y += rimVelocity * elapsed - GRAVITY * elapsed ** 2 / 2;
    } else if (time < T.reboundCatch) {
      const duration = T.reboundCatch - bounceTime;
      this.flight(this.basketball, this.floor, this.reboundTo, (time - bounceTime) / duration, GRAVITY * duration ** 2 / 8, groundLift);
    } else {
      const duration = T.returnEnd - T.returnStart;
      this.flight(this.basketball, this.returnFrom, this.returnTo, (time - T.returnStart) / duration,
        GRAVITY * duration ** 2 / 8, groundLift);
    }
  }

  private pickleballRally(time: number, groundLift: number): void {
    const stroke = Math.floor(time / T.pickleballShot);
    const forward = stroke % 2 === 0;
    const from = this.paddleContacts[stroke];
    const to = this.paddleContacts[(stroke + 1) % this.paddleContacts.length];
    const phase = time % T.pickleballShot;
    const bounceDistance = Math.max(PICKLEBALL.kitchenDepth + 0.4, Math.abs(to.x - PICKLEBALL.x) - 1.25);
    this.pickleBounce.set(PICKLEBALL.x + (forward ? 1 : -1) * bounceDistance,
      PICKLEBALL.surfaceY + PICKLEBALL.ballRadius, mix(from.z, to.z, 0.7));
    if (phase < T.pickleballBounce) {
      const netProgress = (PICKLEBALL.x - from.x) / (this.pickleBounce.x - from.x);
      // Hands and bounces rise, but the clearance target over the fixed net does not.
      const arcHeight = GRAVITY * T.pickleballBounce ** 2 / 8 - groundLift / (4 * netProgress * (1 - netProgress));
      this.flight(this.pickleball, from, this.pickleBounce, phase / T.pickleballBounce, arcHeight, groundLift);
    } else {
      const duration = T.pickleballShot - T.pickleballBounce;
      this.flight(this.pickleball, this.pickleBounce, to, (phase - T.pickleballBounce) / duration, GRAVITY * duration ** 2 / 8, groundLift);
    }
  }
}
