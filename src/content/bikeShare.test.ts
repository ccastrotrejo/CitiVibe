import { describe, expect, it } from 'vitest';
import {
  BIKE_SHARE_LAYOUT as L, BIKE_SHARE_STATIONS, BIKE_SHARE_STYLE, BIKE_SHARE_POCKETS, COURTSIDE_BIKE_POCKET,
  bikeShareBounds, bikeSharePoint, sampleBikeShare, validateBikeShareStations, type BikeShareTripState,
} from './bikeShare';
import { BASKETBALL_COURT, PICKLEBALL_COURT, RECREATION_AREA } from './courts';
import { COURT_LAMPS, LAMP_GEOMETRY } from './lighting';
import { METRO_OPENINGS } from './metro';
import { STREET_BLOCKS } from './streets';
import { CURB_VEHICLES, STREET_BENCHES, STREET_MAILBOXES, propBounds } from './streetFurniture';
import { SIDEWALK_SHEDS, STREET_BUILDINGS } from '../world/streetscape';

const overlaps = (a: ReturnType<typeof bikeShareBounds>, b: ReturnType<typeof bikeShareBounds>) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

const trip = (station: typeof BIKE_SHARE_STATIONS[number], phase: BikeShareTripState['phase'],
  docked: boolean): BikeShareTripState => ({
  stationId: station.id, phase, x: station.x + 3, z: station.z - 2, heading: Math.PI / 2,
  speed: docked ? 0 : 2.8, distanceFromDock: docked ? 0 : 5, docked, lockConfirmed: docked,
});

describe('original shared-bike content', () => {
  it('conserves every bike while a rider is docked or taking a trip', () => {
    for (const station of BIKE_SHARE_STATIONS) {
      for (const state of [trip(station, 'docked', true), trip(station, 'pushing-out', false), trip(station, 'riding', false), trip(station, 'pushing-in', false)]) {
        const sample = sampleBikeShare(station, 0, false, state);
        expect(sample.occupiedSlots).toHaveLength(11);
        expect(sample.occupiedSlots.filter(Boolean).length + sample.awayBikes).toBe(10);
        expect(sample.occupiedSlots[1]).toBe(false);
        expect(sample.occupiedSlots[2]).toBe(true);
        expect(sample.occupiedSlots[station.activeSlot]).toBe(state.docked);
        expect(sample.awayBikes).toBe(state.docked ? 0 : 1);
      }
    }
  });

  it('uses the traffic rider pose during a trip and keeps the standing neighbor behind the bike', () => {
    const station = BIKE_SHARE_STATIONS[0];
    const state = trip(station, 'pushing-out', false);
    const sample = sampleBikeShare(station, 0, false, state);
    expect(sample.phase).toBe('pushing-out');
    expect(sample.bikeX).toBe(state.x);
    expect(sample.bikeZ).toBe(state.z);
    expect(sample.heading).toBe(state.heading);
    expect(Math.hypot(sample.personX - sample.bikeX, sample.personZ - sample.bikeZ)).toBeCloseTo(L.personBehind);
    expect(BIKE_SHARE_STYLE.wheelRadius).toBeGreaterThan(0.3);
  });

  it('holds a docked reduced-motion still', () => {
    for (const station of BIKE_SHARE_STATIONS) {
      expect(sampleBikeShare(station, 0, true)).toEqual(sampleBikeShare(station, 845, true));
      expect(sampleBikeShare(station, 845, true).docked).toBe(true);
    }
  });

  it('confirms a lock only after the rider has redocked', () => {
    const station = BIKE_SHARE_STATIONS[0];
    expect(sampleBikeShare(station, 0, false, trip(station, 'riding', false)).lockConfirmed).toBe(false);
    const sample = sampleBikeShare(station, 0, false, trip(station, 'docked', true));
    expect(sample.lockConfirmed).toBe(true);
    expect(sample.docked).toBe(true);
    expect(sample.awayBikes).toBe(0);
  });

  it('keeps rows and full handling footprints in reserved pockets clear of two-way sidewalks', () => {
    expect(() => validateBikeShareStations()).not.toThrow();
    for (const station of BIKE_SHARE_STATIONS) {
      const b = bikeShareBounds(station);
      const pocket = BIKE_SHARE_POCKETS[station.id as keyof typeof BIKE_SHARE_POCKETS];
      expect(b.minX).toBeGreaterThanOrEqual(pocket.minX);
      expect(b.maxX).toBeLessThanOrEqual(pocket.maxX);
      expect(L.slotSpacing - BIKE_SHARE_STYLE.handlebarWidth).toBeGreaterThan(0.2);
      expect(STREET_BLOCKS.some((block) => b.minX > block.minX + 7.7 &&
        b.maxX < block.maxX - 7.7 && b.minZ > block.minZ + 7.7 && b.maxZ < block.maxZ - 7.7)).toBe(true);
      for (let time = 0; time <= L.period; time += 0.125) {
        const sample = sampleBikeShare(station, time);
        expect(sample.bikeZ - 0.96).toBeGreaterThan(b.minZ);
        expect(sample.bikeZ + 0.96).toBeLessThan(b.maxZ);
        expect(sample.personZ - 0.6).toBeGreaterThan(b.minZ);
        expect(sample.personX - 0.4).toBeGreaterThan(b.minX);
        expect(sample.personX + 0.4).toBeLessThan(b.maxX);
      }
    }
  });

  it('places a parallel-bike row on the clear park-facing pickleball apron', () => {
    expect(BIKE_SHARE_STATIONS).toHaveLength(3);
    const station = BIKE_SHARE_STATIONS[2];
    expect(station.id).toBe('juniper-bike-bay');
    expect(station.surfaceY).toBe(0.025);
    const bounds = bikeShareBounds(station);
    expect(bounds).toEqual({ minX: 9.56, maxX: 18.85, minZ: 103.1, maxZ: 106.45 });
    expect(bounds.minZ).toBeGreaterThan(102.6);
    expect(bounds.minX).toBeGreaterThan(RECREATION_AREA.passageMaxX);
    expect(bounds.maxZ).toBeLessThan(PICKLEBALL_COURT.z - PICKLEBALL_COURT.runoffDepth / 2);
    for (let time = 0; time < 48; time += 0.125) {
      const sample = sampleBikeShare(station, time);
      expect(sample.bikeX).toBe(station.x + station.activeSlot * L.slotSpacing);
      expect(sample.personX).toBe(station.x + station.activeSlot * L.slotSpacing);
      expect(sample.personZ + L.personBehind).toBeCloseTo(sample.bikeZ);
      expect(sample.personZ - 0.6).toBeGreaterThan(bounds.minZ);
      expect(sample.bikeZ + 0.96).toBeLessThan(bounds.maxZ);
    }
    expect(bikeSharePoint(station, 7.5, 0)).toEqual({ x: 17.5, z: 105.3 });
    expect(bounds.minX).toBeGreaterThan(COURTSIDE_BIKE_POCKET.minX);
    expect(() => validateBikeShareStations([{ ...station, z: 102.5 }])).toThrow();
    expect(() => validateBikeShareStations([{ ...station, z: 108.5 }])).toThrow();
    expect(() => validateBikeShareStations([{ ...station, x: 1 }])).toThrow();
    expect(() => validateBikeShareStations([{ ...station, yaw: Math.PI / 4 }])).toThrow();
    expect(() => validateBikeShareStations([{ ...station, surfaceY: -0.08 }])).toThrow();
  });

  it('stays clear of buildings, subway openings, sheds, existing furniture and park', () => {
    for (const station of BIKE_SHARE_STATIONS) {
      const bounds = bikeShareBounds(station);
      const obstacles = [
        ...STREET_BUILDINGS.map((b) => ({
          minX: b.x - b.width / 2 - 1, maxX: b.x + b.width / 2 + 1,
          minZ: b.z - b.depth / 2 - 1, maxZ: b.z + b.depth / 2 + 1,
        })),
        ...METRO_OPENINGS,
        ...SIDEWALK_SHEDS.map((s) => ({
          minX: s.x - 1.5, maxX: s.x + 1.5, minZ: s.z - s.length / 2, maxZ: s.z + s.length / 2,
        })),
        ...CURB_VEHICLES.map((p) => propBounds(p, p.width, p.length)),
        ...STREET_BENCHES.map((p) => propBounds(p, 2.1, 0.9)),
        ...STREET_MAILBOXES.map((p) => propBounds(p, 0.85, 0.8)),
        ...[BASKETBALL_COURT, PICKLEBALL_COURT].map((court) => ({
          minX: court.x - court.runoffWidth / 2, maxX: court.x + court.runoffWidth / 2,
          minZ: court.z - court.runoffDepth / 2, maxZ: court.z + court.runoffDepth / 2,
        })),
        ...COURT_LAMPS.map((lamp) => ({
          minX: lamp.x - LAMP_GEOMETRY.courtBaseRadius, maxX: lamp.x + LAMP_GEOMETRY.courtBaseRadius,
          minZ: lamp.z - LAMP_GEOMETRY.courtBaseRadius, maxZ: lamp.z + LAMP_GEOMETRY.courtBaseRadius,
        })),
        { minX: RECREATION_AREA.passageMinX, maxX: RECREATION_AREA.passageMaxX, minZ: 102, maxZ: 125 },
        ...[{ x: 2.6, z: 106.2 }, { x: 2.6, z: 120.8 }, { x: 31, z: 121 }].map(({ x, z }) => ({
          minX: x - 1.05, maxX: x + 1.05, minZ: z - 0.45, maxZ: z + 0.45,
        })),
        ...[31, 36.5].map((x) => ({ minX: x - 1.4, maxX: x + 1.4, minZ: 115.6, maxZ: 118.4 })),
        { minX: -39, maxX: 39, minZ: -88, maxZ: 88 },
      ];
      expect(obstacles.filter((obstacle) => overlaps(bounds, obstacle))).toEqual([]);
    }
  });

  it('rejects invalid clocks, moved bays, crossing conflicts and duplicate or overlapping bays', () => {
    const station = BIKE_SHARE_STATIONS[0];
    for (const time of [-1, NaN, Infinity]) expect(() => sampleBikeShare(station, time)).toThrow(RangeError);
    expect(() => validateBikeShareStations([{ ...station, x: -108 }])).toThrow();
    expect(() => validateBikeShareStations([{ ...station, z: 95 }])).toThrow();
    expect(() => validateBikeShareStations([station, station])).toThrow();
    expect(() => validateBikeShareStations([station, { ...station, id: 'other' }])).toThrow();
  });
});
