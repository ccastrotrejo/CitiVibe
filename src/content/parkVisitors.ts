import { CurvePath, LineCurve3, Vector3 } from 'three';
import { PARK_PATHS, PARK_PICNICS } from './park';

type Point = readonly [number, number];

function line(points: readonly Point[]): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>();
  for (let index = 1; index < points.length; index++) {
    path.add(new LineCurve3(new Vector3(points[index - 1][0], 0, points[index - 1][1]),
      new Vector3(points[index][0], 0, points[index][1])));
  }
  return path;
}

/** A clockwise public-sidewalk circuit, outside the existing park fence and motor lanes. */
export const PARK_OUTSIDE_WALK = line([
  [39.8, 2.7], [39.8, 84.6], [39.8, 88.2], [39.65, 88.65], [39.2, 88.8],
  [0, 88.8], [-39.2, 88.8], [-39.65, 88.65], [-39.8, 88.2], [-39.8, -84.6], [-39.8, -88.2],
  [-39.65, -88.65], [-39.2, -88.8], [39.2, -88.8], [39.65, -88.65], [39.8, -88.2], [39.8, -2.7], [39.8, 2.7],
]);
export const PARK_RETURN_DISTANCE = PARK_OUTSIDE_WALK.curves.slice(0, 5).reduce((sum, curve) => sum + curve.getLength(), 0);
const southGateApproach = PARK_OUTSIDE_WALK.getPoint(PARK_RETURN_DISTANCE / PARK_OUTSIDE_WALK.getLength());
const mall = PARK_PATHS.find((path) => path.id === 'mall')!;
const eastWalk = PARK_PATHS.find((path) => path.id === 'east-walk')!;

const approaches: readonly (readonly Point[])[] = [
  [[8, -8], [23, -8], [29, -5], [32, -3], [35, -1]],
  [[20, -12], [25, -10], [29, -5], [32, -3], [35, -1]],
  [[17, 7], [24, 7], [29, 4], [32, 1], [35, -1]],
  [[24, 60], [27, 56], [25, 39], [22, 31], [26, 22], [31, 12], [32, 1], [35, -1]],
];
const returns: readonly (readonly Point[])[] = [
  [[26.1, 18], [22, 12], [20, 4], [18, -7], [8, -5.5]],
  [[26.1, 18], [22, 12], [20, 4], [20, -7]],
  [[26.1, 18], [22, 12], [17, 9]],
];

/** The eight original neighbors keep their IDs and seats; no visitor is spawned or hidden. */
export const PARK_RESTING_VISITORS = PARK_PICNICS.flatMap(([x, z], index) => [-1, 1].map((side) => {
  const seat: Point = [x + side * 0.7, z];
  const outward = line([seat, [seat[0], z - 1.5], ...approaches[index], [38, 0], [39.8, 2.7]]);
  const homeward = line([[southGateApproach.x, southGateApproach.z], [0, 85.5]]);
  if (index === 3) {
    homeward.add(line([[0, 85.5], [0, 60.7], [seat[0], 60.7], seat]));
  } else {
    homeward.add(mall.curve);
    // Follow the original walking curve in its existing direction before branching onto the lawn.
    const points = Array.from({ length: 501 }, (_, step): Point => {
      const point = eastWalk.curve.getPoint(step / 500 * 5 / 7);
      return [point.x, point.z];
    });
    homeward.add(line([...points, ...returns[index].slice(1), [seat[0], z + 1.5], seat]));
  }
  return {
    id: `picnic-neighbor-${index}-${side}`, seat, outward, homeward, departureDelay: side < 0 ? 6 : 0,
    outwardLength: outward.getLength(), homewardLength: homeward.getLength(),
  };
}));
