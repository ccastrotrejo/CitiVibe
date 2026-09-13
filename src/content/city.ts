import { CITY_EXTENT } from './streets';
import { METRO_ENTRANCES } from './metro';
import type { CameraPose } from '../world/types';

const crosstown = METRO_ENTRANCES.find(({ id }) => id === 'crosstown-entrance');
if (!crosstown) throw new Error('Crosstown tour view requires its authored subway entrance.');

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface CameraAnchor {
  id: string;
  subject: string;
  pose: CameraPose;
}

export const CITY = {
  version: 'rainlight-005',
  name: 'Rainlight Square',
  bounds: CITY_EXTENT,
  busId: 'city-vehicle-6',
} as const;

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
  { id: 'square-overview', subject: 'District overview', pose: { x: 0, z: 0, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 1 } },
  { id: 'pavilion-view', subject: 'Rainlight Pavilion', pose: { x: 0, z: 33.3, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 4.8 } },
  { id: 'crosstown-view', subject: 'Crosstown Steps', pose: { x: crosstown.x, z: crosstown.z, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 5.2 } },
  { id: 'terrace-view', subject: 'Terrace Steps', pose: { x: 10.8, z: 18, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 4.5 } },
  { id: 'garden-view', subject: 'Reservoir Walk', pose: { x: 0, z: -49.5, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 3.5 } },
  { id: 'court-view', subject: 'Juniper Court', pose: { x: -5, z: 113.5, yaw: Math.PI / 4, pitch: CAMERA_PROJECTION.defaultPitch, zoom: 5.2 } },
] as const;

export const CONTENT = {
  schemaVersion: 1,
  assetVersion: CITY.version,
  seed: 2401,
  units: 'meters',
  upAxis: 'Y',
  routeId: 'crosstown-grid',
  cameraAnchors: CAMERA_ANCHORS,
} as const;

export function validateCameraAnchors(anchors: readonly CameraAnchor[]): void {
  if (anchors.length === 0) throw new Error('City content has no camera anchors.');
  const anchorIds = new Set<string>();
  for (const { id, subject, pose } of anchors) {
    if (!id || !subject.trim() || anchorIds.has(id) || !Object.values(pose).every(Number.isFinite) || Math.abs(pose.x) > CITY.bounds.x ||
      Math.abs(pose.z) > CITY.bounds.z || pose.zoom < 0.65 || pose.zoom > CAMERA_PROJECTION.maxZoom ||
      pose.pitch < CAMERA_PROJECTION.minPitch || pose.pitch > CAMERA_PROJECTION.maxPitch) throw new Error(`Invalid camera anchor: ${id}.`);
    anchorIds.add(id);
  }
}
