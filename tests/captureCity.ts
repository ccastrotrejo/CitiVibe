import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

/** Compare exact captures without constructing a huge byte-by-byte assertion diff on failure. */
export async function captureCity(page: Page): Promise<string> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw new Error('The live city canvas is not visible.');
  const image = await page.screenshot({
    clip: bounds,
    style: '.scene-shell > :not(.scene-navigation), .scene-navigation > :not(canvas) { visibility: hidden !important; }',
  });
  return createHash('sha256').update(image).digest('hex');
}
