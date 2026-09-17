import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CIVIC_UTILITIES, MAINTENANCE_STRIPS, STEAM_PILOT, STEAM_STACKS, STREET_DRAINS,
  outsideWalkingCorridors,
} from '../content/civicUtilities';
import { BIKE_SHARE_POCKETS, JUNIPER_ACCESS_CROSSING } from '../content/bikeShare';
import { METRO_ACCESS_NOTE, METRO_ENTRANCES, METRO_GEOMETRY, METRO_OPENINGS, METRO_STATIONS, metroStationFor } from '../content/metro';
import { PARK_COMPANION_SEAT_IDS, PARK_EDGE_ROLES, PARK_PATHS, PARK_SEATS, PARK_SEAT_GEOMETRY } from '../content/park';
import { PARK_LAMPS } from '../content/lighting';
import { BUS_STOP_MARKER } from '../content/transitService';
import {
  EXTRA_PARK_BENCHES, FOOD_CARTS, LOADING_CURB_MARKER, PARKING_BAYS, PARK_READING_POCKET,
  STREET_BENCHES, STREET_MAILBOXES,
  benchAccessPocket, foodCartBounds, propBounds,
} from '../content/streetFurniture';
import { CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, STREET_X, STREET_Z, TWO_WAY_BIKE_STREETS, VEHICLE_OFFSET } from '../content/streets';
import { applyCivicMaintenanceCapture, buildCivicUtilities, buildStreetTreeBed } from './civicUtilities';
import { CIVIC_MAINTENANCE_GLSL, civicSnowRetentionAt } from './civicMaintenance';
import type { StreetscapeBuilder } from './streetscape';
import { WeatherSurface } from './weatherSurface';
import { LOADING_SERVICE_POCKET } from './loadingFrontage';

interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }
function separate(a: Bounds, b: Bounds) {
  return a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ;
}
function captureBuilder() {
  const box = new THREE.BoxGeometry();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const crown = new THREE.DodecahedronGeometry();
  const material = new THREE.MeshStandardMaterial();
  const line = new THREE.MeshStandardMaterial();
  const roof = new THREE.MeshStandardMaterial();
  const palette: StreetscapeBuilder['palette'] = {
    sand: material, stone: material, paving: material, road: material, line, cream: material,
    clay: material, teal: material, roof, copper: material, copperEdge: material,
    glass: material, wood: material, leaf: material, leafLight: material, water: material,
    bus: material, rubber: material, taxi: material, facade: material,
  };
  const parts: { shape: THREE.BufferGeometry; material: THREE.Material; bounds: THREE.Box3; tint?: string }[] = [];
  const transform = new THREE.Object3D();
  const builder: StreetscapeBuilder = {
    box, cylinder, crown, palette,
    add(shape, surface, position, scale, rotation = [0, 0, 0], tint) {
      expect([...position, ...scale, ...rotation].every(Number.isFinite)).toBe(true);
      expect(scale.every((value) => value > 0)).toBe(true);
      transform.position.set(...position);
      transform.scale.set(...scale);
      transform.rotation.set(...rotation);
      transform.updateMatrix();
      shape.computeBoundingBox();
      parts.push({ shape, material: surface, bounds: shape.boundingBox!.clone().applyMatrix4(transform.matrix), tint });
    },
    block(surface, x, y, z, width, height, depth, yaw = 0, tint) {
      builder.add(box, surface, [x, y, z], [width, height, depth], [0, yaw, 0], tint);
    },
  };
  return { builder, parts, dispose: () => [box, cylinder, crown, material, line, roof].forEach((resource) => resource.dispose()) };
}

describe('bounded civic fabric', () => {
  it('keeps utilities and the paved steam pilot outside moving bodies, roads, crossings and retained reservations', () => {
    const reserved = [
      ...PARKING_BAYS.map((bay) => propBounds(bay, bay.width, bay.length)),
      ...FOOD_CARTS.map(foodCartBounds), ...METRO_OPENINGS,
      ...Object.values(BIKE_SHARE_POCKETS), JUNIPER_ACCESS_CROSSING,
      ...STREET_MAILBOXES.map((prop) => propBounds(prop, 0.8, 0.8)),
      ...STREET_BENCHES.map((prop) => propBounds(prop, 2.65, 0.86)),
    ];
    const props = [...CIVIC_UTILITIES, ...STEAM_STACKS];
    for (const prop of props) {
      const bounds = propBounds(prop, prop.width + 0.06, prop.depth + 0.06);
      expect(outsideWalkingCorridors(prop, prop.width + 0.06, prop.depth + 0.06), prop.id).toBe(true);
      expect(bounds.minX).toBeGreaterThanOrEqual(-CITY_EXTENT.x + 12);
      expect(bounds.maxX).toBeLessThanOrEqual(CITY_EXTENT.x - 12);
      expect(bounds.minZ).toBeGreaterThanOrEqual(-CITY_EXTENT.z + 12);
      expect(bounds.maxZ).toBeLessThanOrEqual(CITY_EXTENT.z - 12);
      for (const road of STREET_X) expect(Math.min(Math.abs(bounds.minX - road), Math.abs(bounds.maxX - road))).toBeGreaterThan(ROAD_HALF_WIDTH);
      for (const road of STREET_Z) {
        const clearance = Math.min(Math.abs(bounds.minZ - road), Math.abs(bounds.maxZ - road));
        if ('kind' in prop && prop.kind === 'hydrant' && Math.abs(prop.z - road) < ROAD_HALF_WIDTH) {
          const track = TWO_WAY_BIKE_STREETS.find(({ z }) => z === road);
          expect(track).toBeDefined();
          expect(Math.sign(prop.z - road)).not.toBe(track!.side);
          expect(clearance).toBeGreaterThan(VEHICLE_OFFSET + 1.1 + 0.2);
        } else expect(clearance).toBeGreaterThan(ROAD_HALF_WIDTH);
      }
      for (const other of reserved) expect(separate(bounds, other), prop.id).toBe(true);
      for (const other of props.filter(({ id }) => id !== prop.id)) {
        expect(separate(bounds, propBounds(other, other.width + 0.06, other.depth + 0.06))).toBe(true);
      }
    }
    expect(STEAM_PILOT.outletY).toBeCloseTo(STEAM_PILOT.surfaceY + STEAM_PILOT.height);
    expect(STEAM_PILOT.baseY).toBe(STEAM_PILOT.surfaceY);
  });

  it('locates thirty rectangular drains in empty non-cycle curb segments, not parking bays or landings', () => {
    expect(STREET_DRAINS).toHaveLength(30);
    for (const drain of STREET_DRAINS) {
      const bounds = propBounds(drain, drain.width, drain.depth);
      expect(outsideWalkingCorridors(drain, drain.width, drain.depth)).toBe(true);
      if (drain.curbSide < 0) {
        expect(drain.z + drain.depth / 2).toBeLessThan(drain.roadZ - VEHICLE_OFFSET - 1.1);
        expect(drain.z - drain.depth / 2).toBeGreaterThanOrEqual(drain.roadZ - ROAD_HALF_WIDTH);
      } else {
        expect(drain.z - drain.depth / 2).toBeGreaterThan(drain.roadZ + VEHICLE_OFFSET + 1.1);
        expect(drain.z + drain.depth / 2).toBeLessThanOrEqual(drain.roadZ + ROAD_HALF_WIDTH);
      }
      expect(drain.grateTopY).toBe(drain.surfaceY);
      expect(drain.recessY).toBeLessThan(drain.surfaceY);
      expect(drain.mouthTopY).toBeLessThan(drain.curbTopY);
      for (const bay of PARKING_BAYS) expect(separate(bounds, propBounds(bay, bay.width, bay.length))).toBe(true);
      for (const junction of INTERSECTIONS.filter(({ z }) => z === drain.roadZ)) {
        expect(Math.abs(junction.x - drain.x) - drain.width / 2).toBeGreaterThan(12);
      }
    }
  });

  it('groups all eight unchanged scenic mouths once and makes no working step-free promise', () => {
    expect(METRO_ENTRANCES).toHaveLength(8);
    expect(METRO_STATIONS).toHaveLength(4);
    expect(new Set(METRO_STATIONS.flatMap(({ entrances }) => [...entrances])).size).toBe(8);
    for (const entrance of METRO_ENTRANCES) expect(metroStationFor(entrance.id)).toBeDefined();
    expect(() => metroStationFor('missing')).toThrow('No scenic station grouping');
    expect(METRO_ACCESS_NOTE).toContain('no working station or step-free underground connection');
  });

  it('marks the actual bus dwell from the landward furnishing strip, not the bike track or walking lanes', () => {
    const marker = { ...BUS_STOP_MARKER, id: 'bus-stop-marker', yaw: Math.PI / 2 };
    expect(outsideWalkingCorridors(marker, 0.64, 0.12)).toBe(true);
    expect(outsideWalkingCorridors({ ...marker, x: -51.5 }, 0.64, 0.12)).toBe(true);
    expect(outsideWalkingCorridors({ ...marker, x: -53.55 }, 0.64, 0.12)).toBe(false);
    for (const opening of METRO_OPENINGS) expect(separate(propBounds(marker, 0.64, 0.12), opening)).toBe(true);
  });

  it('keeps the service visit behind through-walkers and the marker clear of bike access and parking', () => {
    const pocket = LOADING_SERVICE_POCKET;
    const bounds = propBounds(pocket, pocket.width, pocket.depth);
    expect(outsideWalkingCorridors(pocket, pocket.width, pocket.depth)).toBe(true);
    expect(separate(bounds, JUNIPER_ACCESS_CROSSING)).toBe(true);
    for (const station of Object.values(BIKE_SHARE_POCKETS)) expect(separate(bounds, station)).toBe(true);
    const marker = propBounds(LOADING_CURB_MARKER, 0.62, 0.1);
    expect(outsideWalkingCorridors(LOADING_CURB_MARKER, 0.62, 0.1)).toBe(true);
    expect(separate(marker, JUNIPER_ACCESS_CROSSING)).toBe(true);
    for (const bay of PARKING_BAYS) expect(separate(marker, propBounds(bay, bay.width, bay.length))).toBe(true);
  });

  it('faces park seats toward a use, retains centers and leaves every drawn path clear', () => {
    expect(PARK_SEATS).toHaveLength(11);
    expect(PARK_SEAT_GEOMETRY.seatHeight).toBe(0.63);
    expect(new Set(PARK_EDGE_ROLES.map(({ role }) => role)).size).toBe(4);
    for (const seat of [...PARK_SEATS, ...EXTRA_PARK_BENCHES]) {
      const space = benchAccessPocket(seat, seat.id.startsWith('park-') ? 2 : 2.4);
      expect(Math.hypot(space.facing.x, space.facing.z)).toBeCloseTo(1);
      expect(separate(space.seat, space.companion)).toBe(true);
      for (const path of PARK_PATHS) for (const point of path.curve.getPoints(256)) {
        const nearestX = Math.max(space.seat.minX, Math.min(space.seat.maxX, point.x));
        const nearestZ = Math.max(space.seat.minZ, Math.min(space.seat.maxZ, point.z));
        expect(Math.hypot(point.x - nearestX, point.z - nearestZ), `${seat.id} ${path.id}`)
          .toBeGreaterThan(path.width / 2 + 0.05);
      }
    }
  });

  it('reserves actual companion spaces beside two paved seats without occupying lamps or other seats', () => {
    const lamps = [...PARK_LAMPS, ...[52.2, 63, 73.8].flatMap((z) => [-3.5, 3.5].map((x) => ({ x, z })))];
    for (const id of PARK_COMPANION_SEAT_IDS) {
      const seat = PARK_SEATS.find((candidate) => candidate.id === id)!;
      const pocket = benchAccessPocket(seat, PARK_SEAT_GEOMETRY.width);
      for (const lamp of lamps) expect(separate(pocket.companion,
        { minX: lamp.x - 0.1, maxX: lamp.x + 0.1, minZ: lamp.z - 0.1, maxZ: lamp.z + 0.1 })).toBe(true);
      for (const other of [...PARK_SEATS, ...EXTRA_PARK_BENCHES]) {
        if (other.id === id) continue;
        expect(separate(pocket.companion, propBounds(other, 2.4, 0.86))).toBe(true);
      }
      expect(Math.min(Math.abs(pocket.approach.minX), Math.abs(pocket.approach.maxX))).toBeGreaterThan(2.4);
    }
    const reading = PARK_READING_POCKET;
    expect(reading.x - 0.55).toBeGreaterThan(reading.minX);
    expect(reading.x + 0.55).toBeLessThan(reading.maxX);
    for (const lamp of lamps) expect(Math.hypot(lamp.x - reading.x, lamp.z - reading.z)).toBeGreaterThan(0.65);
    expect(EXTRA_PARK_BENCHES.find(({ id }) => id === reading.benchId)).toMatchObject({ x: 4.4, z: 58.8, yaw: -Math.PI / 2 });
  });

  it('uses existing batch primitives, keeps grates flush and gives the stack an accurately located outlet', () => {
    const capture = captureBuilder();
    try {
      buildCivicUtilities(capture.builder);
      expect(capture.parts.every(({ shape }) => shape === capture.builder.box || shape === capture.builder.cylinder)).toBe(true);
      const triangles = capture.parts.reduce((sum, { shape }) =>
        sum + (shape.index?.count ?? shape.getAttribute('position').count) / 3, 0);
      // Local civic geometry scales with the approved drain, hydrant and stack counts.
      expect(triangles).toBeLessThan(16000);
      for (const drain of STREET_DRAINS) {
        const frames = capture.parts.filter(({ material, bounds }) => material === capture.builder.palette.roof && bounds.max.y > -0.01 &&
          Math.abs(bounds.getCenter(new THREE.Vector3()).x - drain.x) < drain.width &&
          Math.abs(bounds.getCenter(new THREE.Vector3()).z - drain.z) < drain.depth);
        expect(frames).toHaveLength(13);
        for (const frame of frames) expect(frame.bounds.max.y).toBeCloseTo(drain.grateTopY);
      }
      expect(STEAM_STACKS[0]).toBe(STEAM_PILOT);
      expect(STEAM_STACKS).toHaveLength(4);
      for (const stack of STEAM_STACKS) {
        const stackParts = capture.parts.filter(({ bounds }) => Math.abs(bounds.getCenter(new THREE.Vector3()).x - stack.x) < 0.5 &&
          Math.abs(bounds.getCenter(new THREE.Vector3()).z - stack.z) < 0.5);
        expect(stackParts, stack.id).toHaveLength(8);
        expect(Math.max(...stackParts.map(({ bounds }) => bounds.max.y)), stack.id).toBeCloseTo(stack.topY);
      }
      for (const cover of CIVIC_UTILITIES.filter(({ kind }) => kind === 'service-cover')) {
        const nearby = capture.parts.filter(({ bounds }) =>
          Math.abs(bounds.getCenter(new THREE.Vector3()).x - cover.x) < 0.4 &&
          Math.abs(bounds.getCenter(new THREE.Vector3()).z - cover.z) < 0.5);
        expect(nearby).toHaveLength(4);
        expect(Math.max(...nearby.map(({ bounds }) => bounds.max.y)) - cover.surfaceY).toBeLessThan(0.003);
      }
      for (const part of capture.parts.filter(({ material }) => material === capture.builder.palette.line)) {
        expect(part.bounds.min.y).toBeGreaterThan(2.2);
      }
      const count = capture.parts.length;
      buildStreetTreeBed(capture.builder, 0, 0);
      expect(capture.parts.length - count).toBe(4);
      expect(capture.parts.slice(count).filter(({ tint }) => tint === '#70866a')).toHaveLength(2);
      expect(Math.max(...capture.parts.slice(count).map(({ bounds }) => bounds.max.y))).toBeLessThan(0.05);
    } finally {
      capture.dispose();
    }
  });

  it('fits the scenic labels between the retained subway globes rather than clipping them', () => {
    const capture = captureBuilder();
    try {
      buildCivicUtilities(capture.builder);
      const labels = capture.parts.filter(({ material, bounds }) =>
        material === capture.builder.palette.roof && bounds.min.y > 2.5 && bounds.max.y > 2.9);
      expect(labels).toHaveLength(8);
      const g = METRO_GEOMETRY;
      for (const entrance of METRO_ENTRANCES) for (const side of [-1, 1]) {
        const x = side * (g.openingWidth / 2 + g.wallThickness / 2);
        const z = g.openingDepth / 2;
        for (const height of [g.globeHeight, g.globeHeight + 0.14]) {
          const globe = new THREE.Vector3(
            entrance.x + x * Math.cos(entrance.yaw) + z * Math.sin(entrance.yaw),
            g.surfaceY + height,
            entrance.z - x * Math.sin(entrance.yaw) + z * Math.cos(entrance.yaw),
          );
          for (const label of labels) expect(label.bounds.distanceToPoint(globe)).toBeGreaterThan(0.18);
        }
      }
    } finally {
      capture.dispose();
    }
  });

  it('ties maintenance to retained weather and preserves elevated capture rather than faking drainage', () => {
    expect(civicSnowRetentionAt(0, -0.012, -86, 1)).toBe(0);
    expect(civicSnowRetentionAt(0, 3, -86, 1)).toBe(1);
    expect(civicSnowRetentionAt(28, 0, -99.65, 0.45)).toBe(0);
    expect(civicSnowRetentionAt(28, 0, -99.65, 0)).toBe(0);
    expect(CIVIC_MAINTENANCE_GLSL).toContain('float civicSnowRetention(vec3 point, float retention)');
    expect(CIVIC_MAINTENANCE_GLSL).toContain('abs(point.y - -0.0050) <= 0.045');
    const surface = new WeatherSurface(-0.012);
    surface.retention.fill(1);
    const resolution = Math.round(Math.sqrt(surface.retention.length));
    const cell = (x: number, z: number) =>
      Math.floor((z + resolution * surface.cellSize / 2) / surface.cellSize) * resolution +
      Math.floor((x + resolution * surface.cellSize / 2) / surface.cellSize);
    const overhead = cell(0.25, -86.25);
    surface.heights[overhead] = 3;
    applyCivicMaintenanceCapture(surface);
    expect(surface.retention[overhead]).toBe(1);
    expect(surface.snowRetentionAt(-0.25, -86.25)).toBe(0);
    expect(surface.snowRetentionAt(4, -86.25)).toBe(1);
    expect(surface.heightAt(STEAM_PILOT.x, STEAM_PILOT.z)).toBeCloseTo(STEAM_PILOT.topY);
    expect(surface.snowRetentionAt(STEAM_PILOT.x, STEAM_PILOT.z)).toBe(1);
    expect(MAINTENANCE_STRIPS).toHaveLength(2 + STREET_DRAINS.length);
    const before = surface.retention.slice();
    applyCivicMaintenanceCapture(surface);
    expect(surface.retention).toEqual(before);
  });
});
