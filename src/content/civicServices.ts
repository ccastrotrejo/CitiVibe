export type CivicServiceId = 'civic-hospital' | 'civic-fire-station' | 'civic-police-station';
export type CivicServiceKind = 'hospital' | 'fire-station' | 'police-station';
export type CivicStaff =
  | { readonly id: `city-walker-${number}`; readonly occupation: 'healthcare-worker'; readonly outfit: 'scrubs' | 'lab-coat' }
  | { readonly id: `city-walker-${number}`; readonly occupation: 'firefighter'; readonly outfit: 'fire-station-wear' }
  | { readonly id: `city-walker-${number}`; readonly occupation: 'police-officer'; readonly outfit: 'police-uniform' };

export interface CivicService {
  readonly id: CivicServiceId;
  readonly kind: CivicServiceKind;
  readonly buildingId: `street-building-${number}`;
  readonly blockId: `block-${number}-${number}`;
  readonly label: string;
  readonly entry: {
    readonly axis: 'x' | 'z';
    readonly side: -1 | 1;
    readonly along: number;
    readonly width: number;
    /** Frontage-aligned safe sidewalk target, not an enterable interior or stair. */
    readonly x: number;
    readonly z: number;
  };
  readonly staff: readonly CivicStaff[];
}

/** Original neighborhood services; static IDs avoid a people/street/building import cycle. */
export const CIVIC_SERVICES: readonly CivicService[] = Object.freeze([
  {
    id: 'civic-hospital', kind: 'hospital', buildingId: 'street-building-63', blockId: 'block-2-0',
    label: 'Hospital',
    entry: { axis: 'z', side: 1, along: 0, width: 2.8, x: 7.8, z: -138.2 },
    staff: [
      { id: 'city-walker-3', occupation: 'healthcare-worker', outfit: 'lab-coat' },
      { id: 'city-walker-27', occupation: 'healthcare-worker', outfit: 'scrubs' },
      { id: 'city-walker-51', occupation: 'healthcare-worker', outfit: 'scrubs' },
      { id: 'city-walker-75', occupation: 'healthcare-worker', outfit: 'lab-coat' },
    ],
  },
  {
    id: 'civic-fire-station', kind: 'fire-station', buildingId: 'street-building-60', blockId: 'block-1-0',
    label: 'Fire station',
    entry: { axis: 'z', side: 1, along: 3.2, width: 1.4, x: -57.8, z: -138.2 },
    staff: [
      { id: 'city-walker-2', occupation: 'firefighter', outfit: 'fire-station-wear' },
      { id: 'city-walker-26', occupation: 'firefighter', outfit: 'fire-station-wear' },
      { id: 'city-walker-50', occupation: 'firefighter', outfit: 'fire-station-wear' },
      { id: 'city-walker-74', occupation: 'firefighter', outfit: 'fire-station-wear' },
    ],
  },
  {
    id: 'civic-police-station', kind: 'police-station', buildingId: 'street-building-93', blockId: 'block-3-4',
    label: 'Police station',
    entry: { axis: 'z', side: 1, along: 0, width: 1.8, x: 61, z: 155.8 },
    staff: [
      { id: 'city-walker-47', occupation: 'police-officer', outfit: 'police-uniform' },
      { id: 'city-walker-71', occupation: 'police-officer', outfit: 'police-uniform' },
      { id: 'city-walker-119', occupation: 'police-officer', outfit: 'police-uniform' },
      { id: 'city-walker-143', occupation: 'police-officer', outfit: 'police-uniform' },
    ],
  },
] satisfies readonly CivicService[]);

/** A visual workplace assignment never owns a second person or a separate actor lifetime. */
export function getCivicStaffAssignment(id: string): { service: CivicService; staff: CivicStaff } | undefined {
  for (const service of CIVIC_SERVICES) {
    const staff = service.staff.find((person) => person.id === id);
    if (staff) return { service, staff };
  }
  return undefined;
}
