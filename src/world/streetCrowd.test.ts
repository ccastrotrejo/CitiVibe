// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ActorState } from './actors';
import type { PersonArt } from './person';
import { StreetCrowdActivity } from './streetCrowd';

function createArt(): { art: PersonArt; dispose(): void } {
  const box = new THREE.BoxGeometry();
  const head = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshBasicMaterial();
  return {
    art: { box, head, material },
    dispose() {
      box.dispose();
      head.dispose();
      material.dispose();
    },
  };
}

describe('NYC street and promenade crowd activity', () => {
  it('validates inputs, moves smoothly without discontinuities, applies weather gear, and disposes cleanly', () => {
    const { art, dispose } = createArt();
    const scene = new THREE.Scene();
    try {
      const crowd = new StreetCrowdActivity(scene, art);
      expect(crowd.groups).toHaveLength(96);
      expect(scene.children).toHaveLength(96);

      expect(() => crowd.update(-0.1, false)).toThrow(RangeError);
      expect(() => crowd.update(NaN, false)).toThrow(RangeError);
      expect(() => crowd.update(1, false, -0.01)).toThrow(RangeError);
      expect(() => crowd.update(1, false, 0.5)).toThrow(RangeError);

      // Reduced motion freezes positions at t = 0 while adjusting snow ground lift.
      crowd.update(0, true, 0);
      const stillPos = crowd.groups[0].position.clone();
      crowd.update(25, true, 0.2);
      expect(crowd.groups[0].position.x).toBeCloseTo(stillPos.x, 8);
      expect(crowd.groups[0].position.z).toBeCloseTo(stillPos.z, 8);
      expect(crowd.groups[0].position.y).toBeCloseTo(stillPos.y + 0.2, 8);

      // Continuous motion without large position teleports across turnaround arcs.
      crowd.update(0, false, 0);
      const prev = crowd.groups.map((g) => g.position.clone());
      for (let step = 1; step <= 120; step++) {
        crowd.update(step * 0.25, false, 0);
        crowd.groups.forEach((g, idx) => {
          expect(g.position.distanceTo(prev[idx])).toBeLessThan(0.5);
          prev[idx].copy(g.position);
        });
      }

      // Weather equipment synchronization in rain/winter.
      const winterSample = [{
        id: 'sample',
        kind: 'pedestrian',
        position: { x: 0, y: 0, z: 0 },
        heading: 0,
        state: 'moving',
        distance: 0,
        speed: 1,
        routeLength: 100,
        weather: { equipment: 'winter', umbrellaOpen: 0, pace: 0.85, cautious: true },
      }] as ActorState[];
      crowd.update(10, false, 0.1, winterSample);
      const coat = crowd.groups[0].getObjectByName('Weather coat');
      expect(coat?.parent?.scale.x).toBe(1);

      crowd.dispose();
      crowd.dispose();
      expect(scene.children).toHaveLength(0);
    } finally {
      dispose();
    }
  });
});
