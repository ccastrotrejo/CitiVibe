import { afterEach, describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { BASKETBALL_COURT as BASKETBALL, COURT_PLAYERS, PICKLEBALL_COURT as PICKLEBALL } from '../content/courts';
import { SIDEWALK_HALF_WIDTH, STREET_BLOCKS } from '../content/streets';
import { buildCityScene, type CityScene } from './scene';

const worlds: CityScene[] = [];
function fixture() {
  const world = buildCityScene();
  worlds.push(world);
  const basketball = world.scene.getObjectByName('Basketball in play')!;
  const pickleball = world.scene.getObjectByName('Pickleball in play')!;
  const players = COURT_PLAYERS.map(({ id }) => world.scene.getObjectByName(id)!);
  const update = world.updateCourtActivity!;
  return { world, basketball, pickleball, players, update };
}
function snapshot(objects: readonly Object3D[]) {
  return objects.map((object) => {
    const poses: number[][] = [];
    object.traverse((part) => poses.push([...part.position.toArray(), part.rotation.x, part.rotation.y, part.rotation.z]));
    return poses;
  });
}
afterEach(() => worlds.splice(0).forEach((world) => world.dispose()));

describe('Juniper court activities', () => {
  it('fits separate basketball and pickleball courts inside the public parcel', () => {
    const parcel = STREET_BLOCKS.find(({ id }) => id === 'block-1-3')!;
    for (const court of [BASKETBALL, PICKLEBALL]) {
      expect(court.x - court.width / 2).toBeGreaterThan(parcel.minX + SIDEWALK_HALF_WIDTH);
      expect(court.x + court.width / 2).toBeLessThan(parcel.maxX - SIDEWALK_HALF_WIDTH);
      expect(court.z - court.depth / 2).toBeGreaterThan(parcel.minZ + SIDEWALK_HALF_WIDTH);
      expect(court.z + court.depth / 2).toBeLessThan(parcel.maxZ - SIDEWALK_HALF_WIDTH);
    }
    expect(BASKETBALL.z - BASKETBALL.depth / 2 - (PICKLEBALL.z + PICKLEBALL.depth / 2)).toBeGreaterThan(3);
  });

  it('adds four basketball players, two paddle players and exactly two balls without selectable actors', () => {
    const { world, players } = fixture();
    expect(players).toHaveLength(6);
    COURT_PLAYERS.forEach((definition, index) => {
      const court = definition.sport === 'basketball' ? BASKETBALL : PICKLEBALL;
      expect(players[index].position.x).toBe(court.x + definition.x);
      expect(players[index].position.z).toBe(court.z + definition.z);
      expect(Math.abs(definition.x) + 0.4).toBeLessThan(court.width / 2);
      expect(Math.abs(definition.z) + 0.4).toBeLessThan(court.depth / 2);
      expect(players[index].userData.semanticId).toBeUndefined();
    });
    expect(players.filter((player) => player.getObjectByName('Pickleball paddle'))).toHaveLength(2);
    expect(world.actors.size).toBe(126);
  });

  it('dribbles, passes, shoots through the shared rim, rebounds and repeats continuously', () => {
    const { basketball, update } = fixture();
    update(0.5, false);
    expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + BASKETBALL.ballRadius);
    update(2.5, false);
    expect(basketball.position.x).toBeGreaterThan(BASKETBALL.x - 2.6);
    expect(basketball.position.x).toBeLessThan(BASKETBALL.x + 1.7);
    update(4.5, false);
    expect(basketball.position.x).toBeCloseTo(BASKETBALL.x + BASKETBALL.hoopOffset);
    expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + BASKETBALL.hoopHeight);
    expect(basketball.position.z).toBeCloseTo(BASKETBALL.z);
    update(5, false);
    expect(basketball.position.y).toBeCloseTo(BASKETBALL.surfaceY + BASKETBALL.ballRadius);
    update(6, false);
    expect(basketball.position.x).toBeCloseTo(BASKETBALL.x + 3.4);
    update(0, false);
    const initial = basketball.position.clone();
    update(12, false);
    expect(basketball.position).toEqual(initial);
  });

  it('rallies in both directions, clears the net and bounces on the receiving side', () => {
    const { pickleball, players, update } = fixture();
    for (const offset of [0, 2.4]) {
      const direction = offset === 0 ? 1 : -1;
      update(offset + 1.8 * 4 / 6.5, false);
      expect(pickleball.position.x).toBeCloseTo(PICKLEBALL.x);
      expect(pickleball.position.y - PICKLEBALL.ballRadius).toBeGreaterThan(PICKLEBALL.surfaceY + PICKLEBALL.netHeight);
      update(offset + 1.8, false);
      expect(pickleball.position.x).toBeCloseTo(PICKLEBALL.x + direction * 2.5);
      expect(pickleball.position.y).toBeCloseTo(PICKLEBALL.surfaceY + PICKLEBALL.ballRadius);
      update(offset, false);
      const paddle = players[offset === 0 ? 4 : 5].getObjectByName('Pickleball paddle')!;
      players.forEach((player) => player.updateWorldMatrix(true, true));
      expect(pickleball.position.distanceTo(paddle.getWorldPosition(pickleball.position.clone()))).toBeLessThan(0.01);
    }
  });

  it('keeps balls inside their courts with no loop-boundary jumps for a full minute', () => {
    const { basketball, pickleball, update } = fixture();
    const previous = [basketball.position.clone(), pickleball.position.clone()];
    for (let tick = 1; tick <= 7200; tick++) {
      update(tick / 120, false);
      for (const [index, [ball, court]] of ([[basketball, BASKETBALL], [pickleball, PICKLEBALL]] as const).entries()) {
        expect(Math.abs(ball.position.x - court.x) + court.ballRadius).toBeLessThan(court.width / 2);
        expect(Math.abs(ball.position.z - court.z) + court.ballRadius).toBeLessThan(court.depth / 2);
        expect(ball.position.y).toBeGreaterThanOrEqual(court.surfaceY + court.ballRadius - 1e-8);
        expect(ball.position.distanceTo(previous[index])).toBeLessThan(0.1);
        previous[index].copy(ball.position);
      }
    }
  });

  it('reproduces every pose on repeated clocks, restores from elapsed time and holds reduced-motion stills', () => {
    const first = fixture();
    const second = fixture();
    const objects = (value: ReturnType<typeof fixture>) => [...value.players, value.basketball, value.pickleball];
    first.update(8.4, false);
    const before = snapshot(objects(first));
    first.update(8.4, false);
    second.update(8.4, false);
    expect(snapshot(objects(first))).toEqual(before);
    expect(snapshot(objects(second))).toEqual(before);
    first.update(44, true);
    const still = snapshot(objects(first));
    first.update(3000, true);
    expect(snapshot(objects(first))).toEqual(still);
    first.update(8.4, false);
    expect(snapshot(objects(first))).toEqual(before);
    first.world.dispose();
    first.update(8.5, false);
    expect(snapshot(objects(first))).toEqual(before);
  });

  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid elapsed time %s before changing poses', (time) => {
    const { players, basketball, pickleball, update } = fixture();
    const before = snapshot([...players, basketball, pickleball]);
    expect(() => update(time, false)).toThrow(RangeError);
    expect(snapshot([...players, basketball, pickleball])).toEqual(before);
  });
});
