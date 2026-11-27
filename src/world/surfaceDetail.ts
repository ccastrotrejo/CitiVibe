import type * as THREE from 'three';
import { SIDEWALK_HALF_WIDTH, STREET_X, STREET_Z } from '../content/streets';

/** Finishes drawn procedurally in the fragment shader: no textures, geometry or passes. */
export type SurfaceDetailMode = 'sidewalk' | 'asphalt' | 'masonry';

/** Standard modular brick: three courses per ~0.61 m, 0.4 m stretchers in running bond. */
export const BRICK_COURSE = { height: 0.205, length: 0.42 } as const;

const glslList = (values: readonly number[]) => values.map((value) => value.toFixed(1)).join(', ');

/** NYC concrete sidewalk flags are commonly about five feet square. */
export const SIDEWALK_FLAG_SIZE = 1.52;

export interface SurfaceDetailTextures {
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  normalScale?: number;
  worldTileMeters?: number;
}

const DETAIL_GLSL = /* glsl */ `
varying vec3 vDetailPosition;
varying vec3 vDetailNormal;
varying vec3 vBoxLocal;
varying vec3 vBoxScale;
varying vec3 vBoxAxisX;
varying vec3 vBoxAxisY;
varying vec3 vBoxAxisZ;
#ifdef USE_SURFACE_DETAIL_MAPS
  uniform sampler2D uDetailNormalMap;
  uniform sampler2D uDetailRoughnessMap;
  uniform float uDetailNormalScale;
  uniform float uDetailInvTile;
#endif
float detailHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float detailNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(detailHash(i), detailHash(i + vec2(1.0, 0.0)), f.x),
    mix(detailHash(i + vec2(0.0, 1.0)), detailHash(i + vec2(1.0)), f.x), f.y);
}
float detailFbm(vec2 p) {
  return detailNoise(p);
}
// Coverage of a line of half-width hw at distance d, filtered by the pixel footprint w so
// thin joints fade to their average tone instead of shimmering at overview zoom.
float detailLine(float d, float hw, float w) {
  return (1.0 - smoothstep(hw, hw + w, d)) * clamp(2.0 * hw / max(w, 1e-4), 0.0, 1.0);
}
`;

const MODE_GLSL: Record<SurfaceDetailMode, string> = {
  sidewalk: /* glsl */ `
    if (vDetailNormal.y > 0.9 && vDetailPosition.y > -0.1 && vDetailPosition.y < -0.06) {
      vec2 flag = vDetailPosition.xz / ${SIDEWALK_FLAG_SIZE.toFixed(2)};
      vec2 edge = min(fract(flag), 1.0 - fract(flag)) * ${SIDEWALK_FLAG_SIZE.toFixed(2)};
      float footprint = length(fwidth(vDetailPosition.xz));
      float joint = max(detailLine(edge.x, 0.012, footprint), detailLine(edge.y, 0.012, footprint));
      float tone = 0.96 + 0.06 * detailHash(floor(flag));
      float grime = 0.97 + 0.035 * detailFbm(vDetailPosition.xz * 0.75);
      diffuseColor.rgb *= tone * grime * (1.0 - 0.24 * joint);
    }
  `,
  asphalt: /* glsl */ `
    if (vDetailNormal.y > 0.9 && vDetailPosition.y < 0.05) {
      float footprint = length(fwidth(vDetailPosition.xz));
      float fine = detailFbm(vDetailPosition.xz * 2.2) * (1.0 - smoothstep(0.08, 0.35, footprint));
      float broad = detailFbm(vDetailPosition.xz * 0.24);
      vec2 patchCell = floor(vDetailPosition.xz / vec2(6.5, 3.7));
      vec2 patchLocal = fract(vDetailPosition.xz / vec2(6.5, 3.7));
      float patchEdge = min(min(patchLocal.x, 1.0 - patchLocal.x), min(patchLocal.y, 1.0 - patchLocal.y));
      float repair = step(0.88, detailHash(patchCell)) * smoothstep(0.08, 0.12, patchEdge);
      diffuseColor.rgb *= (0.94 + 0.09 * broad + 0.04 * (fine - 0.45)) * (1.0 - 0.06 * repair);
    }
  `,
  // Shared white facade paint also colours sidewalk props and small AC units, so coursing is limited
  // to actual building walls outside every street-and-sidewalk corridor.
  masonry: /* glsl */ `
    if (abs(vDetailNormal.y) < 0.3 && vDetailPosition.y > 0.35 && max(vBoxScale.x, vBoxScale.z) > 1.2) {
      float street = 1e3;
      const float streetX[${STREET_X.length}] = float[](${glslList(STREET_X)});
      const float streetZ[${STREET_Z.length}] = float[](${glslList(STREET_Z)});
      for (int i = 0; i < ${STREET_X.length}; i++) street = min(street, abs(vDetailPosition.x - streetX[i]));
      for (int i = 0; i < ${STREET_Z.length}; i++) street = min(street, abs(vDetailPosition.z - streetZ[i]));
      if (street > ${(SIDEWALK_HALF_WIDTH + 0.05).toFixed(2)}) {
        float along = abs(vDetailNormal.x) > abs(vDetailNormal.z) ? vDetailPosition.z : vDetailPosition.x;
        if (diffuseColor.r - diffuseColor.b > 0.07) {
          float course = vDetailPosition.y / ${BRICK_COURSE.height.toFixed(3)};
          float row = floor(course);
          float stretcher = along / ${BRICK_COURSE.length.toFixed(2)} + 0.5 * mod(row, 2.0);
          vec2 footprint = fwidth(vec2(along, vDetailPosition.y));
          float bed = detailLine(min(fract(course), 1.0 - fract(course)) * ${BRICK_COURSE.height.toFixed(3)}, 0.009, footprint.y);
          float head = detailLine(min(fract(stretcher), 1.0 - fract(stretcher)) * ${BRICK_COURSE.length.toFixed(2)}, 0.009, footprint.x);
          float brick = mix(0.95 + 0.09 * detailHash(vec2(row, floor(stretcher))), 1.0,
            smoothstep(0.06, 0.22, max(footprint.x, footprint.y)));
          diffuseColor.rgb = mix(diffuseColor.rgb * brick, vec3(0.76, 0.73, 0.68), 0.38 * max(bed, head));
        } else {
          float ashlarCourse = vDetailPosition.y / 0.42;
          float ashlarRow = floor(ashlarCourse);
          float ashlarBlock = along / 0.88 + 0.5 * mod(ashlarRow, 2.0);
          vec2 footprint = fwidth(vec2(along, vDetailPosition.y));
          float stoneJoint = max(
            detailLine(min(fract(ashlarCourse), 1.0 - fract(ashlarCourse)) * 0.42, 0.006, footprint.y),
            detailLine(min(fract(ashlarBlock), 1.0 - fract(ashlarBlock)) * 0.88, 0.006, footprint.x)
          );
          float stoneTone = mix(0.97 + 0.05 * detailHash(vec2(ashlarRow, floor(ashlarBlock))), 1.0,
            smoothstep(0.08, 0.28, max(footprint.x, footprint.y)));
          diffuseColor.rgb *= stoneTone * (1.0 - 0.12 * stoneJoint);
        }
      }
    }
  `,
};

const NORMAL_RELIEF_GLSL: Record<SurfaceDetailMode, string> = {
  sidewalk: /* glsl */ `
    if (vDetailNormal.y > 0.9 && vDetailPosition.y > -0.1 && vDetailPosition.y < -0.06) {
      vec2 flag = vDetailPosition.xz / ${SIDEWALK_FLAG_SIZE.toFixed(2)};
      vec2 frac = fract(flag);
      vec2 signedEdge = (frac - 0.5);
      vec2 edge = min(frac, 1.0 - frac) * ${SIDEWALK_FLAG_SIZE.toFixed(2)};
      float footprint = length(fwidth(vDetailPosition.xz));
      float grooveX = (1.0 - smoothstep(0.004, 0.026 + footprint, edge.x)) * sign(signedEdge.x);
      float grooveZ = (1.0 - smoothstep(0.004, 0.026 + footprint, edge.y)) * sign(signedEdge.y);
      vec2 mapSlope = vec2(0.0);
      float baseRough = roughnessFactor * 0.94;
      #ifdef USE_SURFACE_DETAIL_MAPS
        vec2 wUv = vDetailPosition.xz * uDetailInvTile;
        mapSlope = (texture2D(uDetailNormalMap, wUv).xy * 2.0 - 1.0) * uDetailNormalScale;
        baseRough = texture2D(uDetailRoughnessMap, wUv).r;
      #endif
      vec3 worldBump = normalize(vec3(grooveX * 0.16 + mapSlope.x, 1.0, grooveZ * 0.16 + mapSlope.y));
      normal = normalize(mix(normal, normalize((viewMatrix * vec4(worldBump, 0.0)).xyz), 0.42));
      float jointMask = max(detailLine(edge.x, 0.014, footprint), detailLine(edge.y, 0.014, footprint));
      roughnessFactor = mix(clamp(baseRough, 0.68, 0.92), 0.96, jointMask);
    }
  `,
  asphalt: /* glsl */ `
    if (vDetailNormal.y > 0.9 && vDetailPosition.y < 0.05) {
      #ifdef USE_SURFACE_DETAIL_MAPS
        vec2 wUv = vDetailPosition.xz * uDetailInvTile;
        vec2 mapSlope = (texture2D(uDetailNormalMap, wUv).xy * 2.0 - 1.0) * uDetailNormalScale;
        vec3 worldBump = normalize(vec3(mapSlope.x, 1.0, mapSlope.y));
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(worldBump, 0.0)).xyz), 0.45));
        roughnessFactor = texture2D(uDetailRoughnessMap, wUv).r;
      #endif
      float streetDistX = 1e3;
      float streetDistZ = 1e3;
      const float roadX[${STREET_X.length}] = float[](${glslList(STREET_X)});
      const float roadZ[${STREET_Z.length}] = float[](${glslList(STREET_Z)});
      for (int i = 0; i < ${STREET_X.length}; i++) streetDistX = min(streetDistX, abs(vDetailPosition.x - roadX[i]));
      for (int i = 0; i < ${STREET_Z.length}; i++) streetDistZ = min(streetDistZ, abs(vDetailPosition.z - roadZ[i]));
      float laneCoord = min(streetDistX, streetDistZ);
      // Dual tire-wear polish centered around +/- 1.6 m vehicle lanes (~0.65 m track gauge).
      float trackPolish = exp(-pow((laneCoord - 1.15) / 0.42, 2.0)) + exp(-pow((laneCoord - 2.05) / 0.42, 2.0));
      roughnessFactor = mix(roughnessFactor, 0.56, clamp(trackPolish, 0.0, 1.0) * 0.55);
    }
  `,
  masonry: /* glsl */ `
    // Smooth 2.4 cm world-space normal chamfer along box edges for tactile architectural corners.
    vec3 absLocal = abs(vBoxLocal);
    if (max(max(absLocal.x, absLocal.y), absLocal.z) <= 0.501 && min(min(vBoxScale.x, vBoxScale.y), vBoxScale.z) > 0.08) {
      vec3 edgeMeters = max(vec3(0.0), (vec3(0.5) - absLocal) * vBoxScale);
      float footprint3d = length(fwidth(vDetailPosition));
      float bevelRadius = clamp(0.026, 0.008, 0.22 * min(min(vBoxScale.x, vBoxScale.y), vBoxScale.z));
      float fade = 1.0 - smoothstep(bevelRadius * 0.8, bevelRadius * 3.5, footprint3d);
      vec3 faceMask = step(vec3(0.495), absLocal);
      vec3 edgeWeight = (1.0 - smoothstep(0.0, bevelRadius, edgeMeters)) * (vec3(1.0) - faceMask) * sign(vBoxLocal);
      vec3 chamferWorld = edgeWeight.x * vBoxAxisX + edgeWeight.y * vBoxAxisY + edgeWeight.z * vBoxAxisZ;
      vec3 chamferView = (viewMatrix * vec4(chamferWorld, 0.0)).xyz;
      normal = normalize(normal + chamferView * (0.48 * fade));
    }
    if (abs(vDetailNormal.y) < 0.3 && vDetailPosition.y > 0.35 && max(vBoxScale.x, vBoxScale.z) > 1.2) {
      float streetCheck = 1e3;
      const float mStreetX[${STREET_X.length}] = float[](${glslList(STREET_X)});
      const float mStreetZ[${STREET_Z.length}] = float[](${glslList(STREET_Z)});
      for (int i = 0; i < ${STREET_X.length}; i++) streetCheck = min(streetCheck, abs(vDetailPosition.x - mStreetX[i]));
      for (int i = 0; i < ${STREET_Z.length}; i++) streetCheck = min(streetCheck, abs(vDetailPosition.z - mStreetZ[i]));
      if (streetCheck > ${(SIDEWALK_HALF_WIDTH + 0.05).toFixed(2)}) {
        float along = abs(vDetailNormal.x) > abs(vDetailNormal.z) ? vDetailPosition.z : vDetailPosition.x;
        float baseRough = 0.75;
        #ifdef USE_SURFACE_DETAIL_MAPS
          vec2 wUv = vec2(along, vDetailPosition.y) * uDetailInvTile;
          vec2 mapSlope = (texture2D(uDetailNormalMap, wUv).xy * 2.0 - 1.0) * uDetailNormalScale;
          vec3 tangentDir = abs(vDetailNormal.x) > abs(vDetailNormal.z) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
          vec3 mapWorld = tangentDir * mapSlope.x + vec3(0.0, 1.0, 0.0) * mapSlope.y;
          normal = normalize(normal + (viewMatrix * vec4(mapWorld, 0.0)).xyz);
          baseRough = texture2D(uDetailRoughnessMap, wUv).r;
        #endif
        if (diffuseColor.r - diffuseColor.b > 0.07) {
          float course = vDetailPosition.y / ${BRICK_COURSE.height.toFixed(3)};
          float row = floor(course);
          float stretcher = along / ${BRICK_COURSE.length.toFixed(2)} + 0.5 * mod(row, 2.0);
          vec2 footprint = fwidth(vec2(along, vDetailPosition.y));
          float cFrac = fract(course);
          float sFrac = fract(stretcher);
          float bed = detailLine(min(cFrac, 1.0 - cFrac) * ${BRICK_COURSE.height.toFixed(3)}, 0.01, footprint.y);
          float head = detailLine(min(sFrac, 1.0 - sFrac) * ${BRICK_COURSE.length.toFixed(2)}, 0.01, footprint.x);
          float mortar = max(bed, head);
          float bevelY = (1.0 - smoothstep(0.0, 0.022 + footprint.y, min(cFrac, 1.0 - cFrac) * ${BRICK_COURSE.height.toFixed(3)})) * sign(0.5 - cFrac);
          vec3 mortarTilt = (viewMatrix * vec4(0.0, bevelY * 0.22, 0.0, 0.0)).xyz;
          normal = normalize(normal + mortarTilt * (1.0 - smoothstep(0.05, 0.2, footprint.y)));
          roughnessFactor = mix(clamp(baseRough, 0.68, 0.84), 0.95, mortar);
        } else {
          roughnessFactor = clamp(baseRough, 0.72, 0.9);
        }
      }
    }
  `,
};

/**
 * Add a procedural finish + normal-bevel & world-space mipmapped PBR micro-surface to a shared material.
 * Other borrowers (weather surfaces) chain after this compile hook, and the cache key keeps each mode in its own program.
 */
export function applySurfaceDetail(
  material: THREE.MeshStandardMaterial,
  mode: SurfaceDetailMode,
  textures?: SurfaceDetailTextures,
): void {
  const hasMaps = Boolean(textures?.normalMap && textures?.roughnessMap);
  const tileMeters = textures?.worldTileMeters ?? (mode === 'masonry' ? 2.4 : mode === 'sidewalk' ? 3.04 : 4.2);
  const normalScale = textures?.normalScale ?? 0.28;
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key.call(material)}:surface-detail-${mode}-1${hasMaps ? '-maps' : ''}`;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    if (hasMaps && textures?.normalMap && textures?.roughnessMap) {
      shader.uniforms.uDetailNormalMap = { value: textures.normalMap };
      shader.uniforms.uDetailRoughnessMap = { value: textures.roughnessMap };
      shader.uniforms.uDetailNormalScale = { value: normalScale };
      shader.uniforms.uDetailInvTile = { value: 1 / tileMeters };
    }
    const mapDefine = hasMaps ? '#define USE_SURFACE_DETAIL_MAPS\n' : '';
    shader.vertexShader = `varying vec3 vDetailPosition;
varying vec3 vDetailNormal;
varying vec3 vBoxLocal;
varying vec3 vBoxScale;
varying vec3 vBoxAxisX;
varying vec3 vBoxAxisY;
varying vec3 vBoxAxisZ;
${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 detailPosition = vec4(transformed, 1.0);
      mat4 boxWorldMat = modelMatrix;
      #ifdef USE_INSTANCING
        detailPosition = instanceMatrix * detailPosition;
        boxWorldMat = modelMatrix * instanceMatrix;
      #endif
      vBoxLocal = position;
      vBoxScale = vec3(length(boxWorldMat[0].xyz), length(boxWorldMat[1].xyz), length(boxWorldMat[2].xyz));
      vBoxAxisX = normalize(boxWorldMat[0].xyz + vec3(1e-6, 0.0, 0.0));
      vBoxAxisY = normalize(boxWorldMat[1].xyz + vec3(0.0, 1e-6, 0.0));
      vBoxAxisZ = normalize(boxWorldMat[2].xyz + vec3(0.0, 0.0, 1e-6));
      vec3 invScaleSq = 1.0 / max(vBoxScale * vBoxScale, vec3(1e-6));
      vDetailPosition = (modelMatrix * detailPosition).xyz;
      vDetailNormal = normalize(mat3(boxWorldMat) * (objectNormal * invScaleSq));`,
    );
    shader.fragmentShader = `${mapDefine}${DETAIL_GLSL}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>\n${MODE_GLSL[mode]}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${NORMAL_RELIEF_GLSL[mode]}`);
  };
  material.needsUpdate = true;
}
