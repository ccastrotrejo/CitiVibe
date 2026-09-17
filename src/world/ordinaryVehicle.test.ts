// @vitest-environment node
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CURB_VEHICLES, PARKING_BAYS } from '../content/streetFurniture';
import { TRAFFIC_ACTORS } from '../content/streets';
import { ActorInstances } from './actorInstances';
import { isEmergencyVehicle } from './emergencyVehicle';
import type { VehicleRig } from './locomotion';
import { passengerVariant } from './ordinaryVehicle';
import { buildCityScene, type CityScene } from './scene';
import { buildSignLettering } from './signLettering';
import { buildParkedCar } from './streetFurniture';
import { TRAFFIC_LENGTHS } from './traffic';
import { buildVehicleRig, type VehicleArt } from './vehicle';

const ordinary = TRAFFIC_ACTORS.filter(({ vehicleType }) =>
  vehicleType && vehicleType !== 'bicycle' && !isEmergencyVehicle(vehicleType));
let world: CityScene;
let art: VehicleArt;
const mesh = (object: THREE.Object3D, name: string) => {
  const part = object.getObjectByName(name);
  if (!(part instanceof THREE.Mesh) || Array.isArray(part.material)) throw new Error(`Missing single-material part ${name}.`);
  return part as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
};
beforeAll(() => {
  world = buildCityScene();
  const passenger = world.actors.get(ordinary.find(({ vehicleType }) => vehicleType === 'sedan')!.id)!;
  const taxi = world.actors.get(ordinary.find(({ vehicleType }) => vehicleType === 'taxi')!.id)!;
  const rig: VehicleRig = passenger.userData.rig;
  const tire = rig.wheels[0].spin.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  const hub = rig.wheels[0].spin.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  const paint = mesh(passenger, 'Passenger shoulder').material;
  const box = mesh(passenger, 'Between-wheel body').geometry;
  art = {
    box, cylinder: hub.geometry, wheel: tire.geometry,
    taperedShell: mesh(passenger, 'Passenger shoulder').geometry,
    wheelArch: mesh(passenger, 'Open wheel arch trim').geometry,
    taxiLettering: mesh(taxi, 'Original TAXI lettering').geometry,
    vehiclePaint: paint, vehicleGlass: mesh(passenger, 'Front windshield').material,
    lampGlow: mesh(taxi, 'Unbranded taxi roof light').material,
    personArt: { box, head: box, material: paint }, civicBlue: paint, beaconRed: paint, beaconBlue: paint,
    palette: { taxi: paint, cream: paint, teal: paint, clay: paint, stone: hub.material, rubber: tire.material,
      paving: paint, copper: paint, line: paint },
  };
});
afterAll(() => world.dispose());

describe('ordinary and parked fleet artwork', () => {
  it('retains all 38 ordinary and ten approved emergency slots including six buses', () => {
    expect(ordinary).toHaveLength(38);
    expect(TRAFFIC_ACTORS.filter(({ vehicleType }) => isEmergencyVehicle(vehicleType))).toHaveLength(10);
    expect(Object.fromEntries(['sedan', 'taxi', 'van', 'truck', 'bus'].map(type =>
      [type, ordinary.filter(({ vehicleType }) => vehicleType === type).length])))
      .toEqual({ sedan: 11, taxi: 9, van: 7, truck: 5, bus: 6 });
  });

  it('fits every actual mesh and rendered lamp lens inside unchanged full traffic envelopes', () => {
    for (const definition of ordinary) {
      const actor = world.actors.get(definition.id)!;
      const width = definition.vehicleType === 'bus' ? 1.1 : 0.9;
      const half = TRAFFIC_LENGTHS[definition.vehicleType!] / 2;
      const bounds = new THREE.Box3().setFromObject(actor);
      expect(bounds.min.y, definition.id).toBeCloseTo(0, 5);
      expect(bounds.max.x, definition.id).toBeLessThanOrEqual(width);
      expect(bounds.min.x, definition.id).toBeGreaterThanOrEqual(-width);
      expect(bounds.max.z, definition.id).toBeLessThanOrEqual(half);
      expect(bounds.min.z, definition.id).toBeGreaterThanOrEqual(-half);
      const rig: VehicleRig = actor.userData.rig;
      expect(rig.wheels).toHaveLength(4);
      expect(rig.wheels.filter(({ front }) => front)).toHaveLength(2);
      for (const wheel of rig.wheels) {
        expect(wheel.steer.parent).toBe(actor);
        expect(wheel.steer.position.y).toBeCloseTo(rig.wheelRadius);
      }
      const lights = world.vehicleLights.find(({ id }) => id === definition.id)!;
      expect(lights.lamps).toHaveLength(11);
      for (const lamp of lights.lamps) {
        expect(lamp.mount.parent).toBe(rig.body);
        expect(Math.abs(lamp.mount.position.x) + lamp.size[0] / 2, definition.id).toBeLessThanOrEqual(width);
        expect(Math.abs(lamp.mount.position.z) + lamp.size[2] / 2, definition.id).toBeLessThanOrEqual(half);
      }
    }
  });

  it('exposes windshields and all tire sidewalls instead of burying them in solid hulls', () => {
    const ray = new THREE.Raycaster();
    for (const { id } of ordinary) {
      const actor = world.actors.get(id)!;
      actor.updateWorldMatrix(true, true);
      const windshield = mesh(actor, 'Front windshield');
      const center = windshield.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.2, 0, 0));
      const targets: THREE.Mesh[] = [];
      actor.traverse(object => { if (object instanceof THREE.Mesh) targets.push(object); });
      ray.set(center.clone().add(new THREE.Vector3(0, 0, 5)), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObjects(targets, false)[0]?.object, id).toBe(windshield);
      const glass = windshield.material as THREE.MeshStandardMaterial;
      expect(glass.userData.window).not.toBe(true);
      expect(glass.emissiveIntensity * glass.emissive.getHex()).toBe(0);
      const rig: VehicleRig = actor.userData.rig;
      for (const wheel of rig.wheels) {
        const p = wheel.steer.getWorldPosition(new THREE.Vector3());
        const side = Math.sign(p.x);
        // Above the hub, on the tire's exposed sidewall.
        ray.set(new THREE.Vector3(side * 4, p.y + rig.wheelRadius * 0.72, p.z), new THREE.Vector3(-side, 0, 0));
        expect(ray.intersectObjects(targets, false)[0]?.object, `${id} tire`).toBe(wheel.spin.children[0]);
      }
      actor.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.name !== 'Open wheel arch trim') return;
        const normal = new THREE.Vector3().fromBufferAttribute(object.geometry.getAttribute('normal'), 0)
          .transformDirection(object.matrixWorld);
        expect(normal.x * Math.sign(object.position.x)).toBeGreaterThan(0.99);
        expect(object.geometry.index!.count / 3).toBe(6);
      });
    }
  });

  it('uses ID-stable silhouettes and paint regardless of build order or reconstruction', () => {
    const variants = (type: 'sedan' | 'taxi') => new Set(ordinary.filter(d => d.vehicleType === type)
      .map(({ id }) => passengerVariant(id, type === 'taxi')));
    expect(variants('sedan')).toEqual(new Set(['sedan', 'hatch', 'crossover']));
    expect(variants('taxi')).toEqual(new Set(['sedan', 'minivan']));
    expect(new Set(ordinary.filter(d => d.vehicleType === 'van')
      .map(({ id }) => world.actors.get(id)!.userData.rig.body.userData.commercialVariant)))
      .toEqual(new Set(['low-roof', 'high-roof']));
    const signature = (group: THREE.Group) => {
      const result: unknown[] = [];
      group.traverse(object => {
        if (object instanceof THREE.Mesh) result.push([object.name, object.position.toArray(),
          object.scale.toArray(), object.quaternion.toArray(), object.userData.instanceColor?.getHexString()]);
      });
      return result;
    };
    for (const definition of [...ordinary].reverse()) {
      const reconstructed = new THREE.Group();
      buildVehicleRig(reconstructed, definition, art);
      expect(signature(reconstructed), definition.id).toEqual(signature(world.actors.get(definition.id)!));
    }
  });

  it('keeps cargo vans, box trucks and curb-door buses structurally distinct', () => {
    for (const { id, vehicleType } of ordinary) {
      const actor = world.actors.get(id)!;
      if (vehicleType === 'van') {
        expect(actor.getObjectByName('Opaque cargo compartment')).toBeDefined();
        expect(actor.getObjectByName('Sliding-door seam')).toBeDefined();
        expect(actor.getObjectByName('Rear double-door seam')).toBeDefined();
        expect(actor.getObjectByName('Passenger glazing')).toBeUndefined();
      } else if (vehicleType === 'truck') {
        const box = new THREE.Box3().setFromObject(mesh(actor, 'Separate cargo box'));
        const cab = new THREE.Box3().setFromObject(mesh(actor, 'Cab roof'));
        expect(box.max.y).toBeGreaterThan(cab.max.y + 0.3);
        expect(box.max.z).toBeLessThan(cab.min.z);
        expect(actor.getObjectByName('Rear roll-up door')).toBeDefined();
      } else if (vehicleType === 'bus') {
        const door = mesh(actor, 'Curbside passenger door');
        expect(door.position.x).toBeLessThan(0);
        expect(actor.getObjectByName('Bus window band')).toBeDefined();
        const rig: VehicleRig = actor.userData.rig;
        expect(rig.wheels.every(({ steer }) => Math.abs(steer.position.z) < 1.4)).toBe(true);
      }
    }
  });

  it('shares original 40-triangle two-face TAXI strokes with no medallions or ad geometry', () => {
    const shapes = new Set<THREE.BufferGeometry>();
    for (const { id } of ordinary.filter(({ vehicleType }) => vehicleType === 'taxi')) {
      const letters: THREE.Mesh[] = [];
      world.actors.get(id)!.traverse(object => {
        if (object instanceof THREE.Mesh && object.name === 'Original TAXI lettering') letters.push(object);
        expect(object.name).not.toMatch(/medallion|advert/i);
      });
      expect(letters).toHaveLength(2);
      for (const letter of letters) {
        shapes.add(letter.geometry);
        expect(letter.geometry.index!.count / 3).toBe(20);
      }
      expect(letters.map(({ rotation }) => rotation.y)).toEqual([Math.PI, 0]);
    }
    expect(shapes.size).toBe(1);
    const x = buildSignLettering('X', 1, 1);
    expect(x.index!.count / 3).toBe(4);
    x.dispose();
  });

  it('uses the same parked shell within actual curb bounds and captures its roof for weather', () => {
    const staticShapes = new Set<THREE.BufferGeometry>();
    world.scene.traverseVisible(object => {
      if (object instanceof THREE.InstancedMesh && object.castShadow) staticShapes.add(object.geometry);
    });
    for (const prop of CURB_VEHICLES) {
      const parked = buildParkedCar(prop, art);
      const bounds = new THREE.Box3().setFromObject(parked);
      const roof = mesh(parked, 'Passenger roof');
      expect(staticShapes.has(roof.geometry)).toBe(true);
      expect(roof.material.userData.weatherSurface).toBe(true);
      expect(bounds.max.z - bounds.min.z, prop.id).toBeLessThanOrEqual(prop.width + 1e-6);
      expect(bounds.max.x - bounds.min.x, prop.id).toBeLessThanOrEqual(prop.length);
      expect(bounds.min.y).toBeCloseTo(0);
      expect(PARKING_BAYS.find(({ id }) => id === prop.id)?.length).toBe(6.2);
      expect(parked.position.toArray()).toEqual([prop.x, 0, prop.z]);
      expect(parked.rotation.y).toBe(prop.yaw);
      const cell = world.weatherSurface.cellSize;
      const p = roof.getWorldPosition(new THREE.Vector3());
      const x = Math.floor(p.x / cell) * cell + cell / 2;
      const z = Math.floor(p.z / cell) * cell + cell / 2;
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(parked, true)[0];
      expect(hit, prop.id).toBeDefined();
      expect(world.weatherSurface.heightAt(x, z), prop.id).toBeCloseTo(hit.point.y, 4);
    }
  });

  it('batches the body colors on the same weather-aware material without taking resource ownership', () => {
    const actor = new THREE.Group();
    buildVehicleRig(actor, ordinary[0], art);
    const shoulder = mesh(actor, 'Passenger shoulder');
    const batches = new ActorInstances([actor]);
    const batch = batches.group.children.find(object => object instanceof THREE.InstancedMesh &&
      object.material === shoulder.material && object.geometry === shoulder.geometry) as THREE.InstancedMesh;
    expect(shoulder.material.userData.weatherSurface).toBe(true);
    const color = new THREE.Color();
    expect(Array.from({ length: batch.count }, (_, index) => {
      batch.getColorAt(index, color);
      return color.getHexString();
    })).toContain(shoulder.userData.instanceColor.getHexString());
    batches.dispose();
    expect(shoulder.visible).toBe(true);
  });
});
