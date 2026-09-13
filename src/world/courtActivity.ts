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

const BASKETBALL_PERIOD = 12;
const RALLY_PERIOD = 4.8;
const SHOT_TIME = RALLY_PERIOD / 2;
const PADDLE_REACH = 0.65;
const SHOT_ARC = 1.6;
const TAU = Math.PI * 2;
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);
const DRIVES = {
  'court-shooter': { range: BASKETBALL.width / 7, keys: [[0, 0], [1, 0], [3, 1], [5, 1], [9, 0], [12, 0]] },
  'court-rebounder': { range: BASKETBALL.width * 3 / 35, keys: [[0, 0], [4, 0], [6, 1], [8, 1], [10, 0], [12, 0]] },
  'court-defender': { range: BASKETBALL.width * 3 / 28, keys: [[0, 0], [1, 0], [3.5, 1], [5, 1], [8, 0], [12, 0]] },
  'court-passer': { range: BASKETBALL.width * 3 / 28, keys: [[0, 0], [2, 1], [3, 1], [6, 0], [12, 0]] },
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
  private readonly shotFrom = new Vector3();
  private readonly reboundTo = new Vector3();
  private readonly returnFrom = new Vector3();
  private readonly returnTo = new Vector3();
  private readonly westPaddle = new Vector3();
  private readonly eastPaddle = new Vector3();
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
    this.captureContact('court-passer', 2, WALKER.armLen, this.passFrom);
    this.captureContact('court-shooter', 3, WALKER.armLen, this.shotFrom);
    this.captureContact('court-rebounder', 6, WALKER.armLen, this.reboundTo);
    this.captureContact('court-rebounder', 8, WALKER.armLen, this.returnFrom);
    this.captureContact('court-passer', 9, WALKER.armLen, this.returnTo);
    this.captureContact('pickleball-west', 0, PADDLE_REACH, this.westPaddle);
    this.captureContact('pickleball-east', SHOT_TIME, PADDLE_REACH, this.eastPaddle);
    this.update(0, false);
  }

  update(elapsedSeconds: number, reducedMotion: boolean, groundLift = 0): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Court time must be finite and nonnegative.');
    if (!Number.isFinite(groundLift) || groundLift < 0 || groundLift > 0.45) throw new RangeError('Court ground lift must be between 0 and 0.45 metres.');
    const time = reducedMotion ? 0 : elapsedSeconds;
    this.posePlayers(time, groundLift);
    this.basketballPlay(time % BASKETBALL_PERIOD, groundLift);
    this.pickleballRally(time % RALLY_PERIOD, groundLift);
  }

  private posePlayers(time: number, groundLift = 0): void {
    const play = time % BASKETBALL_PERIOD;
    const rally = time % RALLY_PERIOD;
    for (const { definition, group, rig } of this.players) {
      const basketball = definition.sport === 'basketball';
      const court = basketball ? BASKETBALL : PICKLEBALL;
      let distance: number;
      if (definition.sport === 'basketball') {
        const drive = DRIVES[definition.id];
        distance = drive.range * movement(drive.keys, play);
      } else {
        const direction = definition.id === 'pickleball-west' ? 1 : -1;
        distance = direction * PICKLEBALL.depth * 0.23 * (1 - Math.cos(TAU * rally / RALLY_PERIOD)) / 2;
      }
      group.position.set(court.x + definition.x + (basketball ? distance : 0), court.surfaceY + groundLift,
        court.z + definition.z + (basketball ? 0 : distance));
      group.rotation.y = definition.heading;
      // Signed displacement with a fixed stride also locks feet during backpedals and shuffles.
      const gaitDistance = basketball ? distance * Math.sin(definition.heading) : distance;
      poseWalkerRig(rig, { distance: gaitDistance, speed: basketball ? 1 : 0.4, blend: 1, reducedMotion: false });
      let arm = -1.2;
      if (definition.id === 'court-shooter') {
        arm = play < 2 ? -1.2 : play < 3 ? mix(-1.2, -2.2, smooth(play - 2)) :
          play < 4.5 ? -2.2 - 0.4 * Math.sin((play - 3) / 1.5 * Math.PI) :
            play < 5.5 ? mix(-2.2, -1.2, smooth(play - 4.5)) : -1.2;
      } else if (definition.id === 'court-defender') {
        arm = -0.4 - (play >= 2 && play < 6 ? 1.8 * Math.sin((play - 2) / 4 * Math.PI) : 0);
      } else if (!basketball) {
        const phase = (rally + (definition.id === 'pickleball-east' ? SHOT_TIME : 0)) % RALLY_PERIOD;
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

  private basketballPlay(time: number, groundLift: number): void {
    if (time < 2 || time >= 9 || (time >= 6 && time < 8)) {
      this.contact(time >= 6 && time < 8 ? 'court-rebounder' : 'court-passer', WALKER.armLen, this.hand);
      this.basketball.position.copy(this.hand);
      this.basketball.position.y = mix(BASKETBALL.surfaceY + groundLift + BASKETBALL.ballRadius, this.hand.y, Math.abs(Math.cos(time * Math.PI)));
    } else if (time < 3) {
      this.flight(this.basketball, this.passFrom, this.shotFrom, time - 2, 0.5, groundLift);
    } else if (time < 4.5) {
      this.flight(this.basketball, this.shotFrom, this.rim, (time - 3) / 1.5, SHOT_ARC, groundLift, 0);
    } else if (time < 5) {
      const elapsed = time - 4.5;
      const rimVelocity = (this.rim.y - (this.shotFrom.y + groundLift) - 4 * SHOT_ARC) / 1.5;
      const acceleration = (this.floor.y + groundLift - this.rim.y - rimVelocity * 0.5) / 0.25;
      this.basketball.position.copy(this.rim);
      this.basketball.position.y += rimVelocity * elapsed + acceleration * elapsed ** 2;
    } else if (time < 6) {
      this.flight(this.basketball, this.floor, this.reboundTo, time - 5, 0.45, groundLift);
    } else {
      this.flight(this.basketball, this.returnFrom, this.returnTo, time - 8, 0.9, groundLift);
    }
  }

  private pickleballRally(time: number, groundLift: number): void {
    const forward = time < SHOT_TIME;
    const from = forward ? this.westPaddle : this.eastPaddle;
    const to = forward ? this.eastPaddle : this.westPaddle;
    const phase = (time % SHOT_TIME) / SHOT_TIME;
    this.pickleBounce.set(PICKLEBALL.x + (forward ? 1 : -1) * PICKLEBALL.kitchenDepth * 0.75,
      PICKLEBALL.surfaceY + PICKLEBALL.ballRadius, mix(from.z, to.z, 0.7));
    if (phase < 0.75) {
      const netProgress = (PICKLEBALL.x - from.x) / (this.pickleBounce.x - from.x);
      // Hands and bounces rise, but the clearance target over the fixed net does not.
      const arcHeight = 0.95 - groundLift / (4 * netProgress * (1 - netProgress));
      this.flight(this.pickleball, from, this.pickleBounce, phase / 0.75, arcHeight, groundLift);
    } else {
      this.flight(this.pickleball, this.pickleBounce, to, (phase - 0.75) / 0.25, 0.1, groundLift);
    }
  }
}
