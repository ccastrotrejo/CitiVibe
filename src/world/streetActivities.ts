import { BIKE_SHARE_POCKETS } from '../content/bikeShare';
import { METRO_OPENINGS } from '../content/metro';
import { FOOD_CARTS, foodCartBounds } from '../content/streetFurniture';
import { buildingFrontPoint, buildingFrontSpan } from './buildingFabric';
import type { ActivityDestination } from './destinationActivities';
import { SIDEWALK_SHEDS, STREET_BUILDINGS, type StreetBuilding } from './streetscape';
import type { TrafficRoute } from './traffic';

export interface StreetActivityStop {
  block: number;
  lane: number;
  distance: number;
  destination: ActivityDestination;
}

/** Project a facade pocket onto a real walking link, retaining room for both merge hold lines. */
export function frontageActivity(
  routes: readonly (readonly TrafficRoute[])[], building: StreetBuilding, lane: number, frontageAlong: number,
  activity: Pick<ActivityDestination, 'id' | 'activity' | 'duration' | 'pauseAfter'>, landingRoom = 5.8,
): StreetActivityStop | undefined {
  if (building.stoop || SIDEWALK_SHEDS.some(({ buildingId }) => buildingId === building.id)) return;
  const pocket = { ...buildingFrontPoint(building, frontageAlong, 1.05), y: 0 };
  const front = buildingFrontPoint(building, frontageAlong, 0);
  const block = routes.findIndex(([route]) => route.id === building.blockId);
  if (block < 0) return;
  const excluded = [...Object.values(BIKE_SHARE_POCKETS), ...METRO_OPENINGS, ...FOOD_CARTS.map(foodCartBounds)];
  for (const segment of routes[block][lane].segments) {
    if (segment.kind !== 'link') continue;
    const along = (pocket.x - segment.x) * segment.dx + (pocket.z - segment.z) * segment.dz;
    if (along < landingRoom - 1e-7 || along > segment.length - landingRoom + 1e-7) continue;
    const entry = { x: segment.x + segment.dx * along, y: 0, z: segment.z + segment.dz * along };
    const length = Math.hypot(pocket.x - entry.x, pocket.z - entry.z);
    if (length < 1.15 || length > 3.5 ||
      (front.x - pocket.x) * (pocket.x - entry.x) + (front.z - pocket.z) * (pocket.z - entry.z) <= 0) continue;
    const bounds = { minX: Math.min(entry.x, pocket.x) - 0.7, maxX: Math.max(entry.x, pocket.x) + 0.7,
      minZ: Math.min(entry.z, pocket.z) - 0.7, maxZ: Math.max(entry.z, pocket.z) + 0.7 };
    if (excluded.some((other) => bounds.minX < other.maxX && bounds.maxX > other.minX &&
      bounds.minZ < other.maxZ && bounds.maxZ > other.minZ)) continue;
    return { block, lane, distance: segment.start + along, destination: {
      ...activity, entry, pocket, heading: Math.atan2(front.x - pocket.x, front.z - pocket.z),
    } };
  }
}

/** Select one real display window with a clear setback; no invented door or indoor teleport. */
export function storefrontActivity(routes: readonly (readonly TrafficRoute[])[]): StreetActivityStop {
  for (const building of STREET_BUILDINGS) {
    if (!building.storefront || building.use !== 'mixed-use') continue;
    const windowAlong = Math.min(1.1, buildingFrontSpan(building) * 0.25);
    const stop = frontageActivity(routes, building, 1, windowAlong, {
      id: `${building.id}-window`, activity: 'window-shopping', duration: 4.5,
    });
    if (stop) return stop;
  }
  throw new Error('No clear existing storefront activity pocket.');
}
