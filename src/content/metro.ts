import { PARK_BOUNDS } from './park';

export interface MetroEntrance {
  id: string;
  x: number;
  z: number;
  /** Mouth faces local +Z; all authored entrances use cardinal rotations. */
  yaw: number;
}

export const METRO_ACCESS_NOTE = 'Scenic subway stairs only; no working station or step-free underground connection is modeled.';

/** Several mouths can suggest one fictional station; these are not real transit routes. */
export const METRO_STATIONS = [
  { id: 'north-gate', name: 'North Gate', marker: 'N', entrances: ['crosstown-entrance', 'north-frontage-entrance'] },
  { id: 'west-walk', name: 'West Walk', marker: 'W', entrances: ['west-entrance', 'west-north-entrance', 'west-middle-entrance'] },
  { id: 'east-walk', name: 'East Walk', marker: 'E', entrances: ['east-north-entrance', 'east-south-entrance'] },
  { id: 'south-gate', name: 'South Gate', marker: 'S', entrances: ['south-frontage-entrance'] },
] as const;

export function metroStationFor(entranceId: string) {
  const station = METRO_STATIONS.find(({ entrances }) => (entrances as readonly string[]).includes(entranceId));
  if (!station) throw new Error(`No scenic station grouping for ${entranceId}.`);
  return station;
}

/** Clear stairwell dimensions; surfaceY matches the adjacent sidewalk pavement. */
export const METRO_GEOMETRY = {
  openingWidth: 1.9,
  openingDepth: 4.5,
  surfaceY: -0.08,
  stepCount: 12,
  stepRise: 0.18,
  treadDepth: 0.3,
  landingDepth: 0.9,
  apronDepth: 0.45,
  wallThickness: 0.12,
  railingHeight: 1.08,
  globeHeight: 2.68,
  signHeight: 2.42,
} as const;

const sideScale = PARK_BOUNDS.z / 98;

/** Original compact entrances occupy frontage edges, not the public walking corridors. */
export const METRO_ENTRANCES: readonly MetroEntrance[] = [
  { id: 'crosstown-entrance', x: 67.1, z: -117.8, yaw: 0 },
  { id: 'west-entrance', x: -54.9, z: 51.5 * sideScale, yaw: 0 },
  { id: 'west-north-entrance', x: -54.9, z: -50.5 * sideScale, yaw: 0 },
  { id: 'west-middle-entrance', x: -54.9, z: 0.5 * sideScale, yaw: 0 },
  { id: 'east-north-entrance', x: 67.1, z: -50.5 * sideScale + 2, yaw: 0 },
  { id: 'east-south-entrance', x: 67.1, z: 51.5 * sideScale, yaw: 0 },
  { id: 'north-frontage-entrance', x: -17.5, z: -103.9, yaw: Math.PI / 2 },
  { id: 'south-frontage-entrance', x: 16, z: 123.1, yaw: Math.PI / 2 },
];

/** Exact axis-aligned holes to cut through island/paving geometry; excludes the retaining walls. */
export const METRO_OPENINGS = METRO_ENTRANCES.map(({ id, x, z, yaw }) => {
  const horizontal = Math.abs(Math.sin(yaw)) > 0.5;
  const width = horizontal ? METRO_GEOMETRY.openingDepth : METRO_GEOMETRY.openingWidth;
  const depth = horizontal ? METRO_GEOMETRY.openingWidth : METRO_GEOMETRY.openingDepth;
  return { id, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
});
