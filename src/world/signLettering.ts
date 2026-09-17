import { BufferGeometry, Float32BufferAttribute } from 'three';

type Stroke = readonly (readonly [number, number])[];

// Original narrow capitals, built synchronously so paused and recovered views never
// wait for a font or texture download. Coordinates are local to the sign face.
const LETTERS: Readonly<Record<string, readonly Stroke[]>> = {
  A: [[[0, 0], [0.25, 1], [0.5, 0]], [[0.08, 0.34], [0.42, 0.34]]],
  B: [[[0, 0], [0, 1], [0.35, 1], [0.5, 0.86], [0.5, 0.65], [0.35, 0.5], [0, 0.5]], [[0.35, 0.5], [0.5, 0.35], [0.5, 0.14], [0.35, 0], [0, 0]]],
  C: [[[0.5, 0.88], [0.38, 1], [0.12, 1], [0, 0.86], [0, 0.14], [0.12, 0], [0.38, 0], [0.5, 0.12]]],
  D: [[[0, 0], [0, 1], [0.28, 1], [0.5, 0.8], [0.5, 0.2], [0.28, 0], [0, 0]]],
  E: [[[0.5, 1], [0, 1], [0, 0], [0.5, 0]], [[0, 0.5], [0.4, 0.5]]],
  F: [[[0, 0], [0, 1], [0.5, 1]], [[0, 0.5], [0.4, 0.5]]],
  G: [[[0.5, 0.88], [0.38, 1], [0.12, 1], [0, 0.86], [0, 0.14], [0.12, 0], [0.5, 0], [0.5, 0.48], [0.28, 0.48]]],
  H: [[[0, 0], [0, 1]], [[0.5, 0], [0.5, 1]], [[0, 0.5], [0.5, 0.5]]],
  I: [[[0.25, 0], [0.25, 1]], [[0.08, 1], [0.42, 1]], [[0.08, 0], [0.42, 0]]],
  J: [[[0.5, 1], [0.5, 0.15], [0.35, 0], [0.12, 0], [0, 0.15], [0, 0.3]], [[0.15, 1], [0.5, 1]]],
  L: [[[0, 1], [0, 0], [0.5, 0]]],
  N: [[[0, 0], [0, 1], [0.5, 0], [0.5, 1]]],
  O: [[[0.12, 0], [0, 0.14], [0, 0.86], [0.12, 1], [0.38, 1], [0.5, 0.86], [0.5, 0.14], [0.38, 0], [0.12, 0]]],
  P: [[[0, 0], [0, 1], [0.35, 1], [0.5, 0.86], [0.5, 0.66], [0.35, 0.52], [0, 0.52]]],
  R: [[[0, 0], [0, 1], [0.35, 1], [0.5, 0.86], [0.5, 0.66], [0.35, 0.52], [0, 0.52]], [[0.24, 0.52], [0.52, 0]]],
  S: [[[0.5, 0.88], [0.38, 1], [0.12, 1], [0, 0.86], [0, 0.64], [0.12, 0.5], [0.38, 0.5], [0.5, 0.36], [0.5, 0.14], [0.38, 0], [0.12, 0], [0, 0.12]]],
  T: [[[0, 1], [0.5, 1]], [[0.25, 1], [0.25, 0]]],
  U: [[[0, 1], [0, 0.14], [0.12, 0], [0.38, 0], [0.5, 0.14], [0.5, 1]]],
  V: [[[0, 1], [0.25, 0], [0.5, 1]]],
  W: [[[0, 1], [0.1, 0], [0.25, 0.55], [0.4, 0], [0.5, 1]]],
  X: [[[0, 0], [0.5, 1]], [[0, 1], [0.5, 0]]],
  Y: [[[0, 1], [0.25, 0.5], [0.5, 1]], [[0.25, 0.5], [0.25, 0]]],
};

/** Center original front-facing lettering within a blade's safe area. Caller owns geometry. */
export function buildSignLettering(text: string, width: number, height: number): BufferGeometry {
  const characters = [...text.toUpperCase()];
  if (!text.trim() || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Street sign lettering needs text and positive finite dimensions.');
  }
  for (const character of characters) {
    if (character !== ' ' && !LETTERS[character]) throw new Error(`Unsupported street sign letter: ${character}.`);
  }
  const vertices: number[] = [];
  const indices: number[] = [];
  characters.forEach((character, characterIndex) => {
    for (const path of LETTERS[character] ?? []) {
      for (let index = 1; index < path.length; index++) {
        const [ax, ay] = path[index - 1];
        const [bx, by] = path[index];
        const length = Math.hypot(bx - ax, by - ay);
        const dx = (bx - ax) / length * 0.05;
        const dy = (by - ay) / length * 0.05;
        const start = vertices.length / 3;
        for (const [x, y] of [
          [ax - dx + dy, ay - dy - dx], [bx + dx + dy, by + dy - dx],
          [bx + dx - dy, by + dy + dx], [ax - dx - dy, ay - dy + dx],
        ]) {
          vertices.push(x + characterIndex * 0.76, y, 0);
        }
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const scale = Math.min(width / (bounds.max.x - bounds.min.x), height / (bounds.max.y - bounds.min.y));
  geometry.translate(-(bounds.max.x + bounds.min.x) / 2, -(bounds.max.y + bounds.min.y) / 2, 0);
  geometry.scale(scale, scale, 1);
  return geometry;
}
