import { ROAD_HALF_WIDTH, SIDEWALK_OFFSET, STREET_X, STREET_Z, TWO_WAY_BIKE_STREETS } from './streets';
import { PARKING_BAYS, propBounds, type StreetProp } from './streetFurniture';

export interface CivicUtility extends StreetProp {
  kind: 'hydrant' | 'litter-basket' | 'service-cover';
  width: number;
  depth: number;
  surfaceY: number;
}

/** Interior plaza services and small setouts in spare non-cycling curb pockets, never the island border. */
export const CIVIC_UTILITIES: readonly CivicUtility[] = [
  { id: 'west-hydrant', kind: 'hydrant', x: 0, z: -99.97, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'east-hydrant', kind: 'hydrant', x: -30, z: 99.97, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'lantern-hydrant', kind: 'hydrant', x: -84.35, z: -147, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'crosstown-hydrant', kind: 'hydrant', x: -67.65, z: -114, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'west-park-hydrant', kind: 'hydrant', x: -54.35, z: -76, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'east-park-hydrant', kind: 'hydrant', x: 54.35, z: -76, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'willow-hydrant', kind: 'hydrant', x: 67.65, z: -108, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'harbor-hydrant', kind: 'hydrant', x: 84.35, z: -147, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'alder-hydrant', kind: 'hydrant', x: -84.35, z: 114, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'orchard-hydrant', kind: 'hydrant', x: -67.65, z: 147, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'southwest-park-hydrant', kind: 'hydrant', x: -54.35, z: 76, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'southeast-park-hydrant', kind: 'hydrant', x: 54.35, z: 76, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'juniper-hydrant', kind: 'hydrant', x: 67.65, z: 114, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'police-hydrant', kind: 'hydrant', x: 84.35, z: 147, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'mall-hydrant', kind: 'hydrant', x: -37.65, z: 114, yaw: Math.PI, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'west-litter-basket', kind: 'litter-basket', x: -57.5, z: -1.8, yaw: Math.PI / 2, width: 0.62, depth: 0.62, surfaceY: 0.025 },
  { id: 'east-litter-basket', kind: 'litter-basket', x: 64.1, z: 43.2, yaw: -Math.PI / 2, width: 0.62, depth: 0.62, surfaceY: 0.025 },
  { id: 'west-service-cover', kind: 'service-cover', x: -63.6, z: -44.7, yaw: 0, width: 0.64, depth: 0.9, surfaceY: 0.025 },
  { id: 'east-service-cover', kind: 'service-cover', x: 64.8, z: 0.6, yaw: 0, width: 0.64, depth: 0.9, surfaceY: 0.025 },
];

export const SIDEWALK_ZONING = {
  walkingHalfWidth: 0.5,
  outerOffset: SIDEWALK_OFFSET + 1.5,
} as const;

/** Tests and destination authors use the same full body corridor, not just a path centerline. */
export function outsideWalkingCorridors(prop: StreetProp, width: number, depth: number): boolean {
  const bounds = propBounds(prop, width, depth);
  return [STREET_X, STREET_Z].every((roads, axis) => roads.every((road) => [-1, 1].every((side) => {
    const inner = road + side * (SIDEWALK_OFFSET - SIDEWALK_ZONING.walkingHalfWidth);
    const outer = road + side * SIDEWALK_ZONING.outerOffset;
    const low = Math.min(inner, outer);
    const high = Math.max(inner, outer);
    return axis === 0
      ? bounds.maxX < low || bounds.minX > high
      : bounds.maxZ < low || bounds.minZ > high;
  })));
}

const INTERIOR_DRAIN_ROADS = [-132, -95, 95, 132] as const;
const DRAIN_X_CANDIDATES = [-89, -61, -28, 28, 61] as const;
const DRAIN_WIDTH = 1.2;
const DRAIN_DEPTH = 0.6;

function separatedFromParking(x: number, z: number): boolean {
  const bounds = propBounds({ id: 'candidate-drain', x, z, yaw: 0 }, DRAIN_WIDTH, DRAIN_DEPTH);
  return PARKING_BAYS.every((bay) => {
    const bayBounds = propBounds(bay, bay.width, bay.length);
    return bounds.maxX < bayBounds.minX || bounds.minX > bayBounds.maxX ||
      bounds.maxZ < bayBounds.minZ || bounds.minZ > bayBounds.maxZ;
  });
}

/** Dense original curb grates on interior horizontal streets, skipping bike-track and parking sides. */
export const STREET_DRAINS = INTERIOR_DRAIN_ROADS.flatMap((roadZ) => [-1, 1].flatMap((curbSide) => {
  if (TWO_WAY_BIKE_STREETS.some((track) => track.z === roadZ && track.side === curbSide)) return [];
  return DRAIN_X_CANDIDATES.flatMap((x) => {
    const z = roadZ + curbSide * (ROAD_HALF_WIDTH - 0.35);
    if (!separatedFromParking(x, z)) return [];
    return [{
      id: `curb-drain-${roadZ}-${curbSide}-${x}`,
      x, z, yaw: 0,
      width: DRAIN_WIDTH, depth: DRAIN_DEPTH,
      roadZ, curbZ: roadZ + curbSide * (ROAD_HALF_WIDTH + 0.09), curbSide,
      surfaceY: -0.005,
      grateTopY: -0.005,
      recessY: -0.02,
      mouthBottomY: -0.02,
      mouthTopY: 0.06,
      curbTopY: 0.09,
      snowRetention: 0,
    }];
  });
})).slice(0, 30);

/** Interior paved plaza maintenance pocket; the stable ID survives the relocation. No underground network. */
export const STEAM_PILOT = {
  id: 'east-maintenance-stack', x: -64.5, z: -43, yaw: 0,
  width: 0.72, depth: 0.72, surfaceY: 0.025, baseY: 0.025,
  stackRadius: 0.24, height: 2.7,
  outletY: 2.725, topY: 2.73,
} as const;

export const STEAM_STACKS = [
  STEAM_PILOT,
  { id: 'west-maintenance-stack', x: -84.35, z: 58, yaw: 0, width: 0.72, depth: 0.72, surfaceY: 0.025, baseY: 0.025,
    stackRadius: 0.24, height: 2.7, outletY: 2.725, topY: 2.73 },
  { id: 'east-plaza-stack', x: 84.35, z: -58, yaw: 0, width: 0.72, depth: 0.72, surfaceY: 0.025, baseY: 0.025,
    stackRadius: 0.24, height: 2.7, outletY: 2.725, topY: 2.73 },
  { id: 'south-plaza-stack', x: 84.35, z: 76, yaw: 0, width: 0.72, depth: 0.72, surfaceY: 0.025, baseY: 0.025,
    stackRadius: 0.24, height: 2.7, outletY: 2.725, topY: 2.73 },
] as const;

export interface MaintenanceStrip {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surfaceY: number;
  snowRetention: number;
}

/** Bounded scenic clearing: existing main gate paths and drain aprons, not a calendar or hydraulic model. */
export const MAINTENANCE_STRIPS: readonly MaintenanceStrip[] = [
  { id: 'north-gate-clearing', minX: -0.95, maxX: 0.95, minZ: -89.4, maxZ: -84,
    surfaceY: -0.012, snowRetention: 0 },
  { id: 'south-gate-clearing', minX: -1.8, maxX: 1.8, minZ: 81, maxZ: 89.4,
    surfaceY: -0.012, snowRetention: 0 },
  ...STREET_DRAINS.map((drain) => ({
    id: `${drain.id}-clearing`, minX: drain.x - 0.9, maxX: drain.x + 0.9,
    minZ: drain.z - 0.3, maxZ: drain.z + 0.55,
    surfaceY: drain.surfaceY, snowRetention: drain.snowRetention,
  })),
];
