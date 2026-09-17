// @vitest-environment node
import { Box3, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PERSON_SPACE } from '../content/people';
import { civicActivities } from './civicActivities';
import { PARK_READING_DESTINATION } from './parkActivities';
import { buildCityScene } from './scene';
import { serviceActivities } from './serviceActivities';
import { storefrontActivity } from './streetActivities';
import { SIDEWALK_WALKING_ROUTES } from './traffic';

describe('retained activity clearance after interior furniture placement', () => {
  it('keeps every physical approach, standing pocket and sidewalk entry turn clear of rendered scenery', () => {
    const world = buildCityScene();
    try {
      world.scene.updateMatrixWorld(true);
      const matrix = new Matrix4();
      const solids: { label: string; bounds: Box3 }[] = [];
      world.scene.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        const count = object instanceof InstancedMesh ? object.count : 1;
        for (let index = 0; index < count; index++) {
          if (object instanceof InstancedMesh) object.getMatrixAt(index, matrix);
          else matrix.identity();
          const bounds = object.geometry.boundingBox!.clone().applyMatrix4(matrix.premultiply(object.matrixWorld));
          if (bounds.max.y > 0.1 && bounds.min.y < 2.1) solids.push({ label: `${object.name}/${index}`, bounds });
        }
      });
      expect(solids.length).toBeGreaterThan(0);
      const destinations = [
        storefrontActivity(SIDEWALK_WALKING_ROUTES).destination,
        ...civicActivities(SIDEWALK_WALKING_ROUTES).map(({ destination }) => destination),
        ...serviceActivities(SIDEWALK_WALKING_ROUTES).map(({ destination }) => destination),
        PARK_READING_DESTINATION,
      ];
      const collisions: string[] = [];
      for (const { id, entry, pocket } of destinations) {
        const alongX = Math.abs(pocket.x - entry.x) > Math.abs(pocket.z - entry.z);
        const halfX = (alongX ? PERSON_SPACE.length : PERSON_SPACE.width) / 2 + 0.04;
        const halfZ = (alongX ? PERSON_SPACE.width : PERSON_SPACE.length) / 2 + 0.04;
        const approach = new Box3(
          new Vector3(Math.min(entry.x, pocket.x) - halfX, 0.1, Math.min(entry.z, pocket.z) - halfZ),
          new Vector3(Math.max(entry.x, pocket.x) + halfX, 2.1, Math.max(entry.z, pocket.z) + halfZ),
        );
        const turnRadius = Math.hypot(PERSON_SPACE.length, PERSON_SPACE.width) / 2 + 0.04;
        const entryTurn = new Box3(
          new Vector3(entry.x - turnRadius, 0.1, entry.z - turnRadius),
          new Vector3(entry.x + turnRadius, 2.1, entry.z + turnRadius),
        );
        for (const { label, bounds } of solids) {
          if (bounds.intersectsBox(approach) || bounds.intersectsBox(entryTurn)) {
            collisions.push(`${id} intersects ${label}: ${bounds.min.toArray()} .. ${bounds.max.toArray()}`);
          }
        }
      }
      expect(collisions).toEqual([]);
    } finally {
      world.dispose();
    }
  });
});
