import * as THREE from 'three';

export type WindowUse = 'civic' | 'office' | 'residential' | 'storefront' | 'hospital' | 'station';

export const WINDOW_USE = { civic: 0, office: 1, residential: 2, storefront: 3, hospital: 4, station: 5 } as const;
const clocks = new WeakMap<THREE.MeshStandardMaterial, THREE.Uniform<number>>();

function smooth(a: number, b: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Authored daily occupancy, not a measured NYC schedule. Seed belongs to a building/floor. */
export function windowActivity(use: WindowUse, phase: number, offset: number, floor: number): number {
  if (![phase, offset, floor].every(Number.isFinite)) throw new RangeError('Window time and cohorts must be finite.');
  const hour = ((phase * 24 + offset) % 24 + 24) % 24;
  let active = 1;
  if (use === 'office') {
    active = smooth(6.5, 8, hour) * (1 - smooth(17.5, 20, hour));
    if (floor < 0.08) active = Math.max(active, 0.28);
  } else if (use === 'residential') {
    active = Math.max(smooth(5.5, 7, hour) * (1 - smooth(9, 10.5, hour)),
      smooth(17, 19, hour), 1 - smooth(0, 1.5, hour));
  } else if (use === 'storefront') {
    active = smooth(7, 9, hour) * (1 - smooth(21, 23, hour));
  } else if (use === 'hospital') {
    active = floor < 0.3 ? 0.7 : 0.4;
  } else if (use === 'station') {
    active = 0.22 + 0.7 * smooth(6.5, 8, hour) * (1 - smooth(19, 22, hour));
  }
  return 0.06 + 0.94 * active;
}

/** One shared program per glazing batch; only a retained-time uniform changes on draws. */
export function createWindowLightingMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const material = source.clone();
  const phase = new THREE.Uniform(15 / 24);
  clocks.set(material, phase);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windowPhase = phase;
    shader.vertexShader = `attribute vec3 windowGlow;
attribute vec3 windowSchedule;
varying vec3 vWindowGlow;
varying vec3 vWindowSchedule;
${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvWindowGlow = windowGlow;\nvWindowSchedule = windowSchedule;');
    shader.fragmentShader = `uniform float windowPhase;
varying vec3 vWindowGlow;
varying vec3 vWindowSchedule;
float windowActivity() {
  float hour = mod(windowPhase * 24.0 + vWindowSchedule.y + 24.0, 24.0);
  float litAmount = 1.0;
  if (vWindowSchedule.x > 0.5 && vWindowSchedule.x < 1.5) {
    litAmount = smoothstep(6.5, 8.0, hour) * (1.0 - smoothstep(17.5, 20.0, hour));
    if (vWindowSchedule.z < 0.08) litAmount = max(litAmount, 0.28);
  } else if (vWindowSchedule.x > 1.5 && vWindowSchedule.x < 2.5) {
    litAmount = max(max(smoothstep(5.5, 7.0, hour) * (1.0 - smoothstep(9.0, 10.5, hour)),
      smoothstep(17.0, 19.0, hour)), 1.0 - smoothstep(0.0, 1.5, hour));
  } else if (vWindowSchedule.x > 2.5 && vWindowSchedule.x < 3.5) {
    litAmount = smoothstep(7.0, 9.0, hour) * (1.0 - smoothstep(21.0, 23.0, hour));
  } else if (vWindowSchedule.x > 3.5 && vWindowSchedule.x < 4.5) {
    litAmount = vWindowSchedule.z < 0.3 ? 0.7 : 0.4;
  } else if (vWindowSchedule.x > 4.5) {
    litAmount = 0.22 + 0.7 * smoothstep(6.5, 8.0, hour) * (1.0 - smoothstep(19.0, 22.0, hour));
  }
  return 0.06 + 0.94 * litAmount;
}
${shader.fragmentShader}`.replace('vec3 totalEmissiveRadiance = emissive;',
      'vec3 totalEmissiveRadiance = vWindowGlow * length(emissive) * windowActivity();');
  };
  material.customProgramCacheKey = () => 'rainlight-window-schedules-v1';
  return material;
}

/** Undefined means this is ordinary glazing, not a scheduled city-window material. */
export function getWindowPhase(material: THREE.MeshStandardMaterial): number | undefined {
  return clocks.get(material)?.value;
}

/** Project the environment's retained day phase without owning another clock. */
export function setWindowPhase(material: THREE.MeshStandardMaterial, phase: number): void {
  if (!Number.isFinite(phase)) throw new RangeError('Window phase must be finite.');
  const clock = clocks.get(material);
  if (clock) clock.value = phase;
}
