export const STREET_X = [-102, -76, -46, 46, 76, 102] as const;
export const STREET_Z = [-162, -132, -95, 95, 132, 162] as const;
export const ROAD_HALF_WIDTH = 5;
export const SIDEWALK_HALF_WIDTH = 7;
export const BIKE_OFFSET = 4;
export const VEHICLE_OFFSET = 1.6;
export const SIDEWALK_OFFSET = 6.2;
export const INTERSECTION_GATE = 7;
export const STOP_LINE_OFFSET = 8.5;
export const SIGNAL_POLE_OFFSET = ROAD_HALF_WIDTH + 0.5;
export const CITY_EXTENT = { x: 110, z: 170 } as const;

export const TWO_WAY_BIKE_TRACK = {
  offset: 3.95, width: 2.1, laneOffset: 0.5, separatorOffset: 2.94,
} as const;
export const TWO_WAY_BIKE_STREETS = [
  { z: STREET_Z[2], side: 1 },
  { z: STREET_Z[3], side: -1 },
] as const;

/** Signed right-of-travel offset; counterflow shares the park-side protected track. */
export function bikeLaneOffset(axis: 'north-south' | 'east-west', road: number, direction: number): number {
  const track = axis === 'east-west' ? TWO_WAY_BIKE_STREETS.find(({ z }) => z === road) : undefined;
  return track
    ? direction * track.side * TWO_WAY_BIKE_TRACK.offset + TWO_WAY_BIKE_TRACK.laneOffset
    : BIKE_OFFSET;
}

/** Signalized corners run a fixed cycle; quiet corners are posted all-way stops instead. */
export type IntersectionControl = 'signal' | 'all-way-stop';

export interface TrafficSignalState {
  id: string;
  control: IntersectionControl;
  phase: 'north-south' | 'east-west' | 'clearance' | 'pedestrians' | 'stop';
  /** True while the crosswalks may be entered: a WALK phase, or a clear all-way stop. */
  walk: boolean;
}

export interface Intersection {
  id: string;
  x: number;
  z: number;
  control: IntersectionControl;
}

/** Seeded so the posted corners are reproducible art, not a per-load surprise. */
const STOP_SIGN_SEED = 2401;
const STOP_SIGN_SHARE = 0.45;

/** The park-fronting avenues and cross streets carry the through traffic and keep their signals. */
function isArterial(x: number, z: number): boolean {
  return x === STREET_X[2] || x === STREET_X[3] || z === STREET_Z[2] || z === STREET_Z[3];
}

export const INTERSECTIONS: readonly Intersection[] = (() => {
  let state = STOP_SIGN_SEED;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return STREET_Z.flatMap((z, row) =>
    STREET_X.map((x, column): Intersection => ({
      id: `intersection-${column}-${row}`, x, z,
      control: !isArterial(x, z) && random() < STOP_SIGN_SHARE ? 'all-way-stop' : 'signal',
    })));
})();

export const STOP_SIGN_INTERSECTIONS = INTERSECTIONS.filter(({ control }) => control === 'all-way-stop');
export const SIGNALED_INTERSECTIONS = INTERSECTIONS.filter(({ control }) => control === 'signal');

export const STREET_BLOCKS = STREET_Z.slice(0, -1).flatMap((minZ, row) =>
  STREET_X.slice(0, -1).flatMap((minX, column) => column === 2 && row === 2 ? [] : [{
    id: `block-${column}-${row}`,
    minX,
    maxX: STREET_X[column + 1],
    minZ,
    maxZ: STREET_Z[row + 1],
  }]));

export type TrafficVehicleType =
  | 'sedan' | 'taxi' | 'van' | 'truck' | 'bus' | 'bicycle'
  | 'ambulanceVan' | 'ambulanceBox' | 'firetruck' | 'fireSuv' | 'policeSuv';

export interface TrafficActorDefinition {
  id: string;
  kind: 'car' | 'bus' | 'cyclist' | 'pedestrian';
  vehicleType?: TrafficVehicleType;
}

const VEHICLE_TYPES = ['sedan', 'taxi', 'van', 'truck', 'sedan', 'bus'] as const;
const ADDITIONAL_VEHICLE_TYPES = ['sedan', 'taxi', 'van', 'truck'] as const;
/**
 * Ambulances, fire-service vehicles and patrol SUVs join ordinary traffic. Each re-skins an
 * existing car in place, so the simulation footprint (TRAFFIC_LENGTHS) and every seeded
 * placement stay identical: emergency vehicles only replace a same-length regular vehicle.
 */
const EMERGENCY_OVERRIDES: ReadonlyMap<string, { id: string; vehicleType: TrafficVehicleType }> = new Map([
  ['city-vehicle-1', { id: 'city-vehicle-1', vehicleType: 'policeSuv' }],
  ['city-vehicle-25', { id: 'city-vehicle-25', vehicleType: 'policeSuv' }],
  ['city-vehicle-16', { id: 'city-ambulance-1', vehicleType: 'ambulanceBox' }],
  ['city-vehicle-22', { id: 'city-ambulance-2', vehicleType: 'ambulanceBox' }],
  ['city-vehicle-39', { id: 'city-ambulance-3', vehicleType: 'ambulanceVan' }],
  ['city-vehicle-43', { id: 'city-ambulance-4', vehicleType: 'ambulanceVan' }],
  ['city-vehicle-40', { id: 'city-firetruck-1', vehicleType: 'firetruck' }],
  ['city-vehicle-44', { id: 'city-firetruck-2', vehicleType: 'firetruck' }],
  ['city-vehicle-37', { id: 'city-firetruck-3', vehicleType: 'fireSuv' }],
  ['city-vehicle-41', { id: 'city-firetruck-4', vehicleType: 'fireSuv' }],
]);
const emergency = (definition: TrafficActorDefinition): TrafficActorDefinition => {
  const override = EMERGENCY_OVERRIDES.get(definition.id);
  return override ? { ...definition, ...override } : definition;
};
export const BIKE_SHARE_RIDER_IDS = ['bikeshare-rider-lantern', 'bikeshare-rider-willow', 'bikeshare-rider-juniper'] as const;

/** Fixed semantic population; appearance is independent of simulation internals. */
export const TRAFFIC_ACTORS: readonly TrafficActorDefinition[] = Object.freeze([
  ...Array.from({ length: 36 }, (_, index): TrafficActorDefinition => {
    const vehicleType = VEHICLE_TYPES[index % VEHICLE_TYPES.length];
    return emergency({ id: `city-vehicle-${index + 1}`, kind: vehicleType === 'bus' ? 'bus' : 'car', vehicleType });
  }),
  ...Array.from({ length: 12 }, (_, index): TrafficActorDefinition =>
    emergency({ id: `city-vehicle-${index + 37}`, kind: 'car', vehicleType: ADDITIONAL_VEHICLE_TYPES[index % ADDITIONAL_VEHICLE_TYPES.length] })),
  ...Array.from({ length: 15 }, (_, index): TrafficActorDefinition =>
    ({ id: `city-cyclist-${index + 1}`, kind: 'cyclist', vehicleType: 'bicycle' })),
  ...BIKE_SHARE_RIDER_IDS.map((id): TrafficActorDefinition => ({ id, kind: 'cyclist', vehicleType: 'bicycle' })),
  ...Array.from({ length: 9 }, (_, index): TrafficActorDefinition =>
    ({ id: `shared-cyclist-${index + 1}`, kind: 'cyclist', vehicleType: 'bicycle' })),
  ...Array.from({ length: 200 }, (_, index): TrafficActorDefinition =>
    ({ id: `city-walker-${index + 1}`, kind: 'pedestrian' })),
]);
