// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LOADING_STOP } from '../content/transitService';
import { EnvironmentController } from './environment';
import { CityTraffic, TRAFFIC, TRAFFIC_ROUTES } from './traffic';
import { drivingLightLevel, indicatorLevel, sampleVehicleLights, VEHICLE_LIGHTING, vehicleIndicatorPhase } from './vehicleLighting';

const DATE = new Date(2026, 8, 13, 15);
const DT = 1 / 30;

describe('retained vehicle lighting', () => {
  it('enables forward/rear visibility at night and in rain, mist and snow, not clear daylight', () => {
    const environment = new EnvironmentController();
    expect(drivingLightLevel(environment.frame)).toBe(0);
    environment.setTime('night', DATE);
    expect(drivingLightLevel(environment.frame)).toBe(1);
    environment.setTime('afternoon', DATE);
    for (const weather of ['rain', 'mist', 'snow'] as const) {
      environment.setWeather(weather, true);
      expect(drivingLightLevel(environment.frame)).toBe(1);
    }
    environment.setWeather('rain', true);
    environment.setRainIntensity(0);
    expect(drivingLightLevel(environment.frame)).toBeLessThan(0.1);
    environment.setRainIntensity(1.5);
    expect(drivingLightLevel(environment.frame)).toBe(0.5);
  });

  it('samples 75 soft-edged flashes per minute and holds indicators steady under reduced motion', () => {
    expect(60 / VEHICLE_LIGHTING.period).toBe(75);
    expect(indicatorLevel(0.1, false)).toBe(1);
    expect(indicatorLevel(0.6, false)).toBe(0);
    expect(indicatorLevel(0.01, false)).toBeGreaterThan(0);
    expect(indicatorLevel(0.01, false)).toBeLessThan(1);
    for (let index = 0; index < 75; index++) {
      expect(indicatorLevel(index * 0.8 + 0.2, false)).toBe(1);
      expect(indicatorLevel(index * 0.8 + 0.6, false)).toBe(0);
      expect(indicatorLevel(index * 0.8 + 0.6, true)).toBe(1);
    }
  });

  it('keeps brake intensity independent of daylight, with only the requested indicator active', () => {
    const environment = new EnvironmentController();
    const actor = new CityTraffic().actors[0];
    const sample = { head: 0, tail: 0, brake: 0, left: 0, right: 0 };
    const phase = vehicleIndicatorPhase(actor.id);
    actor.lighting = { braking: true, turn: 'left' };
    sampleVehicleLights(actor, environment.frame, 0.2 - phase, false, sample);
    expect(sample).toEqual({ head: 0, tail: 0, brake: 1, left: 1, right: 0 });
    environment.setTime('night', DATE);
    sampleVehicleLights(actor, environment.frame, 0.6 - phase, false, sample);
    expect(sample).toEqual({ head: 1, tail: 0.3, brake: 1, left: 0, right: 0 });
    sampleVehicleLights(actor, environment.frame, 0.6, true, sample);
    expect(sample.left).toBe(1);
    expect(sample.right).toBe(0);
  });

  it('gives vehicles reproducible, distinct oscillator phases without allocating timers', () => {
    const ids = new CityTraffic().actors.filter(({ lighting }) => lighting).map(({ id }) => id);
    const phases = ids.map(vehicleIndicatorPhase);
    expect(new Set(phases).size).toBe(ids.length);
    expect(ids.map(vehicleIndicatorPhase)).toEqual(phases);
    phases.forEach((phase) => { expect(phase).toBeGreaterThanOrEqual(0); expect(phase).toBeLessThan(0.8); });
  });

  it('signals the next real turn before arrival, holds through queues/turns, and cancels on exit', () => {
    const traffic = new CityTraffic();
    const motors = traffic.actors.filter(({ lighting }) => lighting);
    const seen = new Set<string>();
    for (let tick = 0; tick < 9000; tick++) {
      const previous = motors.map(({ speed }) => speed);
      traffic.step(DT);
      motors.forEach((actor, index) => {
        const route = TRAFFIC_ROUTES[index % 6];
        let segmentIndex = 0;
        while (segmentIndex < route.segments.length - 1 && route.segments[segmentIndex + 1].start <= actor.distance) segmentIndex++;
        const segment = route.segments[segmentIndex];
        const turn = segment.kind === 'junction' ? segment : route.segments[(segmentIndex + 1) % route.segments.length];
        const approaching = segment.kind === 'junction' ||
          segment.start + segment.length - actor.distance <= TRAFFIC.indicatorApproach;
        const service = traffic.services.find(({ actorId }) => actorId === actor.id);
        const loadingManeuver = service?.id === LOADING_STOP.id && service.phase !== 'circulating';
        const expectedTurn = loadingManeuver
          ? service.phase === 'approaching' ? 'right' : service.phase === 'departing' ? 'left' : null
          : approaching && turn.turn ? turn.turn > 0 ? 'right' : 'left' : null;
        expect(actor.lighting!.turn).toBe(expectedTurn);
        if (actor.lighting!.turn) {
          seen.add(actor.lighting!.turn);
          seen.add(segment.kind);
          if (actor.state === 'waiting') seen.add('queued');
        } else if (segment.kind === 'junction') seen.add('straight');
        const serviceBrakeHold = service !== undefined && actor.state === 'dwelling';
        if (serviceBrakeHold) {
          expect(actor.speed).toBe(0);
          expect(['dwelling', 'departing']).toContain(service.phase);
        }
        expect(actor.lighting!.braking).toBe(previous[index] - actor.speed > 0.2 * DT ||
          actor.state === 'waiting' || serviceBrakeHold);
      });
    }
    expect(seen).toEqual(new Set(['left', 'right', 'link', 'junction', 'queued', 'straight']));
    const paused = structuredClone(traffic.actors);
    for (let tick = 0; tick < 30; tick++) traffic.step(0);
    expect(traffic.actors).toEqual(paused);
    // Posted-stop dwells lengthen the simulated run needed to observe every indicator case.
  }, 20_000);

  it('holds real service-stop brakes, signals the loading maneuver, and releases after departure', () => {
    const traffic = new CityTraffic();
    const environment = new EnvironmentController();
    const sample = { head: 0, tail: 0, brake: 0, left: 0, right: 0 };
    const seen = new Map(traffic.services.map((service) => [service.id, new Set<string>()]));
    const motors = new Map(traffic.actors.filter(({ lighting }) => lighting).map((actor) => [actor.id, actor]));
    for (let tick = 0; tick < 900 / DT; tick++) {
      traffic.step(DT);
      for (const service of traffic.services) {
        const actor = motors.get(service.actorId)!;
        const phases = seen.get(service.id)!;
        phases.add(service.phase);
        // Reduced motion makes indicator assertions independent of each retained oscillator phase.
        sampleVehicleLights(actor, environment.frame, traffic.elapsed, true, sample);
        if (actor.state === 'dwelling') {
          expect(actor.speed).toBe(0);
          expect(actor.lighting!.braking).toBe(true);
          expect(sample.brake).toBe(1);
          // The van announces its departure while its final stationary brake tick is still held.
          expect(sample.left).toBe(service.id === LOADING_STOP.id && service.phase === 'departing' ? 1 : 0);
          expect(sample.right).toBe(0);
          if (!phases.has('paused-dwell')) {
            const held = structuredClone({ actor, service, sample });
            for (let pause = 0; pause < 30; pause++) traffic.step(0);
            sampleVehicleLights(actor, environment.frame, traffic.elapsed, true, sample);
            expect({ actor, service, sample }).toEqual(held);
            phases.add('paused-dwell');
          }
        } else if (service.id === LOADING_STOP.id && service.phase === 'approaching') {
          expect(sample.right).toBe(1);
          expect(sample.left).toBe(0);
        } else if (service.id === LOADING_STOP.id && service.phase === 'departing') {
          expect(sample.left).toBe(1);
          expect(sample.right).toBe(0);
        }
        if (service.completedCycles > 0 && actor.speed > 0 && !actor.lighting!.braking) {
          expect(sample.brake).toBe(0);
          phases.add('released-brakes');
        }
      }
      if ([...seen.values()].every((phases) => phases.has('released-brakes'))) break;
    }
    for (const phases of seen.values()) {
      expect(phases).toEqual(new Set([
        'circulating', 'approaching', 'dwelling', 'departing', 'paused-dwell', 'released-brakes',
      ]));
    }
  }, 20_000);
});
