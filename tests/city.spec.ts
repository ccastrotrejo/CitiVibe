import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { captureCity } from './captureCity';

test('live navigation, tour interruption, help focus, and static pause', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('City is living', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveTitle('CitiVibe - Rainlight Square');
  await expect(page.locator('.wordmark')).toHaveText('CitiVibe.');
  await expect(page.getByRole('button', { name: 'Field guide' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /follow/i })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Landmark navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start tour' }).click();
  await expect(page.getByText('Tour view', { exact: true })).toBeVisible();
  const scene = page.getByRole('region', { name: 'City navigation' });
  await scene.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start tour' }).click();
  await scene.focus();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close help' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(scene).toBeFocused();
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause city' }).click();
  await page.getByRole('button', { name: 'Reset overview' }).click();
  await page.getByRole('button', { name: 'Pan right' }).click();
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  const before = await captureCity(page);
  await page.waitForTimeout(300);
  expect(await captureCity(page)).toEqual(before);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await captureCity(page)).not.toEqual(before);
  await expect(page.getByRole('button', { name: /follow/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reduced-motion city-wide guided views, inert bracket shortcuts, DPR bounds, and accessible controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  await page.getByRole('region', { name: 'City navigation' }).focus();
  await page.keyboard.press('[');
  await page.keyboard.press(']');
  await expect(page.getByText('Overview', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /landmark|clear selection/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guided views' }).click();
  const subjects = ['District overview', 'Rainlight Pavilion', 'Crosstown Steps', 'Terrace Steps', 'Reservoir Walk', 'Juniper Court'];
  for (const [index, subject] of subjects.entries()) {
    await expect(page.locator('#tour-hint')).toHaveText(`Guided view ${index + 1} / 6: ${subject}`);
    await page.getByRole('button', { name: 'Next view' }).click();
  }
  await expect(page.locator('#tour-hint')).toHaveText('Guided view 1 / 6: District overview');
  await page.getByRole('button', { name: 'Previous view' }).click();
  await expect(page.locator('#tour-hint')).toHaveText('Guided view 6 / 6: Juniper Court');
  const dpr = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width / canvas.clientWidth);
  expect(dpr).toBeLessThanOrEqual(1.5);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('region', { name: 'City navigation' }).focus();
  await page.keyboard.press('?');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('scene labels remain readable over nighttime rain', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: /^Weather/ }).selectOption('rain');
  await page.getByRole('combobox', { name: /^Time of day/ }).selectOption('night');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.locator('.environment-badge')).toHaveText('Night / Rain');
  await expect(page.locator('.scene-heading')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Rainlight Square' })).toHaveClass('sr-only');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('unsupported WebGL keeps the descriptive still without landmark navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null;
      return Reflect.apply(original, this, [type, ...args]);
    };
  });
  await page.goto('/');
  await expect(page.getByText(/WebGL2 is unavailable/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Landmark navigation' })).toHaveCount(0);
  await expect(page.locator('.static-marker')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Original miniature city/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start tour' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Pause city' })).toBeDisabled();
  expect(await page.locator('.city-poster').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a useful original still remains when JavaScript is disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Rainlight Square' })).toBeVisible();
  await expect(page.getByRole('img')).toBeVisible();
  await expect(page.getByText(/JavaScript is disabled/)).toBeVisible();
  await expect(page.getByText(/Sound is off/)).toBeVisible();
  await context.close();
});

test('real WebGL context restores once and preserves the paused manual camera', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('City is living', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause city' }).click();
  await page.getByRole('button', { name: 'Pan right' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const before = await captureCity(page);
  const supported = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 100);
    return true;
  });
  expect(supported).toBe(true);
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  expect(await captureCity(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await page.getByRole('button', { name: 'Zoom in' }).click();
});

test('the same paused seed reproduces the scene and does not load external resources', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== baseURL) external.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  const first = await captureCity(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  expect(await captureCity(page)).toEqual(first);
  expect(external).toEqual([]);
});

test('Command-drag orbits the current pivot and clicking scenery does not select it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  await page.getByRole('button', { name: 'Guided views' }).click();
  await page.getByRole('button', { name: 'Next view' }).click();
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing scene bounds');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.keyboard.down('Meta');
  await page.mouse.move(x + 30, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y + 180, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Meta');
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await expect(canvas).not.toHaveAttribute('data-dragging');
  const beforeClick = await captureCity(page);
  await page.mouse.click(x, y);
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear selection' })).toHaveCount(0);
  expect(await captureCity(page)).toEqual(beforeClick);
  await page.getByRole('button', { name: 'More street-level' }).click();
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More overhead' }).click();
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
});

test('mouse gestures yield the camera without touching overlay controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('City is living', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start tour' }).click();
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Missing scene bounds');
  const x = box.x + box.width * 0.6;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 10, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start tour' }).click();
  await page.getByRole('button', { name: 'Dismiss navigation hint' }).click();
  await expect(page.getByText('Tour view', { exact: true })).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -80);
  await expect(page.getByText('Free view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause city', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume city', exact: true })).toBeEnabled();
});

for (const [width, height] of [[1024, 768], [1440, 900], [1920, 1080]]) {
  test(`controls stay reachable without horizontal overflow at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of ['Resume city', 'Guided views', 'Zoom in', 'Pan up', 'Rotate left', 'More overhead', 'More street-level', 'Settings']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const bounds = await button.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      await expect(button).toBeVisible();
      expect(await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
    }
    await page.getByRole('button', { name: 'Guided views' }).click();
    await expect(page.getByRole('button', { name: 'Next view' })).toBeVisible();
    await expect(page.getByRole('button', { name: /landmark|clear selection/i })).toHaveCount(0);
  });
}
