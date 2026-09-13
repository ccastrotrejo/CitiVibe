import { CITY_EXTENT } from './streets';

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
  version: 'rainlight-004',
  name: 'Rainlight Square',
  bounds: CITY_EXTENT,
  busId: 'city-vehicle-6',
  landmark: {
    id: 'rainlight-pavilion',
    name: 'Rainlight Pavilion',
    description: 'An open limestone pergola beside a lakeside fountain terrace. A long, tree-lined mall leads here from the south gate.',
    position: { x: 0, y: 0, z: 33.3 },
    hitRadius: 5,
    focusAnchorId: 'pavilion-view',
  },
} as const;

export const LANDMARKS: readonly Landmark[] = [
  CITY.landmark,
  {
    id: 'terrace-steps',
    name: 'Terrace Steps',
    description: 'Low stone steps overlooking the great lawn and its winding perimeter walk, with woodland and a reservoir beyond.',
    position: { x: 10.8, y: 0, z: 18 },
    hitRadius: 3,
    focusAnchorId: 'terrace-view',
  },
  {
    id: 'reed-garden',
    name: 'Reservoir Walk',
    description: 'An open reservoir with dark shoreline fencing and a dedicated running loop. Joggers pass in bright shirts and running shoes.',
    position: { x: 0, y: 0, z: -49.5 },
    hitRadius: 12,
    focusAnchorId: 'garden-view',
  },
  {
    id: 'juniper-court',
    name: 'Juniper Court',
    description: 'Neighbors pass, dribble and shoot on the basketball court. Beside it, two pickleball players trade shots across a low net.',
    position: { x: -63, y: 0, z: 118 },
    hitRadius: 6,
    focusAnchorId: 'court-view',
  },
  {
    id: 'crosstown-steps',
    name: 'Crosstown Steps',
    description: 'Subway stairs open onto a small public plaza. Buses and yellow cabs pass near the park-side two-way cycling track.',
    position: { x: 63, y: 0, z: -118 },
    hitRadius: 5,
    focusAnchorId: 'crosstown-view',
  },
];

export const CAMERA_PROJECTION = {
  distance: 340,
  far: 850,
  overviewHeight: 270,
  overviewWidth: 430,
  maxZoom: 10,
  defaultPitch: Math.PI / 6,
  minPitch: Math.PI / 6,
  maxPitch: Math.PI * 5 / 12,
} as const;

export const CAMERA_ANCHORS = [
  { id: 'square-overview', pose: { x: 0, z: 0, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1 } },
  { id: 'pavilion-view', pose: { x: 0, z: 33.3, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 4.8 } },
  { id: 'terrace-view', pose: { x: 10.8, z: 18, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 4.5 } },
  { id: 'garden-view', pose: { x: 0, z: -49.5, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 3.5 } },
  { id: 'court-view', pose: { x: -63, z: 118, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 5.2 } },
  { id: 'crosstown-view', pose: { x: 63, z: -118, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 5.2 } },
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
    if (anchorIds.has(id) || !Object.values(pose).every(Number.isFinite) || Math.abs(pose.x) > CITY.bounds.x ||
      Math.abs(pose.z) > CITY.bounds.z || pose.zoom < 0.65 || pose.zoom > CAMERA_PROJECTION.maxZoom ||
      pose.pitch < CAMERA_PROJECTION.minPitch || pose.pitch > CAMERA_PROJECTION.maxPitch) throw new Error(`Invalid camera anchor: ${id}.`);
    anchorIds.add(id);
  }
  for (const landmark of landmarks) {
    if (!landmark.id || ids.has(landmark.id)) throw new Error('City landmark IDs must be unique and nonempty.');
    ids.add(landmark.id);
    if (!anchorIds.has(landmark.focusAnchorId)) throw new Error(`Missing focus anchor: ${landmark.id}.`);
    const { x, y, z } = landmark.position;
    if (![x, y, z, landmark.hitRadius].every(Number.isFinite) ||
      Math.abs(x) > CITY.bounds.x || Math.abs(z) > CITY.bounds.z || y < 0 || y > 30 || landmark.hitRadius <= 0) {
      throw new Error(`Invalid city anchor: ${landmark.id}.`);
    }
  }
}
