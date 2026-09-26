import type * as THREE from 'three';
import { SIDEWALK_HALF_WIDTH, STREET_X, STREET_Z } from '../content/streets';

/** Finishes drawn procedurally in the fragment shader: no textures, geometry or passes. */
export type SurfaceDetailMode = 'sidewalk' | 'asphalt' | 'masonry';

/** Standard modular brick: three courses per ~0.61 m, 0.4 m stretchers in running bond. */
export const BRICK_COURSE = { height: 0.205, length: 0.42 } as const;

const glslList = (values: readonly number[]) => values.map((value) => value.toFixed(1)).join(', ');

/** NYC concrete sidewalk flags are commonly about five feet square. */
export const SIDEWALK_FLAG_SIZE = 1.52;

const DETAIL_GLSL = /* glsl */ `
varying vec3 vDetailPosition;
varying vec3 vDetailNormal;
float detailHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float detailNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(detailHash(i), detailHash(i + vec2(1.0, 0.0)), f.x),
    mix(detailHash(i + vec2(0.0, 1.0)), detailHash(i + vec2(1.0)), f.x), f.y);
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
      float tone = 0.94 + 0.09 * detailHash(floor(flag));
      float grime = 0.96 + 0.05 * detailNoise(vDetailPosition.xz * 0.8);
      diffuseColor.rgb *= tone * grime * (1.0 - 0.3 * joint);
    }
  `,
  asphalt: /* glsl */ `
    if (vDetailNormal.y > 0.9 && vDetailPosition.y < 0.05) {
      float footprint = length(fwidth(vDetailPosition.xz));
      float fine = detailNoise(vDetailPosition.xz * 1.9) * (1.0 - smoothstep(0.08, 0.35, footprint));
      float broad = detailNoise(vDetailPosition.xz * 0.28);
      vec2 patchCell = floor(vDetailPosition.xz / vec2(6.5, 3.7));
      vec2 patchLocal = fract(vDetailPosition.xz / vec2(6.5, 3.7));
      float patchEdge = min(min(patchLocal.x, 1.0 - patchLocal.x), min(patchLocal.y, 1.0 - patchLocal.y));
      float repair = step(0.88, detailHash(patchCell)) * smoothstep(0.08, 0.12, patchEdge);
      diffuseColor.rgb *= (0.92 + 0.12 * broad + 0.06 * (fine - 0.5)) * (1.0 - 0.07 * repair);
    }
  `,
  // Shared white facade paint also colours vehicles and sidewalk props, so coursing is limited
  // to warm (brick/brownstone) tints on vertical faces outside every street-and-sidewalk corridor.
  masonry: /* glsl */ `
    if (abs(vDetailNormal.y) < 0.3 && vDetailPosition.y > 0.35 && diffuseColor.r - diffuseColor.b > 0.07) {
      float street = 1e3;
      const float streetX[${STREET_X.length}] = float[](${glslList(STREET_X)});
      const float streetZ[${STREET_Z.length}] = float[](${glslList(STREET_Z)});
      for (int i = 0; i < ${STREET_X.length}; i++) street = min(street, abs(vDetailPosition.x - streetX[i]));
      for (int i = 0; i < ${STREET_Z.length}; i++) street = min(street, abs(vDetailPosition.z - streetZ[i]));
      if (street > ${(SIDEWALK_HALF_WIDTH + 0.05).toFixed(2)}) {
        float along = abs(vDetailNormal.x) > abs(vDetailNormal.z) ? vDetailPosition.z : vDetailPosition.x;
        float course = vDetailPosition.y / ${BRICK_COURSE.height.toFixed(3)};
        float row = floor(course);
        float stretcher = along / ${BRICK_COURSE.length.toFixed(2)} + 0.5 * mod(row, 2.0);
        vec2 footprint = fwidth(vec2(along, vDetailPosition.y));
        float bed = detailLine(min(fract(course), 1.0 - fract(course)) * ${BRICK_COURSE.height.toFixed(3)}, 0.01, footprint.y);
        float head = detailLine(min(fract(stretcher), 1.0 - fract(stretcher)) * ${BRICK_COURSE.length.toFixed(2)}, 0.01, footprint.x);
        float brick = mix(0.93 + 0.12 * detailHash(vec2(row, floor(stretcher))), 1.0,
          smoothstep(0.06, 0.2, max(footprint.x, footprint.y)));
        diffuseColor.rgb = mix(diffuseColor.rgb * brick, vec3(0.74, 0.71, 0.66), 0.45 * max(bed, head));
      }
    }
  `,
};

/**
 * Add a procedural finish to a shared material. Other borrowers (weather surfaces)
 * chain after this compile hook, and the cache key keeps each mode in its own program.
 */
export function applySurfaceDetail(material: THREE.MeshStandardMaterial, mode: SurfaceDetailMode): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key.call(material)}:surface-detail-${mode}-1`;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.vertexShader = `varying vec3 vDetailPosition;\nvarying vec3 vDetailNormal;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 detailPosition = vec4(transformed, 1.0);
      vec3 detailNormal = objectNormal;
      #ifdef USE_INSTANCING
        detailPosition = instanceMatrix * detailPosition;
        detailNormal = mat3(instanceMatrix) * detailNormal;
      #endif
      vDetailPosition = (modelMatrix * detailPosition).xyz;
      vDetailNormal = normalize(mat3(modelMatrix) * detailNormal);`,
    );
    shader.fragmentShader = `${DETAIL_GLSL}\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n${MODE_GLSL[mode]}`,
    );
  };
  material.needsUpdate = true;
}
