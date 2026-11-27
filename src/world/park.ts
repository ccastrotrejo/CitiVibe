import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PARK_BOUNDS, PARK_COMPANION_SEAT_IDS, PARK_LAKESIDE, PARK_PATHS, PARK_PICNICS, PARK_RESERVOIR, PARK_SEATS,
} from '../content/park';
import type { StreetscapeBuilder } from './streetscape';
import { GROUND_PUDDLES } from './groundWater';

type Point = readonly [number, number];

/** Original compressed park composition; never imports a real-city model or map. */
export function buildCentralPark(builder: StreetscapeBuilder) {
  const { block, add, box, cylinder, crown, palette: p } = builder;
  const rbox = builder.roundedBox ?? box;
  const cone = builder.cone ?? cylinder;
  const alloy = builder.alloy ?? p.stone;
  const group = new THREE.Group();
  group.name = 'Central park landscape';
  const geometries: THREE.BufferGeometry[] = [];
  const grass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const gravel = new THREE.MeshStandardMaterial({ color: '#cdbd9e', roughness: 1 });
  const track = new THREE.MeshStandardMaterial({ color: '#bc9b79', roughness: 1 });
  const waterSource = p.water as THREE.MeshStandardMaterial;
  const pondWater = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.16,
    metalness: 0.08,
    normalMap: waterSource.normalMap ?? null,
    normalScale: waterSource.normalScale ? waterSource.normalScale.clone() : new THREE.Vector2(0.22, 0.22),
  });
  pondWater.name = 'Lakeside depth-colored water';
  pondWater.userData.waterRipple = true;
  for (const material of [grass, gravel, track]) material.userData.weatherSurface = true;
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
  const joinedMesh = (name: string, parts: THREE.BufferGeometry[], material: THREE.Material) => {
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    if (!geometry) throw new Error(`Unable to merge park geometry: ${name}.`);
    const result = mesh(name, geometry, material);
    result.castShadow = true;
    return result;
  };
  const ellipse = (x: number, z: number, rx: number, rz: number): Point[] =>
    Array.from({ length: 80 }, (_, index) => {
      const angle = index * Math.PI / 40;
      return [x + Math.cos(angle) * rx, z + Math.sin(angle) * rz];
    });
  const surface = (name: string, points: readonly Point[], y: number, material: THREE.Material, smooth = false, tint?: string) => {
    const outline = smooth
      ? new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
        .getPoints(100).map(({ x, z }) => [x, z] as const)
      : points;
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    if (name === 'Park lawn' || name === 'Great lawn') {
      for (const basin of GROUND_PUDDLES) {
        const hole = new THREE.Path();
        hole.absellipse(basin.x, -basin.z, basin.radiusX, basin.radiusZ, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    const geometry = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    if (tint) {
      const color = new THREE.Color(tint);
      const colors = new THREE.Float32BufferAttribute(geometry.getAttribute('position').count * 3, 3);
      for (let index = 0; index < colors.count; index++) colors.setXYZ(index, color.r, color.g, color.b);
      geometry.setAttribute('color', colors);
    }
    return mesh(name, geometry, material, y);
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
    [PARK_BOUNDS.x, PARK_BOUNDS.z], [-PARK_BOUNDS.x, PARK_BOUNDS.z]], -0.07, grass, false, '#849b70');
  surface('Great lawn', ellipse(8.1, -2.7, 20.7, 18), -0.035, grass, false, '#a0b782');
  surface('South meadow', ellipse(17.1, 59.4, 13.5, 16.2), -0.035, grass, false, '#a0b782');
  surface('North grove', [[-36, -86.4], [-6.3, -85.5], [-8.1, -79.2], [-30.6, -77.4], [-35.1, -57.6]], -0.035, grass, true, '#a0b782');
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
  // Flush arrival bands terminate at the gate, leaving the running and quiet edges informal.
  for (const side of [-1, 1]) for (const along of [85.7, 87.3]) {
    block(p.paving, 0, -0.008, side * along, side < 0 ? 2.1 : 4.4, 0.006, 0.18);
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

  const lake = PARK_LAKESIDE.shore;
  surface('Pond stone bank', lake.map(([x, z]) => [-16.2 + (x + 16.2) * 1.07, 31.5 + (z - 31.5) * 1.07]),
    -0.004, p.stone, true);
  const shoreline = new THREE.CatmullRomCurve3(lake.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true, 'centripetal').getPoints(80).slice(0, -1);
  const waterPositions = [-16.2, 0.012, 31.5];
  const waterUvs = [-16.2, -31.5];
  const waterColors = new THREE.Color('#477d7c').toArray();
  const waterIndices: number[] = [];
  for (const [ring, radius] of [0.55, 0.86, 1].entries()) {
    const color = new THREE.Color(['#477d7c', '#65958d', '#93b3a0'][ring]);
    for (const [index, point] of shoreline.entries()) {
      const wx = -16.2 + (point.x + 16.2) * radius;
      const wz = 31.5 + (point.z - 31.5) * radius;
      waterPositions.push(wx, 0.012, wz);
      waterUvs.push(wx, -wz);
      waterColors.push(color.r, color.g, color.b);
      const current = 1 + ring * shoreline.length + index;
      const next = 1 + ring * shoreline.length + (index + 1) % shoreline.length;
      if (ring === 0) waterIndices.push(0, next, current);
      else waterIndices.push(current - shoreline.length, next, current, current - shoreline.length, next - shoreline.length, next);
    }
  }
  const waterGeometry = new THREE.BufferGeometry();
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
  waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
  waterGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));
  waterGeometry.setIndex(waterIndices);
  waterGeometry.computeVertexNormals();
  mesh('Reed pond', waterGeometry, pondWater);

  // Sculpted Loop-subdivided lakeside river boulders + reed clusters and blossoming lily pads.
  const seedBoulder = new THREE.DodecahedronGeometry(1, 0);
  const subdividedBoulder = LoopSubdivision.modify(seedBoulder, 2, { split: false, uvSmooth: false, preserveEdges: false });
  seedBoulder.dispose();
  const boulderGeometry = toCreasedNormals(subdividedBoulder, Math.PI * 0.45);
  subdividedBoulder.dispose();
  geometries.push(boulderGeometry);
  const boulderTransform = new THREE.Object3D();
  const boulderMatrix = (x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, tilt = 0) => {
    boulderTransform.position.set(x, y, z);
    boulderTransform.rotation.set(0, yaw, tilt);
    boulderTransform.scale.set(sx, sy, sz);
    boulderTransform.updateMatrix();
    return boulderTransform.matrix.clone();
  };
  const shoreRockMatrices: THREE.Matrix4[] = [];
  for (const [index, [x, z]] of [
    [-28.5, 23.8], [-27.2, 39.2], [-20.8, 46.8], [-11.8, 46], [-6.2, 24.4],
  ].entries()) {
    shoreRockMatrices.push(
      boulderMatrix(x, 0.13, z, 0.72, 0.29, 0.5, index * 0.9, 0.1),
      boulderMatrix(x + Math.cos(index * 1.4) * 0.48, 0.08, z + Math.sin(index * 1.4) * 0.42, 0.36, 0.18, 0.3, index * 1.7, -0.08),
    );
    for (let stem = 0; stem < 7; stem++) {
      const angle = stem * 2.4 + index;
      const height = 0.5 + (stem % 4) * 0.16;
      const sx = x + Math.cos(angle) * 0.48;
      const sz = z + Math.sin(angle) * 0.42;
      const tiltX = Math.cos(angle) * 0.22;
      const tiltZ = Math.sin(angle) * 0.22;
      add(cylinder, stem % 3 ? p.leaf : p.leafLight, [sx, height / 2, sz], [0.026, height, 0.026],
        [tiltX, angle, tiltZ]);
      if (stem % 3 === 0) {
        add(cylinder, p.wood, [sx + Math.sin(tiltZ) * 0.04, height - 0.02, sz - Math.sin(tiltX) * 0.04],
          [0.036, 0.19, 0.036], [tiltX, angle, tiltZ]);
      }
    }
  }
  for (const [padIndex, [x, z]] of [
    [-25, 24], [-24.3, 24.5], [-25.1, 25.1], [-17.5, 43.6], [-18.3, 44], [-17.1, 44.4],
  ].entries()) {
    add(cylinder, padIndex % 2 ? p.leaf : p.leafLight, [x, 0.028, z], [0.31, 0.018, 0.26], [0, padIndex * 1.1, 0]);
    if (padIndex % 3 !== 2) {
      const bx = x + (padIndex % 2 ? 0.045 : -0.04);
      const bz = z + (padIndex % 2 ? -0.035 : 0.04);
      add(crown, padIndex % 2 ? p.cream : p.clay, [bx, 0.054, bz], [0.068, 0.048, 0.068], [0, padIndex * 0.85, 0]);
      add(cone, p.cream, [bx, 0.084, bz], [0.032, 0.056, 0.032]);
    }
  }

  // One continuous profile, ending at the terrace rather than crossing the fountain.
  const bridge = PARK_LAKESIDE.bridge;
  const deckY = (t: number) => bridge.landingY + Math.sin(t * Math.PI) ** 2 * bridge.rise;
  const archProfile = (width: number, thickness: number, lift: number, z: number) => {
    const shape = new THREE.Shape();
    for (let index = 0; index <= 32; index++) {
      const t = index / 32;
      const x = THREE.MathUtils.lerp(bridge.startX, bridge.endX, t);
      if (index === 0) shape.moveTo(x, deckY(t) + lift);
      else shape.lineTo(x, deckY(t) + lift);
    }
    for (let index = 32; index >= 0; index--) {
      const t = index / 32;
      shape.lineTo(THREE.MathUtils.lerp(bridge.startX, bridge.endX, t), deckY(t) + lift - thickness);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
    geometry.translate(0, 0, z - width / 2);
    return geometry;
  };
  mesh('Lake bridge continuous deck', archProfile(bridge.width, 0.24, 0, bridge.z), p.stone).castShadow = true;
  const rails: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const z = bridge.z + side * (bridge.width / 2 - 0.08);
    rails.push(archProfile(0.09, 0.075, 1.12, z), archProfile(0.055, 0.045, 0.32, z));
  }
  joinedMesh('Lake bridge curved railings', rails, p.rubber);
  for (let index = 0; index <= 20; index++) {
    const t = index / 20;
    const x = THREE.MathUtils.lerp(bridge.startX, bridge.endX, t);
    const y = deckY(t);
    for (const side of [-1, 1]) {
      block(p.rubber, x, y + 0.56, bridge.z + side * 1.32, 0.065, 1.12, 0.065);
    }
    if (index > 0 && index < 20) {
      const slope = Math.sin(t * 2 * Math.PI) * Math.PI * bridge.rise / (bridge.endX - bridge.startX);
      add(box, p.paving, [x, y + 0.007, bridge.z], [0.035, 0.012, 2.5], [0, 0, Math.atan(slope)]);
    }
  }
  for (const x of [bridge.startX, bridge.endX]) {
    block(p.stone, x, -0.14, bridge.z, 1.2, 0.35, 3.4);
    for (const side of [-1, 1]) {
      block(p.stone, x, 0.58, bridge.z + side * 1.57, 0.42, 1.16, 0.42);
      block(p.paving, x, 1.19, bridge.z + side * 1.57, 0.52, 0.1, 0.52);
    }
  }
  block(p.paving, bridge.startX - 1.05, -0.015, bridge.z, 2.2, 0.08, 3.4);

  surface('Lakeside terrace', [[-9, 26.1], [9, 26.1], [9.9, 32.4], [9, 40.5], [-9, 40.5], [-9.9, 32.4]], 0.025, p.paving);
  const fountain = PARK_LAKESIDE.fountain;
  const turnedStone = (profile: readonly Point[]) => {
    const geometry = new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), 36);
    geometry.translate(fountain.x, 0, fountain.z);
    return geometry;
  };
  joinedMesh('Lakeside fountain', [
    turnedStone([
      [0, 0.06], [fountain.radius, 0.06], [fountain.radius, 0.19], [2.42, 0.24],
      [2.36, 0.54], [2.47, 0.6], [fountain.radius, 0.68], [2.14, 0.68],
      [2.09, 0.58], [2.09, 0.2], [0, 0.2],
    ]),
    turnedStone([
      [0, 0.18], [0.66, 0.18], [0.64, 0.34], [0.46, 0.44], [0.34, 0.56],
      [0.26, 1.08], [0.5, 1.18], [0.54, 1.25], [0.3, 1.32],
      [0.25, 1.5], [0.68, 1.64], [1.04, 1.92], [1.05, 2.06],
      [0.88, 2.06], [0.65, 1.82], [0, 1.82],
    ]),
  ], p.stone);
  // Fountain basin pools, splash rings, mid-tier ring, bronze nozzle, and cascading water plume.
  add(cylinder, p.water, [fountain.x, 0.49, fountain.z], [2.08, 0.035, 2.08]);
  add(cylinder, p.cream, [fountain.x, 0.514, fountain.z], [1.46, 0.008, 1.46]);
  add(cylinder, p.water, [fountain.x, 0.522, fountain.z], [1.08, 0.008, 1.08]);
  add(cylinder, p.water, [fountain.x, 1.24, fountain.z], [0.47, 0.02, 0.47]);
  add(cylinder, p.water, [fountain.x, 1.96, fountain.z], [0.89, 0.035, 0.89]);
  add(cylinder, p.copperEdge, [fountain.x, 2.06, fountain.z], [0.08, 0.22, 0.08]);
  add(cylinder, alloy, [fountain.x, 2.2, fountain.z], [0.048, 0.07, 0.048]);
  add(cone, p.water, [fountain.x, 2.43, fountain.z], [0.095, 0.4, 0.095]);
  add(cone, p.water, [fountain.x, 2.31, fountain.z], [0.32, 0.34, 0.32]);
  add(crown, p.cream, [fountain.x, 2.63, fountain.z], [0.125, 0.15, 0.125]);

  for (const { x, z } of PARK_LAKESIDE.pergolas) {
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const px = x + side * 1.35;
      const pz = z + end * 1.15;
      // Sculpted granite post plinth, beveled cap, and cast-alloy timber shoe.
      add(rbox, p.stone, [px, 0.14, pz], [0.42, 0.24, 0.42]);
      add(rbox, p.paving, [px, 0.282, pz], [0.34, 0.038, 0.34]);
      add(rbox, alloy, [px, 0.345, pz], [0.22, 0.082, 0.22]);
      block(p.wood, px, 1.47, pz, 0.18, 2.62, 0.18);
      // High knee braces and alloy gusset plates (strictly above 2.5 m walk headroom).
      add(rbox, alloy, [px, 2.75, pz], [0.2, 0.13, 0.22]);
      add(rbox, p.wood, [px, 2.66, z + end * 0.92], [0.1, 0.3, 0.1], [end * 0.72, 0, 0]);
      add(rbox, p.wood, [x + side * 1.12, 2.66, pz], [0.1, 0.3, 0.1], [0, 0, side * -0.72]);
    }
    for (const side of [-1, 1]) {
      add(rbox, p.wood, [x + side * 1.35, 2.82, z], [0.165, 0.25, 3.36]);
    }
    for (let slat = 0; slat < 9; slat++) {
      block(p.wood, x, 3.01, z - 1.45 + slat * 0.36, 3.5, 0.16, 0.12);
    }
    for (let purlin = 0; purlin < 5; purlin++) {
      add(rbox, p.wood, [x - 1.2 + purlin * 0.6, 3.125, z], [0.07, 0.06, 3.24]);
    }
  }
  for (let step = 0; step < 5; step++) {
    add(rbox, p.stone, [10.8, 0.09 + step * 0.1, 16.92 + step * 0.45], [8.1, 0.18 + step * 0.2, 0.46]);
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

  const crownLobes: readonly [dx: number, dy: number, dz: number, rx: number, ry: number, rz: number, lightBias: number][] = [
    [-0.8, 3.35, 0.14, 1.26, 1.1, 1.2, 0],
    [0.76, 3.5, 0.36, 1.3, 1.14, 1.24, 1],
    [-0.1, 3.44, -0.74, 1.24, 1.08, 1.22, 0],
    [0.26, 4.02, 0.4, 1.18, 1.1, 1.16, 2],
    [-0.06, 4.52, -0.16, 1.32, 1.16, 1.28, 1],
  ];
  for (const [index, [x, z, scale]] of trees.entries()) {
    if (index % 9 === 0 && clearOfPaths(x, z, 0.7)) {
      add(cylinder, p.wood, [x, -0.028, z], [0.65, 0.015, 0.65]);
      add(cylinder, p.roof, [x, -0.018, z], [0.38, 0.01, 0.38]);
    }
    // Subtly tapered root-flare trunk + upper boughs (kept within trunk footprint & >2.5m overhead).
    add(cylinder, p.wood, [x, 0.072, z], [0.22 * scale, 0.15, 0.22 * scale]);
    add(cylinder, p.wood, [x, 0.62 * scale, z], [0.17 * scale, 1.24 * scale, 0.17 * scale]);
    add(cylinder, p.wood, [x, 2.08 * scale, z], [0.125 * scale, 2.15 * scale, 0.125 * scale]);
    for (const branchSide of [-1, 1]) {
      add(cylinder, p.wood, [x + branchSide * 0.22 * scale, 3.05 * scale, z + branchSide * 0.08 * scale],
        [0.062 * scale, 0.92 * scale, 0.062 * scale], [branchSide * 0.12, index * 0.7, branchSide * -0.36]);
    }
    // Richer 5-lobe organic crown clusters preserving exact foliage wind sway compatibility.
    for (const [lobeIndex, [dx, dy, dz, rx, ry, rz, lightBias]] of crownLobes.entries()) {
      const surfaceMaterial = (index + lightBias + lobeIndex) % 3 === 0 ? p.leafLight : p.leaf;
      add(crown, surfaceMaterial,
        [x + dx * scale, dy * scale, z + dz * scale],
        [rx * scale, ry * scale * (index % 4 === 0 ? 1.03 : 1.1), rz * scale],
        [Math.sin(index + lobeIndex) * 0.14, index * 1.7 + lobeIndex * 1.2, Math.cos(index + lobeIndex) * 0.14]);
    }
  }

  // Smooth Loop-subdivided Manhattan schist outcrops in meadow & grove pockets (instanced for tight per-rock bounds).
  const darkOutcropMatrices: THREE.Matrix4[] = [];
  for (const [x, z] of [[-21.6, 2.7], [-24.3, 64.8], [-17.1, 80.1], [18, -81.9]]) {
    if (clearOfPaths(x, z, 2.3) && clearOfPaths(x + 1.6, z + 0.55, 1.5) && clearOfPaths(x - 1.15, z + 0.82, 1.0)) {
      darkOutcropMatrices.push(boulderMatrix(x, 0.56, z, 2.25, 1.02, 1.68, x * 0.1, 0.24));
      shoreRockMatrices.push(
        boulderMatrix(x + 1.6, 0.32, z + 0.55, 1.32, 0.66, 1.12, z * 0.08, -0.14),
        boulderMatrix(x - 1.15, 0.22, z + 0.82, 0.82, 0.42, 0.72, x * 0.2, 0.12),
      );
    }
  }
  const boulderBatches: THREE.InstancedMesh[] = [];
  const addBoulderBatch = (name: string, matrices: readonly THREE.Matrix4[], material: THREE.Material) => {
    if (matrices.length === 0) return;
    const batch = new THREE.InstancedMesh(boulderGeometry, material, matrices.length);
    batch.name = name;
    batch.castShadow = true;
    batch.receiveShadow = true;
    matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    boulderBatches.push(batch);
    group.add(batch);
  };
  addBoulderBatch('Lakeside shoreline boulders', shoreRockMatrices, p.stone);
  addBoulderBatch('Park schist outcrops', darkOutcropMatrices, p.roof);

  // Contoured multi-slat wood park benches with scrolled cast-iron frames & center armrest.
  for (const { id, x, z, yaw } of PARK_SEATS) {
    const pos = (dx: number, y: number, dz: number): readonly [number, number, number] =>
      [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, y, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
    const orient = (pitch: number): readonly [number, number, number] => {
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, 0))),
      );
      return [euler.x, euler.y, euler.z];
    };
    if ((PARK_COMPANION_SEAT_IDS as readonly string[]).includes(id)) {
      block(p.paving, ...pos(0.6, -0.02, 0.8), 3.4, 0.016, 2.4, yaw);
    }
    for (const [dz, y, pitch, h, d] of [
      [-0.2, 0.575, 0.08, 0.052, 0.11],
      [-0.07, 0.56, 0.02, 0.052, 0.11],
      [0.06, 0.558, -0.04, 0.052, 0.11],
      [0.19, 0.568, 0.1, 0.06, 0.118],
    ] as const) {
      add(rbox, p.wood, pos(0, y, dz), [1.96, h, d], orient(pitch));
    }
    for (const [dz, y, pitch, h] of [
      [-0.245, 0.73, -0.18, 0.095],
      [-0.27, 0.865, -0.21, 0.095],
      [-0.298, 1.005, -0.24, 0.108],
    ] as const) {
      add(rbox, p.wood, pos(0, y, dz), [1.96, h, 0.056], orient(pitch));
    }
    for (const side of [-1, 1]) {
      const fx = side * 0.84;
      add(rbox, p.rubber, pos(fx, 0.24, 0.17), [0.068, 0.48, 0.08], orient(-0.12));
      add(rbox, p.rubber, pos(fx, 0.52, -0.23), [0.07, 1.02, 0.085], orient(-0.19));
      add(rbox, p.rubber, pos(fx, 0.49, -0.01), [0.062, 0.055, 0.5], [0, yaw, 0]);
      add(rbox, p.rubber, pos(fx, 0.74, -0.02), [0.068, 0.05, 0.52], orient(0.04));
      add(rbox, p.rubber, pos(fx, 0.63, 0.21), [0.052, 0.18, 0.052], orient(0.1));
      add(cylinder, alloy, pos(fx, 0.72, 0.24), [0.045, 0.072, 0.045], orient(0));
    }
    add(rbox, alloy, pos(0, 0.73, -0.02), [0.05, 0.044, 0.46], orient(0.04));
    add(rbox, p.rubber, pos(0, 0.625, 0.19), [0.044, 0.17, 0.044], orient(0.1));
  }

  for (const [x, z] of PARK_PICNICS) {
    add(rbox, p.clay, [x, 0.004, z], [2.4, 0.028, 1.8]);
    add(rbox, p.cream, [x, 0.015, z], [2.12, 0.014, 1.52]);
  }
  for (const z of [52.2, 63, 73.8]) for (const x of [-3.5, 3.5]) {
    add(cylinder, p.rubber, [x, 0.22, z], [0.15, 0.44, 0.15]);
    add(cylinder, alloy, [x, 0.47, z], [0.115, 0.06, 0.115]);
    add(cylinder, p.rubber, [x, 2.1, z], [0.072, 3.7, 0.072]);
    add(cylinder, alloy, [x, 3.94, z], [0.13, 0.09, 0.13]);
    add(crown, p.cream, [x, 4.18, z], [0.31, 0.39, 0.31]);
    add(cone, p.rubber, [x, 4.52, z], [0.34, 0.16, 0.34]);
    add(cylinder, alloy, [x, 4.64, z], [0.036, 0.09, 0.036]);
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
      for (const along of [-opening - 0.35, opening + 0.35]) {
        place(along, 0.7, 1.4, p.stone, 0.62);
        const cx = vertical ? side * across : along;
        const cz = vertical ? along : side * across;
        add(rbox, p.paving, [cx, 1.36, cz], vertical ? [0.3, 0.08, 0.78] : [0.78, 0.08, 0.3]);
        add(crown, p.stone, [cx, 1.5, cz], [0.14, 0.16, 0.14]);
      }
    }
  }
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      boulderBatches.forEach((batch) => batch.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      [grass, gravel, track, pondWater].forEach((material) => material.dispose());
      group.removeFromParent();
      group.clear();
    },
  };
}
