import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CURB_RUN_ENDS, CURB_VEHICLES, EXTRA_PARK_BENCHES, FOOD_CARTS, FOOD_CART_SPACE, PARKING_BAYS, PARKING_SIGNS,
  STREET_BENCHES, STREET_MAILBOXES, foodCartBounds, propBounds,
} from '../content/streetFurniture';
import { CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, STREET_X, STREET_Z, VEHICLE_OFFSET } from '../content/streets';
import { outsideWalkingCorridors } from '../content/civicUtilities';
import { METRO_OPENINGS } from '../content/metro';
import { buildStreetFurniture } from './streetFurniture';
import { buildSignLettering } from './signLettering';
import type { StreetscapeBuilder } from './streetscape';

describe('original curbside furniture', () => {
  it('keeps twelve parked cars in the spare non-cycling curb lane, with no food trucks in traffic', () => {
    expect(CURB_VEHICLES).toHaveLength(12);
    expect(CURB_VEHICLES.every(({ kind }) => kind === 'parked-car')).toBe(true);
    for (const prop of CURB_VEHICLES) {
      const bounds = propBounds(prop, prop.width, prop.length);
      const outward = Math.abs(prop.z) - 95;
      expect(outward - prop.width / 2).toBeGreaterThan(VEHICLE_OFFSET + 1.9 / 2 + 0.2);
      expect(outward + prop.width / 2).toBeLessThan(ROAD_HALF_WIDTH);
      expect(Math.sign(prop.yaw)).toBe(-Math.sign(prop.z));
      for (const junction of INTERSECTIONS) {
        if (Math.abs(junction.z - prop.z) > 5) continue;
        expect(Math.min(Math.abs(junction.x - bounds.minX), Math.abs(junction.x - bounds.maxX)))
          .toBeGreaterThan(12);
      }
      for (const other of CURB_VEHICLES) {
        if (other.id === prop.id) continue;
        const next = propBounds(other, other.width, other.length);
        expect(bounds.maxX < next.minX || bounds.minX > next.maxX ||
          bounds.maxZ < next.minZ || bounds.minZ > next.maxZ).toBe(true);
      }
    }
  });

  it('places four compact food carts in corner sidewalk pockets outside the complete walking corridors', () => {
    expect(FOOD_CARTS).toHaveLength(4);
    for (const cart of FOOD_CARTS) {
      const bounds = foodCartBounds(cart);
      expect(bounds.minX).toBeGreaterThan(-CITY_EXTENT.x);
      expect(bounds.maxX).toBeLessThan(CITY_EXTENT.x);
      expect(bounds.minZ).toBeGreaterThan(-CITY_EXTENT.z);
      expect(bounds.maxZ).toBeLessThan(CITY_EXTENT.z);
      for (const road of STREET_X) {
        expect(bounds.maxX <= road - 7.7 + 1e-8 || bounds.minX >= road + 7.7 - 1e-8).toBe(true);
      }
      for (const road of STREET_Z) {
        expect(bounds.maxZ <= road - 7.7 + 1e-8 || bounds.minZ >= road + 7.7 - 1e-8).toBe(true);
      }
      const approachX = cart.x + Math.sin(cart.yaw) * 2.3;
      const approachZ = cart.z + Math.cos(cart.yaw) * 2.3;
      expect(Math.min(...STREET_Z.map((road) => Math.abs(approachZ - road)),
        ...STREET_X.map((road) => Math.abs(approachX - road)))).toBeCloseTo(7.7);
      for (const opening of METRO_OPENINGS) {
        expect(bounds.maxX < opening.minX || bounds.minX > opening.maxX ||
          bounds.maxZ < opening.minZ || bounds.minZ > opening.maxZ).toBe(true);
      }
    }
  });

  it('keeps street seats and mailboxes outside full walking envelopes, inside the island and clear of entrances', () => {
    expect(STREET_BENCHES).toHaveLength(8);
    expect(STREET_MAILBOXES).toHaveLength(6);
    expect(EXTRA_PARK_BENCHES).toHaveLength(10);
    const props = [...CURB_VEHICLES, ...FOOD_CARTS, ...STREET_BENCHES, ...STREET_MAILBOXES, ...EXTRA_PARK_BENCHES];
    expect(new Set(props.map(({ id }) => id)).size).toBe(props.length);
    for (const prop of [...STREET_BENCHES, ...STREET_MAILBOXES]) {
      const bounds = propBounds(prop, prop.id.startsWith('mailbox') ? 0.8 : 2.65, 0.86);
      expect(bounds.minX).toBeGreaterThan(-CITY_EXTENT.x);
      expect(bounds.maxX).toBeLessThan(CITY_EXTENT.x);
      expect(bounds.minZ).toBeGreaterThan(-CITY_EXTENT.z);
      expect(bounds.maxZ).toBeLessThan(CITY_EXTENT.z);
      expect(Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX))).toBeLessThanOrEqual(CITY_EXTENT.x - 12);
      expect(Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ))).toBeLessThanOrEqual(CITY_EXTENT.z - 12);
      expect(outsideWalkingCorridors(prop, prop.id.startsWith('mailbox') ? 0.8 : 2.65, 0.86)).toBe(true);
      for (const opening of METRO_OPENINGS) {
        expect(bounds.maxX < opening.minX || bounds.minX > opening.maxX ||
          bounds.maxZ < opening.minZ || bounds.minZ > opening.maxZ).toBe(true);
      }
    }
  });

  it('retains unpainted curb reservations and restrained signs without entering driving lanes or crossings', () => {
    expect(PARKING_BAYS).toHaveLength(12);
    expect(PARKING_SIGNS).toHaveLength(4);
    expect(CURB_RUN_ENDS).toHaveLength(4);
    for (const end of CURB_RUN_ENDS) {
      expect(Math.abs(end.x)).toBe(25.3);
      expect(Math.abs(end.z)).toBe(100.09);
    }
    for (const bay of PARKING_BAYS) {
      const vehicle = CURB_VEHICLES.find(({ id }) => id === bay.id)!;
      expect(bay.length).toBeGreaterThan(vehicle.length + 1.5);
      expect(bay.width).toBeGreaterThan(vehicle.width);
      expect(Math.abs(bay.z) - 95 - bay.width / 2).toBeGreaterThan(VEHICLE_OFFSET + 0.95 + 0.2);
      expect(Math.abs(bay.x) + bay.length / 2).toBeLessThan(46 - 10);
    }
    for (const sign of PARKING_SIGNS) {
      expect(Math.abs(sign.z) + 0.063).toBeLessThan(100.1);
      for (const vehicle of CURB_VEHICLES) {
        const bounds = propBounds(vehicle, vehicle.width, vehicle.length);
        expect(sign.z - 0.04 > bounds.maxZ || sign.z + 0.04 < bounds.minZ ||
          sign.x - 0.04 > bounds.maxX || sign.x + 0.04 < bounds.minX).toBe(true);
      }
    }
  });

  it('builds finite shared geometry, rounded mailboxes, slats and street-facing service counters without owning resources', () => {
    const box = new THREE.BoxGeometry();
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
    const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.2, 12);
    const crown = new THREE.DodecahedronGeometry();
    const surface = new THREE.MeshStandardMaterial();
    const blue = new THREE.MeshStandardMaterial();
    const glass = new THREE.MeshStandardMaterial();
    const lettering = { food: buildSignLettering('FOOD', 2.8, 0.48), parking: buildSignLettering('P', 0.4, 0.52) };
    const palette: StreetscapeBuilder['palette'] = {
      sand: surface, stone: surface, paving: surface, road: surface, line: surface,
      cream: surface, clay: surface, teal: surface, roof: surface, copper: surface,
      copperEdge: surface, glass: surface, wood: surface, leaf: surface,
      leafLight: surface, water: surface, bus: surface, rubber: surface, taxi: surface,
      facade: surface,
    };
    const parts: { shape: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    const transform = new THREE.Object3D();
    const builder: StreetscapeBuilder = {
      box, cylinder, crown, palette,
      add(shape, material, position, scale, rotation = [0, 0, 0]) {
        expect([...position, ...scale, ...rotation].every(Number.isFinite)).toBe(true);
        expect(scale.every((value) => value > 0)).toBe(true);
        transform.position.set(...position);
        transform.scale.set(...scale);
        transform.rotation.set(...rotation);
        transform.updateMatrix();
        parts.push({ shape, material, matrix: transform.matrix.clone() });
      },
      block(material, x, y, z, w, h, d, yaw = 0) {
        builder.add(box, material, [x, y, z], [w, h, d], [0, yaw, 0]);
      },
    };
    const vehicleArt = {
      box, cylinder, wheel, taperedShell: box, wheelArch: box, taxiLettering: lettering.parking,
      personArt: { box, head: crown, material: surface }, civicBlue: blue,
      vehiclePaint: surface, vehicleGlass: glass, lampGlow: surface,
      beaconRed: surface, beaconBlue: surface, palette,
    };
    try {
      buildStreetFurniture(builder, blue, glass, lettering, vehicleArt);
      expect(parts.filter(({ shape, material }) => shape === cylinder && material === blue)).toHaveLength(6);
      expect(parts.filter(({ material }) => material === glass)).toHaveLength(28);
      expect(parts.filter(({ shape }) => shape === lettering.food)).toHaveLength(8);
      expect(parts.filter(({ shape }) => shape === lettering.parking)).toHaveLength(0);
      expect(parts.length).toBeLessThan(1800);
      for (const part of parts) {
        part.shape.computeBoundingBox();
        const bounds = part.shape.boundingBox!.clone().applyMatrix4(part.matrix);
        expect(bounds.min.x).toBeGreaterThan(-CITY_EXTENT.x);
        expect(bounds.max.x).toBeLessThan(CITY_EXTENT.x);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.140001);
      }
      for (const cart of FOOD_CARTS) {
        const space = foodCartBounds(cart);
        const nearby = parts.map((part) => ({
          ...part, bounds: part.shape.boundingBox!.clone().applyMatrix4(part.matrix),
        })).filter(({ bounds }) => bounds.min.x >= space.minX - 1e-8 && bounds.max.x <= space.maxX + 1e-8 &&
          bounds.min.z >= space.minZ - 1e-8 && bounds.max.z <= space.maxZ + 1e-8);
        expect(nearby.filter(({ shape }) => shape === lettering.food)).toHaveLength(2);
        expect(nearby.filter(({ shape, bounds }) => shape === cylinder && bounds.max.y < 0.3)).toHaveLength(8);
        expect(nearby.every(({ bounds }) => bounds.max.y < FOOD_CART_SPACE.height)).toBe(true);
        const display = nearby.filter(({ material }) => material === glass);
        expect(display).toHaveLength(1);
        expect(display[0].bounds.max.y).toBeLessThan(1.7);
        expect(nearby.filter(({ shape, material }) => shape === cylinder && material === surface))
          .toHaveLength(20);
      }
      const first = parts.map(({ matrix }) => matrix.toArray());
      parts.length = 0;
      buildStreetFurniture(builder, blue, glass, lettering, vehicleArt);
      expect(parts.map(({ matrix }) => matrix.toArray())).toEqual(first);
    } finally {
      [box, cylinder, wheel, crown, surface, blue, glass, lettering.food, lettering.parking].forEach((resource) => resource.dispose());
    }
  });
});
