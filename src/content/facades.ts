/**
 * Facade tones, party-wall murals and window air conditioners for the original
 * neighbourhood. Every value here is authored art direction for Rainlight Square, not a
 * recovered source palette and not a copy of any real building, mural or product.
 *
 * Evidence labels follow docs/SOURCES.md:
 *  - `observed`  hex measured by k-means over a freely licensed reference photograph
 *                (dominant cluster, mixed daylight and shade), recorded in research/.
 *  - `inferred`  reasoned estimate from a described material; not a measurement.
 */

export type FacadeFamily =
  | 'brownstone' | 'redBrick' | 'salmonBrick' | 'orangeBrick' | 'buffBrick'
  | 'paintedBrick' | 'midCenturyBrick' | 'limestone' | 'ironSpot'
  | 'terracotta' | 'castIron' | 'curtainWall';

export type FacadeEvidence = 'observed' | 'inferred';

export interface FacadeTone {
  readonly id: string;
  readonly family: FacadeFamily;
  /** Base masonry colour, applied as a per-instance tint on the shared facade material. */
  readonly hex: string;
  readonly evidence: FacadeEvidence;
}

/**
 * Relative commonality of each family across ordinary (non-landmark) blocks. Weights are an
 * authored prior for this city, not a survey of real building stock.
 */
export const FACADE_FAMILY_WEIGHTS: Readonly<Record<FacadeFamily, number>> = {
  redBrick: 30,
  buffBrick: 14,
  brownstone: 11,
  paintedBrick: 11,
  midCenturyBrick: 9,
  limestone: 6,
  orangeBrick: 5,
  salmonBrick: 4,
  curtainWall: 4,
  ironSpot: 3,
  terracotta: 2,
  castIron: 1,
};

export const FACADE_TONES: readonly FacadeTone[] = [
  // Brownstone and brownstone-look parge: chocolate through sun-bleached sandstone.
  { id: 'brownstone-weathered', family: 'brownstone', hex: '#806860', evidence: 'observed' },
  { id: 'brownstone-shaded', family: 'brownstone', hex: '#5e544e', evidence: 'observed' },
  { id: 'brownstone-pale', family: 'brownstone', hex: '#9c8886', evidence: 'observed' },
  { id: 'brownstone-chocolate', family: 'brownstone', hex: '#6b4a32', evidence: 'inferred' },
  { id: 'brownstone-ruddy', family: 'brownstone', hex: '#8a5a42', evidence: 'inferred' },
  // Common red brick: the default wall of the neighbourhood, including party walls.
  { id: 'red-brick-mid', family: 'redBrick', hex: '#9c4a38', evidence: 'inferred' },
  { id: 'red-brick-aged', family: 'redBrick', hex: '#7d3a2c', evidence: 'inferred' },
  { id: 'red-brick-party-wall', family: 'redBrick', hex: '#6d2726', evidence: 'observed' },
  { id: 'red-brick-salmon', family: 'redBrick', hex: '#b4614a', evidence: 'inferred' },
  { id: 'red-brick-chestnut', family: 'redBrick', hex: '#954535', evidence: 'inferred' },
  { id: 'red-brick-sunlit', family: 'redBrick', hex: '#a3663d', evidence: 'observed' },
  // Pink/salmon pressed brick with stone trim.
  { id: 'salmon-brick-light', family: 'salmonBrick', hex: '#eebcaa', evidence: 'observed' },
  { id: 'salmon-brick-mid', family: 'salmonBrick', hex: '#c99a8f', evidence: 'observed' },
  { id: 'salmon-brick-shaded', family: 'salmonBrick', hex: '#997e74', evidence: 'observed' },
  // Orange-red brick.
  { id: 'orange-brick-mid', family: 'orangeBrick', hex: '#b5613c', evidence: 'inferred' },
  { id: 'orange-brick-warm', family: 'orangeBrick', hex: '#c98a5a', evidence: 'inferred' },
  { id: 'orange-brick-sunlit', family: 'orangeBrick', hex: '#e1ac67', evidence: 'observed' },
  // Buff/yellow brick, which soils toward grey-brown as it ages.
  { id: 'buff-brick-clean', family: 'buffBrick', hex: '#dcca9c', evidence: 'observed' },
  { id: 'buff-brick-soiled', family: 'buffBrick', hex: '#9b927a', evidence: 'observed' },
  { id: 'buff-brick-khaki', family: 'buffBrick', hex: '#c3b091', evidence: 'inferred' },
  { id: 'buff-brick-warm', family: 'buffBrick', hex: '#b8a57e', evidence: 'inferred' },
  { id: 'buff-brick-cream', family: 'buffBrick', hex: '#e3d5b2', evidence: 'inferred' },
  // Painted and whitewashed masonry, including the occasional saturated one-off.
  { id: 'painted-whitewash', family: 'paintedBrick', hex: '#e8e4da', evidence: 'inferred' },
  { id: 'painted-greyed', family: 'paintedBrick', hex: '#cfcbc2', evidence: 'inferred' },
  { id: 'painted-grey', family: 'paintedBrick', hex: '#a7a6a1', evidence: 'inferred' },
  { id: 'painted-sage', family: 'paintedBrick', hex: '#8a9478', evidence: 'inferred' },
  { id: 'painted-dusty-blue', family: 'paintedBrick', hex: '#7e93a0', evidence: 'inferred' },
  { id: 'painted-oxblood', family: 'paintedBrick', hex: '#7a3b36', evidence: 'inferred' },
  { id: 'painted-ochre', family: 'paintedBrick', hex: '#c89b4a', evidence: 'inferred' },
  // Postwar white, beige and grey brick slabs.
  { id: 'midcentury-white', family: 'midCenturyBrick', hex: '#e6e3da', evidence: 'inferred' },
  { id: 'midcentury-soiled', family: 'midCenturyBrick', hex: '#c9c5b9', evidence: 'inferred' },
  { id: 'midcentury-tan', family: 'midCenturyBrick', hex: '#c6b394', evidence: 'inferred' },
  { id: 'midcentury-grey', family: 'midCenturyBrick', hex: '#bcbab4', evidence: 'inferred' },
  // Light stone fronts.
  { id: 'limestone-clean', family: 'limestone', hex: '#d8d1c0', evidence: 'inferred' },
  { id: 'limestone-typical', family: 'limestone', hex: '#c2bcab', evidence: 'inferred' },
  { id: 'limestone-sooted', family: 'limestone', hex: '#9e9a8e', evidence: 'inferred' },
  // Dark iron-spot and clinker brick.
  { id: 'iron-spot-plum', family: 'ironSpot', hex: '#5a4048', evidence: 'inferred' },
  { id: 'iron-spot-manganese', family: 'ironSpot', hex: '#6b4a50', evidence: 'inferred' },
  { id: 'iron-spot-clinker', family: 'ironSpot', hex: '#463b3e', evidence: 'inferred' },
  // Architectural terracotta used as a field material rather than trim.
  { id: 'terracotta-red', family: 'terracotta', hex: '#b05a3c', evidence: 'inferred' },
  { id: 'terracotta-buff', family: 'terracotta', hex: '#c9a276', evidence: 'inferred' },
  // Painted cast iron: smooth, flatter and more uniform than any masonry.
  { id: 'cast-iron-grey', family: 'castIron', hex: '#74777b', evidence: 'observed' },
  { id: 'cast-iron-pale', family: 'castIron', hex: '#93979b', evidence: 'observed' },
  { id: 'cast-iron-sage', family: 'castIron', hex: '#7e8a72', evidence: 'inferred' },
  { id: 'cast-iron-deep-green', family: 'castIron', hex: '#3f5148', evidence: 'inferred' },
  // Later curtain-wall infill.
  { id: 'curtain-wall-teal', family: 'curtainWall', hex: '#4e7c82', evidence: 'inferred' },
  { id: 'curtain-wall-grey', family: 'curtainWall', hex: '#6e7377', evidence: 'inferred' },
  { id: 'curtain-wall-bronze', family: 'curtainWall', hex: '#6b563c', evidence: 'inferred' },
];

const FAMILY_ORDER = Object.keys(FACADE_FAMILY_WEIGHTS) as readonly FacadeFamily[];
const TOTAL_WEIGHT = FAMILY_ORDER.reduce((sum, family) => sum + FACADE_FAMILY_WEIGHTS[family], 0);

/** Independent keyed samples, so adding a feature never reshuffles the others. */
export function facadeSample(id: string, feature: string): number {
  let hash = 2166136261;
  for (const char of `${id}:${feature}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}

function weightedFamily(roll: number): FacadeFamily {
  let cursor = roll * TOTAL_WEIGHT;
  for (const family of FAMILY_ORDER) {
    cursor -= FACADE_FAMILY_WEIGHTS[family];
    if (cursor < 0) return family;
  }
  return 'redBrick';
}

export function tonesOf(family: FacadeFamily): readonly FacadeTone[] {
  return FACADE_TONES.filter((tone) => tone.family === family);
}

/**
 * Developer-built streets read as runs of similar fronts broken by an abrupt change, so the
 * family is keyed to the blockfront run and only the tone varies building to building.
 */
export function facadeToneFor(
  buildingId: string, runId: string, forcedFamily?: FacadeFamily,
): FacadeTone {
  const family = forcedFamily ?? weightedFamily(facadeSample(runId, 'facade-family'));
  const options = tonesOf(family);
  if (!options.length) throw new Error(`No facade tones authored for family: ${family}.`);
  return options[Math.floor(facadeSample(buildingId, 'facade-tone') * options.length)];
}

/**
 * Window air conditioners, in metres. A unit sits on the sill inside the lower sash, tilts down
 * so condensate drains outward, and shows a louvred condenser face to the street.
 *
 * `observed` (EPA ENERGY STAR certified room air conditioner dataset, 462 window records): two
 * thirds of units fall in one size band measuring about 0.49 x 0.34 x 0.55 m, and every record
 * is classified with louvred sides. `inferred`: roughly 0.18-0.30 m of that depth clears the
 * facade, because the masonry reveal and the in-room evaporator absorb the rest.
 */
export const WINDOW_UNIT = {
  width: 0.49,
  height: 0.34,
  /** Total case depth; the reveal and in-room half absorb what does not project. */
  depth: 0.55,
  projection: 0.26,
  /** Drainage tilt, radians, nose down away from the wall. */
  tilt: 0.06,
  grilleDepth: 0.05,
  /**
   * `observed` (NYC Building Code 3202.2.1.2, cited verbatim in Environmental Control Board
   * violations): a projection over the public way may not exceed 0.102 m below 3.05 m above
   * grade. At 2.4 m floors that excludes the ground floor, so units start one floor up.
   */
  lowestFloor: 1,
  /** Share of buildings fitted with units at all, and of their eligible windows that carry one. */
  buildingShare: 0.52,
  windowShare: 0.26,
} as const;

/** Cabinet colours, from off-white through the characteristic sun-yellowed and grimed beiges. */
export const WINDOW_UNIT_TONES: readonly string[] = ['#d9d2c0', '#c9ba96', '#e8e6df', '#c6c2b8', '#b6b9bb'];
/** Louvred condenser face, which reads as a dark recessed panel from the street. */
export const WINDOW_UNIT_GRILLE = '#4a4c4d';

export type MuralMotif = 'bands' | 'arcs' | 'bloom' | 'mosaic' | 'sunburst' | 'figure' | 'diamonds' | 'ghost-sign';

export interface MuralPalette {
  readonly id: string;
  readonly ground: string;
  readonly outline: string;
  readonly colors: readonly string[];
}

/**
 * Contemporary wall palettes: few colours, flat and opaque, skewed cool and high-contrast so
 * they separate from warm brick. Compositions are generated from these, never traced from art.
 * Dark grounds are included because near-black and deep navy fields are common and make
 * saturated shapes read strongly from across a street.
 */
export const MURAL_PALETTES: readonly MuralPalette[] = [
  { id: 'harbour', ground: '#f2f0ea', outline: '#191a1c', colors: ['#1e9bd1', '#2b3e90', '#00b8a9', '#f5a623'] },
  { id: 'orchard', ground: '#1d2a24', outline: '#10130f', colors: ['#2fa36b', '#8fc361', '#fbe04b', '#e8558c'] },
  { id: 'ember', ground: '#f7efe2', outline: '#241a16', colors: ['#e23a34', '#f5a623', '#8e3fa0', '#2b3e90'] },
  { id: 'dusk', ground: '#2a2c48', outline: '#14151f', colors: ['#e8558c', '#f2f0ea', '#00b8a9', '#fbe04b'] },
  { id: 'meadow', ground: '#efe6cf', outline: '#1d2118', colors: ['#2fa36b', '#1e9bd1', '#e23a34', '#141414'] },
  { id: 'midnight', ground: '#14161c', outline: '#0a0b0e', colors: ['#1e9bd1', '#e8558c', '#fbe04b', '#2fa36b'] },
  { id: 'spectrum', ground: '#f2ede1', outline: '#1a1713', colors: ['#e23a34', '#f5a623', '#fbe04b', '#2fa36b', '#1e9bd1', '#8e3fa0'] },
];

/** Muted greys and umbers for the abstracted figure motif, which never depicts a real person. */
export const MURAL_FIGURE_TONES: readonly string[] = ['#8c8a86', '#6d6b68', '#4c4b49', '#a9a6a0', '#332f2d'];

/** Reachable-height scribble band along the bottom of a wall, rendered as abstract marks only. */
export const MURAL_TAG_TONES: readonly string[] = ['#f2f0ea', '#1a1a1c', '#c8c5bd'];

/**
 * Faded overpainted wall lettering reads as texture, not text. Surviving lead-based marks sit
 * lighter than the brick at low contrast, so these tones are pale and nearly neutral. The
 * generator paints abstract bars and rules only; it never renders words, brands or slogans.
 */
export const GHOST_SIGN_PALETTE = {
  id: 'ghost-sign',
  panel: '#b9b1a2',
  marks: ['#c9bdae', '#b0a18f', '#8c7a66', '#7a6a5c'],
} as const;

export const MURAL_MOTIFS: readonly MuralMotif[] = [
  'bands', 'arcs', 'bloom', 'mosaic', 'sunburst', 'figure', 'diamonds', 'ghost-sign',
];

/** Contemporary motifs, weighted so no single composition dominates the neighbourhood. */
export const MURAL_MOTIF_WEIGHTS: Readonly<Record<MuralMotif, number>> = {
  figure: 18, sunburst: 15, bloom: 14, bands: 14, mosaic: 13, diamonds: 11, arcs: 9, 'ghost-sign': 6,
};

export function muralMotifFor(id: string): MuralMotif {
  const total = MURAL_MOTIFS.reduce((sum, motif) => sum + MURAL_MOTIF_WEIGHTS[motif], 0);
  let cursor = facadeSample(id, 'mural-motif') * total;
  for (const motif of MURAL_MOTIFS) {
    cursor -= MURAL_MOTIF_WEIGHTS[motif];
    if (cursor < 0) return motif;
  }
  return 'bands';
}

/** Reject malformed authored art direction before any GPU resource is allocated. */
export function validateFacadeContent(): void {
  const ids = new Set<string>();
  const hex = /^#[0-9a-f]{6}$/;
  for (const tone of FACADE_TONES) {
    if (!tone.id || ids.has(tone.id) || !hex.test(tone.hex) ||
      !FAMILY_ORDER.includes(tone.family) || (tone.evidence !== 'observed' && tone.evidence !== 'inferred')) {
      throw new Error(`Invalid facade tone: ${tone.id || '(unnamed)'}.`);
    }
    ids.add(tone.id);
  }
  for (const family of FAMILY_ORDER) {
    if (!(FACADE_FAMILY_WEIGHTS[family] > 0) || !tonesOf(family).length) {
      throw new Error(`Facade family ${family} needs a positive weight and at least one tone.`);
    }
  }
  const paletteIds = new Set<string>();
  for (const palette of MURAL_PALETTES) {
    if (!palette.id || paletteIds.has(palette.id) || palette.colors.length < 3 ||
      ![palette.ground, palette.outline, ...palette.colors].every((color) => hex.test(color))) {
      throw new Error(`Invalid mural palette: ${palette.id || '(unnamed)'}.`);
    }
    paletteIds.add(palette.id);
  }
  if (!hex.test(GHOST_SIGN_PALETTE.panel) || !GHOST_SIGN_PALETTE.marks.every((color) => hex.test(color))) {
    throw new Error('Invalid ghost sign palette.');
  }
  if (!MURAL_FIGURE_TONES.every((color) => hex.test(color)) || MURAL_FIGURE_TONES.length < 3 ||
    !MURAL_TAG_TONES.every((color) => hex.test(color))) {
    throw new Error('Invalid mural figure or tag tones.');
  }
  if (!MURAL_MOTIFS.every((motif) => MURAL_MOTIF_WEIGHTS[motif] > 0)) {
    throw new Error('Every mural motif needs a positive weight.');
  }
  if (WINDOW_UNIT.projection >= WINDOW_UNIT.depth || WINDOW_UNIT.width <= 0 || WINDOW_UNIT.height <= 0 ||
    WINDOW_UNIT.grilleDepth >= WINDOW_UNIT.depth || !Number.isInteger(WINDOW_UNIT.lowestFloor) ||
    WINDOW_UNIT.lowestFloor < 1 || !hex.test(WINDOW_UNIT_GRILLE) ||
    !WINDOW_UNIT_TONES.length || !WINDOW_UNIT_TONES.every((tone) => hex.test(tone)) ||
    WINDOW_UNIT.buildingShare <= 0 || WINDOW_UNIT.buildingShare > 1 ||
    WINDOW_UNIT.windowShare <= 0 || WINDOW_UNIT.windowShare > 1) {
    throw new Error('Invalid window air conditioner dimensions.');
  }
}
