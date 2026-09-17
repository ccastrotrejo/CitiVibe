import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { captureCity } from './captureCity';
import { GROUND_LEVEL, GROUND_PUDDLES } from '../src/world/groundWater';
import { CAMERA_PROJECTION } from '../src/content/city';

interface WeatherProbe {
  fog: number;
  snow: number;
  wetness: number;
  snowDepth: number;
  poolDepth: Record<string, number>;
  advance: (ticks: number) => void;
}

declare global {
  interface Window {
    weatherProbe?: WeatherProbe;
  }
}

function advanceWeather(ticks: number) {
  if (!window.weatherProbe) throw new Error('Weather test probe was not installed.');
  window.weatherProbe.advance(ticks);
}

function readWeather() {
  if (!window.weatherProbe) throw new Error('Weather test probe was not installed.');
  const { fog, snow, wetness, snowDepth, poolDepth } = window.weatherProbe;
  return { fog, snow, wetness, snowDepth, poolDepth };
}

test('a weather shader compilation failure reports an actionable fallback instead of a false live state', async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
      original.call(this, shader, source.includes('uniform sampler2D weatherHeight')
        ? `${source}\ninvalid_weather_shader;` : source);
    };
  });
  await page.goto('/');
  await expect(page.getByText('City graphics shaders could not compile. Retry the live city.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Retry live city' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause city' })).toBeDisabled();
});

test('snow and windy settings are accessible, persistent and static through graphics recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const weather = page.getByRole('combobox', { name: 'Weather', exact: true });
  await weather.selectOption('snow');
  await expect(weather).toHaveValue('snow');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Reset overview' }).click();
  const snow = await captureCity(page);
  await page.waitForTimeout(150);
  expect(await captureCity(page)).toEqual(snow);
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Missing graphics recovery test extension.');
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 100);
  });
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  expect(await captureCity(page)).toEqual(snow);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  expect(await captureCity(page)).toEqual(snow);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(weather).toHaveValue('snow');
  await weather.selectOption('windy');
  await page.getByRole('button', { name: 'Close settings' }).click();
  expect(await captureCity(page)).not.toEqual(snow);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Time of day', exact: true }).selectOption('night');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('heading', { name: 'Rainlight Square', exact: true })).toHaveCSS('color', 'rgb(255, 253, 247)');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('live snow depth and ground pools accumulate, pause, and respond to warming and rain intensity', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(({ basins, groundLevel }) => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestFrame = window.requestAnimationFrame.bind(window);
    const cancelFrame = window.cancelAnimationFrame.bind(window);
    let now = 0;
    let omitIntermediateDraws = false;
    const probe: WeatherProbe = {
      fog: 0, snow: 0, wetness: 0, snowDepth: 0, poolDepth: {},
      advance(ticks) {
        try {
          for (let index = 0; index < ticks; index++) {
            // Exercise the real fixed-step loop, but rasterize only the final frame
            // rather than queuing hundreds of software-GPU frames synchronously.
            omitIntermediateDraws = index < ticks - 1;
            now += 100;
            const pending = [...callbacks.entries()];
            callbacks.clear();
            pending.forEach(([id, callback]) => { cancelFrame(id); callback(now); });
          }
        } finally {
          omitIntermediateDraws = false;
        }
      },
    };
    Object.assign(window, { weatherProbe: probe });
    window.requestAnimationFrame = (callback) => {
      const id = requestFrame(() => {
        callbacks.delete(id);
        now += 1000 / 60;
        callback(now);
      });
      callbacks.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => { callbacks.delete(id); cancelFrame(id); };
    const names = new WeakMap<WebGLUniformLocation, string>();
    const prototype = WebGL2RenderingContext.prototype;
    const drawElements = prototype.drawElements;
    const drawArrays = prototype.drawArrays;
    const drawElementsInstanced = prototype.drawElementsInstanced;
    const drawArraysInstanced = prototype.drawArraysInstanced;
    prototype.drawElements = function (...args) { if (!omitIntermediateDraws) drawElements.apply(this, args); };
    prototype.drawArrays = function (...args) { if (!omitIntermediateDraws) drawArrays.apply(this, args); };
    prototype.drawElementsInstanced = function (...args) { if (!omitIntermediateDraws) drawElementsInstanced.apply(this, args); };
    prototype.drawArraysInstanced = function (...args) { if (!omitIntermediateDraws) drawArraysInstanced.apply(this, args); };
    const getLocation = prototype.getUniformLocation;
    const setFloat = prototype.uniform1f;
    const setMatrix = prototype.uniformMatrix4fv;
    prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    prototype.uniform1f = function (location, value) {
      const name = location && names.get(location);
      if (name === 'fogDensity') probe.fog = value;
      if (name === 'weatherSnow') probe.snow = value;
      if (name === 'weatherWetness') probe.wetness = value;
      if (name === 'weatherSnowDepth') probe.snowDepth = value;
      setFloat.call(this, location, value);
    };
    prototype.uniformMatrix4fv = function (...args) {
      const [location, , values, offset = 0] = args;
      if (location && names.get(location) === 'modelMatrix') {
        const matrix = Array.from(values);
        const basin = basins.find((item) => Math.abs(matrix[offset + 12] - item.x) < 0.001 &&
          Math.abs(matrix[offset + 14] - item.z) < 0.001);
        if (basin) probe.poolDepth[basin.id] = matrix[offset + 13] - groundLevel + basin.maxDepth - 0.002;
      }
      setMatrix.apply(this, args);
    };
  }, { basins: GROUND_PUDDLES, groundLevel: GROUND_LEVEL });
  await page.goto('/');
  await expect(page.getByText('City is living', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('snow');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.evaluate(advanceWeather, 21);
  const transitioning = await page.evaluate(readWeather);
  const fogScale = 60 / CAMERA_PROJECTION.distance;
  expect(transitioning.fog).toBeGreaterThan(0.003 * fogScale);
  expect(transitioning.fog).toBeLessThan(0.007 * fogScale);
  await page.evaluate(advanceWeather, 380);
  await page.getByRole('button', { name: 'Pause city' }).click();
  const frozen = await page.evaluate(readWeather);
  const accumulated = frozen.snow;
  expect(accumulated).toBeGreaterThan(0.75);
  expect(frozen.snowDepth).toBeGreaterThan(0.02);
  const held = await captureCity(page);
  await page.evaluate(advanceWeather, 9000);
  expect(await captureCity(page)).toEqual(held);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('sunny');
  await page.getByRole('button', { name: 'Close settings' }).click();
  expect((await page.evaluate(readWeather)).snow).toBe(accumulated);
  await page.getByRole('button', { name: 'Resume city' }).click();
  await page.evaluate(advanceWeather, 101);
  const warmed = await page.evaluate(readWeather);
  expect(warmed.snow).toBeGreaterThan(0);
  expect(warmed.snow).toBeLessThan(accumulated);
  expect(warmed.wetness).toBeGreaterThan(0.1);
  expect(warmed.snowDepth).toBeLessThan(frozen.snowDepth);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('rain');
  const intensity = page.getByRole('slider', { name: 'Rain intensity', exact: true });
  await intensity.focus();
  await page.keyboard.press('End');
  await expect(intensity).toHaveValue('30');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.evaluate(advanceWeather, 301);
  await page.getByRole('button', { name: 'Pause city' }).click();
  const wet = await page.evaluate(readWeather);
  for (const basin of GROUND_PUDDLES) {
    expect(wet.poolDepth[basin.id]).toBeGreaterThan(0.03);
    expect(wet.poolDepth[basin.id]).toBeLessThanOrEqual(basin.maxDepth + 0.001);
  }
  await page.evaluate(advanceWeather, 5000);
  expect((await page.evaluate(readWeather)).poolDepth).toEqual(wet.poolDepth);
  expect(errors).toEqual([]);
});
