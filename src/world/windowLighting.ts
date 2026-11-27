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
  material.roughness = 0.14;
  material.metalness = 0.18;
  const phase = new THREE.Uniform(15 / 24);
  clocks.set(material, phase);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windowPhase = phase;
    shader.vertexShader = `attribute vec3 windowGlow;
attribute vec3 windowSchedule;
varying vec3 vWindowGlow;
varying vec3 vWindowSchedule;
varying vec2 vWinUv;
varying vec3 vWinWorldPos;
varying vec3 vWinCenter;
varying vec3 vWinUAxis;
varying vec3 vWinVAxis;
varying vec3 vWinNAxis;
varying vec3 vWinToCam;
vec3 winSafeNormalize(vec3 v, vec3 fallback) {
  float len = length(v);
  return len > 1e-6 ? v / len : fallback;
}
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vWindowGlow = windowGlow;
vWindowSchedule = windowSchedule;
vWinUv = uv;
mat4 winWorldMat = modelMatrix;
#ifdef USE_INSTANCING
  winWorldMat = modelMatrix * instanceMatrix;
#endif
vec4 winWorldPos4 = winWorldMat * vec4(transformed, 1.0);
vWinWorldPos = winWorldPos4.xyz;
vWinCenter = winWorldMat[3].xyz;
vec3 winLocalN = winSafeNormalize(normal, vec3(0.0, 0.0, 1.0));
vec3 winLocalV = abs(winLocalN.y) < 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, -sign(winLocalN.y));
vec3 winLocalU = winSafeNormalize(cross(winLocalV, winLocalN), vec3(1.0, 0.0, 0.0));
mat3 winBasis = mat3(winWorldMat);
vWinUAxis = winSafeNormalize(winBasis * winLocalU, vec3(1.0, 0.0, 0.0));
vWinVAxis = winSafeNormalize(winBasis * winLocalV, vec3(0.0, 1.0, 0.0));
vWinNAxis = winSafeNormalize(winBasis * winLocalN, vec3(0.0, 0.0, 1.0));
vWinToCam = isOrthographic
  ? winSafeNormalize((vec4(0.0, 0.0, 1.0, 0.0) * viewMatrix).xyz, vec3(0.0, 0.0, 1.0))
  : (cameraPosition - winWorldPos4.xyz);`,
    );
    shader.fragmentShader = `uniform float windowPhase;
varying vec3 vWindowGlow;
varying vec3 vWindowSchedule;
varying vec2 vWinUv;
varying vec3 vWinWorldPos;
varying vec3 vWinCenter;
varying vec3 vWinUAxis;
varying vec3 vWinVAxis;
varying vec3 vWinNAxis;
varying vec3 vWinToCam;
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
void evalWindowInterior(out float roomLightProfile, out vec3 dayInteriorColor, out vec3 glowWarmShift) {
  const float roomDepth = 0.65;
  vec2 p0 = clamp(vWinUv, vec2(0.001), vec2(0.999));
  vec3 worldViewDir = normalize(vWinToCam);
  vec3 inWorld = -worldViewDir;
  vec3 uAxis = normalize(vWinUAxis);
  vec3 vAxis = normalize(vWinVAxis);
  vec3 nAxis = normalize(vWinNAxis);
  vec3 ray = vec3(dot(inWorld, uAxis), dot(inWorld, vAxis), min(dot(inWorld, nAxis), -0.08));

  float tBack = -roomDepth / ray.z;
  float tx = abs(ray.x) > 1e-4 ? ((ray.x > 0.0 ? 1.0 : 0.0) - p0.x) / ray.x : 1e6;
  float ty = abs(ray.y) > 1e-4 ? ((ray.y > 0.0 ? 1.0 : 0.0) - p0.y) / ray.y : 1e6;
  float tHit = min(tBack, min(tx, ty));
  vec3 hit = clamp(
    vec3(p0, 0.0) + ray * tHit,
    vec3(0.0, 0.0, -roomDepth),
    vec3(1.0, 1.0, 0.0)
  );

  bool isCeiling = (ty <= tBack && ty <= tx && ray.y > 0.0);
  bool isFloor = (ty <= tBack && ty <= tx && ray.y < 0.0);
  bool isSideWall = (tx < tBack && tx < ty);
  bool isBackWall = !isCeiling && !isFloor && !isSideWall;

  vec2 seedKey = floor(vWinCenter.xz * 2.3 + vec2(vWinCenter.y * 3.1, vWindowSchedule.z * 19.0));
  float h1 = fract(sin(dot(seedKey, vec2(127.1, 311.7))) * 43758.5453);
  float h2 = fract(sin(dot(seedKey, vec2(269.5, 183.3))) * 43758.5453);

  bool isResidential = (vWindowSchedule.x > 1.5 && vWindowSchedule.x < 2.5);
  bool isStorefront = (vWindowSchedule.x > 2.5 && vWindowSchedule.x < 3.5);
  bool isOffice = !isResidential && !isStorefront;

  float seamX = isSideWall ? 1.0 : min(hit.x, 1.0 - hit.x);
  float seamY = (isCeiling || isFloor) ? 1.0 : min(hit.y, 1.0 - hit.y);
  float seamZ = isBackWall ? 1.0 : (hit.z + roomDepth) / roomDepth;
  float roomAO = (0.72 + 0.28 * smoothstep(0.0, 0.12, seamX))
    * (0.72 + 0.28 * smoothstep(0.0, 0.12, seamY))
    * (0.75 + 0.25 * smoothstep(0.0, 0.16, seamZ));

  float upperWash = smoothstep(0.06, 0.96, hit.y);
  float nearGlass = 1.0 + hit.z / roomDepth;
  float light = 0.78;
  float dayShade = 0.42;

  if (isCeiling) {
    float strip = isOffice
      ? exp(-18.0 * pow(hit.z + roomDepth * 0.48, 2.0)) * smoothstep(0.08, 0.22, min(hit.x, 1.0 - hit.x))
      : exp(-12.0 * (pow(hit.x - 0.5, 2.0) + pow((hit.z + roomDepth * 0.48) * 1.35, 2.0)));
    light = 1.12 + 0.58 * strip;
    dayShade = 0.52 + 0.24 * nearGlass;
  } else if (isFloor) {
    float floorPool = exp(-6.5 * (pow(hit.x - 0.5, 2.0) + pow((hit.z + roomDepth * 0.46) * 1.3, 2.0)));
    light = 0.46 + 0.42 * floorPool;
    dayShade = 0.26 + 0.22 * nearGlass;
  } else if (isSideWall) {
    light = (0.64 + 0.54 * upperWash) * (0.88 + 0.18 * nearGlass);
    dayShade = (0.34 + 0.34 * nearGlass) * (0.82 + 0.24 * hit.y);
  } else {
    light = 0.54 + 0.58 * upperWash;
    dayShade = 0.24 + 0.18 * hit.y;
  }

  if (isBackWall || isSideWall) {
    float wallCoord = isBackWall ? hit.x : (hit.z + roomDepth) / roomDepth;
    if (isOffice) {
      float deskMask = 1.0 - 0.34 * (1.0 - smoothstep(0.24, 0.30, hit.y));
      float partitionPos = 0.28 + 0.44 * h1;
      float partitionMask = 1.0 - 0.26 * (1.0 - smoothstep(0.03, 0.055, abs(wallCoord - partitionPos)))
        * step(hit.y, 0.78);
      float taskPool = h2 > 0.42
        ? 0.28 * exp(-22.0 * (pow(wallCoord - (0.25 + 0.5 * h2), 2.0) + pow(hit.y - 0.36, 2.0)))
        : 0.0;
      light = light * deskMask * partitionMask + taskPool;
      dayShade *= deskMask * partitionMask;
    } else if (isResidential) {
      vec2 lampPos = vec2(0.22 + 0.56 * h1, 0.36 + 0.18 * h2);
      float lampDist2 = pow(wallCoord - lampPos.x, 2.0) + pow(hit.y - lampPos.y, 2.0);
      float lampPool = (h2 > 0.32 ? 0.56 : 0.22) * exp(-13.0 * lampDist2);
      float shelfBay = step(0.16, hit.y) * step(hit.y, 0.74)
        * step(0.15, abs(wallCoord - lampPos.x));
      float shelfPlank = 1.0 - 0.28 * shelfBay * (1.0 - smoothstep(0.035, 0.065, abs(fract(hit.y * 3.6) - 0.5)));
      light = light * shelfPlank + lampPool;
      dayShade *= shelfPlank;
    } else {
      float shelfBand = 1.0 - 0.26 * (1.0 - smoothstep(0.035, 0.065, abs(fract(hit.y * 2.8) - 0.5)))
        * step(0.14, hit.y) * step(hit.y, 0.84);
      float displaySpot = 0.34 * exp(-9.0 * pow(wallCoord - 0.5, 2.0)) * smoothstep(0.15, 0.85, hit.y);
      light = light * shelfBand + displaySpot;
      dayShade *= shelfBand;
    }
  }

  light *= roomAO;

  float blindChance = isOffice ? 0.48 : (isResidential ? 0.34 : 0.0);
  float blindMask = 0.0;
  float slat = 1.0;
  if (h1 < blindChance) {
    float blindDrop = (isOffice ? 0.34 : 0.44) + 0.48 * h2;
    blindMask = smoothstep(blindDrop - 0.025, blindDrop + 0.015, p0.y);
    slat = 0.64 + 0.36 * sin(p0.y * 56.0);
    light *= mix(1.0, 0.48 * slat, blindMask);
  }

  float curtainMask = 0.0;
  if (isResidential && h1 > 0.58) {
    float curtainW = 0.11 + 0.07 * h2;
    float edgeDist = min(p0.x, 1.0 - p0.x);
    curtainMask = 1.0 - smoothstep(curtainW - 0.025, curtainW + 0.02, edgeDist);
    float fold = 0.76 + 0.24 * sin(p0.x * 46.0);
    light *= mix(1.0, 0.34 * fold, curtainMask);
  }

  float sashVignette = 0.84 + 0.16 * smoothstep(0.0, 0.038, min(min(p0.x, 1.0 - p0.x), min(p0.y, 1.0 - p0.y)));
  roomLightProfile = clamp(light * sashVignette, 0.08, 1.65);

  vec3 shadowRoom = vec3(0.20, 0.25, 0.31) + vec3(0.46, 0.47, 0.48) * (dayShade * roomAO);
  vec3 blindDay = vec3(0.66, 0.65, 0.61) * slat;
  vec3 curtainDay = mix(vec3(0.54, 0.49, 0.44), vec3(0.44, 0.48, 0.52), h2);
  dayInteriorColor = mix(shadowRoom, blindDay, blindMask * 0.68);
  dayInteriorColor = mix(dayInteriorColor, curtainDay, curtainMask * 0.62) * sashVignette;

  float warmth = isResidential ? 1.0 : (isStorefront ? 0.75 : 0.35);
  glowWarmShift = mix(
    vec3(0.93, 0.87, 0.78),
    vec3(1.08, 1.01, 0.92),
    clamp(roomLightProfile * 0.65 + warmth * 0.2, 0.0, 1.0)
  );
}
${shader.fragmentShader}`
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `float winActivity = windowActivity();
float winRoomLightProfile = 1.0;
vec3 winDayInterior = vec3(0.5);
vec3 winGlowWarmShift = vec3(1.0);
evalWindowInterior(winRoomLightProfile, winDayInterior, winGlowWarmShift);
vec3 totalEmissiveRadiance = vWindowGlow * winGlowWarmShift * (length(emissive) * winActivity * winRoomLightProfile);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb *= mix(winDayInterior, vec3(0.68 + 0.32 * min(winRoomLightProfile, 1.15)), winActivity * 0.42);`,
      );
  };
  material.customProgramCacheKey = () => 'rainlight-window-parallax-v2';
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
