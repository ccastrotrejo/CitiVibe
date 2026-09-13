import * as THREE from 'three';
import { PARK_PATHS, type ParkPathId } from '../content/park';
import { BIKE_OFFSET, STREET_X, STREET_Z } from '../content/streets';
import type { StreetscapeBuilder } from './streetscape';

type Point = readonly [number, number];

export const BIKE_MARKINGS = [
  ...STREET_X.flatMap((x) => STREET_Z.slice(0, -1).flatMap((z, index) =>
    [-1, 1].map((side) => ({
      x: x + side * BIKE_OFFSET, z: (z + STREET_Z[index + 1]) / 2,
      yaw: side < 0 ? 0 : Math.PI,
    })))),
  ...STREET_Z.flatMap((z) => STREET_X.slice(0, -1).flatMap((x, index) =>
    [-1, 1].map((side) => ({
      x: (x + STREET_X[index + 1]) / 2, z: z + side * BIKE_OFFSET,
      yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2,
    })))),
];

export const WALK_MARKINGS: readonly { id: ParkPathId; at: number; reverse?: boolean }[] = [
  { id: 'mall', at: 0.13 },
  { id: 'east-walk', at: 0.44 },
  { id: 'meadow', at: 0.36 },
  { id: 'woodland', at: 0.52, reverse: true },
];

/** Original geometric stencils, not downloaded icons; each kind shares one flat mesh. */
export function buildPavementMarkings({ add, palette }: StreetscapeBuilder) {
  const polygon = (points: readonly Point[]) =>
    new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const stroke = (from: Point, to: Point, width = 0.055) => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const scale = width / (2 * Math.hypot(dx, dz));
    const nx = -dz * scale;
    const nz = dx * scale;
    return polygon([
      [from[0] + nx, from[1] + nz], [to[0] + nx, to[1] + nz],
      [to[0] - nx, to[1] - nz], [from[0] - nx, from[1] - nz],
    ]);
  };
  const circle = (x: number, z: number, radius: number, hollow = false) => {
    const points = (r: number) => Array.from({ length: 16 }, (_, index): Point => {
      const angle = index * Math.PI / 8;
      return [x + Math.cos(angle) * r, z + Math.sin(angle) * r];
    });
    const shape = polygon(points(radius));
    if (hollow) shape.holes.push(new THREE.Path(points(radius - 0.05)
      .reverse().map(([px, pz]) => new THREE.Vector2(px, -pz))));
    return shape;
  };
  const bicycle = new THREE.ShapeGeometry([
    circle(-0.28, -0.26, 0.23, true), circle(0.28, -0.26, 0.23, true),
    stroke([-0.28, -0.26], [-0.11, 0.16]), stroke([-0.28, -0.26], [0.02, -0.26]),
    stroke([-0.11, 0.16], [0.02, -0.26]), stroke([-0.11, 0.16], [0.2, 0.16]),
    stroke([0.02, -0.26], [0.2, 0.16]), stroke([0.28, -0.26], [0.17, 0.32]),
    stroke([0.17, 0.32], [0.33, 0.32]), stroke([-0.21, 0.22], [-0.02, 0.22]),
    circle(0.015, 0.53, 0.09),
    stroke([-0.07, 0.25], [-0.1, 0.43]), stroke([-0.1, 0.43], [0.17, 0.32]),
    stroke([-0.07, 0.25], [0.09, 0.03]), stroke([0.09, 0.03], [-0.03, -0.22]),
    polygon([[-0.055, 0.67], [0.055, 0.67], [0.055, 1.34], [0.27, 1.16],
      [0.32, 1.24], [0, 1.59], [-0.32, 1.24], [-0.27, 1.16], [-0.055, 1.34]]),
  ]).rotateX(-Math.PI / 2);
  bicycle.name = 'Bicycle and direction pavement stencil';
  for (const { x, z, yaw } of BIKE_MARKINGS) {
    add(bicycle, palette.line, [x, 0.026, z], [1, 1, 1.35], [0, yaw, 0]);
  }

  const runner = new THREE.ShapeGeometry([
    circle(0.08, 0.49, 0.13),
    stroke([0.06, 0.3], [-0.06, -0.12], 0.11),
    stroke([0.02, 0.24], [-0.26, 0.09], 0.075),
    stroke([-0.26, 0.09], [-0.37, 0.25], 0.075),
    stroke([0.02, 0.24], [0.28, 0.06], 0.075),
    stroke([0.28, 0.06], [0.39, 0.22], 0.075),
    stroke([-0.06, -0.12], [-0.32, -0.36], 0.09),
    stroke([-0.32, -0.36], [-0.42, -0.22], 0.09),
    stroke([-0.06, -0.12], [0.22, -0.28], 0.09),
    stroke([0.22, -0.28], [0.34, -0.55], 0.09),
  ]).rotateX(-Math.PI / 2);
  runner.name = 'Park running and walking pavement stencil';
  for (const { id, at, reverse } of WALK_MARKINGS) {
    const path = PARK_PATHS.find((path) => path.id === id);
    if (!path) throw new Error(`Missing marked park path: ${id}.`);
    const point = path.curve.getPointAt(at);
    const direction = path.curve.getTangentAt(at);
    add(runner, palette.rubber, [point.x, 0.001, point.z], [1, 1, 1],
      [0, Math.atan2(direction.x, direction.z) + (reverse ? Math.PI : 0), 0]);
  }

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      bicycle.dispose();
      runner.dispose();
    },
  };
}
