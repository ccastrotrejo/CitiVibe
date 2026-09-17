import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BIKE_SHARE_POCKETS, JUNIPER_ACCESS_CROSSING } from '../content/bikeShare';
import { CIVIC_UTILITIES, SIDEWALK_ZONING, STEAM_STACKS, outsideWalkingCorridors } from '../content/civicUtilities';
import { CIVIC_SERVICES } from '../content/civicServices';
import { METRO_ENTRANCES, METRO_GEOMETRY } from '../content/metro';
import { PARK_PATHS } from '../content/park';
import { PERSON_SPACE } from '../content/people';
import { CITY_EXTENT, INTERSECTIONS, ROAD_HALF_WIDTH, STREET_X, STREET_Z } from '../content/streets';
import {
  EXTRA_PARK_BENCHES, FOOD_CARTS, PARKING_BAYS, STREET_BENCHES,
  STREET_FURNITURE_APRONS, STREET_MAILBOXES, benchAccessPocket, foodCartBounds, propBounds, type StreetProp,
} from '../content/streetFurniture';
import { buildCityScene, type CityScene } from './scene';
import { civicActivities } from './civicActivities';
import { buildSignLettering } from './signLettering';
import { buildStreetFurniture } from './streetFurniture';
import type { StreetscapeBuilder } from './streetscape';
import { LOADING_SERVICE_POCKET } from './loadingFrontage';
import { SIDEWALK_WALKING_CLEARANCE, SIDEWALK_WALKING_OFFSETS, SIDEWALK_WALKING_ROUTES } from './traffic';

const key = (shape: THREE.BufferGeometry, matrix: THREE.Matrix4) =>
  `${shape.type}:${matrix.elements.map(Math.fround).join(',')}`;
const envelope = (prop: StreetProp, width: number, depth: number, height: number, forward = 0) => ({
  id: prop.id,
  height,
  bounds: propBounds({
    ...prop, x: prop.x + Math.sin(prop.yaw) * forward, z: prop.z + Math.cos(prop.yaw) * forward,
  }, width, depth),
});
const placements = [
  ...STREET_BENCHES.map((prop) => {
    const { seat, approach } = benchAccessPocket(prop);
    return {
      id: prop.id, height: 2.3,
      bounds: {
        minX: Math.min(seat.minX, approach.minX), maxX: Math.max(seat.maxX, approach.maxX),
        minZ: Math.min(seat.minZ, approach.minZ), maxZ: Math.max(seat.maxZ, approach.maxZ),
      },
    };
  }),
  ...STREET_MAILBOXES.map((prop) => envelope(prop, 0.8, 1.5, 2.3, 0.35)),
  ...CIVIC_UTILITIES.map((prop) => envelope(prop, prop.width + 0.06, prop.depth + 0.06,
    prop.kind === 'hydrant' ? 1.1 : prop.kind === 'service-cover' ? 0.2 : 1)),
  ...STEAM_STACKS.map((stack) => envelope(stack, 0.76, 0.76, stack.topY + 0.05)),
];
const disjoint = (a: ReturnType<typeof propBounds>, b: ReturnType<typeof propBounds>) =>
  a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ;

describe('interior civic furniture relocation', () => {
  let world: CityScene;
  const obstacles: THREE.Box3[] = [];
  const meshes: THREE.Mesh[] = [];

  beforeAll(() => {
    // Enumerate this public builder's transforms, so its furniture can be checked against
    // the remaining real scene without treating each new fixture as its own obstruction.
    const owned = new Set<string>();
    const box = new THREE.BoxGeometry();
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
    const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.2, 12);
    const crown = new THREE.DodecahedronGeometry();
    const material = new THREE.MeshStandardMaterial();
    const lettering = { food: buildSignLettering('FOOD', 2.8, 0.48), parking: buildSignLettering('P', 0.4, 0.52) };
    const palette: StreetscapeBuilder['palette'] = {
      sand: material, stone: material, paving: material, road: material, line: material, cream: material,
      clay: material, teal: material, roof: material, copper: material, copperEdge: material,
      glass: material, wood: material, leaf: material, leafLight: material, water: material,
      bus: material, rubber: material, taxi: material, facade: material,
    };
    const transform = new THREE.Object3D();
    const builder: StreetscapeBuilder = {
      box, cylinder, crown, palette,
      add(shape, _surface, position, scale, rotation = [0, 0, 0]) {
        transform.position.set(...position);
        transform.scale.set(...scale);
        transform.rotation.set(...rotation);
        transform.updateMatrix();
        owned.add(key(shape, transform.matrix));
      },
      block(surface, x, y, z, w, h, d, yaw = 0) {
        builder.add(box, surface, [x, y, z], [w, h, d], [0, yaw, 0]);
      },
    };
    try {
      buildStreetFurniture(builder, material, material, lettering, {
        box, cylinder, wheel, taperedShell: box, wheelArch: box, taxiLettering: lettering.parking,
        personArt: { box, head: crown, material }, civicBlue: material,
        vehiclePaint: material, vehicleGlass: material, lampGlow: material,
        beaconRed: material, beaconBlue: material, palette,
      });
    } finally {
      [box, cylinder, wheel, crown, material, lettering.food, lettering.parking].forEach((resource) => resource.dispose());
    }
    world = buildCityScene();
    world.scene.updateMatrixWorld(true);
    const actors = new Set<THREE.Object3D>(world.actors.values());
    const matrix = new THREE.Matrix4();
    world.scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let parent = object.parent; parent; parent = parent.parent) if (actors.has(parent)) return;
      meshes.push(object);
      object.geometry.computeBoundingBox();
      const count = object instanceof THREE.InstancedMesh ? object.count : 1;
      for (let index = 0; index < count; index++) {
        if (object instanceof THREE.InstancedMesh) {
          object.getMatrixAt(index, matrix);
          matrix.premultiply(object.matrixWorld);
        } else matrix.copy(object.matrixWorld);
        if (owned.has(key(object.geometry, matrix))) continue;
        const bounds = object.geometry.boundingBox!.clone().applyMatrix4(matrix);
        if (bounds.max.y > 0.16 && bounds.min.y < 2.8) obstacles.push(bounds);
      }
    });
  });
  afterAll(() => world?.dispose());

  it('retains all IDs and counts with a full twelve-metre anti-border inset', () => {
    expect(STREET_BENCHES.map(({ id }) => id)).toEqual([-1, 1].flatMap((side) =>
      [0, 1, 2, 3].map((index) => `street-bench-${side}-${index}`)));
    expect(STREET_MAILBOXES.map(({ id }) => id)).toEqual([-1, 1].flatMap((side) =>
      [0, 1, 2].map((index) => `mailbox-${side}-${index}`)));
    expect(CIVIC_UTILITIES).toHaveLength(19);
    expect(CIVIC_UTILITIES.filter(({ kind }) => kind === 'hydrant')).toHaveLength(15);
    expect(STEAM_STACKS).toHaveLength(4);
    expect(placements).toHaveLength(37);
    for (const { bounds, id } of placements) {
      expect(Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)), id).toBeLessThanOrEqual(CITY_EXTENT.x - 12);
      expect(Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)), id).toBeLessThanOrEqual(CITY_EXTENT.z - 12);
    }
  });

  it('protects both actual sidewalk lanes, including the outward counterflow body envelope', () => {
    expect(SIDEWALK_ZONING.outerOffset).toBe(SIDEWALK_WALKING_CLEARANCE);
    expect(SIDEWALK_WALKING_OFFSETS[1] + SIDEWALK_ZONING.walkingHalfWidth).toBe(SIDEWALK_ZONING.outerOffset);
    for (const road of STREET_X) for (const side of [-1, 1]) for (const offset of SIDEWALK_WALKING_OFFSETS) {
      expect(outsideWalkingCorridors({ id: 'on-walk', x: road + side * offset, z: 15, yaw: 0 }, 0.2, 0.2)).toBe(false);
    }
    for (const road of STREET_Z) for (const side of [-1, 1]) for (const offset of SIDEWALK_WALKING_OFFSETS) {
      expect(outsideWalkingCorridors({ id: 'on-walk', x: 15, z: road + side * offset, yaw: 0 }, 0.2, 0.2)).toBe(false);
    }
    expect(outsideWalkingCorridors({ id: 'former-service-point', x: 33, z: 103.1, yaw: 0 }, 1.3, 1.6)).toBe(false);
  });

  it('reserves real seat/user envelopes without overlapping other relocated fixtures or retained access', () => {
    const reservations = [
      ...PARKING_BAYS.map((bay) => propBounds(bay, bay.width, bay.length)),
      ...FOOD_CARTS.map(foodCartBounds),
      ...EXTRA_PARK_BENCHES.map((prop) => propBounds(prop, 2.65, 0.86)),
      ...Object.values(BIKE_SHARE_POCKETS), JUNIPER_ACCESS_CROSSING,
      propBounds(LOADING_SERVICE_POCKET, LOADING_SERVICE_POCKET.width, LOADING_SERVICE_POCKET.depth),
      ...METRO_ENTRANCES.map((entrance) => propBounds({
        ...entrance,
        x: entrance.x + Math.sin(entrance.yaw) * 0.55,
        z: entrance.z + Math.cos(entrance.yaw) * 0.55,
      }, METRO_GEOMETRY.openingWidth + 0.6, METRO_GEOMETRY.openingDepth + 1.7)),
      ...CIVIC_SERVICES.map(({ entry }) => ({
        minX: entry.x - entry.width / 2 - 0.6, maxX: entry.x + entry.width / 2 + 0.6,
        minZ: entry.z - 4, maxZ: entry.z + 0.9,
      })),
      ...INTERSECTIONS.map(({ x, z }) => ({ minX: x - 9.8, maxX: x + 9.8, minZ: z - 9.8, maxZ: z + 9.8 })),
    ];
    for (const [index, { id, bounds }] of placements.entries()) {
      const prop = { id, x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2, yaw: 0 };
      expect(outsideWalkingCorridors(prop, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ), id).toBe(true);
      for (const road of STREET_X) {
        expect(Math.min(Math.abs(bounds.minX - road), Math.abs(bounds.maxX - road)), id).toBeGreaterThan(ROAD_HALF_WIDTH);
      }
      if (!CIVIC_UTILITIES.some((utility) => utility.id === id && utility.kind === 'hydrant')) {
        for (const road of STREET_Z) {
          expect(Math.min(Math.abs(bounds.minZ - road), Math.abs(bounds.maxZ - road)), id).toBeGreaterThan(ROAD_HALF_WIDTH);
        }
      }
      for (const other of placements.slice(index + 1)) expect(disjoint(bounds, other.bounds), `${id}/${other.id}`).toBe(true);
      for (const reservation of reservations) expect(disjoint(bounds, reservation), id).toBe(true);
      for (const path of PARK_PATHS) for (const point of path.curve.getPoints(256)) {
        const x = Math.max(bounds.minX, Math.min(bounds.maxX, point.x));
        const z = Math.max(bounds.minZ, Math.min(bounds.maxZ, point.z));
        expect(Math.hypot(point.x - x, point.z - z), `${id}/${path.id}`).toBeGreaterThan(path.width / 2 + 0.05);
      }
    }
  });

  it('keeps both actual staff approaches clear of relocated benches and mailbox use spaces', () => {
    const visits = civicActivities(SIDEWALK_WALKING_ROUTES);
    expect(visits).toHaveLength(CIVIC_SERVICES.length * 2);
    const furniture = new Set([...STREET_BENCHES, ...STREET_MAILBOXES].map(({ id }) => id));
    const radius = Math.hypot(PERSON_SPACE.width, PERSON_SPACE.length) / 2 + 0.04;
    for (const { destination } of visits) {
      const { entry, pocket } = destination;
      const sweep = {
        minX: Math.min(entry.x, pocket.x) - radius, maxX: Math.max(entry.x, pocket.x) + radius,
        minZ: Math.min(entry.z, pocket.z) - radius, maxZ: Math.max(entry.z, pocket.z) + radius,
      };
      for (const { id, bounds } of placements) {
        if (furniture.has(id)) expect(disjoint(bounds, sweep), `${destination.id}/${id}`).toBe(true);
      }
    }
  });

  it('keeps fixtures and their use spaces clear of actual buildings, low crowns, racks, railings and other scenery', () => {
    for (const { id, bounds, height } of placements) {
      const volume = new THREE.Box3(new THREE.Vector3(bounds.minX, 0.16, bounds.minZ),
        new THREE.Vector3(bounds.maxX, height, bounds.maxZ));
      for (const obstacle of obstacles) {
        expect(volume.intersectsBox(obstacle), `${id}: ${obstacle.min.toArray()} / ${obstacle.max.toArray()}`).toBe(false);
      }
    }
  });

  it('connects four small civic forecourt aprons to the existing sidewalk at the same level', () => {
    expect(STREET_FURNITURE_APRONS).toHaveLength(4);
    for (const apron of STREET_FURNITURE_APRONS) {
      const x = (apron.minX + apron.maxX) / 2;
      const edge = apron.maxZ;
      for (const z of [edge - 0.1, edge + 0.1]) {
        const hit = new THREE.Raycaster(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, -1, 0), 0, 0.5)
          .intersectObjects(meshes, false)[0];
        expect(hit?.point.y).toBeCloseTo(-0.08);
      }
    }
  });
});
