import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PARK_LAMPS, STREET_LAMPS, validateLighting, type ParkLamp } from './lighting';
import { CITY_EXTENT } from './streets';
import { PARK_BOUNDS, PARK_PATHS } from './park';

describe('public lighting manifest', () => {
  it('places street lamps on the island and clear of the park lawn', () => {
    expect(STREET_LAMPS.length).toBe(66);
    for (const lamp of STREET_LAMPS) {
      expect(Math.abs(lamp.x)).toBeLessThanOrEqual(CITY_EXTENT.x);
      expect(Math.abs(lamp.z)).toBeLessThanOrEqual(CITY_EXTENT.z);
      const insidePark = Math.abs(lamp.x) < PARK_BOUNDS.x - 0.5 && Math.abs(lamp.z) < PARK_BOUNDS.z - 0.5;
      expect(insidePark).toBe(false);
    }
  });

  it('keeps every park lamp inside the lawn and off the walking paths', () => {
    expect(PARK_LAMPS.length).toBe(15);
    const sample = new Vector3();
    for (const lamp of PARK_LAMPS) {
      expect(Math.abs(lamp.x)).toBeLessThanOrEqual(PARK_BOUNDS.x);
      expect(Math.abs(lamp.z)).toBeLessThanOrEqual(PARK_BOUNDS.z);
      for (const path of PARK_PATHS) {
        const clearance = path.width / 2 + 0.05;
        for (let i = 0; i <= 400; i += 1) {
          path.curve.getPointAt(i / 400, sample);
          expect(Math.hypot(sample.x - lamp.x, sample.z - lamp.z)).toBeGreaterThan(clearance);
        }
      }
    }
  });

  it('validates the shipped manifest without throwing', () => {
    expect(() => validateLighting()).not.toThrow();
  });

  it('rejects duplicate lamp ids', () => {
    expect(() => validateLighting(
      [STREET_LAMPS[0], { ...STREET_LAMPS[1], id: STREET_LAMPS[0].id }],
      [],
    )).toThrow(/Duplicate lamp id/);
  });

  it('rejects lamps that leave the island', () => {
    expect(() => validateLighting(
      [{ id: 'off-island', x: CITY_EXTENT.x + 5, z: 0, arm: 1 }],
      [],
    )).toThrow(/outside the island/);
  });

  it('rejects a street lamp that intrudes on the park lawn', () => {
    expect(() => validateLighting(
      [{ id: 'lawn-intruder', x: 0, z: 0, arm: 1 }],
      [],
    )).toThrow(/intrudes on the park lawn/);
  });

  it('rejects a park lamp placed on a walking path', () => {
    const onMall: ParkLamp = { id: 'mall-blocker', x: 0, z: 58 };
    expect(() => validateLighting([], [onMall])).toThrow(/blocks the mall path/);
  });
});
