import { CatmullRomCurve3, Vector3 } from 'three';

export const PARK_BOUNDS = { x: 23, z: 19 } as const;
type Point = readonly [number, number];

const paths = [
  { id: 'mall', points: [[0, -19.8], [0, -13.6], [-4, -10], [-6, -7], [-4, -3]], width: 2.2 },
  { id: 'east-walk', points: [[-4, -3], [1, -4.5], [8, -7], [14.5, -4]], width: 1.8 },
  { id: 'east-gate', points: [[14.5, -4], [18, -1], [23.8, 0]], width: 2 },
  { id: 'meadow', points: [[14.5, -4], [16, 3], [14, 10], [9, 12.5], [0, 12.5]], width: 1.8 },
  { id: 'south-gate', points: [[0, 12.5], [0, 16], [0, 19.8]], width: 2.2 },
  { id: 'woodland', points: [[-16, 0], [-16, 7], [-13, 11.5], [-5, 12.5], [0, 12.5]], width: 1.8 },
  { id: 'west-gate', points: [[-16, 0], [-20, 0], [-23.8, 0]], width: 2 },
  { id: 'pond-walk', points: [[-4, -3], [-10, -2], [-16, 0]], width: 1.8 },
  { id: 'pond-approach', points: [[-4, -3], [-1, 0], [-1, 5.5], [-2.5, 6.5]], width: 1.6 },
  { id: 'east-sidewalk', points: [[23.8, 0], [23.8, 15], [23, 19], [18, 19.8], [0, 19.8]], width: 1.6 },
  { id: 'west-sidewalk', points: [[-23.8, 0], [-23.8, -15], [-23, -19], [-18, -19.8], [0, -19.8]], width: 1.6 },
] as const satisfies readonly { id: string; points: readonly Point[]; width: number }[];

export type ParkPathId = typeof paths[number]['id'];
export const PARK_PATHS = paths.map((path) => {
  const curve = new CatmullRomCurve3(path.points.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal');
  curve.arcLengthDivisions = 2048;
  return { ...path, curve };
});

const itineraries: readonly (readonly { id: ParkPathId; reverse?: boolean }[])[] = [
  [
    { id: 'mall' }, { id: 'east-walk' }, { id: 'east-gate' }, { id: 'east-sidewalk' },
    { id: 'south-gate', reverse: true }, { id: 'woodland', reverse: true },
    { id: 'west-gate' }, { id: 'west-sidewalk' },
  ],
  [
    { id: 'mall' }, { id: 'east-walk' }, { id: 'meadow' },
    { id: 'woodland', reverse: true }, { id: 'west-gate' }, { id: 'west-sidewalk' },
  ],
];

export const PARK_ROUTES = itineraries.map((itinerary) => {
  let length = 0;
  const segments = itinerary.map(({ id, reverse = false }) => {
    const path = PARK_PATHS.find((path) => path.id === id);
    if (!path) throw new Error(`Missing park walking path: ${id}.`);
    const segment = { path, reverse, start: length, length: path.curve.getLength() };
    length += segment.length;
    return segment;
  });
  return { segments, length };
});

/** The renderer and walking simulation use these same curves, including the open gates. */
export function sampleParkRoute(route: typeof PARK_ROUTES[number], distance: number, target: Vector3): void {
  const along = ((distance % route.length) + route.length) % route.length;
  let index = 0;
  while (index < route.segments.length - 1 && along >= route.segments[index + 1].start) index++;
  const segment = route.segments[index];
  const fraction = (along - segment.start) / segment.length;
  segment.path.curve.getPointAt(segment.reverse ? 1 - fraction : fraction, target);
}
