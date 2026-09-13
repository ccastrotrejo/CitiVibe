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

export interface TrafficSignalState {
  id: string;
  phase: 'north-south' | 'east-west' | 'clearance' | 'pedestrians';
}

export const INTERSECTIONS = STREET_Z.flatMap((z, row) =>
  STREET_X.map((x, column) => ({ id: `intersection-${column}-${row}`, x, z })));

export const STREET_BLOCKS = STREET_Z.slice(0, -1).flatMap((minZ, row) =>
  STREET_X.slice(0, -1).flatMap((minX, column) => column === 2 && row === 2 ? [] : [{
    id: `block-${column}-${row}`,
    minX,
    maxX: STREET_X[column + 1],
    minZ,
    maxZ: STREET_Z[row + 1],
  }]));

export type TrafficVehicleType = 'sedan' | 'taxi' | 'van' | 'truck' | 'bus' | 'bicycle';

export interface TrafficActorDefinition {
  id: string;
  kind: 'car' | 'bus' | 'cyclist' | 'pedestrian';
  vehicleType?: TrafficVehicleType;
}

const VEHICLE_TYPES = ['sedan', 'taxi', 'van', 'truck', 'sedan', 'bus'] as const;
const ADDITIONAL_VEHICLE_TYPES = ['sedan', 'taxi', 'van', 'truck'] as const;

/** Fixed semantic population; appearance is independent of simulation internals. */
export const TRAFFIC_ACTORS: readonly TrafficActorDefinition[] = Object.freeze([
  ...Array.from({ length: 36 }, (_, index): TrafficActorDefinition => {
    const vehicleType = VEHICLE_TYPES[index % VEHICLE_TYPES.length];
    return { id: `city-vehicle-${index + 1}`, kind: vehicleType === 'bus' ? 'bus' : 'car', vehicleType };
  }),
  ...Array.from({ length: 12 }, (_, index): TrafficActorDefinition =>
    ({ id: `city-vehicle-${index + 37}`, kind: 'car', vehicleType: ADDITIONAL_VEHICLE_TYPES[index % ADDITIONAL_VEHICLE_TYPES.length] })),
  ...Array.from({ length: 12 }, (_, index): TrafficActorDefinition =>
    ({ id: `city-cyclist-${index + 1}`, kind: 'cyclist', vehicleType: 'bicycle' })),
  ...Array.from({ length: STREET_BLOCKS.length * 7 }, (_, index): TrafficActorDefinition =>
    ({ id: `city-walker-${index + 1}`, kind: 'pedestrian' })),
]);
