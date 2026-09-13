import { CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, STREET_X } from './streets';
import { PARK_BOUNDS, PARK_PATHS } from './park';
import { BASKETBALL_COURT, PICKLEBALL_COURT, RECREATION_AREA } from './courts';
import { Vector3 } from 'three';

/** A cantilevered cobra-head street lamp on the sidewalk; `arm` points its luminaire over the road. */
export interface StreetLamp {
  id: string;
  x: number;
  z: number;
  arm: 1 | -1;
}

/** A short globe lamp lighting a park path. */
export interface ParkLamp {
  id: string;
  x: number;
  z: number;
}

/** Shielded recreation light outside the runoff, aimed inward at its playing surface. */
export interface CourtLamp extends ParkLamp {
  targetZ: number;
  radius: number;
}

/** Shared fixture proportions; heads and pools are driven on at dusk by the environment layer. */
export const LAMP_GEOMETRY = {
  streetHeight: 5,
  parkHeight: 3.4,
  poleRadius: 0.08,
  armLength: 2.4,
  armHeight: 4.72,
  headSize: [0.44, 0.2, 0.72],
  headDrop: 0.32,
  parkGlobeRadius: 0.34,
  streetPoolRadius: 6.5,
  parkPoolRadius: 4.6,
  courtHeight: 6.4,
  courtBaseRadius: 0.22,
} as const;

/** Sidewalk offset from the road centreline: just past the kerb, clear of the traffic lane. */
const SIDEWALK_LAMP_OFFSET = ROAD_HALF_WIDTH + 0.5;
const CORNER_LAMP_APPROACH = 9.6;
/** North-south fill positions so long avenue blocks are not left dark between corners. */
const AVENUE_FILL_Z = [-63, -31, 0, 31, 63] as const;

function buildStreetLamps(): readonly StreetLamp[] {
  const lamps: StreetLamp[] = [];
  INTERSECTIONS.forEach(({ id, x, z }, index) => {
    const cornerX = index % 2 === 0 ? 1 : -1;
    const cornerZ = Math.floor(index / STREET_X.length) % 2 === 0 ? 1 : -1;
    lamps.push({ id: `${id}-corner-lamp`, x: x + cornerX * SIDEWALK_LAMP_OFFSET, z: z + cornerZ * CORNER_LAMP_APPROACH, arm: cornerX === 1 ? -1 : 1 });
  });
  STREET_X.forEach((x, column) => {
    AVENUE_FILL_Z.forEach((z, row) => {
      const side = (column + row) % 2 === 0 ? 1 : -1;
      lamps.push({ id: `avenue-${column}-fill-${row}-lamp`, x: x + side * SIDEWALK_LAMP_OFFSET, z, arm: side === 1 ? -1 : 1 });
    });
  });
  return lamps;
}

export const STREET_LAMPS: readonly StreetLamp[] = Object.freeze(buildStreetLamps());

export const PARK_LAMPS: readonly ParkLamp[] = Object.freeze([
  { id: 'mall-north-lamp', x: 3.1, z: 76.2 },
  { id: 'mall-mid-lamp', x: 3.1, z: 58 },
  { id: 'mall-south-lamp', x: 3.1, z: 42 },
  { id: 'east-walk-a-lamp', x: 29.6, z: 5.2 },
  { id: 'east-walk-b-lamp', x: 21.2, z: 18.2 },
  { id: 'east-walk-c-lamp', x: 12.2, z: 27.4 },
  { id: 'lake-walk-a-lamp', x: -29.4, z: 3.6 },
  { id: 'lake-walk-b-lamp', x: -31, z: 24.6 },
  { id: 'lake-walk-c-lamp', x: -27.4, z: 45.6 },
  { id: 'ramble-a-lamp', x: 2.6, z: -78.4 },
  { id: 'ramble-b-lamp', x: -28.4, z: -77 },
  { id: 'ramble-c-lamp', x: -31.2, z: -48.7 },
  { id: 'ramble-d-lamp', x: -29.4, z: -14.8 },
  { id: 'meadow-a-lamp', x: 26.3, z: 81.6 },
  { id: 'meadow-b-lamp', x: 26.4, z: 45.2 },
]);

export const COURT_LAMPS: readonly CourtLamp[] = Object.freeze([
  ...[-1, 1].flatMap((side) => [-1, 1].map((end) => ({
    id: `basketball-${side}-${end}-light`,
    x: BASKETBALL_COURT.x + side * 7,
    z: BASKETBALL_COURT.z + end * (BASKETBALL_COURT.runoffDepth / 2 + 0.8),
    targetZ: BASKETBALL_COURT.z + end * 3.5,
    radius: 10,
  }))),
  ...[-1, 1].map((side) => ({
    id: `pickleball-${side}-light`,
    x: PICKLEBALL_COURT.x,
    z: PICKLEBALL_COURT.z + side * (PICKLEBALL_COURT.runoffDepth / 2 + 0.8),
    targetZ: PICKLEBALL_COURT.z + side * 1.2,
    radius: 8,
  })),
]);

/** Reject off-parcel fixtures and poles obstructing lawns, paths or court runoffs. */
export function validateLighting(
  streetLamps: readonly StreetLamp[] = STREET_LAMPS,
  parkLamps: readonly ParkLamp[] = PARK_LAMPS,
  courtLamps: readonly CourtLamp[] = COURT_LAMPS,
): void {
  const ids = new Set<string>();
  for (const lamp of [...streetLamps, ...parkLamps, ...courtLamps]) {
    if (ids.has(lamp.id)) throw new Error(`Duplicate lamp id: ${lamp.id}.`);
    ids.add(lamp.id);
    if (Math.abs(lamp.x) > CITY_EXTENT.x || Math.abs(lamp.z) > CITY_EXTENT.z) {
      throw new Error(`Lamp ${lamp.id} falls outside the island.`);
    }
  }
  for (const lamp of courtLamps) {
    const clearance = LAMP_GEOMETRY.courtBaseRadius;
    if (lamp.x - clearance < RECREATION_AREA.minX || lamp.x + clearance > RECREATION_AREA.maxX ||
      lamp.z - clearance < RECREATION_AREA.minZ || lamp.z + clearance > RECREATION_AREA.maxZ) {
      throw new Error(`Court light ${lamp.id} leaves the recreation parcel.`);
    }
    if (lamp.x + clearance > RECREATION_AREA.passageMinX && lamp.x - clearance < RECREATION_AREA.passageMaxX) {
      throw new Error(`Court light ${lamp.id} blocks the shared passage.`);
    }
    for (const court of [BASKETBALL_COURT, PICKLEBALL_COURT]) {
      if (Math.abs(lamp.x - court.x) < court.runoffWidth / 2 + clearance &&
        Math.abs(lamp.z - court.z) < court.runoffDepth / 2 + clearance) {
        throw new Error(`Court light ${lamp.id} blocks a court runoff.`);
      }
    }
  }
  for (const lamp of streetLamps) {
    if (Math.abs(lamp.x) < PARK_BOUNDS.x - 0.5 && Math.abs(lamp.z) < PARK_BOUNDS.z - 0.5) {
      throw new Error(`Street lamp ${lamp.id} intrudes on the park lawn.`);
    }
  }
  for (const lamp of parkLamps) {
    if (Math.abs(lamp.x) > PARK_BOUNDS.x || Math.abs(lamp.z) > PARK_BOUNDS.z) {
      throw new Error(`Park lamp ${lamp.id} is outside the park.`);
    }
  }
  const sample = new Vector3();
  for (const lamp of parkLamps) {
    for (const path of PARK_PATHS) {
      const clearance = path.width / 2 + 0.05 + LAMP_GEOMETRY.poleRadius;
      const steps = 400;
      for (let i = 0; i <= steps; i += 1) {
        path.curve.getPointAt(i / steps, sample);
        if (Math.hypot(sample.x - lamp.x, sample.z - lamp.z) < clearance) {
          throw new Error(`Park lamp ${lamp.id} blocks the ${path.id} path.`);
        }
      }
    }
  }
}
