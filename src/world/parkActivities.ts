import { Object3D, Vector3 } from 'three';
import { PARK_PATHS, PARK_ROUTES, sampleParkRoute } from '../content/park';
import { EXTRA_PARK_BENCHES, PARK_READING_POCKET } from '../content/streetFurniture';
import type { ActivityDestination } from './destinationActivities';
import type { WalkerRig } from './locomotion';
import { personPart, type PersonArt } from './person';

const mall = PARK_PATHS.find(({ id }) => id === 'mall')!;
const meadow = PARK_PATHS.find(({ id }) => id === 'meadow-walk')!;
const east = PARK_PATHS.find(({ id }) => id === 'east-walk')!;
const bench = EXTRA_PARK_BENCHES.find(({ id }) => id === PARK_READING_POCKET.benchId)!;

/** Distances to actual spline knots, not straight-line approximations at the two merges. */
export const PARK_MEADOW_VISIT = {
  id: meadow.id,
  entry: mall.curve.getLengths()[1024],
  exit: PARK_ROUTES[0].segments[1].start + east.curve.getLengths()[4096],
  length: meadow.curve.getLength(),
  sample(distance: number, target: Vector3): void {
    meadow.curve.getPointAt(Math.max(0, Math.min(1, distance / this.length)), target);
  },
};

export const PARK_READING_ENTRY = mall.curve.getLengths()[2048] - (PARK_READING_POCKET.z - 58.5);
const readingEntry = new Vector3();
sampleParkRoute(PARK_ROUTES[0], PARK_READING_ENTRY, readingEntry);

export const PARK_READING_DESTINATION: ActivityDestination = {
  id: `${bench.id}-reading`,
  activity: 'reading',
  entry: { x: readingEntry.x, y: 0, z: readingEntry.z },
  pocket: { x: PARK_READING_POCKET.x, y: 0, z: PARK_READING_POCKET.z },
  heading: bench.yaw + Math.PI,
  duration: 5.5,
};

/** Limit reading props and visits to retained IDs, independent of appearance or demographic traits. */
export function isParkReader(id: string): boolean {
  return ['walker-5', 'walker-15', 'walker-25', 'walker-35', 'walker-45', 'walker-55'].includes(id);
}

/** Shared boxes/material only; call before actor batching so the book participates in retained poses. */
export function buildReadingArt(rig: WalkerRig, art: PersonArt): void {
  const book = new Object3D();
  book.name = 'Unbranded reading book';
  book.position.set(0, 0.14, 0.4);
  book.rotation.x = -0.4;
  personPart(art, book, 'Plain book cover', '#754d42', [0, 0, 0], [0.38, 0.035, 0.24]);
  personPart(art, book, 'Book pages', '#e9dfcd', [0, 0.025, 0], [0.35, 0.025, 0.21]);
  rig.torso.add(book);
  rig.readingBook = book;
  book.scale.setScalar(0);
}
