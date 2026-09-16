// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createWeatherTraits } from '../content/people';
import type { ActorState } from './actors';
import { PeopleWeather, type PeopleWeatherInput } from './peopleWeather';

const sunny: PeopleWeatherInput = {
  frame: { rain: 0, rainIntensityMmH: 8, snow: 0, temperatureC: 22, windSpeed: 1.2, wetness: 0 },
  snowCover: 0, sunny: true,
};
const rain: PeopleWeatherInput = {
  frame: { ...sunny.frame, rain: 1, temperatureC: 10, windSpeed: 3.5, wetness: 0.4 },
  snowCover: 0, sunny: false,
};
const snow: PeopleWeatherInput = {
  frame: { ...sunny.frame, snow: 1, temperatureC: -4, wetness: 0.5 },
  snowCover: 0.8, sunny: false,
};
function fixture() {
  const actors: ActorState[] = Array.from({ length: 80 }, (_, index) => ({
    id: `weather-person-${index}`, kind: 'pedestrian', position: { x: 0, y: 0, z: 0 },
    heading: 0, state: 'moving', distance: 0, speed: 1, routeLength: 100,
  }));
  return { actors, weather: new PeopleWeather(actors) };
}
function advance(weather: PeopleWeather, input: PeopleWeatherInput, seconds: number) {
  for (let tick = 0; tick < seconds * 30; tick++) weather.step(1 / 30, input);
}

describe('retained personal weather responses', () => {
  it('staggers reactions, retains seeded equipment and never uses a per-frame draw', () => {
    const { actors, weather } = fixture();
    expect(actors.every((actor) => actor.weather?.equipment === 'dry')).toBe(true);
    advance(weather, rain, 2);
    const changed = actors.filter((actor) => actor.weather?.equipment !== 'dry').length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(actors.length);
    advance(weather, rain, 5);
    expect(new Set(actors.map((actor) => actor.weather?.equipment))).toEqual(new Set(['umbrella', 'raincoat']));
    for (const actor of actors) expect(actor.weather?.equipment).toBe(createWeatherTraits(actor.id).rainProtection);
    const second = fixture();
    advance(second.weather, rain, 7);
    expect(second.actors).toEqual(actors);
  });

  it('responds to actual precipitation, including zero rain intensity and blended snow', () => {
    const { actors, weather } = fixture();
    advance(weather, { ...rain, frame: { ...rain.frame, rainIntensityMmH: 0 } }, 10);
    expect(weather.adverse).toBe(false);
    expect(actors.every((actor) => actor.weather?.equipment === 'dry')).toBe(true);
    advance(weather, { ...snow, frame: { ...snow.frame, snow: 0.12, temperatureC: 9 } }, 6);
    expect(weather.adverse).toBe(true);
    expect(actors.every((actor) => actor.weather?.equipment === 'winter')).toBe(true);
  });

  it('uses coats in snow, keeps them while cold and suppresses hurry on snow-covered ground', () => {
    const { actors, weather } = fixture();
    advance(weather, rain, 8);
    expect(actors.some((actor) => actor.weather!.pace > 1)).toBe(true);
    advance(weather, snow, 8);
    for (const actor of actors) {
      expect(actor.weather!.equipment).toBe('winter');
      expect(actor.weather!.umbrellaOpen).toBe(0);
      expect(actor.weather!.pace).toBeLessThan(0.9);
      expect(actor.weather!.cautious).toBe(true);
    }
    advance(weather, { ...sunny, frame: { ...sunny.frame, temperatureC: -2 }, snowCover: 0.8 }, 60);
    expect(actors.every((actor) => actor.weather?.equipment === 'winter')).toBe(true);
    expect(weather.returnAllowed).toBe(false);
    advance(weather, sunny, 100);
    expect(actors.every((actor) => actor.weather?.equipment === 'dry')).toBe(true);
    expect(weather.returnAllowed).toBe(true);
  });

  it('replaces umbrellas with hoods in strong wind without threshold chatter', () => {
    const { actors, weather } = fixture();
    advance(weather, rain, 6);
    advance(weather, { ...rain, frame: { ...rain.frame, windSpeed: 8 } }, 6);
    expect(actors.every((actor) => actor.weather?.equipment === 'raincoat')).toBe(true);
    advance(weather, { ...rain, frame: { ...rain.frame, windSpeed: 6 } }, 10);
    expect(actors.every((actor) => actor.weather?.equipment === 'raincoat')).toBe(true);
    advance(weather, rain, 10);
    expect(actors.some((actor) => actor.weather?.equipment === 'umbrella')).toBe(true);
  });

  it('keeps a short sunny interruption from recalling visitors or stowing equipment', () => {
    const { actors, weather } = fixture();
    advance(weather, rain, 8);
    for (let episode = 0; episode < 20; episode++) {
      advance(weather, sunny, 0.5);
      advance(weather, rain, 0.5);
    }
    expect(weather.returnAllowed).toBe(false);
    expect(actors.every((actor) => actor.weather?.equipment !== 'dry')).toBe(true);
    advance(weather, sunny, 25);
    expect(weather.returnAllowed).toBe(false);
    advance(weather, sunny, 70);
    expect(weather.returnAllowed).toBe(true);
  });

  it('applies explicit static clothing without advancing time or departure eligibility', () => {
    const { actors, weather } = fixture();
    const references = actors.map((actor) => actor.weather);
    weather.applyImmediate(snow);
    expect(actors.every((actor) => actor.weather?.equipment === 'winter')).toBe(true);
    expect(weather.returnAllowed).toBe(false);
    const before = JSON.stringify(weather);
    weather.step(0, rain);
    expect(JSON.stringify(weather)).toBe(before);
    weather.applyImmediate(sunny);
    expect(actors.every((actor) => actor.weather?.equipment === 'dry')).toBe(true);
    expect(actors.map((actor) => actor.weather)).toEqual(references);
  });
});
