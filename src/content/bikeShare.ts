import { CITY_EXTENT } from './streets';
import { PICKLEBALL_COURT } from './courts';

/** Original civic palette; no operator branding or source artwork. */
export const BIKE_SHARE_STYLE = {
  blue: '#256897',
  paleBlue: '#9cd3e6',
  metal: '#bac9cb',
  tire: '#29363e',
  seat: '#344650',
  wheelRadius: 0.32,
  wheelbase: 1.08,
  handlebarWidth: 0.54,
} as const;

export interface BikeShareStation {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly side: -1 | 1;
  readonly phase: number;
  readonly yaw: number;
  readonly surfaceY: number;
}

/** A clear pocket on existing paving, outside the north pickleball runoff and sidewalk. */
export const COURTSIDE_BIKE_POCKET = {
  minX: 8, maxX: 25, minZ: 103,
  maxZ: PICKLEBALL_COURT.z - PICKLEBALL_COURT.runoffDepth / 2 - 2.4,
  surfaceY: 0.025,
} as const;

/** Empty inter-building pockets and the existing court apron; no buildings or routes move. */
export const BIKE_SHARE_POCKETS = {
  'lantern-bike-bay': { minX: -94.2, maxX: -83.8, minZ: -24.6, maxZ: -19, surfaceY: -0.08 },
  'willow-bike-bay': { minX: 83.8, maxX: 94.2, minZ: 20.1, maxZ: 25, surfaceY: -0.08 },
  'juniper-bike-bay': COURTSIDE_BIKE_POCKET,
} as const;

/** Parallel bicycles sit side-by-side across each row; handling remains inside the paved bay. */
export const BIKE_SHARE_STATIONS: readonly BikeShareStation[] = [
  { id: 'lantern-bike-bay', x: -93.3, z: -21.5, side: -1, phase: 0, yaw: 0, surfaceY: -0.08 },
  { id: 'willow-bike-bay', x: 84.3, z: 23, side: 1, phase: 19, yaw: 0, surfaceY: -0.08 },
  { id: 'juniper-bike-bay', x: 10, z: 105.3, side: 1, phase: 9, yaw: 0,
    surfaceY: COURTSIDE_BIKE_POCKET.surfaceY },
];

export const BIKE_SHARE_LAYOUT = {
  slotSpacing: 0.75,
  slots: 11,
  bicycles: 10,
  emptySlot: 1,
  personBehind: 0.72,
  travel: 0.8,
  padMinX: -0.44,
  padMaxX: 8.85,
  padMinZ: -2.2,
  padMaxZ: 1.15,
  surfaceY: -0.08,
  period: 48,
} as const;

export type BikeSharePhase = 'unlocking' | 'walking-out' | 'checking' | 'returning' | 'locking' | 'resting';

export interface BikeShareSample {
  readonly phase: BikeSharePhase;
  readonly bikeX: number;
  readonly bikeZ: number;
  readonly personX: number;
  readonly personZ: number;
  readonly displacement: number;
  readonly speed: number;
  readonly latchTouch: number;
  readonly docked: boolean;
  readonly lockConfirmed: boolean;
  readonly occupiedSlots: readonly boolean[];
  readonly awayBikes: number;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Exact cardinal transform shared by static art, rigs, swept bounds and contact targets. */
export function bikeSharePoint(station: BikeShareStation, x: number, z: number) {
  return station.yaw === Math.PI / 2
    ? { x: station.x + z, z: station.z - x }
    : { x: station.x + x, z: station.z + z };
}

/**
 * A bounded checkout-and-redock, not a simulated journey. The user holds the saddle
 * and walks astride the rear wheel, clear of pedals. Both remain visible throughout.
 */
export function sampleBikeShare(
  station: BikeShareStation, elapsedSeconds: number, reducedMotion = false,
): BikeShareSample {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError('Bike-share time must be finite and nonnegative.');
  }
  const time = reducedMotion ? 0 : (elapsedSeconds + station.phase) % BIKE_SHARE_LAYOUT.period;
  let phase: BikeSharePhase;
  let displacement = 0;
  let speed = 0;
  if (time < 4) phase = 'unlocking';
  else if (time < 12) {
    phase = 'walking-out';
    const u = (time - 4) / 8;
    displacement = -BIKE_SHARE_LAYOUT.travel * smooth(u);
    speed = -BIKE_SHARE_LAYOUT.travel * 6 * u * (1 - u) / 8;
  } else if (time < 20) {
    phase = 'checking';
    displacement = -BIKE_SHARE_LAYOUT.travel;
  } else if (time < 28) {
    phase = 'returning';
    const u = (time - 20) / 8;
    displacement = -BIKE_SHARE_LAYOUT.travel * (1 - smooth(u));
    speed = BIKE_SHARE_LAYOUT.travel * 6 * u * (1 - u) / 8;
  } else phase = time < 32 ? 'locking' : 'resting';
  const docked = time <= 4 || time >= 28;
  const bike = bikeSharePoint(station, 0, displacement);
  const person = bikeSharePoint(station, 0, displacement - BIKE_SHARE_LAYOUT.personBehind);
  return {
    phase, displacement, speed, docked, lockConfirmed: phase === 'resting',
    latchTouch: time < 4 ? Math.sin(Math.PI * time / 4) ** 2 :
      time >= 28 && time < 32 ? Math.sin(Math.PI * (time - 28) / 4) ** 2 : 0,
    bikeX: bike.x, bikeZ: bike.z,
    personX: person.x, personZ: person.z,
    occupiedSlots: Array.from({ length: BIKE_SHARE_LAYOUT.slots }, (_, slot) =>
      slot === 0 ? docked : slot !== BIKE_SHARE_LAYOUT.emptySlot),
    awayBikes: docked ? 0 : 1,
  };
}

/** Entire authored bay, including the user's conservative 0.8 x 1.2 m envelope. */
export function bikeShareBounds(station: BikeShareStation) {
  const a = bikeSharePoint(station, BIKE_SHARE_LAYOUT.padMinX, BIKE_SHARE_LAYOUT.padMinZ);
  const b = bikeSharePoint(station, BIKE_SHARE_LAYOUT.padMaxX, BIKE_SHARE_LAYOUT.padMaxZ);
  return {
    minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z),
  };
}

/** Fail before building if a bay overlaps through-walking, crossings, or the map edge. */
export function validateBikeShareStations(stations: readonly BikeShareStation[] = BIKE_SHARE_STATIONS): void {
  const ids = new Set<string>();
  for (const station of stations) {
    const bounds = bikeShareBounds(station);
    const pocket = BIKE_SHARE_POCKETS[station.id as keyof typeof BIKE_SHARE_POCKETS];
    const unsafeSite = !pocket || (station.yaw !== 0 && station.yaw !== Math.PI / 2) ||
      bounds.minX < pocket.minX || bounds.maxX > pocket.maxX ||
      bounds.minZ < pocket.minZ || bounds.maxZ > pocket.maxZ || station.surfaceY !== pocket.surfaceY;
    if (!station.id || ids.has(station.id) || !Number.isFinite(station.x) ||
      !Number.isFinite(station.z) || !Number.isFinite(station.phase) || station.phase < 0 ||
      unsafeSite ||
      bounds.minX < -CITY_EXTENT.x || bounds.maxX > CITY_EXTENT.x ||
      bounds.minZ < -CITY_EXTENT.z || bounds.maxZ > CITY_EXTENT.z) {
      throw new Error(`Unsafe shared-bike bay: ${station.id}.`);
    }
    ids.add(station.id);
    for (const other of stations) {
      if (other === station) continue;
      const b = bikeShareBounds(other);
      if (bounds.minX < b.maxX && bounds.maxX > b.minX && bounds.minZ < b.maxZ && bounds.maxZ > b.minZ) {
        throw new Error(`Overlapping shared-bike bays: ${station.id}.`);
      }
    }
  }
}
