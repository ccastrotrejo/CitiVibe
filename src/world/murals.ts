import * as THREE from 'three';
import {
  GHOST_SIGN_PALETTE, MURAL_FIGURE_TONES, MURAL_PALETTES, MURAL_TAG_TONES,
  facadeSample, muralMotifFor, type MuralMotif,
} from '../content/facades';

/**
 * A blank lot-line wall left exposed because the abutting building is lower. These walls carry
 * no windows, so they are the surfaces the neighbourhood paints.
 */
export interface MuralWall {
  id: string;
  buildingId: string;
  /** Axis the wall faces along; the wall itself runs on the other horizontal axis. */
  axis: 'x' | 'z';
  side: 1 | -1;
  /** Position of the wall plane on the facing axis. */
  plane: number;
  /** Centre of the wall on its running axis. */
  center: number;
  width: number;
  baseY: number;
  height: number;
  /** `upper` sits above the neighbour's parapet; `full` drops to just above the ground floor. */
  regime: 'upper' | 'full';
}

type Point = readonly [number, number];
interface Shape {
  color: string;
  points: readonly Point[];
}

const SURFACE_OFFSET = 0.05;
/**
 * Total thickness of a painted panel. Layers are spread across this depth rather than stepped
 * by a fixed amount, so a busy composition stays flat against the brick instead of standing
 * off it. The camera is orthographic, so depth resolution is uniform across the city.
 */
const PAINT_DEPTH = 0.03;
/** Upper bound on a single layer step, used when a panel has only a few shapes. */
const LAYER_STEP = 0.004;
/** Painted margin of raw masonry left around the artwork. */
const MARGIN = 0.06;

/** Sutherland-Hodgman clip against the unit panel, so no motif can spill past its wall. */
function clipToPanel(points: readonly Point[]): Point[] {
  const edges: readonly (readonly [number, number, number])[] = [
    [1, 0, 0], [-1, 0, 1], [0, 1, 0], [0, -1, 1],
  ];
  let polygon = [...points];
  for (const [nx, ny, offset] of edges) {
    if (!polygon.length) return [];
    const next: Point[] = [];
    for (let index = 0; index < polygon.length; index++) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = nx * current[0] + ny * current[1] + offset >= 0;
      const previousInside = nx * previous[0] + ny * previous[1] + offset >= 0;
      if (currentInside !== previousInside) {
        const a = nx * previous[0] + ny * previous[1] + offset;
        const b = nx * current[0] + ny * current[1] + offset;
        const t = a / (a - b);
        next.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t]);
      }
      if (currentInside) next.push(current);
    }
    polygon = next;
  }
  return polygon;
}

function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
}

function regularShape(cx: number, cy: number, radiusX: number, radiusY: number, sides: number, turn = 0): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = turn + index * Math.PI * 2 / sides;
    return [cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY] as Point;
  });
}

/** A straight stroke of a given thickness, used for stems, rules and abstract marks. */
function stroke(from: Point, to: Point, thickness: number): Point[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length * thickness / 2;
  const ny = dx / length * thickness / 2;
  return [
    [from[0] + nx, from[1] + ny], [to[0] + nx, to[1] + ny],
    [to[0] - nx, to[1] - ny], [from[0] - nx, from[1] - ny],
  ];
}

/** Bold keyline around a polygon; outlining does much of the perceptual work on a mural. */
function outline(points: readonly Point[], color: string, thickness: number): Shape[] {
  return points.map((point, index) => ({
    color, points: stroke(point, points[(index + 1) % points.length], thickness),
  }));
}

function composition(panelId: string, motif: MuralMotif, aspect: number): Shape[] {
  const roll = (feature: string) => facadeSample(panelId, feature);
  const shapes: Shape[] = [];
  if (motif === 'ghost-sign') {
    // Overpainting was routine, so two offset layers at low contrast read as a palimpsest.
    shapes.push({ color: GHOST_SIGN_PALETTE.panel, points: rectangle(0.06, 0.2, 0.88, 0.6) });
    for (const [layer, tone] of [[0, GHOST_SIGN_PALETTE.marks[3]], [1, GHOST_SIGN_PALETTE.marks[0]]] as const) {
      const drift = layer * 0.035;
      const top = 0.26 + drift;
      const bottom = 0.74 - drift;
      for (const edge of [top, bottom]) {
        shapes.push({ color: tone, points: stroke([0.12 + drift, edge], [0.88 - drift, edge], 0.014) });
      }
      // Abstract bars standing in for weathered marks; the generator never renders words.
      const rows = 3;
      for (let row = 0; row < rows; row++) {
        const y = top + (bottom - top) * (row + 0.8) / (rows + 0.9);
        let cursor = 0.16 + drift;
        for (let bar = 0; bar < 5; bar++) {
          const barWidth = 0.05 + roll(`ghost-${layer}-${row}-${bar}`) * 0.11;
          if (cursor + barWidth > 0.86) break;
          shapes.push({
            color: GHOST_SIGN_PALETTE.marks[(row + bar + layer) % GHOST_SIGN_PALETTE.marks.length],
            points: rectangle(cursor, y - 0.035, barWidth, 0.07),
          });
          cursor += barWidth + 0.025;
        }
      }
    }
    return shapes;
  }

  const palette = MURAL_PALETTES[Math.floor(roll('palette') * MURAL_PALETTES.length)];
  const tint = (index: number) => palette.colors[index % palette.colors.length];
  shapes.push({ color: palette.ground, points: rectangle(0, 0, 1, 1) });

  switch (motif) {
    case 'bands': {
      const count = 4 + Math.floor(roll('band-count') * 3);
      const lean = (roll('band-lean') - 0.5) * 1.6;
      for (let index = 0; index < count; index++) {
        const start = -0.4 + index * 1.8 / count;
        const end = start + 1.8 / count * 0.82;
        shapes.push({
          color: tint(index),
          points: [[start, 0], [end, 0], [end + lean, 1], [start + lean, 1]],
        });
      }
      break;
    }
    case 'arcs': {
      const originX = roll('arc-origin') < 0.5 ? 0.08 : 0.92;
      const rings = 5 + Math.floor(roll('arc-rings') * 3);
      for (let ring = rings; ring > 0; ring--) {
        const radius = ring / rings * 1.15;
        const segments = 14;
        const points: Point[] = [[originX, 0.02]];
        for (let step = 0; step <= segments; step++) {
          const angle = step / segments * Math.PI * 0.5;
          points.push([
            originX + (originX < 0.5 ? 1 : -1) * Math.cos(angle) * radius,
            0.02 + Math.sin(angle) * radius * aspect,
          ]);
        }
        shapes.push({ color: tint(ring), points });
      }
      break;
    }
    case 'sunburst': {
      // Radiating wedges from a low origin, the way a full-wall burst fills a corner lot.
      const originX = 0.2 + roll('burst-x') * 0.6;
      const originY = -0.05 + roll('burst-y') * 0.35;
      const wedges = 11 + Math.floor(roll('burst-count') * 7);
      const spread = Math.PI * (0.72 + roll('burst-spread') * 0.5);
      const start = Math.PI / 2 - spread / 2;
      for (let index = 0; index < wedges; index++) {
        const from = start + index * spread / wedges;
        const to = start + (index + 1) * spread / wedges;
        shapes.push({
          color: tint(index),
          points: [
            [originX, originY],
            [originX + Math.cos(from) * 3, originY + Math.sin(from) * 3],
            [originX + Math.cos(to) * 3, originY + Math.sin(to) * 3],
          ],
        });
      }
      shapes.push({ color: palette.ground, points: regularShape(originX, originY, 0.1, 0.1 * aspect, 12) });
      break;
    }
    case 'bloom': {
      const stems = 3 + Math.floor(roll('bloom-stems') * 3);
      for (let index = 0; index < stems; index++) {
        const rootX = (index + 0.5) / stems;
        const headX = rootX + (roll(`bloom-lean-${index}`) - 0.5) * 0.22;
        const headY = 0.5 + roll(`bloom-height-${index}`) * 0.4;
        shapes.push({ color: tint(index + 2), points: stroke([rootX, 0], [headX, headY], 0.035) });
        for (const leaf of [0.3, 0.52]) {
          const side = leaf > 0.4 ? 1 : -1;
          shapes.push({
            color: tint(index + 3),
            points: regularShape(headX + side * 0.09, headY * leaf, 0.1, 0.06 * aspect, 6, side * 0.6),
          });
        }
        const petals = 5 + Math.floor(roll(`bloom-petals-${index}`) * 3);
        for (let petal = 0; petal < petals; petal++) {
          const angle = petal * Math.PI * 2 / petals;
          shapes.push({
            color: tint(index),
            points: regularShape(headX + Math.cos(angle) * 0.075, headY + Math.sin(angle) * 0.075 * aspect,
              0.072, 0.072 * aspect, 7),
          });
        }
        shapes.push({
          color: tint(index + 1),
          points: regularShape(headX, headY, 0.055, 0.055 * aspect, 8),
        });
      }
      break;
    }
    case 'mosaic': {
      const columns = 4 + Math.floor(roll('mosaic-columns') * 3);
      const rows = Math.max(3, Math.round(columns / aspect));
      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
          const chance = roll(`mosaic-${column}-${row}`);
          if (chance < 0.18) continue;
          const inset = 0.012 + chance * 0.02;
          shapes.push({
            color: tint(column * 3 + row * 5),
            points: rectangle(column / columns + inset, row / rows + inset,
              1 / columns - inset * 2, 1 / rows - inset * 2),
          });
        }
      }
      break;
    }
    case 'diamonds': {
      // A chain of rhombi down the centre over broad flanking fields.
      for (const side of [-1, 1]) {
        shapes.push({
          color: tint(side > 0 ? 1 : 2),
          points: side > 0 ? rectangle(0.52, 0.08, 0.44, 0.84) : rectangle(0.04, 0.08, 0.44, 0.84),
        });
      }
      const beads = 4 + Math.floor(roll('diamond-count') * 4);
      for (let index = 0; index < beads; index++) {
        const y = (index + 0.6) / (beads + 0.2);
        const radius = 0.1 + roll(`diamond-${index}`) * 0.07;
        shapes.push({
          color: tint(index + 2),
          points: regularShape(0.5, y, radius, radius * aspect * 1.35, 4, Math.PI / 2),
        });
        shapes.push(...outline(regularShape(0.5, y, radius, radius * aspect * 1.35, 4, Math.PI / 2),
          palette.outline, 0.016));
      }
      break;
    }
    case 'figure': {
      // An abstracted, faceted head-and-shoulders mass. It carries no features and is never a
      // likeness of any real person; the facets are flat tones over a contrasting field.
      const centerX = 0.36 + roll('figure-x') * 0.28;
      const headY = 0.66;
      const headRadius = 0.21;
      shapes.push({ color: tint(0), points: rectangle(0.04, 0.04, 0.92, 0.92) });
      shapes.push({
        color: MURAL_FIGURE_TONES[1],
        points: [[centerX - 0.36, 0.04], [centerX + 0.36, 0.04], [centerX + 0.26, 0.46], [centerX - 0.26, 0.46]],
      });
      const head = regularShape(centerX, headY, headRadius, headRadius * aspect * 1.18, 9, Math.PI / 2);
      shapes.push({ color: MURAL_FIGURE_TONES[0], points: head });
      const facets = 4 + Math.floor(roll('figure-facets') * 3);
      for (let index = 0; index < facets; index++) {
        const angle = roll(`figure-facet-${index}`) * Math.PI * 2;
        const reach = 0.5 + roll(`figure-reach-${index}`) * 0.7;
        shapes.push({
          color: MURAL_FIGURE_TONES[2 + index % (MURAL_FIGURE_TONES.length - 2)],
          points: [
            [centerX, headY],
            [centerX + Math.cos(angle) * headRadius * reach,
              headY + Math.sin(angle) * headRadius * aspect * reach],
            [centerX + Math.cos(angle + 1.1) * headRadius * reach,
              headY + Math.sin(angle + 1.1) * headRadius * aspect * reach],
          ],
        });
      }
      shapes.push(...outline(head, palette.outline, 0.018));
      break;
    }
  }
  return shapes;
}

/** Abstract reachable-height scribbles, generated as marks; never words, tags or signatures. */
function scribbles(panelId: string, height: number): Shape[] {
  const band = Math.min(0.34, 1.2 / height);
  const marks: Shape[] = [];
  const count = 5 + Math.floor(facadeSample(panelId, 'scribble-count') * 5);
  for (let index = 0; index < count; index++) {
    const x = facadeSample(panelId, `scribble-x-${index}`);
    const y = facadeSample(panelId, `scribble-y-${index}`) * band * 0.8;
    const length = 0.05 + facadeSample(panelId, `scribble-length-${index}`) * 0.12;
    const lean = (facadeSample(panelId, `scribble-lean-${index}`) - 0.5) * band;
    marks.push({
      color: MURAL_TAG_TONES[index % MURAL_TAG_TONES.length],
      points: stroke([x, y], [x + length, y + lean], 0.012),
    });
  }
  return marks;
}

interface Quadrant {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

/**
 * Original procedural wall art on exposed party walls. Every composition is generated from
 * authored palettes and motif rules; nothing here reproduces a real mural, artist's work,
 * advertisement, logo or lettering. Caller owns the returned resources.
 */
export function buildMurals(walls: readonly MuralWall[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Party wall murals';
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  paint.name = 'Mural wall paint';
  paint.userData.weatherSurface = true;
  // Vertical paint holds no snow, but it should darken with the masonry when it rains.
  paint.userData.snowRetention = 0;
  const quadrants: Quadrant[] = Array.from({ length: 4 }, () => ({
    positions: [], normals: [], colors: [], indices: [],
  }));
  const color = new THREE.Color();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const facing = new THREE.Vector3();

  for (const wall of walls) {
    if (!(wall.width > 0) || !(wall.height > 0) || !Number.isFinite(wall.baseY)) {
      throw new Error(`Invalid mural wall: ${wall.id}.`);
    }
    const worldX = wall.axis === 'x' ? wall.plane : wall.center;
    const worldZ = wall.axis === 'x' ? wall.center : wall.plane;
    const quadrant = quadrants[(worldX > 0 ? 1 : 0) + (worldZ > 0 ? 2 : 0)];
    const normal: readonly [number, number, number] =
      wall.axis === 'x' ? [wall.side, 0, 0] : [0, 0, wall.side];
    facing.set(...normal);
    const usableWidth = wall.width * (1 - MARGIN * 2);
    const usableHeight = wall.height * (1 - MARGIN);
    const originRun = wall.center - usableWidth / 2;
    const originY = wall.baseY + wall.height * MARGIN * 0.5;
    // Long walls are divided into abutting panels, each its own composition with a hard edge.
    const panels = Math.max(1, Math.min(3, Math.round(usableWidth / Math.max(usableHeight, 1) / 1.1)));
    for (let panel = 0; panel < panels; panel++) {
      const panelId = `${wall.id}-panel-${panel}`;
      const panelWidth = usableWidth / panels;
      const panelRun = originRun + panel * panelWidth;
      const motif = muralMotifFor(panelId);
      const aspect = panelWidth / usableHeight;
      const shapes = composition(panelId, motif, aspect);
      if (wall.regime === 'full' && motif !== 'ghost-sign' &&
        facadeSample(panelId, 'scribbled') < 0.55) shapes.push(...scribbles(panelId, usableHeight));
      const step = Math.min(LAYER_STEP, PAINT_DEPTH / Math.max(1, shapes.length - 1));
      shapes.forEach((shape, layer) => {
        const clipped = clipToPanel(shape.points);
        if (clipped.length < 3) return;
        const target = quadrant;
        const offset = SURFACE_OFFSET + layer * step;
        const start = target.positions.length / 3;
        color.set(shape.color);
        for (const [u, v] of clipped) {
          const run = panelRun + u * panelWidth;
          const y = originY + v * usableHeight;
          if (wall.axis === 'x') target.positions.push(wall.plane + wall.side * offset, y, run);
          else target.positions.push(run, y, wall.plane + wall.side * offset);
          target.normals.push(...normal);
          target.colors.push(color.r, color.g, color.b);
        }
        for (let vertex = 1; vertex + 1 < clipped.length; vertex++) {
          const triangle = [start, start + vertex, start + vertex + 1];
          edgeA.set(
            target.positions[triangle[1] * 3] - target.positions[triangle[0] * 3],
            target.positions[triangle[1] * 3 + 1] - target.positions[triangle[0] * 3 + 1],
            target.positions[triangle[1] * 3 + 2] - target.positions[triangle[0] * 3 + 2],
          );
          edgeB.set(
            target.positions[triangle[2] * 3] - target.positions[triangle[0] * 3],
            target.positions[triangle[2] * 3 + 1] - target.positions[triangle[0] * 3 + 1],
            target.positions[triangle[2] * 3 + 2] - target.positions[triangle[0] * 3 + 2],
          );
          // Keep every face pointing out of the wall regardless of how a motif wound its points.
          if (edgeA.cross(edgeB).dot(facing) < 0) triangle.reverse();
          target.indices.push(...triangle);
        }
      });
    }
  }

  try {
    for (const [index, quadrant] of quadrants.entries()) {
      if (!quadrant.indices.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(quadrant.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(quadrant.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(quadrant.colors, 3));
      geometry.setIndex(quadrant.indices);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, paint);
      mesh.name = `Mural quadrant ${index}`;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (!group.children.length) throw new Error('No mural walls produced any painted surface.');
    return group;
  } catch (error) {
    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    paint.dispose();
    throw error;
  }
}
