import * as THREE from 'three';
import { PARK_BOUNDS, PARK_PATHS } from '../content/park';
import type { StreetscapeBuilder } from './streetscape';

type Point = readonly [number, number];

/** Original urban park; batches borrow scene resources, landscape surfaces are owned here. */
export function buildCentralPark({ block, add, cylinder, crown, palette: p }: StreetscapeBuilder) {
  const group = new THREE.Group();
  group.name = 'Central park landscape';
  const geometries: THREE.BufferGeometry[] = [];
  const grass = new THREE.MeshStandardMaterial({ color: '#849b70', roughness: 1 });
  const meadow = new THREE.MeshStandardMaterial({ color: '#a0b782', roughness: 1 });
  const gravel = new THREE.MeshStandardMaterial({ color: '#cdbd9e', roughness: 1 });
  gravel.name = 'Park gravel paths';
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    geometries.push(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.receiveShadow = true;
    group.add(result);
    return result;
  };
  const curve = (points: readonly Point[], closed = false) =>
    new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');
  const surface = (name: string, points: readonly Point[], y: number, material: THREE.Material, smooth = false) => {
    const outline = smooth ? curve(points, true).getPoints(80).map(({ x, z }) => [x, z] as const) : points;
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    const result = mesh(name, new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), material);
    result.position.y = y;
    return result;
  };
  const path = (name: string, route: THREE.CatmullRomCurve3, width: number) => {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let index = 0; index <= 80; index++) {
      const point = route.getPoint(index / 80);
      const tangent = route.getTangent(index / 80);
      for (const side of [-1, 1]) vertices.push(
        point.x + tangent.z * width / 2 * side, -0.012,
        point.z - tangent.x * width / 2 * side,
      );
      if (index < 80) {
        const start = index * 2;
        indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(name, geometry, name.includes('sidewalk') ? p.paving : gravel);
  };

  surface('Park lawn', [
    [-PARK_BOUNDS.x, -PARK_BOUNDS.z], [PARK_BOUNDS.x, -PARK_BOUNDS.z],
    [PARK_BOUNDS.x, PARK_BOUNDS.z], [-PARK_BOUNDS.x, PARK_BOUNDS.z],
  ], -0.07, grass);
  surface('Great lawn', [[1, -1], [6, -3], [13, 0], [14, 6], [10, 10], [3, 9], [-0.5, 5]],
    -0.035, meadow, true);
  surface('North grove', [[-15, -11], [-8, -12], [-5, -8], [-8, -4], [-15, -5]],
    -0.035, meadow, true);
  for (const { id, curve, width } of PARK_PATHS) path(`Park path ${id}`, curve, width);

  const pond: readonly Point[] = [[-14, 6], [-12, 2.7], [-8, 2], [-4, 3.8], [-3, 7.5], [-6, 10.2], [-11.5, 10.5]];
  const bank = pond.map(([x, z]) => [-8.5 + (x + 8.5) * 1.09, 6.3 + (z - 6.3) * 1.09] as const);
  surface('Pond stone bank', bank, -0.008, p.stone, true);
  surface('Reed pond', pond, 0.012, p.water, true);
  for (const [x, z] of [[-13, 8.2], [-12.4, 9], [-11.5, 9.6], [-7, 9.9], [-5.5, 9.1], [-12, 3.1]]) {
    for (let stem = 0; stem < 4; stem++) {
      add(cylinder, p.leaf, [x + stem * 0.15, 0.38 + stem * 0.035, z], [0.025, 0.75 + stem * 0.07, 0.025]);
    }
  }
  // A low arched footbridge, with level approaches on both banks.
  for (let segment = 0; segment < 18; segment++) {
    const t = segment / 17;
    const x = -15.4 + t * 13;
    const height = Math.sin(t * Math.PI) * 0.8;
    block(p.wood, x, 0.08 + height, 6.5, 0.79, 0.14, 1.45);
    for (const side of [-1, 1]) {
      block(p.copperEdge, x, 0.86 + height, 6.5 + side * 0.78, 0.8, 0.07, 0.055);
      if (segment % 3 === 0 || segment === 17) {
        block(p.copperEdge, x, 0.47 + height, 6.5 + side * 0.78, 0.06, 0.86, 0.06);
      }
    }
  }

  // Low limestone structures replace the village's towers and oversized copper gazebo.
  block(p.paving, -4, 0.04, -3, 7, 0.16, 5.8);
  for (const x of [-6.8, -1.2]) {
    for (const z of [-5.1, -0.9]) {
      block(p.stone, x, 0.25, z, 0.65, 0.45, 0.65);
      block(p.cream, x, 1.7, z, 0.38, 2.8, 0.38);
      block(p.stone, x, 3.13, z, 0.6, 0.2, 0.6);
    }
    block(p.stone, x, 3.3, -3, 0.45, 0.25, 5.4);
  }
  for (let z = -5.5; z <= -0.4; z += 0.62) block(p.wood, -4, 3.48, z, 6.7, 0.17, 0.18);
  for (let step = 0; step < 4; step++) {
    block(p.stone, 9, 0.09 + step * 0.12, -4.7 + step * 0.48, 5.6, 0.18 + step * 0.24, 0.5);
  }
  block(p.paving, 9, 0.035, -5.8, 6.2, 0.15, 1.5);

  const trees: readonly (readonly [number, number, number])[] = [
    [-14, -10, 1.1], [-10.5, -10, 1.2], [-7, -9.5, 0.95],
    [-14.5, -5.5, 1.1], [-11, -5.6, 0.85], [-15.6, -2.5, 0.85],
    [-2, -8, 0.95], [3.3, -10.5, 0.95], [3.3, -7, 1],
    [7.5, -10, 1.1], [12, -10, 1.05], [15.7, -7.5, 1],
    [17.5, 0.5, 0.75], [17.5, 7.5, 0.9], [11.5, 14.4, 0.75],
    [-17.5, 10, 0.75], [-12.8, 13.7, 0.7], [-4, 11, 0.7],
    [4.5, 11.7, 0.65],
    [-21.8, -7, 0.7], [-21.8, 4, 0.75], [21.8, 4, 0.7], [21.8, 8, 0.7],
    [-12, 18.6, 0.65], [-6, 18.6, 0.7], [6, 18.6, 0.7], [12, 18.6, 0.65],
  ];
  for (const [index, [x, z, scale]] of trees.entries()) {
    add(cylinder, p.wood, [x, 1.65 * scale, z], [0.15 * scale, 3.3 * scale, 0.15 * scale]);
    for (const [dx, dy, dz, size] of [[-0.75, 3.3, 0, 1.25], [0.7, 3.6, 0.35, 1.35], [0, 4.4, -0.35, 1.4]]) {
      add(crown, index % 3 ? p.leaf : p.leafLight, [x + dx * scale, dy * scale, z + dz * scale],
        [size * scale, size * scale * 1.12, size * scale], [0, index * 1.7, 0]);
    }
  }

  for (const [x, z] of [[-6.1, -2], [-1.8, -2], [-15.5, 3.3], [-6, 11.5], [6, 11], [13.2, -4.5]]) {
    for (let slat = 0; slat < 3; slat++) {
      block(p.wood, x, 0.58, z - 0.2 + slat * 0.2, 2, 0.1, 0.16);
      block(p.wood, x, 0.78 + slat * 0.18, z - 0.26, 2, 0.13, 0.09);
    }
    for (const side of [-1, 1]) {
      block(p.rubber, x + side * 0.7, 0.25, z, 0.09, 0.5, 0.45);
      block(p.rubber, x + side * 0.86, 0.76, z, 0.07, 0.07, 0.6);
      block(p.rubber, x + side * 0.86, 0.66, z + 0.2, 0.055, 0.23, 0.055);
    }
  }
  for (const [x, z] of [[-6.2, -2], [-5.6, 11.5], [6.4, 11]]) {
    block(p.teal, x, 0.97, z, 0.36, 0.5, 0.24);
    add(crown, p.skin, [x, 1.38, z], [0.18, 0.22, 0.18]);
    for (const side of [-1, 1]) {
      block(p.rubber, x + side * 0.1, 0.65, z + 0.17, 0.13, 0.15, 0.4);
      block(p.rubber, x + side * 0.1, 0.34, z + 0.32, 0.13, 0.5, 0.14);
    }
  }
  for (const [x, z] of [[-3, -8], [4, -6], [15, 4], [-16, 4], [3, 12]]) {
    add(cylinder, p.copperEdge, [x, 1.6, z], [0.06, 3.2, 0.06]);
    add(crown, p.cream, [x, 3.25, z], [0.27, 0.35, 0.27]);
    block(p.copperEdge, x, 3.62, z, 0.5, 0.09, 0.5);
  }

  // The outer edge meets the city's curb, with four open, step-free entrances.
  for (const vertical of [true, false]) {
    const extent = vertical ? PARK_BOUNDS.z : PARK_BOUNDS.x;
    const across = vertical ? PARK_BOUNDS.x : PARK_BOUNDS.z;
    for (const side of [-1, 1]) {
      const place = (along: number, width: number, height: number, material: THREE.Material, y: number) =>
        block(material, vertical ? side * across : along, y, vertical ? along : side * across,
          vertical ? 0.22 : width, height, vertical ? width : 0.22);
      for (const half of [-1, 1]) {
        place(half * (extent + 2) / 2, extent - 2, 0.35, p.stone, 0.1);
        place(half * (extent + 2) / 2, extent - 2, 0.05, p.rubber, 0.92);
      }
      for (let along = -extent + 0.5; along < extent; along += 1.1) {
        if (Math.abs(along) < 2.3) continue;
        place(along, 0.045, 0.85, p.rubber, 0.52);
      }
      for (const along of [-2.3, 2.3]) place(along, 0.7, 1.4, p.stone, 0.62);
      block(p.paving, vertical ? side * (across - 0.8) : 0, -0.005, vertical ? 0 : side * (across - 0.8),
        vertical ? 1.8 : 3.7, 0.08, vertical ? 3.7 : 1.8);
    }
  }

  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      grass.dispose();
      meadow.dispose();
      gravel.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
