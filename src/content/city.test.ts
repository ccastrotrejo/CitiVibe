import { describe, expect, it } from 'vitest';
import { CAMERA_ANCHORS, validateCameraAnchors } from './city';

describe('district-wide camera compositions', () => {
  it('preserves six stable guided steps with varied street and park compositions', () => {
    expect(CAMERA_ANCHORS.map(({ id }) => id)).toEqual([
      'square-overview', 'pavilion-view', 'crosstown-view', 'terrace-view', 'garden-view', 'court-view',
    ]);
    expect(new Set(CAMERA_ANCHORS.map(({ pose }) => pose.yaw)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(CAMERA_ANCHORS.map(({ pose }) => pose.pitch)).size).toBeGreaterThanOrEqual(3);
    expect(CAMERA_ANCHORS.some(({ subject, pose }) => subject.includes('street wall') && Math.abs(pose.x) > 39)).toBe(true);
    expect(() => validateCameraAnchors(CAMERA_ANCHORS)).not.toThrow();
  });
});
