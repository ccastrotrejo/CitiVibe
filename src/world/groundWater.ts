import type { SurfaceFlux } from './weatherPhysics';

export const GROUND_LEVEL = -0.035;
export const GROUND_PUDDLES = [
  { id: 'west-verge', x: 4, z: -3, radiusX: 0.9, radiusZ: 1.25, maxDepth: 0.085, catchmentM2: 40 },
  { id: 'terrace-verge', x: 13, z: -4, radiusX: 1.2, radiusZ: 0.8, maxDepth: 0.075, catchmentM2: 40 },
  { id: 'south-verge', x: 5, z: 6, radiusX: 1.05, radiusZ: 0.75, maxDepth: 0.08, catchmentM2: 40 },
] as const;

export interface PuddleState {
  volumeM3: number;
  depth: number;
  radiusScale: number;
}

/** Paraboloid depression: A(h) = Amax h/H and V(h) = Amax h²/(2H). */
export function updatePuddleDimensions(state: PuddleState, index: number): void {
  const { volumeM3 } = state;
  const basin = GROUND_PUDDLES[index];
  if (!basin || !Number.isFinite(volumeM3) || volumeM3 < 0) throw new RangeError('Invalid puddle volume or basin.');
  const area = Math.PI * basin.radiusX * basin.radiusZ;
  const depth = Math.min(basin.maxDepth, Math.sqrt(2 * volumeM3 * basin.maxDepth / area));
  state.depth = depth;
  state.radiusScale = Math.sqrt(depth / basin.maxDepth);
}

/** Three authored contributing areas, not a full-city flow or flood solver. All fluxes are m³. */
export class GroundWater {
  readonly states: PuddleState[] = GROUND_PUDDLES.map(() => ({ volumeM3: 0, depth: 0, radiusScale: 0 }));
  readonly flux = { runoffM3: 0, rainM3: 0, meltM3: 0, evaporationM3: 0, drainageM3: 0, overflowM3: 0 };

  step(physicalSeconds: number, surface: SurfaceFlux): void {
    const flux = this.flux;
    flux.runoffM3 = flux.rainM3 = flux.meltM3 = flux.evaporationM3 = flux.drainageM3 = flux.overflowM3 = 0;
    for (let index = 0; index < GROUND_PUDDLES.length; index++) {
      const basin = GROUND_PUDDLES[index];
      const state = this.states[index];
      const area = Math.PI * basin.radiusX * basin.radiusZ;
      const capacity = area * basin.maxDepth / 2;
      const runoff = (surface.drainageMm + surface.waterOverflowMm) * basin.catchmentM2 / 1000;
      const rain = surface.rainMm * area / 1000;
      const melt = surface.meltMm * area / 1000;
      state.volumeM3 += runoff + rain + melt;
      flux.runoffM3 += runoff;
      flux.rainM3 += rain;
      flux.meltM3 += melt;
      const wetArea = area * Math.min(1, Math.sqrt(state.volumeM3 / capacity));
      const evaporation = Math.min(state.volumeM3, surface.potentialEvaporationMm * wetArea / 1000);
      state.volumeM3 -= evaporation;
      const drainage = state.volumeM3 * -Math.expm1(-physicalSeconds / 3600);
      state.volumeM3 -= drainage;
      flux.evaporationM3 += evaporation;
      flux.drainageM3 += drainage;
      flux.overflowM3 += Math.max(0, state.volumeM3 - capacity);
      state.volumeM3 = Math.min(capacity, state.volumeM3);
      updatePuddleDimensions(state, index);
    }
  }

  heightAt(x: number, z: number): number | null {
    for (let index = 0; index < GROUND_PUDDLES.length; index++) {
      const basin = GROUND_PUDDLES[index];
      const state = this.states[index];
      if (state.depth <= 0) continue;
      const radius2 = ((x - basin.x) / basin.radiusX) ** 2 + ((z - basin.z) / basin.radiusZ) ** 2;
      if (radius2 <= state.radiusScale ** 2) return GROUND_LEVEL - basin.maxDepth + state.depth;
    }
    return null;
  }
}
