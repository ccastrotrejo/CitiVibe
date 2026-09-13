import { describe, expect, it } from 'vitest';
import {
  FACADE_FAMILY_WEIGHTS, FACADE_TONES, GHOST_SIGN_PALETTE, MURAL_FIGURE_TONES, MURAL_MOTIFS,
  MURAL_MOTIF_WEIGHTS, MURAL_PALETTES, MURAL_TAG_TONES, WINDOW_UNIT, WINDOW_UNIT_GRILLE,
  WINDOW_UNIT_TONES, facadeSample, facadeToneFor, muralMotifFor, tonesOf, validateFacadeContent,
  type FacadeFamily,
} from './facades';

describe('facade tones, mural art direction and window air conditioners', () => {
  it('accepts the authored content and rejects malformed art direction', () => {
    expect(() => validateFacadeContent()).not.toThrow();
    const hex = /^#[0-9a-f]{6}$/;
    for (const tone of FACADE_TONES) {
      expect(tone.hex).toMatch(hex);
      expect(['observed', 'inferred']).toContain(tone.evidence);
    }
    // Measured reference hexes must outnumber nothing but must exist, so the palette is grounded.
    expect(FACADE_TONES.filter(({ evidence }) => evidence === 'observed').length)
      .toBeGreaterThanOrEqual(8);
    for (const family of Object.keys(FACADE_FAMILY_WEIGHTS) as FacadeFamily[]) {
      expect(FACADE_FAMILY_WEIGHTS[family]).toBeGreaterThan(0);
      expect(tonesOf(family).length).toBeGreaterThanOrEqual(2);
    }
    for (const palette of MURAL_PALETTES) {
      expect(palette.colors.length).toBeGreaterThanOrEqual(4);
      palette.colors.forEach((color) => expect(color).toMatch(hex));
    }
    for (const tone of [GHOST_SIGN_PALETTE.panel, ...GHOST_SIGN_PALETTE.marks, ...MURAL_FIGURE_TONES, ...MURAL_TAG_TONES,
      ...WINDOW_UNIT_TONES, WINDOW_UNIT_GRILLE]) expect(tone).toMatch(hex);
    for (const motif of MURAL_MOTIFS) expect(MURAL_MOTIF_WEIGHTS[motif]).toBeGreaterThan(0);
  });

  it('keeps a blockfront coherent while varying tone building by building', () => {
    const run = 'block-test-run-0';
    const ids = Array.from({ length: 12 }, (_, index) => `street-building-${index + 1}`);
    const picks = ids.map((id) => facadeToneFor(id, run));
    expect(new Set(picks.map(({ family }) => family)).size).toBe(1);
    expect(new Set(picks.map(({ hex }) => hex)).size).toBeGreaterThan(1);
    // Different blockfronts diverge, so the city is not one colour end to end.
    const families = Array.from({ length: 24 }, (_, index) =>
      facadeToneFor('street-building-1', `block-${index}-run-0`).family);
    expect(new Set(families).size).toBeGreaterThan(3);
  });

  it('resolves the same tone, motif and sample for the same inputs on every build', () => {
    expect(facadeToneFor('street-building-7', 'block-1-2-run-0'))
      .toEqual(facadeToneFor('street-building-7', 'block-1-2-run-0'));
    expect(facadeToneFor('street-building-7', 'block-1-2-run-0', 'limestone').family).toBe('limestone');
    expect(muralMotifFor('mural-panel-3')).toBe(muralMotifFor('mural-panel-3'));
    expect(MURAL_MOTIFS).toContain(muralMotifFor('mural-panel-3'));
    // Independent feature keys stop one attribute from predicting another.
    const id = 'street-building-12';
    expect(facadeSample(id, 'window-units')).not.toBe(facadeSample(id, 'mural-wall'));
    for (const feature of ['tone', 'mural-wall', 'window-units']) {
      const value = facadeSample(id, feature);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(facadeSample(id, feature)).toBe(value);
    }
  });

  it('sizes window units to the measured product band and the public-way projection limit', () => {
    expect(WINDOW_UNIT.width).toBeCloseTo(0.49);
    expect(WINDOW_UNIT.height).toBeCloseTo(0.34);
    expect(WINDOW_UNIT.depth).toBeCloseTo(0.55);
    expect(WINDOW_UNIT.projection).toBeGreaterThanOrEqual(0.18);
    expect(WINDOW_UNIT.projection).toBeLessThanOrEqual(0.3);
    // A sill on the lowest permitted floor still clears the 3.05 m public-way limit.
    expect(WINDOW_UNIT.lowestFloor).toBeGreaterThanOrEqual(1);
    expect(0.3 + WINDOW_UNIT.lowestFloor * 2.4 + 1.25 - 1.24 / 2).toBeGreaterThan(3.05);
  });
});
