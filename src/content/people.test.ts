// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PARK_ACTORS } from './park';
import { TRAFFIC_ACTORS } from './streets';
import { createPersonProfile, SKIN_TONES, type PersonContext } from './people';

const street = TRAFFIC_ACTORS.filter(({ kind }) => kind === 'pedestrian').map(({ id }) => createPersonProfile(id, 'street'));
const park = PARK_ACTORS.map(({ id, gait }) => createPersonProfile(id, gait === 'run' ? 'runner' : 'park'));
const people = [...street, ...park];

describe('original diverse population', () => {
  it('retains the bounded street and park walking/running population', () => {
    expect(street).toHaveLength(200);
    expect(park.filter(({ context }) => context === 'park')).toHaveLength(55);
    expect(park.filter(({ context }) => context === 'runner')).toHaveLength(24);
    expect(new Set(people.map(({ id }) => id)).size).toBe(279);
  });

  it('actually casts all thirteen work roles in recognizable on-duty outfits', () => {
    const workers = street.filter(({ purpose }) => purpose === 'commute');
    expect(new Set(workers.map(({ occupation }) => occupation))).toEqual(new Set([
      'lawyer', 'software-engineer', 'analyst', 'office-worker', 'firefighter', 'police-officer',
      'healthcare-worker', 'construction-worker', 'courier', 'chef', 'gardener', 'teacher', 'artist',
    ]));
    expect(workers.filter(({ occupation }) => occupation === 'firefighter').every(({ outfit, hat }) =>
      outfit === 'fire-gear' && hat === 'fire-helmet')).toBe(true);
    expect(workers.filter(({ occupation }) => occupation === 'police-officer').every(({ outfit }) =>
      outfit === 'police-uniform')).toBe(true);
    expect(workers.every(({ age }) => age >= 18)).toBe(true);
  });

  it('varies age, stature, build, hair, clothing, skin and accessories in the shipped manifest', () => {
    expect(new Set(people.map(({ ageGroup }) => ageGroup)).size).toBe(5);
    expect(new Set(people.map(({ skin }) => skin))).toEqual(new Set(SKIN_TONES));
    expect(new Set(people.map(({ outfit }) => outfit)).size).toBeGreaterThanOrEqual(12);
    expect(new Set(people.map(({ hat }) => hat)).size).toBeGreaterThanOrEqual(9);
    expect(new Set(people.map(({ hair }) => hair)).size).toBe(6);
    expect(new Set(people.map(({ bag }) => bag)).size).toBe(5);
    expect(people.filter(({ glasses }) => glasses).length).toBeGreaterThan(25);
    expect(new Set(people.map(({ top, bottom, hat, hair, skin }) => `${top}/${bottom}/${hat}/${hair}/${skin}`)).size)
      .toBeGreaterThan(185);
    const children = people.filter(({ ageGroup }) => ageGroup === 'child');
    const adults = people.filter(({ age }) => age >= 18);
    expect(Math.max(...children.map(({ stature }) => stature))).toBeLessThan(Math.min(...adults.map(({ stature }) => stature)));
    expect(Math.max(...adults.map(({ stature }) => stature)) - Math.min(...adults.map(({ stature }) => stature))).toBeGreaterThan(0.3);
    for (const group of ['child', 'teen', 'young-adult', 'adult', 'older-adult']) {
      expect(new Set(people.filter(({ ageGroup }) => ageGroup === group).map(({ hat }) => hat)).size).toBeGreaterThan(2);
    }
  });

  it('decouples skin, build and hair from job, activity and accessories', () => {
    for (let index = 0; index < 100; index++) {
      const id = `neighbor-${index}`;
      const a = createPersonProfile(id, 'street');
      for (const context of ['park', 'runner', 'cyclist', 'play-child'] satisfies PersonContext[]) {
        const b = createPersonProfile(id, context);
        expect(b.skin).toBe(a.skin);
        expect(b.build).toBe(a.build);
        expect(b.hair).toBe(a.hair);
        expect(b.glasses).toBe(a.glasses);
      }
    }
    const skins = new Map<string, Set<string>>();
    for (let index = 0; index < 1500; index++) {
      const person = createPersonProfile(`resident-${index}`, 'street');
      if (!skins.has(person.occupation)) skins.set(person.occupation, new Set());
      skins.get(person.occupation)!.add(person.skin);
    }
    for (const tones of skins.values()) expect(tones.size).toBeGreaterThanOrEqual(5);
  });

  it('dresses all runners and court players for exercise, including older adults', () => {
    for (const context of ['runner', 'basketball', 'pickleball'] satisfies PersonContext[]) {
      const athletes = Array.from({ length: 60 }, (_, index) => createPersonProfile(`athlete-${index}`, context));
      for (const person of athletes) {
        expect(person.outfit).toBe('sport');
        expect(person.shorts).toBe(true);
        expect(person.bag).toBe('none');
        expect(['none', 'cap']).toContain(person.hat);
      }
      expect(athletes.some(({ age }) => age >= 60)).toBe(true);
    }
    for (let index = 1; index <= 15; index++) expect(createPersonProfile(`city-cyclist-${index}`, 'cyclist').hat).toBe('cycle-helmet');
  });

  it('makes desired commuter pace faster on average without removing individual variation', () => {
    const average = (purpose: 'commute' | 'tour') => {
      const group = street.filter((person) => person.purpose === purpose);
      return group.reduce((sum, person) => sum + person.pace, 0) / group.length;
    };
    expect(average('commute') - average('tour')).toBeGreaterThan(0.3);
    expect(new Set(street.map(({ pace }) => pace)).size).toBe(200);
    for (const person of street) expect(person.pace).toBeGreaterThanOrEqual(0.86);
    for (const person of street) expect(person.pace).toBeLessThanOrEqual(1.56);
  });

  it('reproduces immutable identities without wall clocks or ambient random input', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Random'); });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Clock'); });
    try {
      for (const person of people) {
        expect(Object.isFrozen(person)).toBe(true);
        expect(createPersonProfile(person.id, person.context)).toEqual(person);
      }
      expect(() => createPersonProfile(' ', 'park')).toThrow('stable nonempty ID');
    } finally { random.mockRestore(); now.mockRestore(); }
  });
});
