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
  version: 'rainlight-003',
  name: 'Rainlight Square',
  bounds: 68,
  busId: 'city-vehicle-6',
  landmark: {
    id: 'rainlight-pavilion',
    name: 'Rainlight Pavilion',
    description: 'An open limestone pergola beside the park mall. Shady seats, broad lawns, and a quiet view of the pond.',
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
    description: 'Low stone steps overlooking the great lawn. A quiet meeting place between the woodland paths and city avenues.',
    position: { x: 9, y: 0, z: -4 },
    hitRadius: 3,
    focusAnchorId: 'terrace-view',
  },
  {
    id: 'reed-garden',
    name: 'Reed Garden',
    description: 'A tree-lined park pond with reeds, a gently arched footbridge, and benches along the winding shore.',
    position: { x: -8, y: 0, z: 7 },
    hitRadius: 3,
    focusAnchorId: 'garden-view',
  },
  {
    id: 'juniper-court',
    name: 'Juniper Court',
    description: 'A neighborhood basketball court between the avenues, with shady seats and cyclists passing along the protected lane.',
    position: { x: -45, y: 0, z: 40 },
    hitRadius: 6,
    focusAnchorId: 'court-view',
  },
  {
    id: 'crosstown-steps',
    name: 'Crosstown Steps',
    description: 'Subway stairs open onto a small public plaza. Buses, yellow cabs, and delivery riders pass the corner.',
    position: { x: 45, y: 0, z: -40 },
    hitRadius: 5,
    focusAnchorId: 'crosstown-view',
  },
];

export const CAMERA_PROJECTION = {
  distance: 200,
  overviewHeight: 126,
  overviewWidth: 212,
  maxZoom: 4.5,
  defaultPitch: Math.PI / 6,
  minPitch: Math.PI / 6,
  maxPitch: Math.PI * 5 / 12,
} as const;

export const CAMERA_ANCHORS = [
  { id: 'square-overview', pose: { x: 0, z: 0, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1 } },
  { id: 'pavilion-view', pose: { x: -4, z: -3, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 2.7 } },
  { id: 'terrace-view', pose: { x: 9, z: -4, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 2.7 } },
  { id: 'garden-view', pose: { x: -8, z: 7, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 2.7 } },
  { id: 'court-view', pose: { x: -45, z: 40, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 2.7 } },
  { id: 'crosstown-view', pose: { x: 45, z: -40, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 2.7 } },
] as const;

export const CONTENT = {
  schemaVersion: 1,
  assetVersion: CITY.version,
  seed: 2401,
  units: 'meters',
  upAxis: 'Y',
  routeId: 'crosstown-grid',
  landmarks: LANDMARKS,
  cameraAnchors: CAMERA_ANCHORS,
  tourAnchorIds: ['square-overview', 'pavilion-view', 'crosstown-view', 'terrace-view', 'garden-view', 'court-view'],
} as const;

export function validateLandmarks(landmarks: readonly Landmark[]): void {
  if (landmarks.length === 0) throw new Error('City content has no landmarks.');
  const ids = new Set<string>();
  const anchorIds = new Set<string>();
  for (const { id, pose } of CAMERA_ANCHORS) {
    if (anchorIds.has(id) || !Object.values(pose).every(Number.isFinite) || Math.abs(pose.x) > CITY.bounds ||
      Math.abs(pose.z) > CITY.bounds || pose.zoom < 0.65 || pose.zoom > CAMERA_PROJECTION.maxZoom ||
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
