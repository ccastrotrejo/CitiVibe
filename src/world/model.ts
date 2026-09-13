import { CAMERA_ANCHORS } from '../content/city';
import { ActorSimulation } from './actors';
import { AirplaneSimulation } from './airplane';
import { CameraController, OVERVIEW } from './camera';
import { EnvironmentController } from './environment';
import type { Weather, TimeMode } from './environment';
import type { QualityMode } from '../content/preferences';
import type { TourView } from './camera';
import type { WorldCommand, WorldStatus } from './types';

export interface WorldOptions {
  weather?: Weather;
  rainIntensityMmH?: number;
  timeMode?: TimeMode;
  natural?: boolean;
  quality?: QualityMode;
}

/** Human-readable time-of-day drawn from the environment phase, for badges and status. */
function daylightLabel(phase: number, night: number): string {
  if (night > 0.5) return 'Night';
  const hour = phase * 24;
  if (hour < 11) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export class WorldModel {
  readonly camera = new CameraController();
  readonly simulation = new ActorSimulation();
  readonly environment = new EnvironmentController();
  readonly airplane = new AirplaneSimulation();
  private readonly snowLifts = new Float64Array(this.simulation.actors.length);
  paused: boolean;
  reducedMotion: boolean;
  quality: QualityMode;
  modalOpen = false;
  private guided: { views: TourView[]; index: number } | null = null;
  private message = 'Welcome to Rainlight Square.';

  constructor(reducedMotion: boolean, options: WorldOptions = {}) {
    this.paused = reducedMotion;
    this.reducedMotion = reducedMotion;
    this.quality = options.quality ?? 'automatic';
    const now = new Date();
    if (options.weather) this.environment.setWeather(options.weather, true);
    if (options.rainIntensityMmH !== undefined) this.environment.setRainIntensity(options.rainIntensityMmH);
    if (options.timeMode) this.environment.setTime(options.timeMode, now);
    if (options.natural) this.environment.setNatural(true);
    if (reducedMotion) {
      this.airplane.setReducedMotion(true);
      this.message = 'Reduced motion: city starts paused. Explore at your own pace.';
    }
  }

  snapshot(): WorldStatus {
    return {
      cameraMode: this.camera.mode,
      paused: this.paused,
      reducedMotion: this.reducedMotion,
      view: this.guided ? {
        guided: true, index: this.guided.index, total: this.guided.views.length,
        subject: this.guided.views[this.guided.index].subject,
      } : this.camera.tourStatus,
      message: this.message,
      weather: this.environment.weather,
      rainIntensityMmH: this.environment.rainIntensityMmH,
      timeMode: this.environment.timeMode,
      natural: this.environment.natural,
      quality: this.quality,
      daylight: daylightLabel(this.environment.frame.phase, this.environment.frame.night),
    };
  }

  command(command: WorldCommand): void {
    const immediate = this.paused || this.reducedMotion;
    if (['navigate', 'reset', 'stop', 'open-panel', 'set-reduced-motion'].includes(command.type)) this.guided = null;
    switch (command.type) {
      case 'navigate':
        if (this.modalOpen) return;
        this.camera.navigate(command);
        this.message = 'Free view.';
        break;
      case 'reset':
        this.camera.frame('overview', { ...OVERVIEW }, immediate);
        this.message = 'Overview of Rainlight Square.';
        break;
      case 'stop':
        this.camera.stop();
        this.message = 'Automatic view stopped.';
        break;
      case 'set-paused':
        if (this.paused && !command.paused) this.environment.resyncLocal(new Date());
        this.paused = command.paused;
        this.message = this.paused ? 'City paused. You can still explore.' : 'City resumed.';
        break;
      case 'set-reduced-motion':
        this.reducedMotion = command.reduced;
        this.airplane.setReducedMotion(command.reduced);
        if (command.reduced) {
          this.paused = true;
          this.camera.stop();
          this.message = 'Reduced motion enabled. City paused.';
        } else this.message = 'Full motion available. Resume when ready.';
        break;
      case 'set-weather':
        this.environment.setWeather(command.weather, this.paused || this.reducedMotion);
        this.message = `Weather set to ${command.weather}.`;
        break;
      case 'set-rain-intensity':
        this.environment.setRainIntensity(command.millimetersPerHour);
        this.message = `Rain intensity set to ${command.millimetersPerHour} millimeters per hour.`;
        break;
      case 'set-time':
        this.environment.setTime(command.time, new Date());
        this.message = `Time set to ${command.time}.`;
        break;
      case 'set-natural':
        this.environment.setNatural(command.natural);
        this.message = command.natural ? 'Weather drifts naturally now.' : 'Weather holds steady now.';
        break;
      case 'set-quality':
        this.quality = command.quality;
        this.message = `Graphics quality set to ${command.quality}.`;
        break;
      case 'start-tour': {
        if (this.modalOpen) {
          this.message = 'Close the panel before starting a tour.';
          break;
        }
        if (this.paused && !this.reducedMotion) {
          this.message = 'Resume the city before starting a continuous tour.';
          break;
        }
        const views: TourView[] = CAMERA_ANCHORS.map(({ pose, subject }) => ({ pose: { ...pose }, subject }));
        if (!views.length) {
          this.camera.stop();
          this.message = 'No tour views are available. Use manual camera controls instead.';
          break;
        }
        if (this.reducedMotion) {
          this.guided = { views, index: 0 };
          this.camera.frame('guided', views[0].pose, true);
          this.message = `Guided view 1 of ${views.length}: ${views[0].subject}. Use Previous or Next view.`;
        } else {
          this.camera.startTour(views);
          this.message = `Tour started: ${views[0].subject}. Manual navigation stops the tour.`;
        }
        break;
      }
      case 'guided-step':
        if (!this.guided) {
          this.message = 'Start guided views before choosing a step.';
          break;
        }
        this.guided.index = (this.guided.index + command.direction + this.guided.views.length) % this.guided.views.length;
        this.camera.frame('guided', this.guided.views[this.guided.index].pose, true);
        this.message = `Guided view ${this.guided.index + 1} of ${this.guided.views.length}: ${this.guided.views[this.guided.index].subject}.`;
        break;
      case 'open-panel':
        this.modalOpen = true;
        this.camera.stop();
        break;
      case 'close-panel':
        this.modalOpen = false;
        this.message = 'Panel closed. The camera stays where you left it.';
        break;
    }
  }

  step(dt: number): void {
    if (this.paused) return;
    this.environment.step(dt, new Date(), !this.reducedMotion);
    const snowCover = this.environment.physics.snowCover;
    const traction = Math.max(0.3, 1 - this.environment.frame.wetness * 0.25 - snowCover * 0.5);
    this.simulation.step(dt, traction);
    for (let index = 0; index < this.simulation.actors.length; index++) {
      const position = this.simulation.actors[index].position;
      const support = this.environment.physics.snowSupportAt(position.x, position.z, 0);
      this.snowLifts[index] += (support - this.snowLifts[index]) * -Math.expm1(-Math.min(dt, 0.1) / 0.15);
      position.y = this.snowLifts[index];
    }
    this.airplane.step(dt);
    if (!this.modalOpen) {
      const revision = this.camera.revision;
      this.camera.step(dt);
      if (this.camera.revision !== revision) this.message = `Tour: ${this.camera.tourStatus?.subject}.`;
    }
  }

  /** Call once when the tab becomes visible again, so local time re-syncs without catch-up. */
  resync(): void {
    this.environment.resyncLocal(new Date());
  }
}
