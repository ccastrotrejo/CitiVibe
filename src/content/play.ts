interface PlayPerson {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

export interface PlayChild extends PlayPerson {
  readonly context: 'play-child';
  readonly radius: number;
  readonly speed: number;
  readonly phase: number;
  readonly direction: 1 | -1;
}

export interface PlayGuardian extends PlayPerson {
  readonly context: 'play-guardian';
  readonly heading: number;
}

export type PlayPersonDefinition = PlayChild | PlayGuardian;

/** Full-body clearance envelope inside the south meadow, away from paths and picnic seating. */
export const PLAY_AREA = { minX: 11, maxX: 25, minZ: 65, maxZ: 72, surfaceY: -0.035 } as const;

/** Child x/z positions are circuit centres; guardians have fixed standing positions. */
export const PLAY_PEOPLE: readonly PlayPersonDefinition[] = [
  { id: 'meadow-child-1', context: 'play-child', x: 13, z: 69, radius: 0.9, speed: 1.18, phase: 0, direction: 1 },
  { id: 'meadow-child-2', context: 'play-child', x: 13, z: 69, radius: 0.9, speed: 1.18, phase: Math.PI, direction: 1 },
  { id: 'meadow-child-3', context: 'play-child', x: 18, z: 69, radius: 0.9, speed: 1.36, phase: 2.1, direction: -1 },
  { id: 'meadow-child-4', context: 'play-child', x: 18, z: 69, radius: 0.9, speed: 1.36, phase: 2.1 + Math.PI, direction: -1 },
  { id: 'meadow-child-5', context: 'play-child', x: 23, z: 69, radius: 0.9, speed: 1.54, phase: 4.2, direction: 1 },
  { id: 'meadow-child-6', context: 'play-child', x: 23, z: 69, radius: 0.9, speed: 1.54, phase: 4.2 + Math.PI, direction: 1 },
  { id: 'meadow-guardian-1', context: 'play-guardian', x: 11.6, z: 65.8, heading: 0.4 },
  { id: 'meadow-guardian-2', context: 'play-guardian', x: 24.4, z: 65.8, heading: -0.4 },
];
