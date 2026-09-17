// @vitest-environment node
import { Group, MeshBasicMaterial, BoxGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PARK_LAKESIDE, PARK_PATHS, PARK_ROUTES, sampleParkRoute } from '../content/park';
import { createPersonProfile, PERSON_SPACE } from '../content/people';
import { BENCH_SPACE, EXTRA_PARK_BENCHES, PARK_READING_POCKET, propBounds } from '../content/streetFurniture';
import { buildPersonRig } from './person';
import { Locomotion, poseWalkerRig, WALKER } from './locomotion';
import { buildReadingArt, isParkReader, PARK_MEADOW_VISIT, PARK_READING_DESTINATION, PARK_READING_ENTRY } from './parkActivities';
import { ActorSimulation } from './actors';
import { buildCityScene } from './scene';

describe('connected park destination geometry', () => {
  it('branches and merges at actual existing spline knots without a bridge or phantom connector', () => {
    const actual = new Vector3();
    const expected = new Vector3();
    for (const [distance, along] of [[PARK_MEADOW_VISIT.entry, 0], [PARK_MEADOW_VISIT.exit, PARK_MEADOW_VISIT.length]]) {
      sampleParkRoute(PARK_ROUTES[0], distance, expected);
      PARK_MEADOW_VISIT.sample(along, actual);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-7);
    }
    const path = PARK_PATHS.find(({ id }) => id === 'meadow-walk')!;
    for (let distance = 0; distance < PARK_MEADOW_VISIT.length; distance += 0.1) {
      PARK_MEADOW_VISIT.sample(distance, actual);
      path.curve.getPointAt(distance / PARK_MEADOW_VISIT.length, expected);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-9);
      expect(actual.y).toBe(0);
      expect(actual.x).toBeGreaterThan(PARK_LAKESIDE.bridge.endX);
    }
  });

  it('uses a real bench-front pocket without occupying the seat or mall walking line', () => {
    const actual = new Vector3();
    sampleParkRoute(PARK_ROUTES[0], PARK_READING_ENTRY, actual);
    expect(actual.distanceTo(new Vector3(0, 0, PARK_READING_DESTINATION.entry.z))).toBeLessThan(1e-7);
    const bench = EXTRA_PARK_BENCHES.find(({ id }) => id === PARK_READING_POCKET.benchId)!;
    const bounds = propBounds(bench, BENCH_SPACE.width, BENCH_SPACE.depth);
    expect(PARK_READING_DESTINATION.pocket.x + PERSON_SPACE.length / 2).toBeLessThan(bounds.minX);
    expect(PARK_READING_DESTINATION.pocket.x - PERSON_SPACE.length / 2).toBeGreaterThan(2.4);
    const { pocket } = PARK_READING_DESTINATION;
    expect(pocket).toEqual({ x: PARK_READING_POCKET.x, y: 0, z: PARK_READING_POCKET.z });
    expect(pocket.x - PERSON_SPACE.length / 2).toBeGreaterThanOrEqual(PARK_READING_POCKET.minX);
    expect(pocket.x + PERSON_SPACE.length / 2).toBeLessThanOrEqual(PARK_READING_POCKET.maxX);
    expect(pocket.z - PERSON_SPACE.width / 2).toBeGreaterThanOrEqual(PARK_READING_POCKET.minZ);
    expect(pocket.z + PERSON_SPACE.width / 2).toBeLessThanOrEqual(PARK_READING_POCKET.maxZ);
    expect(isParkReader('walker-5')).toBe(true);
    expect(isParkReader('runner-5')).toBe(false);
  });

  it.each([false, true])('keeps reading genuinely standing and ground-contact correct, reduced motion=%s', (reducedMotion) => {
    const art = { box: new BoxGeometry(), head: new IcosahedronGeometry(), material: new MeshBasicMaterial() };
    try {
      for (const id of ['walker-5', 'walker-15', 'walker-25', 'walker-35', 'walker-45', 'walker-55']) {
        const root = new Group();
        const rig = buildPersonRig(root, createPersonProfile(id, 'park'), art);
        buildReadingArt(rig, art);
        poseWalkerRig(rig, { distance: 97, speed: 0, blend: 1, reducedMotion, activity: 'reading' });
        expect(rig.readingBook?.scale.x).toBe(1);
        expect(rig.pelvis.position.y).toBe(WALKER.hipY);
        root.updateMatrixWorld(true);
        for (const leg of rig.legs) {
          const ankle = leg.knee.localToWorld(new Vector3(0, -WALKER.shank, 0));
          expect(ankle.y).toBeCloseTo(0, 8);
          expect(ankle.z).toBeCloseTo(0, 8);
        }
        const heldPose = rig.arms.map(({ rotation }) => rotation.x);
        poseWalkerRig(rig, { distance: 97, speed: 0, blend: 1, reducedMotion, activity: 'reading', activityTime: 4 });
        expect(rig.arms.map(({ rotation }) => rotation.x)).toEqual(heldPose);
        poseWalkerRig(rig, { distance: 98, speed: 1, blend: 1, reducedMotion, activity: 'walking' });
        expect(rig.readingBook?.scale.x).toBe(0);
      }
    } finally {
      art.box.dispose();
      art.head.dispose();
      art.material.dispose();
    }
  });

  it.each([false, true])('restores the actual instanced book for a live reader and hides it on departure, reduced motion=%s', (reducedMotion) => {
    const simulation = new ActorSimulation(2401);
    for (let tick = 0; tick < 6_000 && !simulation.actors.some(({ activity }) => activity === 'reading'); tick++) {
      simulation.step(1 / 30);
    }
    const reader = simulation.actors.find(({ activity }) => activity === 'reading');
    if (!reader) throw new Error('No natural reading visit reached the retained pocket.');
    const world = buildCityScene();
    try {
      const book = world.actors.get(reader.id)!.getObjectByName('Unbranded reading book')!;
      expect(book.scale).toEqual(new Vector3());
      const locomotion = new Locomotion();
      const frame = () => world.frame({
        actors: simulation.actors, signals: simulation.traffic.signals, elapsedSeconds: simulation.elapsed,
        reducedMotion, groundLift: 0,
      });
      const draw = (restoring: boolean) => {
        for (const state of simulation.actors) {
          const actor = world.actors.get(state.id)!;
          actor.position.set(state.position.x, state.position.y, state.position.z);
          actor.rotation.y = state.heading;
        }
        if (restoring) locomotion.restore(simulation.actors, world.actors, reducedMotion);
        else locomotion.update(simulation.actors, world.actors, 1 / 30, reducedMotion);
        frame();
        world.scene.updateMatrixWorld(true);
      };
      draw(true);
      expect(book.scale).toEqual(new Vector3(1, 1, 1));
      const cover = book.getObjectByName('Plain book cover');
      if (!(cover instanceof Mesh)) throw new Error('The restored reading book has no cover geometry.');
      const batch = world.scene.getObjectByName('Instanced neighborhood activity')!.children
        .find((object): object is InstancedMesh => object instanceof InstancedMesh &&
          object.geometry === cover.geometry && object.material === cover.material);
      if (!batch) throw new Error('The reading book was omitted from actor instancing.');
      const matrix = new Matrix4();
      let slot = -1;
      for (let index = 0; index < batch.count; index++) {
        batch.getMatrixAt(index, matrix);
        matrix.premultiply(batch.matrixWorld);
        if (matrix.elements.every((value, offset) => Math.abs(value - cover.matrixWorld.elements[offset]) < 1e-5)) {
          slot = index;
          break;
        }
      }
      expect(slot).toBeGreaterThanOrEqual(0);
      const count = batch.count;
      const held = matrix.clone();
      const state = JSON.stringify(reader);
      simulation.step(0);
      frame();
      batch.getMatrixAt(slot, matrix);
      matrix.premultiply(batch.matrixWorld);
      expect(matrix.elements).toEqual(held.elements);
      expect(JSON.stringify(reader)).toBe(state);
      for (let tick = 0; tick < 600 && reader.activity === 'reading'; tick++) simulation.step(1 / 30);
      expect(reader.activity).not.toBe('reading');
      draw(false);
      expect(book.scale).toEqual(new Vector3());
      batch.getMatrixAt(slot, matrix);
      expect(new Vector3().setFromMatrixScale(matrix)).toEqual(new Vector3());
      expect(batch.count).toBe(count);
    } finally {
      world.dispose();
    }
  }, 30_000);
});
