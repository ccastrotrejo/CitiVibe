import { WEATHER_EXTENT } from './weatherPhysics';

export const SURFACE_RESOLUTION = Math.ceil(WEATHER_EXTENT * 2 / 0.5);

/** Static 0.5 m top-envelope collision/exposure grid. No GPU readbacks or per-drop raycasts. */
export class WeatherSurface {
  readonly heights = new Float32Array(SURFACE_RESOLUTION ** 2).fill(-0.96);
  readonly retention = new Float32Array(SURFACE_RESOLUTION ** 2);
  readonly cellSize = WEATHER_EXTENT * 2 / SURFACE_RESOLUTION;

  heightAt = (x: number, z: number): number => {
    const column = Math.floor((x + WEATHER_EXTENT) / this.cellSize);
    const row = Math.floor((z + WEATHER_EXTENT) / this.cellSize);
    if (column < 0 || column >= SURFACE_RESOLUTION || row < 0 || row >= SURFACE_RESOLUTION) return -0.96;
    return this.heights[row * SURFACE_RESOLUTION + column];
  };

  snowRetentionAt = (x: number, z: number): number => {
    const column = Math.floor((x + WEATHER_EXTENT) / this.cellSize);
    const row = Math.floor((z + WEATHER_EXTENT) / this.cellSize);
    if (column < 0 || column >= SURFACE_RESOLUTION || row < 0 || row >= SURFACE_RESOLUTION) return 0;
    return this.retention[row * SURFACE_RESOLUTION + column];
  };

  /** Rasterize a world-space triangle at cell centers, retaining its highest intersection. */
  triangle(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, retention = 1): void {
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-8) return;
    const cell = (value: number) => Math.max(0, Math.min(SURFACE_RESOLUTION - 1, Math.floor((value + WEATHER_EXTENT) / this.cellSize)));
    const minX = cell(Math.min(ax, bx, cx));
    const maxX = cell(Math.max(ax, bx, cx));
    const minZ = cell(Math.min(az, bz, cz));
    const maxZ = cell(Math.max(az, bz, cz));
    for (let row = minZ; row <= maxZ; row++) {
      const z = (row + 0.5) * this.cellSize - WEATHER_EXTENT;
      for (let column = minX; column <= maxX; column++) {
        const x = (column + 0.5) * this.cellSize - WEATHER_EXTENT;
        const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
        const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
        const c = 1 - a - b;
        if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
        const index = row * SURFACE_RESOLUTION + column;
        const height = a * ay + b * by + c * cy;
        if (height < this.heights[index]) continue;
        this.heights[index] = height;
        this.retention[index] = retention;
      }
    }
  }
}
