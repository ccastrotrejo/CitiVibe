import { SIDEWALK_OFFSET, STREET_X, STREET_Z } from './streets';
import { propBounds, type StreetProp } from './streetFurniture';

export interface CivicUtility extends StreetProp {
  kind: 'hydrant' | 'litter-basket' | 'service-cover';
  width: number;
  depth: number;
  surfaceY: number;
}

/** Interior plaza services and two small setouts in the spare non-cycling curb, never the island border. */
export const CIVIC_UTILITIES: readonly CivicUtility[] = [
  { id: 'west-hydrant', kind: 'hydrant', x: 0, z: -99.97, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
  { id: 'east-hydrant', kind: 'hydrant', x: -30, z: 99.97, yaw: 0, width: 0.66, depth: 0.66, surfaceY: 0.09 },
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

/** Two original grates on the spare curb; dimensions are authored, not measured from a photo. */
export const STREET_DRAINS = [-28, 28].map((x, index) => ({
  id: `north-curb-drain-${index + 1}`,
  x, z: -99.65, yaw: 0,
  width: 1.2, depth: 0.6,
  roadZ: -95, curbZ: -100.09, curbSide: -1,
  surfaceY: -0.005,
  grateTopY: -0.005,
  recessY: -0.02,
  mouthBottomY: -0.02,
  mouthTopY: 0.06,
  curbTopY: 0.09,
  snowRetention: 0,
}));

/** Interior paved plaza maintenance pocket; the stable ID survives the relocation. No underground network. */
export const STEAM_PILOT = {
  id: 'east-maintenance-stack', x: -64.5, z: -43, yaw: 0,
  width: 0.72, depth: 0.72, surfaceY: 0.025, baseY: 0.025,
  stackRadius: 0.24, height: 2.7,
  outletY: 2.725, topY: 2.73,
} as const;

export const STEAM_STACKS = [STEAM_PILOT] as const;

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
