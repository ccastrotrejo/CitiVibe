// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CIVIC_SERVICES, getCivicStaffAssignment } from './civicServices';
import { createPersonProfile } from './people';
import { SIDEWALK_OFFSET, STREET_BLOCKS, TRAFFIC_ACTORS } from './streets';
import { buildingFrontPoint, buildingFrontSpan } from '../world/buildingFabric';
import { STREET_BUILDINGS } from '../world/streetscape';

describe('original neighborhood civic services', () => {
  it('repurposes three distinct retained buildings without adding people', () => {
    expect(CIVIC_SERVICES).toHaveLength(3);
    expect(new Set(CIVIC_SERVICES.map(({ kind }) => kind))).toEqual(new Set([
      'hospital', 'fire-station', 'police-station',
    ]));
    expect(new Set(CIVIC_SERVICES.map(({ id }) => id)).size).toBe(3);
    expect(new Set(CIVIC_SERVICES.map(({ buildingId }) => buildingId)).size).toBe(3);
    expect(STREET_BUILDINGS).toHaveLength(94);
    expect(TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian')).toHaveLength(200);
    for (const service of CIVIC_SERVICES) {
      const building = STREET_BUILDINGS.find(({ id }) => id === service.buildingId)!;
      expect(building.blockId).toBe(service.blockId);
      expect(building.use).toBe('civic');
      expect(building.civicService).toBe(service.kind);
      expect(building.storefront).toBeNull();
      expect(service.staff).toHaveLength(4);
    }
  });

  it('assigns unique naturally adult employees from each facility’s original home block', () => {
    const walkers = TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian');
    const staffIds = new Set<string>();
    const roles = { hospital: 'healthcare-worker', 'fire-station': 'firefighter', 'police-station': 'police-officer' };
    for (const service of CIVIC_SERVICES) for (const staff of service.staff) {
      expect(staffIds.has(staff.id)).toBe(false);
      staffIds.add(staff.id);
      const index = walkers.findIndex(({ id }) => id === staff.id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(STREET_BLOCKS[index % STREET_BLOCKS.length].id).toBe(service.blockId);
      expect(createPersonProfile(staff.id, 'park').age).toBeGreaterThanOrEqual(18);
      expect(staff.occupation).toBe(roles[service.kind]);
      expect(getCivicStaffAssignment(staff.id)).toEqual({ service, staff });
    }
    expect(staffIds.size).toBe(12);
    expect(getCivicStaffAssignment('unknown-neighbor')).toBeUndefined();
  });

  it('aligns clear sidewalk approach targets with real building entrances', () => {
    for (const service of CIVIC_SERVICES) {
      const building = STREET_BUILDINGS.find(({ id }) => id === service.buildingId)!;
      const block = STREET_BLOCKS.find(({ id }) => id === service.blockId)!;
      const { entry } = service;
      expect({ axis: entry.axis, side: entry.side }).toEqual(building.front);
      expect(entry.width).toBeGreaterThanOrEqual(1.4);
      expect(Math.abs(entry.along) + entry.width / 2).toBeLessThan(buildingFrontSpan(building) / 2);
      const door = buildingFrontPoint(building, entry.along, 0);
      const alongAxis = entry.axis === 'x' ? 'z' : 'x';
      expect(entry[alongAxis]).toBeCloseTo(door[alongAxis], 6);
      const road = entry.axis === 'x'
        ? entry.side > 0 ? block.maxX : block.minX
        : entry.side > 0 ? block.maxZ : block.minZ;
      expect(entry[entry.axis]).toBeCloseTo(road - entry.side * SIDEWALK_OFFSET, 6);
      expect(entry.side * (entry[entry.axis] - door[entry.axis])).toBeGreaterThan(0.8);
      const cornerDistance = entry.axis === 'x'
        ? Math.min(entry.z - block.minZ, block.maxZ - entry.z)
        : Math.min(entry.x - block.minX, block.maxX - entry.x);
      expect(cornerDistance).toBeGreaterThan(10);
    }
  });
});
