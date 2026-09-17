import type { StreetscapeBuilder } from './streetscape';

/** A retained delivery pause beside the closed rear service door, never an indoor destination. */
export const LOADING_FRONTAGE = {
  buildingId: 'street-building-15',
  target: { x: 30, y: 0.025, z: 104.25 },
  recess: { minX: 28.9, maxX: 31.1, backZ: 105.35, height: 2.55 },
} as const;

/** Standing and full-turn clearance stay inside the recessed service frontage. */
export const LOADING_SERVICE_POCKET = {
  id: 'juniper-service-visit', x: LOADING_FRONTAGE.target.x, z: LOADING_FRONTAGE.target.z, yaw: 0,
  width: 1.6, depth: 1.6, surfaceY: LOADING_FRONTAGE.target.y,
} as const;

export interface BuildingLoadingRecess {
  minX: number;
  maxX: number;
  frontZ: number;
  backZ: number;
  height: number;
}

/** Subtract the service opening from solid wall, foundation and trim boxes, retaining supported sides. */
export function recessedBuildingBlock(
  block: StreetscapeBuilder['block'], recess: BuildingLoadingRecess | null,
): StreetscapeBuilder['block'] {
  if (!recess) return block;
  return (surface, x, y, z, width, height, depth, yaw = 0, tint) => {
    const lower = [x - width / 2, y - height / 2, z - depth / 2];
    const upper = [x + width / 2, y + height / 2, z + depth / 2];
    const cutLower = [recess.minX, -0.12, recess.frontZ - 0.4];
    const cutUpper = [recess.maxX, recess.height, recess.backZ];
    if (lower.some((value, axis) => value >= cutUpper[axis] || upper[axis] <= cutLower[axis])) {
      block(surface, x, y, z, width, height, depth, yaw, tint);
      return;
    }
    if (yaw !== 0) throw new Error('The loading recess requires axis-aligned wall solids.');
    const emit = (min: readonly number[], max: readonly number[]) =>
      block(surface, (min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2,
        max[0] - min[0], max[1] - min[1], max[2] - min[2], 0, tint);
    for (let axis = 0; axis < 3; axis++) {
      if (lower[axis] < cutLower[axis]) {
        const end = [...upper];
        end[axis] = cutLower[axis];
        emit(lower, end);
        lower[axis] = cutLower[axis];
      }
      if (upper[axis] > cutUpper[axis]) {
        const start = [...lower];
        start[axis] = cutUpper[axis];
        emit(start, upper);
        upper[axis] = cutUpper[axis];
      }
    }
  };
}

/** Reveal the retained recreation-apron paving and close the service door beneath the upper wall. */
export function buildLoadingFrontage(builder: StreetscapeBuilder, recess: BuildingLoadingRecess): void {
  const { palette: p, block } = builder;
  const { minX, maxX, backZ } = recess;
  const x = (minX + maxX) / 2;
  block(p.roof, x, 1.13, backZ - 0.025, 0.96, 2.18, 0.05);
  for (const side of [-1, 1]) {
    block(p.stone, x + side * 0.58, 1.2, backZ - 0.01, 0.14, 2.4, 0.18);
  }
  block(p.stone, x, 2.31, backZ - 0.01, 1.3, 0.14, 0.18);
  block(p.copperEdge, x - 0.3, 1.12, backZ - 0.07, 0.05, 0.19, 0.035);
}
