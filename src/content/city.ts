export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Landmark {
  id: string;
  name: string;
  description: string;
  position: Position;
  hitRadius: number;
  focusAnchorId: string;
}

export const CITY = {
  version: 'rainlight-001',
  name: 'Rainlight Square',
  bounds: 28,
  busId: 'square-bus',
  busSpeed: 3.2,
  landmark: {
    id: 'rainlight-pavilion',
    name: 'Rainlight Pavilion',
    description: 'A copper-roofed gathering place in the garden. A little shade, a quiet seat, and a view of the passing bus.',
    position: { x: -4, y: 0, z: -3 },
    hitRadius: 5,
    focusAnchorId: 'pavilion-view',
  },
} as const;

export const LANDMARKS: readonly Landmark[] = [
  CITY.landmark,
  {
    id: 'terrace-steps',
    name: 'Terrace Steps',
    description: 'Sun-warmed steps beside the terraced houses. A small meeting place overlooking the garden loop.',
    position: { x: 9, y: 0, z: -4 },
    hitRadius: 3,
    focusAnchorId: 'terrace-view',
  },
  {
    id: 'reed-garden',
    name: 'Reed Garden',
    description: 'A shallow rain garden framed by reeds and shady trees. The slow side of the square.',
    position: { x: -8, y: 0, z: 7 },
    hitRadius: 3,
    focusAnchorId: 'garden-view',
  },
];

export const CAMERA_PROJECTION = {
  distance: Math.hypot(80, 85),
  defaultPitch: Math.atan2(85, 80),
  minPitch: Math.PI / 6,
  maxPitch: Math.PI * 5 / 12,
} as const;

export const CAMERA_ANCHORS = [
  { id: 'square-overview', pose: { x: 0, z: 0, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1 } },
  { id: 'pavilion-view', pose: { x: -4, z: -3, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1.9 } },
  { id: 'terrace-view', pose: { x: 9, z: -4, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1.9 } },
  { id: 'garden-view', pose: { x: -8, z: 7, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1.9 } },
] as const;

export const CONTENT = {
  schemaVersion: 1,
  assetVersion: CITY.version,
  seed: 2401,
  units: 'meters',
  upAxis: 'Y',
  routeId: 'garden-loop',
  landmarks: LANDMARKS,
  cameraAnchors: CAMERA_ANCHORS,
  tourAnchorIds: ['square-overview', 'pavilion-view', 'garden-view', 'terrace-view'],
} as const;

export function validateLandmarks(landmarks: readonly Landmark[]): void {
  if (landmarks.length === 0) throw new Error('City content has no landmarks.');
  const ids = new Set<string>();
  const anchorIds = new Set<string>();
  for (const { id, pose } of CAMERA_ANCHORS) {
    if (anchorIds.has(id) || !Object.values(pose).every(Number.isFinite) || Math.abs(pose.x) > CITY.bounds ||
      Math.abs(pose.z) > CITY.bounds || pose.zoom < 0.65 || pose.zoom > 2.7 ||
      pose.pitch < CAMERA_PROJECTION.minPitch || pose.pitch > CAMERA_PROJECTION.maxPitch) throw new Error(`Invalid camera anchor: ${id}.`);
    anchorIds.add(id);
  }
  for (const landmark of landmarks) {
    if (!landmark.id || ids.has(landmark.id)) throw new Error('City landmark IDs must be unique and nonempty.');
    ids.add(landmark.id);
    if (!anchorIds.has(landmark.focusAnchorId)) throw new Error(`Missing focus anchor: ${landmark.id}.`);
    const { x, y, z } = landmark.position;
    if (![x, y, z, landmark.hitRadius].every(Number.isFinite) ||
      Math.abs(x) > CITY.bounds || Math.abs(z) > CITY.bounds || y < 0 || y > 30 || landmark.hitRadius <= 0) {
      throw new Error(`Invalid city anchor: ${landmark.id}.`);
    }
  }
}

const RADIUS = 6;
const ARC = Math.PI * RADIUS / 2;
export const ROUTE_LENGTH = 2 * (28 + 20) + 4 * ARC;
const ROUTE_SEGMENTS = [28, ARC, 20, ARC, 28, ARC, 20, ARC] as const;
const CORNER_CENTERS = [[14, -10], [14, 10], [-14, 10], [-14, -10]] as const;

/** Constant-distance rounded loop, shared by the street geometry and bus. */
export function sampleRoute(distance: number): Position & { heading: number } {
  if (!Number.isFinite(distance)) throw new Error('Route distance must be finite.');
  let d = ((distance % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;
  let segment = 0;
  while (segment < ROUTE_SEGMENTS.length - 1 && d >= ROUTE_SEGMENTS[segment]) {
    d -= ROUTE_SEGMENTS[segment];
    segment += 1;
  }
  switch (segment) {
    case 0: return { x: -14 + d, y: 0, z: -16, heading: Math.PI / 2 };
    case 2: return { x: 20, y: 0, z: -10 + d, heading: 0 };
    case 4: return { x: 14 - d, y: 0, z: 16, heading: -Math.PI / 2 };
    case 6: return { x: -20, y: 0, z: 10 - d, heading: Math.PI };
    default: {
      const corner = (segment - 1) / 2;
      const angle = -Math.PI / 2 + corner * Math.PI / 2 + d / RADIUS;
      const [x, z] = CORNER_CENTERS[corner];
      return {
        x: x + Math.cos(angle) * RADIUS,
        y: 0,
        z: z + Math.sin(angle) * RADIUS,
        heading: Math.atan2(Math.sin(-angle), Math.cos(-angle)),
      };
    }
  }
}
