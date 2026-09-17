import { LOADING_STOP, type TrafficServiceState } from '../content/transitService';
import type { ActivityDestination, DestinationVisit } from './destinationActivities';
import type { StreetActivityStop } from './streetActivities';
import type { TrafficRoute } from './traffic';
import { LOADING_FRONTAGE } from './loadingFrontage';

export const SERVICE_VISITOR_ID = 'city-walker-17';
export const SERVICE_VISIT_ID = `${LOADING_STOP.id}-visit`;
export const SERVICE_VISIT_POCKET = Object.freeze({
  x: LOADING_FRONTAGE.target.x, y: 0, z: LOADING_FRONTAGE.target.z,
});

/** A nearby sidewalk visit, not a curb crossing, parcel exchange, or building entrance. */
export function serviceActivities(routes: readonly (readonly TrafficRoute[])[]): StreetActivityStop[] {
  const block = routes.findIndex(([route]) => route.id === 'block-2-3');
  if (block < 0) throw new Error('The loading visitor requires the retained Juniper block.');
  return routes[block].map((route, lane) => {
    for (const segment of route.segments) {
      if (segment.kind !== 'link' || segment.dz !== 0 || segment.z > SERVICE_VISIT_POCKET.z) continue;
      const along = (SERVICE_VISIT_POCKET.x - segment.x) * segment.dx;
      const length = SERVICE_VISIT_POCKET.z - segment.z;
      if (along < 5.1 || along > segment.length - 5.1 || length < 1.15 || length > 3.5) continue;
      return { block, lane, distance: segment.start + along, destination: {
        id: SERVICE_VISIT_ID, activity: 'resting', duration: 3.2, waitBeforeUse: 120,
        entry: { x: SERVICE_VISIT_POCKET.x, y: 0, z: segment.z },
        pocket: SERVICE_VISIT_POCKET, heading: Math.PI,
      } };
    }
    throw new Error(`No safe connected service visit from sidewalk lane ${lane}.`);
  });
}

/** A known service may be awaited off-flow; departure cancels an encounter already in use. */
export function serviceVisitAllowed(
  destination: ActivityDestination, services: readonly TrafficServiceState[],
  phase: DestinationVisit['phase'] = 'approaching',
): boolean {
  if (destination.id !== SERVICE_VISIT_ID) return true;
  const service = services.find(({ id }) => id === LOADING_STOP.id);
  if (!service) return false;
  return phase === 'approaching' || phase === 'awaiting' || service.phase === 'dwelling';
}

/** Waiting is not completed work: start only after the real van parks with enough dwell remaining. */
export function serviceVisitReady(destination: ActivityDestination, services: readonly TrafficServiceState[]): boolean {
  if (destination.id !== SERVICE_VISIT_ID) return true;
  const service = services.find(({ id }) => id === LOADING_STOP.id);
  return service?.phase === 'dwelling' && service.remaining >= 8;
}
