import type { Group } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL } from '../content/courts';
import { poseNeutral, type WalkerRig } from './locomotion';

export interface CourtPlayerRig {
  definition: typeof COURT_PLAYERS[number];
  group: Group;
  rig: WalkerRig;
}

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Bounded choreographed games sampled from the retained simulation clock, with no owned timers. */
export class CourtActivity {
  constructor(
    private readonly players: readonly CourtPlayerRig[],
    private readonly basketball: Group,
    private readonly pickleball: Group,
  ) {
    for (const { definition, group, rig } of players) {
      const court = definition.sport === 'basketball' ? BASKETBALL : PICKLEBALL;
      group.position.set(court.x + definition.x, court.surfaceY, court.z + definition.z);
      group.rotation.y = definition.heading;
      poseNeutral(rig);
    }
    this.update(0, false);
  }

  update(elapsedSeconds: number, reducedMotion: boolean): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Court time must be finite and nonnegative.');
    const time = reducedMotion ? 0 : elapsedSeconds;
    const play = time % 12;
    for (const { definition, rig } of this.players) {
      let arm = -1.2;
      if (definition.id === 'court-shooter') {
        arm = play < 2 ? -1.2 : play < 3 ? mix(-1.2, -2.2, play - 2) :
          play < 4.5 ? -2.2 - 0.4 * Math.sin((play - 3) / 1.5 * Math.PI) :
            play < 5.5 ? mix(-2.2, -1.2, play - 4.5) : -1.2;
      } else if (definition.id === 'court-defender') {
        arm = -0.4 - (play >= 2 && play < 6 ? 1.8 * Math.sin((play - 2) / 4 * Math.PI) : 0);
      } else if (definition.sport === 'pickleball') {
        const phase = (time + (definition.id === 'pickleball-east' ? 2.4 : 0)) % 4.8;
        arm = -Math.PI / 2 + 0.6 * Math.sin(phase * Math.PI / 0.6) * Math.exp(-phase * 3);
      } else {
        arm -= 0.18 * Math.sin(play * Math.PI * 2);
      }
      rig.arms[0].rotation.x = arm;
      rig.arms[1].rotation.x = definition.id === 'court-shooter' ? arm * 0.9 :
        definition.id === 'court-defender' ? arm : -0.35;
    }
    this.basketballPlay(play);
    this.pickleballRally(time);
  }

  private basketballPlay(time: number): void {
    const set = (x: number, y: number, z: number) =>
      this.basketball.position.set(BASKETBALL.x + x, BASKETBALL.surfaceY + y, BASKETBALL.z + z);
    const dribble = BASKETBALL.ballRadius + (1.05 - BASKETBALL.ballRadius) * Math.abs(Math.cos(time * Math.PI));
    if (time < 2 || time >= 9) {
      set(-2.6, dribble, 0.25);
    } else if (time < 3) {
      const u = time - 2;
      set(mix(-2.6, 1.7, u), mix(1.05, 1.5, u) + 0.5 * 4 * u * (1 - u), 0.25);
    } else if (time < 4.5) {
      const u = (time - 3) / 1.5;
      set(mix(1.7, BASKETBALL.hoopOffset, u),
        mix(1.5, BASKETBALL.hoopHeight, u) + 1.6 * 4 * u * (1 - u), mix(0.25, 0, u));
    } else if (time < 5) {
      const u = (time - 4.5) / 0.5;
      set(BASKETBALL.hoopOffset, mix(BASKETBALL.hoopHeight, BASKETBALL.ballRadius, u * u), 0);
    } else if (time < 6) {
      const u = time - 5;
      set(mix(BASKETBALL.hoopOffset, 3.4, u), mix(BASKETBALL.ballRadius, 1.05, u) + 0.45 * 4 * u * (1 - u),
        mix(0, 1.85, u));
    } else if (time < 8) {
      set(3.4, dribble, 1.85);
    } else {
      const u = time - 8;
      set(mix(3.4, -2.6, u), 1.05 + 0.9 * 4 * u * (1 - u), mix(1.85, 0.25, u));
    }
  }

  private pickleballRally(time: number): void {
    const direction = Math.floor((time % 4.8) / 2.4) === 0 ? 1 : -1;
    const phase = (time % 2.4) / 2.4;
    let x: number;
    let y: number;
    let z: number;
    if (phase < 0.75) {
      const u = phase / 0.75;
      x = mix(-4, 2.5, u);
      y = mix(1.2, PICKLEBALL.ballRadius, u) + 0.95 * 4 * u * (1 - u);
      z = mix(0.25, -0.25, u);
    } else {
      const u = (phase - 0.75) / 0.25;
      x = mix(2.5, 4, u);
      y = mix(PICKLEBALL.ballRadius, 1.2, u) + 0.25 * 4 * u * (1 - u);
      z = -0.25;
    }
    this.pickleball.position.set(PICKLEBALL.x + direction * x, PICKLEBALL.surfaceY + y, PICKLEBALL.z + direction * z);
  }
}
