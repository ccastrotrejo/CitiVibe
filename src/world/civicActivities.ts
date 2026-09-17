import { CIVIC_SERVICES, type CivicServiceKind } from '../content/civicServices';
import { STREET_BUILDINGS } from './streetscape';
import { frontageActivity, type StreetActivityStop } from './streetActivities';
import type { TrafficRoute } from './traffic';

/** Beside the public doors; the fire-station pocket is between its garage and personnel door. */
export const CIVIC_WORK_ALONG: Readonly<Record<CivicServiceKind, number>> = {
  hospital: 3, 'fire-station': 1.1, 'police-station': -1.9,
};

/** Two approach variants share one exclusive workplace reservation, never two staff at one point. */
export function civicActivities(routes: readonly (readonly TrafficRoute[])[]): readonly StreetActivityStop[] {
  return CIVIC_SERVICES.flatMap((service) => {
    const building = STREET_BUILDINGS.find(({ id }) => id === service.buildingId)!;
    return [0, 1].map((lane) => {
      const stop = frontageActivity(routes, building, lane, CIVIC_WORK_ALONG[service.kind], {
        id: `${service.id}-staff`, activity: 'civic-duty', duration: 5.5, pauseAfter: 2.5,
      }, 5.1);
      if (!stop) throw new Error(`No safe staff approach for ${service.id}, walking lane ${lane}.`);
      return stop;
    });
  });
}
