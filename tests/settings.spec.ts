import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { captureCity } from './captureCity';

for (const [width, height] of [[1024, 768], [1440, 900], [1920, 1080]]) {
  test(`settings stays compact and the city remains usable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled({ timeout: 15000 });
    const trigger = page.getByRole('button', { name: 'Settings', exact: true });
    await expect(trigger).toHaveCount(1);
    const sceneBox = await page.locator('canvas').boundingBox();
    const triggerBox = await trigger.boundingBox();
    if (!sceneBox || !triggerBox) throw new Error('Missing city or Settings button bounds.');
    expect(triggerBox.x).toBeGreaterThanOrEqual(sceneBox.x);
    expect(triggerBox.x).toBeLessThanOrEqual(sceneBox.x + 40);
    expect(triggerBox.y + triggerBox.height).toBeGreaterThanOrEqual(sceneBox.y + sceneBox.height - 40);
    expect(triggerBox.y + triggerBox.height).toBeLessThanOrEqual(sceneBox.y + sceneBox.height);
    expect(triggerBox.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panelId = await trigger.getAttribute('aria-controls');
    if (!panelId) throw new Error('Settings must identify its controlled dock.');
    const dock = page.locator(`[id="${panelId}"]`);
    await expect(dock).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused();
    await expect(page.getByText('Around the square', { exact: true })).toHaveCount(0);
    const dockBox = await dock.boundingBox();
    if (!dockBox) throw new Error('Missing settings bounds.');
    expect(dockBox.width).toBeLessThanOrEqual(340);
    expect(dockBox.height).toBeLessThanOrEqual(420);
    expect(dockBox.width * dockBox.height / (sceneBox.width * sceneBox.height)).toBeLessThan(0.3);
    expect(dockBox.x).toBeGreaterThanOrEqual(sceneBox.x);
    expect(dockBox.x).toBeLessThanOrEqual(sceneBox.x + 40);
    expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(triggerBox.y - 8);
    expect(dockBox.y).toBeGreaterThan(sceneBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.keyboard.press('Shift+Tab');
    expect(await dock.evaluate((element) => element.contains(document.activeElement))).toBe(false);
    const held = await captureCity(page);
    const scrollArea = await dock.evaluateHandle((element) => {
      const candidates = [element, ...element.querySelectorAll<HTMLElement>('*')];
      return candidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight &&
        ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY)) ?? null;
    });
    const scrolling = scrollArea.asElement();
    if (!scrolling) throw new Error('The compact settings contents must scroll internally.');
    const scrollBox = await scrolling.boundingBox();
    if (!scrollBox) throw new Error('Settings scroll area is not visible.');
    await page.mouse.move(scrollBox.x + 8, scrollBox.y + scrollBox.height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scrollArea.evaluate((element) => element?.scrollTop ?? 0)).toBeGreaterThan(0);
    expect(await captureCity(page)).toEqual(held);
    await scrollArea.dispose();

    await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('snow');
    await page.getByRole('region', { name: 'City navigation' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Free view', { exact: true })).toBeVisible();
    await expect(dock).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Free view', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume city' }).click();
    await page.getByRole('button', { name: 'Pause city' }).click();
    await expect(dock).toBeVisible();

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('Free view', { exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Landmark navigation' })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('combobox', { name: 'Weather', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(dock).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
}
