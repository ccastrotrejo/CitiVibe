export const STEP = 1 / 30;
const MAX_STEPS = 3;

/** Discards hidden/paused wall time and caps work after a slow frame. */
export class FrameClock {
  private previous: number | null = null;
  private accumulator = 0;

  reset(): void {
    this.previous = null;
    this.accumulator = 0;
  }

  advance(now: number, tick: (dt: number) => void): void {
    if (!Number.isFinite(now)) throw new Error('Frame timestamp must be finite.');
    if (this.previous === null) {
      this.previous = now;
      return;
    }
    this.accumulator += Math.min(Math.max((now - this.previous) / 1000, 0), STEP * MAX_STEPS);
    this.previous = now;
    let steps = 0;
    while (this.accumulator + 1e-9 >= STEP && steps < MAX_STEPS) {
      tick(STEP);
      this.accumulator -= STEP;
      steps += 1;
    }
  }
}
