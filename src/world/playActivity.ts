import type { Group } from 'three';
import { PLAY_AREA, type PlayPersonDefinition } from '../content/play';
import { poseWalkerRig, RUNNER, type WalkerRig } from './locomotion';

export interface PlayPersonRig {
  definition: PlayPersonDefinition;
  group: Group;
  rig: WalkerRig;
}

const TAU = Math.PI * 2;

/** Separated meadow play sampled from retained simulation time, with no timers or GPU ownership. */
export class PlayActivity {
  constructor(private readonly people: readonly PlayPersonRig[]) {
    this.update(0, false);
  }

  update(elapsedSeconds: number, reducedMotion: boolean, groundLift = 0): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Play time must be finite and nonnegative.');
    if (!Number.isFinite(groundLift) || groundLift < 0 || groundLift > 0.45) throw new RangeError('Play ground lift must be between 0 and 0.45 metres.');
    const time = reducedMotion ? 0 : elapsedSeconds;
    for (const { definition, group, rig } of this.people) {
      const groundY = PLAY_AREA.surfaceY + groundLift;
      if (definition.context === 'play-guardian') {
        group.position.set(definition.x, groundY, definition.z);
        group.rotation.set(0, definition.heading, 0);
        poseWalkerRig(rig, { distance: 0, speed: 0, blend: 0, reducedMotion: false });
        continue;
      }
      const { x, z, radius, speed, phase, direction } = definition;
      const period = TAU * radius / speed;
      const angle = phase + direction * (time % period) * speed / radius;
      group.position.set(x + radius * Math.cos(angle), groundY, z + radius * Math.sin(angle));
      group.rotation.set(0, -angle + (direction === -1 ? Math.PI : 0), 0);
      // Orbit and gait wrap independently: completing a circle never resets a partial stride.
      const stride = RUNNER.stride * (rig.scale ?? 1);
      const distance = (time % (stride / speed)) * speed + phase * radius;
      poseWalkerRig(rig, { distance, speed, blend: 1, reducedMotion: false, running: true });
    }
  }
}
