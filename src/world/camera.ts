import { CAMERA_ANCHORS, CAMERA_PROJECTION, CITY } from '../content/city';
import type { CameraMode, CameraPose, WorldCommand } from './types';

export const OVERVIEW: Readonly<CameraPose> = CAMERA_ANCHORS[0].pose;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface TourView {
  pose: CameraPose;
  subject: string;
}

export class CameraController {
  readonly pose: CameraPose = { ...OVERVIEW };
  mode: CameraMode = 'overview';
  private transition: { from: CameraPose; to: CameraPose; elapsed: number } | null = null;
  private tour: { views: readonly TourView[]; index: number; elapsed: number; from: CameraPose } | null = null;
  revision = 0;

  get tourStatus() {
    return this.tour ? {
      guided: false,
      index: this.tour.index,
      total: this.tour.views.length,
      subject: this.tour.views[this.tour.index].subject,
    } : null;
  }

  private bound(): void {
    this.pose.x = clamp(this.pose.x, -CITY.bounds.x, CITY.bounds.x);
    this.pose.z = clamp(this.pose.z, -CITY.bounds.z, CITY.bounds.z);
    this.pose.zoom = clamp(this.pose.zoom, 0.65, CAMERA_PROJECTION.maxZoom);
    this.pose.pitch = clamp(this.pose.pitch, CAMERA_PROJECTION.minPitch, CAMERA_PROJECTION.maxPitch);
    this.pose.yaw = Math.atan2(Math.sin(this.pose.yaw), Math.cos(this.pose.yaw));
  }

  stop(): void {
    this.transition = null;
    this.tour = null;
    this.mode = 'free';
  }

  navigate(command: Extract<WorldCommand, { type: 'navigate' }>): void {
    this.stop();
    const { panX = 0, panZ = 0, rotate = 0, tilt = 0, zoom = 0 } = command;
    if (![panX, panZ, rotate, tilt, zoom].every(Number.isFinite)) throw new Error('Camera input must be finite.');
    const { yaw } = this.pose;
    this.pose.x += Math.cos(yaw) * panX + Math.sin(yaw) * panZ;
    this.pose.z += -Math.sin(yaw) * panX + Math.cos(yaw) * panZ;
    this.pose.yaw += rotate;
    this.pose.pitch += tilt;
    this.pose.zoom *= Math.exp(clamp(zoom, -1, 1));
    this.bound();
  }

  frame(mode: 'overview' | 'guided', target: CameraPose, immediate: boolean): void {
    this.stop();
    if (!Object.values(target).every(Number.isFinite)) throw new Error('Camera anchor must be finite.');
    this.transition = immediate ? null : { from: { ...this.pose }, to: { ...target }, elapsed: 0 };
    this.mode = mode;
    if (immediate) Object.assign(this.pose, target);
    this.bound();
  }

  startTour(views: readonly TourView[]): void {
    this.stop();
    if (!views.length || views.some(({ pose }) => !Object.values(pose).every(Number.isFinite))) {
      throw new Error('Tour requires valid camera anchors.');
    }
    this.tour = {
      views: views.map(({ pose, subject }) => ({ pose: { ...pose }, subject })),
      index: 0, elapsed: 0, from: { ...this.pose },
    };
    this.mode = 'tour';
  }

  private interpolate(from: CameraPose, to: CameraPose, t: number): void {
    const yawDelta = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
    this.pose.x = from.x + (to.x - from.x) * t;
    this.pose.z = from.z + (to.z - from.z) * t;
    this.pose.zoom = from.zoom + (to.zoom - from.zoom) * t;
    this.pose.yaw = from.yaw + yawDelta * t;
    this.pose.pitch = from.pitch + (to.pitch - from.pitch) * t;
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Camera delta must be finite and nonnegative.');
    dt = Math.min(dt, 1 / 30);
    if (this.tour) {
      const tour = this.tour;
      const duration = 12 + ((2401 + tour.index * 31) % 9);
      const destination = tour.views[tour.index].pose;
      const travel = Math.max(duration - 5, Math.hypot(destination.x - tour.from.x, destination.z - tour.from.z) / 3.6);
      tour.elapsed += dt;
      const t = Math.min(tour.elapsed / travel, 1);
      this.interpolate(tour.from, tour.views[tour.index].pose, t * t * (3 - 2 * t));
      if (tour.elapsed >= travel + 5) {
        tour.index = (tour.index + 1) % tour.views.length;
        tour.elapsed = 0;
        tour.from = { ...this.pose };
        this.revision++;
      }
    }
    if (this.transition) {
      this.transition.elapsed = Math.min(this.transition.elapsed + dt, 0.75);
      const t = 1 - Math.pow(1 - this.transition.elapsed / 0.75, 3);
      const { from, to } = this.transition;
      this.interpolate(from, to, t);
      if (this.transition.elapsed >= 0.75) this.transition = null;
    }
    this.bound();
  }
}
