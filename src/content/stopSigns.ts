import { CITY_EXTENT, SIGNAL_POLE_OFFSET, STOP_LINE_OFFSET, STOP_SIGN_INTERSECTIONS } from './streets';

export const STOP_SIGN_VERSION = 'stop-signs-001';

/** An original blade at ordinary urban proportions: 0.76 m across the flats, hung clear of walkers. */
export const STOP_SIGN_GEOMETRY = {
  width: 0.76,
  bottom: 2.12,
  plaqueHeight: 0.2,
  plaqueGap: 0.09,
  postRadius: 0.048,
  /** Curb-side offset, matching the signal poles that quiet corners no longer carry. */
  lateral: SIGNAL_POLE_OFFSET,
  /** Along the approach, level with the painted stop bar drivers must halt behind. */
  approach: STOP_LINE_OFFSET,
} as const;

export interface StopSignPost {
  id: string;
  intersectionId: string;
  x: number;
  z: number;
  /** Facing the oncoming driver; +Z at yaw 0. */
  yaw: number;
}

/** One right-hand blade per posted approach, skipping approaches that leave the modelled map. */
export const STOP_SIGN_POSTS: readonly StopSignPost[] = STOP_SIGN_INTERSECTIONS.flatMap((intersection) =>
  [true, false].flatMap((vertical) =>
    [-1, 1].flatMap((side) => {
      const { lateral, approach } = STOP_SIGN_GEOMETRY;
      const x = intersection.x + (vertical ? side * lateral : side * approach);
      const z = intersection.z + (vertical ? side * approach : -side * lateral);
      if (Math.abs(x) > CITY_EXTENT.x - 0.5 || Math.abs(z) > CITY_EXTENT.z - 0.5) return [];
      return [{
        id: `${intersection.id}-stop-${vertical ? 'ns' : 'ew'}-${side > 0 ? 'a' : 'b'}`,
        intersectionId: intersection.id, x, z,
        yaw: vertical ? (side < 0 ? Math.PI : 0) : side * Math.PI / 2,
      }];
    })));
