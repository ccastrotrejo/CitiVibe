import type { EnvironmentFrame } from './environment';
import { createWeatherTraits } from '../content/people';
import type { ActorState } from './actors';

export type WeatherEquipment = 'dry' | 'umbrella' | 'raincoat' | 'winter';

export interface PersonWeatherState {
  equipment: WeatherEquipment;
  umbrellaOpen: number;
  pace: number;
  cautious: boolean;
}

export interface PeopleWeatherInput {
  frame: Pick<EnvironmentFrame, 'rain' | 'rainIntensityMmH' | 'snow' | 'temperatureC' | 'windSpeed' | 'wetness'>;
  snowCover: number;
  sunny: boolean;
}

interface WeatherPerson {
  actor: ActorState;
  traits: ReturnType<typeof createWeatherTraits>;
  state: PersonWeatherState;
  pending: WeatherEquipment;
  pendingSeconds: number;
}

/** Simulation-owned equipment and comfort, independent of road-routing randomness and rendering. */
export class PeopleWeather {
  adverse = false;
  returnAllowed = true;
  private drySeconds = 90;
  private sunnySeconds = 90;
  private seatWetness = 0;
  private strongWind = false;
  private calmSeconds = 0;
  private readonly people: WeatherPerson[];

  constructor(actors: readonly ActorState[]) {
    this.people = actors.filter((actor) => actor.kind === 'pedestrian').map((actor) => {
      const state: PersonWeatherState = { equipment: 'dry', umbrellaOpen: 0, pace: 1, cautious: false };
      actor.weather = state;
      return { actor, state, traits: createWeatherTraits(actor.id), pending: 'dry', pendingSeconds: 0 };
    });
  }

  private conditions(input: PeopleWeatherInput, dt: number): void {
    const { frame, snowCover } = input;
    const rainRate = frame.rain * frame.rainIntensityMmH;
    this.adverse = rainRate > (this.adverse ? 0.08 : 0.2) || frame.snow > (this.adverse ? 0.02 : 0.08);
    if (frame.windSpeed >= 7) {
      this.strongWind = true;
      this.calmSeconds = 0;
    } else {
      this.calmSeconds = frame.windSpeed < 5.5 ? this.calmSeconds + dt : 0;
      if (this.calmSeconds >= 5) this.strongWind = false;
    }
    if (this.adverse) {
      this.drySeconds = 0;
      this.seatWetness = 1;
    } else {
      this.drySeconds = Math.min(90, this.drySeconds + dt);
      if (frame.temperatureC > 8 && snowCover < 0.08) this.seatWetness = Math.max(0, this.seatWetness - dt / 60);
    }
    this.sunnySeconds = input.sunny && !this.adverse ? Math.min(90, this.sunnySeconds + dt) : 0;
    this.returnAllowed = !this.adverse && this.sunnySeconds >= 20 && this.seatWetness < 0.15 &&
      frame.temperatureC > 8 && snowCover < 0.08;
  }

  private equipment(person: WeatherPerson, input: PeopleWeatherInput): WeatherEquipment {
    const { frame } = input;
    const cold = frame.temperatureC < person.traits.coldThreshold +
      (person.state.equipment === 'winter' ? 3 : 0);
    if (frame.snow > 0.08 || cold) return 'winter';
    if (this.adverse) return this.strongWind || person.actor.gait === 'run' ? 'raincoat' : person.traits.rainProtection;
    return 'dry';
  }

  /** Explicit paused choices change attire, never route progress, posture or transition clocks. */
  applyImmediate(input: PeopleWeatherInput): void {
    this.conditions(input, 0);
    for (const person of this.people) {
      person.state.equipment = this.equipment(person, input);
      person.state.umbrellaOpen = person.state.equipment === 'umbrella' ? 1 : 0;
      person.pending = person.state.equipment;
      person.pendingSeconds = 0;
      person.state.cautious = input.snowCover > 0.08 || input.frame.snow > 0.08;
    }
  }

  step(dt: number, input: PeopleWeatherInput): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('People weather delta must be finite and nonnegative.');
    if (dt === 0) return;
    dt = Math.min(dt, 1 / 30);
    this.conditions(input, dt);
    const { frame, snowCover } = input;
    for (const person of this.people) {
      const { state, traits } = person;
      const target = this.equipment(person, input);
      if (person.pending !== target) {
        person.pending = target;
        person.pendingSeconds = 0;
      }
      person.pendingSeconds += dt;
      const delay = target === 'dry' ? 8 + traits.reactionSeconds : traits.reactionSeconds;
      if (person.pendingSeconds >= delay && (target !== 'dry' || this.drySeconds >= delay)) state.equipment = target;
      const open = state.equipment === 'umbrella' ? 1 : 0;
      state.umbrellaOpen += Math.sign(open - state.umbrellaOpen) * Math.min(Math.abs(open - state.umbrellaOpen), dt / 0.6);
      state.cautious = snowCover > 0.08 || frame.snow > 0.08;
      const running = person.actor.gait === 'run';
      const hurry = this.adverse && !state.cautious && !running ? traits.hurry * 0.12 : 0;
      const desired = state.cautious ? Math.min(0.94, 1 - snowCover * (running ? 0.4 : 0.28)) :
        1 + hurry - frame.wetness * 0.05 - (running && this.adverse ? 0.1 : 0);
      state.pace += (desired - state.pace) * -Math.expm1(-dt / 0.8);
    }
  }
}
