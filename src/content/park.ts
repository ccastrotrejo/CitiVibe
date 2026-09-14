import { CatmullRomCurve3, Vector3 } from 'three';

export const PARK_BOUNDS = { x: 39, z: 88 } as const;
export const PARK_RESERVOIR = { x: 0, z: -49.5, radiusX: 24.3, radiusZ: 22.5 } as const;
export const PARK_LAKESIDE = {
  shore: [[-30.6, 25.2], [-27, 18], [-16.2, 16.2], [-6.3, 21.6], [-4.5, 27.9], [-1.8, 34.2],
    [-7.2, 44.1], [-18.9, 48.6], [-28.8, 40.5]],
  bridge: { startX: -32, endX: -9, z: 31.5, width: 2.8, rise: 1.15, landingY: 0.04 },
  fountain: { x: -3, z: 34.2, radius: 2.5 },
  pergolas: [{ x: -6.3, z: 37.8 }, { x: 6.5, z: 37.8 }],
} as const;
export const PARK_ACTORS = [
  ...Array.from({ length: 55 }, (_, index) => ({ id: `walker-${index + 1}`, gait: 'walk' as const })),
  ...Array.from({ length: 24 }, (_, index) => ({ id: `runner-${index + 1}`, gait: 'run' as const })),
];
export const PARK_PICNICS = [[5.4, -7.2], [15.3, -9.9], [11.7, 6.3], [19.8, 59.4]] as const;
type Point = readonly [number, number];
interface PathInput { id: string; points: readonly Point[]; width: number; closed?: boolean }

const paths = [
  { id: 'north-ramble', points: [[0, -85.5], [0, -80.1], [-30.6, -79.2], [-34.2, -49.5], [-32.4, -13.5], [-32.4, 0]], width: 2.4 },
  { id: 'west-gate', points: [[-32.4, 0], [-32.4, 2.7], [-35.1, 3.6], [-37.8, 1.8], [-39.8, 0], [-39.8, -2.7]], width: 2.4 },
  { id: 'west-sidewalk', points: [[-39.8, -2.7], [-39.8, -84.6], [-39.8, -88.2], [-39.65, -88.65],
    [-39.2, -88.8], [-3.6, -88.8], [0, -88.8], [0, -85.5]], width: 1.6 },
  { id: 'mall', points: [[0, 85.5], [0, 79.2], [0, 58.5], [0, 45], [0, 41.4]], width: 4.8 },
  { id: 'east-walk', points: [[0, 41.4], [0, 39.6], [2.7, 36.9], [6.3, 33.3], [14.4, 29.7], [26.1, 18], [32.4, 7.2], [32.4, 0]], width: 2.6 },
  { id: 'east-gate', points: [[32.4, 0], [32.4, -2.7], [35.1, -3.6], [37.8, -1.8], [39.8, 0], [39.8, 2.7]], width: 2.4 },
  { id: 'east-sidewalk', points: [[39.8, 2.7], [39.8, 84.6], [39.8, 88.2], [39.65, 88.65],
    [39.2, 88.8], [3.6, 88.8], [0, 88.8], [0, 85.5]], width: 1.6 },
  { id: 'great-lawn-walk', points: [[32.4, 0], [25.2, -20.7], [3.6, -19.8], [-13.5, -10.8], [-10.8, 10.8], [8.1, 22.5], [18.9, 23.4], [26.1, 18]], width: 2.4 },
  { id: 'lake-walk', points: [[-32.4, 0], [-34.2, 24.3], [-29.7, 47.7], [-11.7, 54.9], [0, 40.5]], width: 2.4 },
  { id: 'lake-approach', points: [[6.3, 33.3], [3.6, 24.3], [-7.2, 15.3], [-19.8, 13.5], [-31.5, 18], [-34.2, 24.3]], width: 2.4 },
  { id: 'meadow-walk', points: [[0, 79.2], [24.3, 79.2], [32.4, 62.1], [28.8, 43.2], [14.4, 29.7]], width: 2.4 },
  { id: 'reservoir-track', points: Array.from({ length: 16 }, (_, index): Point => {
    const angle = index * Math.PI / 8;
    return [Math.cos(angle) * 27, -49.5 + Math.sin(angle) * 25.2];
  }), width: 2.5, closed: true },
] as const satisfies readonly PathInput[];

export type ParkPathId = typeof paths[number]['id'];
export const PARK_PATHS = paths.map((path) => {
  const curve = new CatmullRomCurve3(path.points.map(([x, z]) => new Vector3(x, 0, z)),
    'closed' in path && path.closed, 'centripetal');
  // Include every spline knot: a short bend after a long straight must not cause a speed spike.
  curve.arcLengthDivisions = ('closed' in path && path.closed ? path.points.length : path.points.length - 1) * 1024;
  return { ...path, curve };
});

function itinerary(ids: readonly ParkPathId[]) {
  let length = 0;
  const segments = ids.map((id) => {
    const path = PARK_PATHS.find((path) => path.id === id);
    if (!path) throw new Error(`Missing park walking path: ${id}.`);
    const segment = { path, start: length, length: path.curve.getLength() };
    length += segment.length;
    return segment;
  });
  return { segments, length };
}

export const PARK_ROUTES = [
  itinerary(['mall', 'east-walk', 'east-gate', 'east-sidewalk']),
  itinerary(['north-ramble', 'west-gate', 'west-sidewalk']),
];
export const PARK_RUNNING_ROUTE = itinerary(['reservoir-track']);

/** Art and people share these distance-sampled paths, including real open gates. */
export function sampleParkRoute(route: typeof PARK_ROUTES[number], distance: number, target: Vector3): void {
  if (!Number.isFinite(distance)) throw new RangeError('Park route distance must be finite.');
  const along = ((distance % route.length) + route.length) % route.length;
  let index = 0;
  while (index < route.segments.length - 1 && along >= route.segments[index + 1].start) index++;
  const segment = route.segments[index];
  segment.path.curve.getPointAt((along - segment.start) / segment.length, target);
}
