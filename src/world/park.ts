import * as THREE from 'three';
import { PARK_BOUNDS, PARK_PATHS, PARK_RESERVOIR } from '../content/park';
import type { StreetscapeBuilder } from './streetscape';

type Point = readonly [number, number];

/** Original compressed park composition; never imports a real-city model or map. */
export function buildCentralPark({ block, add, box, cylinder, crown, palette: p }: StreetscapeBuilder) {
  const group = new THREE.Group();
  group.name = 'Central park landscape';
  const geometries: THREE.BufferGeometry[] = [];
  const grass = new THREE.MeshStandardMaterial({ color: '#849b70', roughness: 1 });
  const meadow = new THREE.MeshStandardMaterial({ color: '#a0b782', roughness: 1 });
  const gravel = new THREE.MeshStandardMaterial({ color: '#cdbd9e', roughness: 1 });
  const track = new THREE.MeshStandardMaterial({ color: '#bc9b79', roughness: 1 });
  gravel.name = 'Park gravel paths';
  track.name = 'Reservoir running surface';
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, y = 0) => {
    geometries.push(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.position.y = y;
    result.receiveShadow = true;
    group.add(result);
    return result;
  };
  const ellipse = (x: number, z: number, rx: number, rz: number): Point[] =>
    Array.from({ length: 80 }, (_, index) => {
      const angle = index * Math.PI / 40;
      return [x + Math.cos(angle) * rx, z + Math.sin(angle) * rz];
    });
  const surface = (name: string, points: readonly Point[], y: number, material: THREE.Material, smooth = false) => {
    const outline = smooth
      ? new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
        .getPoints(100).map(({ x, z }) => [x, z] as const)
      : points;
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    return mesh(name, new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), material, y);
  };
  const rod = (material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, width: number) => {
    const direction = to.clone().sub(from);
    const rotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
    const midpoint = from.clone().add(to).multiplyScalar(0.5);
    add(box, material, [midpoint.x, midpoint.y, midpoint.z], [width, direction.length(), width],
      [rotation.x, rotation.y, rotation.z]);
  };

  surface('Park lawn', [[-PARK_BOUNDS.x, -PARK_BOUNDS.z], [PARK_BOUNDS.x, -PARK_BOUNDS.z],
    [PARK_BOUNDS.x, PARK_BOUNDS.z], [-PARK_BOUNDS.x, PARK_BOUNDS.z]], -0.07, grass);
  surface('Great lawn', ellipse(8.1, -2.7, 20.7, 18), -0.035, meadow);
  surface('South meadow', ellipse(17.1, 59.4, 13.5, 16.2), -0.035, meadow);
  surface('North grove', [[-36, -86.4], [-6.3, -85.5], [-8.1, -79.2], [-30.6, -77.4], [-35.1, -57.6]], -0.035, meadow, true);
  for (const path of PARK_PATHS) {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let index = 0; index <= 80; index++) {
      const point = path.curve.getPoint(index / 80);
      const tangent = path.curve.getTangent(index / 80);
      for (const side of [-1, 1]) vertices.push(
        point.x + tangent.z * path.width / 2 * side, -0.012,
        point.z - tangent.x * path.width / 2 * side,
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
    mesh(`Park path ${path.id}`, geometry,
      path.id === 'reservoir-track' ? track : path.id.includes('sidewalk') ? p.paving : gravel);
  }

  const reservoir = PARK_RESERVOIR;
  surface('Reservoir stone bank', ellipse(reservoir.x, reservoir.z, 25.11, 23.31), -0.004, p.stone);
  surface('Park reservoir', ellipse(reservoir.x, reservoir.z, reservoir.radiusX, reservoir.radiusZ), 0.012, p.water);
  for (let index = 0; index < 64; index++) {
    const angle = index * Math.PI / 32;
    const next = (index + 1) * Math.PI / 32;
    const x = Math.cos(angle) * 25.29;
    const z = reservoir.z + Math.sin(angle) * 23.49;
    block(p.rubber, x, 0.5, z, 0.06, 1, 0.06);
    for (const y of [0.5, 0.97]) {
      rod(p.rubber, new THREE.Vector3(x, y, z),
        new THREE.Vector3(Math.cos(next) * 25.29, y, reservoir.z + Math.sin(next) * 23.49), 0.035);
    }
  }

  const lake: readonly Point[] = [[-30.6, 25.2], [-27, 18], [-16.2, 16.2], [-6.3, 21.6], [-4.5, 27.9], [-1.8, 34.2],
    [-7.2, 44.1], [-18.9, 48.6], [-28.8, 40.5]];
  surface('Pond stone bank', lake.map(([x, z]) => [-16.2 + (x + 16.2) * 1.07, 31.5 + (z - 31.5) * 1.07]),
    -0.004, p.stone, true);
  surface('Reed pond', lake, 0.012, p.water, true);
  for (const [x, z] of [[-27.9, 23.4], [-26.1, 38.7], [-19.8, 46.8], [-9.9, 42.3], [-5.4, 26.1]]) {
    for (let stem = 0; stem < 5; stem++) {
      add(cylinder, p.leaf, [x + stem * 0.2, 0.6, z], [0.035, 1.2 + stem * 0.05, 0.035]);
    }
  }
  // A pale arched bridge is scenery; runners never leave their level reservoir loop.
  for (let segment = 0; segment < 24; segment++) {
    const t = segment / 23;
    const x = -31.5 + 32.4 * t;
    const y = 0.12 + Math.sin(t * Math.PI) * 1.35;
    block(p.stone, x, y, 31.5, 1.46, 0.18, 2.5);
    for (const side of [-1, 1]) {
      block(p.paving, x, y + 1.02, 31.5 + side * 1.25, 1.46, 0.1, 0.09);
      block(p.rubber, x, y + 0.5, 31.5 + side * 1.25, 0.055, 1, 0.055);
    }
  }

  surface('Lakeside terrace', [[-9, 26.1], [9, 26.1], [9.9, 32.4], [9, 40.5], [-9, 40.5], [-9.9, 32.4]], 0.025, p.paving);
  add(cylinder, p.stone, [-1.8, 0.25, 33.3], [3, 0.45, 3]);
  add(cylinder, p.water, [-1.8, 0.49, 33.3], [2.55, 0.05, 2.55]);
  add(cylinder, p.stone, [-1.8, 1.2, 33.3], [0.35, 1.5, 0.35]);
  add(cylinder, p.stone, [-1.8, 1.98, 33.3], [1.25, 0.16, 1.25]);
  add(cylinder, p.water, [-1.8, 2.08, 33.3], [1.08, 0.04, 1.08]);
  add(crown, p.stone, [-1.8, 2.5, 33.3], [0.25, 0.44, 0.25]);
  for (const x of [-8.1, 8.1]) {
    for (const z of [27, 30.6, 34.2]) block(p.cream, x, 1.9, z, 0.45, 3.6, 0.45);
    block(p.stone, x, 3.8, 30.6, 0.7, 0.24, 8.1);
  }
  for (let step = 0; step < 5; step++) {
    block(p.stone, 10.8, 0.09 + step * 0.1, 16.92 + step * 0.45, 8.1, 0.18 + step * 0.2, 0.48);
  }

  const pathSamples = PARK_PATHS.map((path) => ({ width: path.width, points: path.curve.getPoints(800) }));
  const clearOfPaths = (x: number, z: number, radius: number) => pathSamples.every((path) =>
    path.points.every((point) => Math.hypot(point.x - x, point.z - z) > path.width / 2 + radius + 0.25));
  const dryGround = (x: number, z: number) =>
    (x / 25.65) ** 2 + ((z + 49.5) / 23.85) ** 2 > 1 &&
    ((x + 16.2) / 18) ** 2 + ((z - 31.5) / 20.7) ** 2 > 1;
  const trees: [number, number, number][] = [];
  for (let row = 0; row < 19; row++) {
    const z = -83.7 + row * 9;
    for (const x of [-35.1, -29.7, 30.6, 35.1]) {
      const px = x + Math.sin(row * 1.7 + x) * 0.9;
      const pz = z + Math.cos(x + row * 1.1) * 1.8;
      if (clearOfPaths(px, pz, 0.3) && dryGround(px, pz)) trees.push([px, pz, 1.3 + (row % 3) * 0.13]);
    }
  }
  for (const [x, z] of [
    [-22.5, -84.6], [-12.6, -84.6], [10.8, -84.6], [19.8, -83.7], [27.9, -82.8],
    [-21.6, 0], [-26.1, -9], [-19.8, 9], [-25.2, 10.8], [-21.6, 59.4], [-17.1, 68.4], [-27, 76.5],
    [-12.6, 79.2], [-19.8, 84.6], [-8.1, 84.6], [9.9, 84.6], [23.4, 84.6], [27, 30.6],
    [-5.4, 46.8], [5.4, 46.8], [-5.4, 55.8], [5.4, 55.8], [-5.4, 64.8], [5.4, 64.8], [-5.4, 73.8], [5.4, 73.8],
  ]) if (clearOfPaths(x, z, 0.3) && dryGround(x, z)) trees.push([x, z, Math.abs(x) === 5.4 ? 1.8 : 1.55]);
  for (const [index, [x, z, scale]] of trees.entries()) {
    add(cylinder, p.wood, [x, 1.65 * scale, z], [0.15 * scale, 3.3 * scale, 0.15 * scale]);
    for (const [dx, dy, dz, size] of [[-0.75, 3.3, 0, 1.25], [0.7, 3.6, 0.35, 1.35], [0, 4.4, -0.35, 1.4]]) {
      add(crown, index % 3 ? p.leaf : p.leafLight, [x + dx * scale, dy * scale, z + dz * scale],
        [size * scale, size * scale * 1.12, size * scale], [0, index * 1.7, 0]);
    }
  }
  for (const [x, z] of [[-21.6, 2.7], [-24.3, 64.8], [-17.1, 80.1], [18, -81.9]]) {
    if (clearOfPaths(x, z, 2)) {
      add(crown, p.roof, [x, 0.65, z], [2.4, 1.1, 1.8], [0.3, x * 0.1, 0.2]);
      add(crown, p.stone, [x + 1.8, 0.35, z + 0.6], [1.4, 0.7, 1.2]);
    }
  }
  const benches: readonly Point[] = [
    [-4.4, 54], [4.4, 49.5], [-4.4, 67.5], [4.4, 67.5], [-6.3, 37.8], [6.3, 37.8],
    [31.5, -41.4], [31.5, -59.4], [-30.6, -63.9], [-21.6, 57.6], [35, 74.7],
  ];
  for (const [x, z] of benches) {
    for (let slat = 0; slat < 3; slat++) {
      block(p.wood, x, 0.58, z - 0.2 + slat * 0.2, 2, 0.1, 0.16);
      block(p.wood, x, 0.78 + slat * 0.18, z - 0.26, 2, 0.13, 0.09);
    }
    for (const side of [-1, 1]) {
      block(p.rubber, x + side * 0.7, 0.25, z, 0.09, 0.5, 0.45);
      block(p.rubber, x + side * 0.86, 0.76, z, 0.07, 0.07, 0.6);
    }
  }
  for (const [x, z] of [[5.4, -7.2], [15.3, -9.9], [11.7, 6.3], [19.8, 59.4]]) {
    block(p.clay, x, 0, z, 2.4, 0.04, 1.8);
    for (const side of [-1, 1]) {
      block(p.teal, x + side * 0.7, 0.55, z, 0.36, 0.5, 0.24);
      add(crown, p.skin, [x + side * 0.7, 0.96, z], [0.18, 0.22, 0.18]);
      block(p.rubber, x + side * 0.7, 0.2, z + 0.3, 0.3, 0.15, 0.7);
    }
  }
  for (const z of [52.2, 63, 73.8]) for (const x of [-3.5, 3.5]) {
    add(cylinder, p.rubber, [x, 2, z], [0.075, 4, 0.075]);
    add(crown, p.cream, [x, 4.15, z], [0.32, 0.4, 0.32]);
    block(p.rubber, x, 4.57, z, 0.6, 0.09, 0.6);
  }
  for (const vertical of [true, false]) {
    const extent = vertical ? PARK_BOUNDS.z : PARK_BOUNDS.x;
    const across = vertical ? PARK_BOUNDS.x : PARK_BOUNDS.z;
    const opening = vertical ? 4.1 : 3.2;
    for (const side of [-1, 1]) {
      const place = (along: number, width: number, height: number, material: THREE.Material, y: number) =>
        block(material, vertical ? side * across : along, y, vertical ? along : side * across,
          vertical ? 0.22 : width, height, vertical ? width : 0.22);
      for (const half of [-1, 1]) {
        place(half * (extent + opening) / 2, extent - opening, 0.35, p.stone, 0.1);
        place(half * (extent + opening) / 2, extent - opening, 0.05, p.rubber, 0.92);
      }
      for (let along = -extent + 0.5; along < extent; along += 1.8) {
        if (Math.abs(along) < opening + 0.2) continue;
        place(along, 0.045, 0.85, p.rubber, 0.52);
      }
      for (const along of [-opening - 0.35, opening + 0.35]) place(along, 0.7, 1.4, p.stone, 0.62);
    }
  }
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      [grass, meadow, gravel, track].forEach((material) => material.dispose());
      group.removeFromParent();
      group.clear();
    },
  };
}
