import { MAINTENANCE_STRIPS } from '../content/civicUtilities';

/** Ground-only scenic maintenance, matching the CPU capture instead of clearing roofs above the same XZ. */
export function civicSnowRetentionAt(x: number, y: number, z: number, retention: number): number {
  for (const strip of MAINTENANCE_STRIPS) {
    if (x >= strip.minX && x <= strip.maxX && z >= strip.minZ && z <= strip.maxZ &&
      Math.abs(y - strip.surfaceY) <= 0.045) retention = Math.min(retention, strip.snowRetention);
  }
  return retention;
}

/** Shared by snow color and volume projection. No new uniforms, texture, material, or clock. */
export const CIVIC_MAINTENANCE_GLSL = `
float civicSnowRetention(vec3 point, float retention) {
  ${MAINTENANCE_STRIPS.map((strip) => `
  if (point.x >= ${strip.minX.toFixed(4)} && point.x <= ${strip.maxX.toFixed(4)} &&
      point.z >= ${strip.minZ.toFixed(4)} && point.z <= ${strip.maxZ.toFixed(4)} &&
      abs(point.y - ${strip.surfaceY.toFixed(4)}) <= 0.045) {
    retention = min(retention, ${strip.snowRetention.toFixed(4)});
  }`).join('')}
  return retention;
}
`;
