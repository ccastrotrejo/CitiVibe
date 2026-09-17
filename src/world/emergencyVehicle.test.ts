// @vitest-environment node
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { TRAFFIC_ACTORS } from '../content/streets';
import { ActorInstances } from './actorInstances';
import { type VehicleRig, poseNeutral } from './locomotion';
import { buildCityScene, type CityScene } from './scene';
import { TRAFFIC_LENGTHS } from './traffic';

const worlds: CityScene[] = [];
function world() { const value = buildCityScene(); worlds.push(value); return value; }
afterEach(() => worlds.splice(0).forEach((value) => value.dispose()));

const FLEET = [
  { id: 'city-vehicle-1', type: 'policeSuv', feature: 'Patrol blue belt', top: 1.7 },
  { id: 'city-ambulance-1', type: 'ambulanceBox', feature: 'Patient module', top: 2.2 },
  { id: 'city-ambulance-3', type: 'ambulanceVan', feature: 'High van roof', top: 1.95 },
  { id: 'city-firetruck-1', type: 'firetruck', feature: 'Open hose bed', top: 2.05 },
  { id: 'city-firetruck-3', type: 'fireSuv', feature: 'Command white belt', top: 1.7 },
] as const;

describe('original NYC-inspired emergency fleet', () => {
  it('gives each service a distinct silhouette inside its unchanged traffic envelope', () => {
    const { actors } = world();
    for (const { id, type, feature, top } of FLEET) {
      expect(TRAFFIC_ACTORS.find((actor) => actor.id === id)?.vehicleType).toBe(type);
      const actor = actors.get(id)!;
      const bodywork = actor.getObjectByName(feature) as THREE.Mesh;
      expect(bodywork, id).toBeDefined();
      expect((bodywork.material as THREE.Material).userData.weatherSurface, id).toBe(true);
      const bounds = new THREE.Box3().setFromObject(actor);
      expect(bounds.min.y, id).toBeCloseTo(0, 5);
      expect(bounds.max.y, id).toBeGreaterThan(top);
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(-0.9);
      expect(bounds.max.x, id).toBeLessThanOrEqual(0.9);
      expect(bounds.min.z, id).toBeGreaterThanOrEqual(-TRAFFIC_LENGTHS[type] / 2);
      expect(bounds.max.z, id).toBeLessThanOrEqual(TRAFFIC_LENGTHS[type] / 2);
    }
  });

  it('keeps windshields exposed in front of the cab rather than buried inside the roof', () => {
    const { actors } = world();
    const ray = new THREE.Raycaster();
    for (const { id } of FLEET) {
      const actor = actors.get(id)!;
      const windshield = actor.getObjectByName('Front windshield') as THREE.Mesh;
      expect(windshield, id).toBeDefined();
      actor.updateWorldMatrix(true, true);
      const center = windshield.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.2, 0, 0));
      const targets: THREE.Mesh[] = [];
      actor.traverse((object) => { if (object instanceof THREE.Mesh) targets.push(object); });
      ray.set(center.clone().add(new THREE.Vector3(0, 0, 6)), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObjects(targets, false)[0]?.object, id).toBe(windshield);
      const glass = windshield.material as THREE.MeshStandardMaterial;
      expect(glass.userData.window).not.toBe(true);
      expect(glass.emissiveIntensity * glass.emissive.getHex()).toBe(0);
    }
  });

  it('renders real rear doors and service equipment, not a recolored delivery box', () => {
    const { actors } = world();
    for (const id of ['city-ambulance-1', 'city-ambulance-3']) {
      const actor = actors.get(id)!;
      const doors: THREE.Object3D[] = [];
      actor.traverse((object) => { if (object.name === 'Rear patient door') doors.push(object); });
      expect(doors, id).toHaveLength(2);
      expect(actor.getObjectByName('Rear access step'), id).toBeDefined();
      expect(actor.getObjectByName('Medical identifier'), id).toBeDefined();
    }
    const engine = actors.get('city-firetruck-1')!;
    for (const name of ['Pump control panel', 'Pump outlet', 'Hose load', 'Side equipment shutter',
      'Ground ladder rail', 'Rear safety chevron', 'Crew cab window']) {
      expect(engine.getObjectByName(name), name).toBeDefined();
    }
    expect(actors.get('city-vehicle-1')!.getObjectByName('Patrol push bumper')).toBeDefined();
    expect(actors.get('city-firetruck-3')!.getObjectByName('Command roof rail')).toBeDefined();
  });

  it('retains grounded wheel pivots and all driving lamps on the suspension body', () => {
    const { actors, vehicleLights } = world();
    for (const { id, type } of FLEET) {
      const actor = actors.get(id)!;
      const rig: VehicleRig = actor.userData.rig;
      const lights = vehicleLights.find((value) => value.id === id)!;
      expect(rig.wheels).toHaveLength(4);
      expect(rig.wheels.filter((wheel) => wheel.front)).toHaveLength(2);
      expect(lights.lamps).toHaveLength(11);
      for (const wheel of rig.wheels) {
        expect(wheel.steer.parent).toBe(actor);
        expect(wheel.steer.position.y).toBeCloseTo(rig.wheelRadius);
      }
      for (const lamp of lights.lamps) {
        expect(lamp.mount.parent).toBe(rig.body);
        expect(Math.abs(lamp.mount.position.x) + lamp.size[0] / 2, id).toBeLessThanOrEqual(0.9);
        expect(Math.abs(lamp.mount.position.z) + lamp.size[2] / 2, id).toBeLessThanOrEqual(TRAFFIC_LENGTHS[type] / 2);
      }
      const state = rig.body.matrix.toArray();
      poseNeutral(rig);
      rig.body.updateMatrix();
      expect(rig.body.matrix.toArray()).toEqual(state);
    }
  });

  it('batches the new colors without extra materials and reconstructs the same artwork', () => {
    const first = world(), second = world();
    const signature = (actor: THREE.Group) => {
      const parts: unknown[] = [];
      actor.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        parts.push([object.name, object.position.toArray(), object.scale.toArray(), object.rotation.toArray(),
          object.userData.instanceColor?.getHexString()]);
      });
      return parts;
    };
    for (const { id } of FLEET) {
      expect(signature(first.actors.get(id)!)).toEqual(signature(second.actors.get(id)!));
    }
    const live = first.actors.get('city-vehicle-1')!;
    const batch = new ActorInstances([live]);
    const belt = live.getObjectByName('Patrol blue belt') as THREE.Mesh;
    const mesh = batch.group.children.find((object) =>
      object instanceof THREE.InstancedMesh && object.material === belt.material) as THREE.InstancedMesh;
    const color = new THREE.Color();
    expect(Array.from({ length: mesh.count }, (_, index) => {
      mesh.getColorAt(index, color);
      return color.getHexString();
    })).toContain(belt.userData.instanceColor.getHexString());
    batch.dispose();
  });
});
