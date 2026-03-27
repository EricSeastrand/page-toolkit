const { test } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('_util exports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/color.html');
  });

  test('exposes utility functions on __ps._util', async ({ page }) => {
    const utils = await page.evaluate(() => Object.keys(__ps._util).sort());
    expect(utils).toContain('parseRGB');
    expect(utils).toContain('hexFromRGB');
    expect(utils).toContain('luminance');
    expect(utils).toContain('contrast');
    expect(utils).toContain('rgbToOklch');
    expect(utils).toContain('oklchToRgb');
    expect(utils).toContain('deltaEOK');
    expect(utils).toContain('chromaLabel');
    expect(utils).toContain('hueDistance');
    expect(utils).toContain('harmonyClass');
    expect(utils).toContain('effectiveBackground');
    expect(utils).toContain('detectDarkMode');
    expect(utils).toContain('boxModel');
  });

  test('parseRGB handles rgb()', async ({ page }) => {
    const result = await page.evaluate(() =>
      __ps._util.parseRGB('rgb(230, 57, 70)'));
    expect(result).toEqual({ r: 230, g: 57, b: 70, a: 1 });
  });

  test('parseRGB handles hex', async ({ page }) => {
    const result = await page.evaluate(() =>
      __ps._util.parseRGB('#e63946'));
    expect(result).toEqual({ r: 230, g: 57, b: 70, a: 1 });
  });

  test('hexFromRGB round-trips correctly', async ({ page }) => {
    const hex = await page.evaluate(() =>
      __ps._util.hexFromRGB({ r: 230, g: 57, b: 70 }));
    expect(hex).toBe('#e63946');
  });

  test('luminance returns expected range', async ({ page }) => {
    const [dark, light] = await page.evaluate(() => [
      __ps._util.luminance({ r: 29, g: 53, b: 87 }),
      __ps._util.luminance({ r: 241, g: 250, b: 238 }),
    ]);
    expect(dark).toBeLessThan(0.1);
    expect(light).toBeGreaterThan(0.8);
  });

  test('contrast ratio is correct', async ({ page }) => {
    const ratio = await page.evaluate(() => {
      const l1 = __ps._util.luminance({ r: 0, g: 0, b: 0 });
      const l2 = __ps._util.luminance({ r: 255, g: 255, b: 255 });
      return __ps._util.contrast(l1, l2);
    });
    expect(ratio).toBeCloseTo(21, 0); // black/white = 21:1
  });

  test('rgbToOklch produces valid OKLCH', async ({ page }) => {
    const oklch = await page.evaluate(() =>
      __ps._util.rgbToOklch(230, 57, 70));
    expect(oklch.L).toBeGreaterThan(0);
    expect(oklch.L).toBeLessThan(1);
    expect(oklch.C).toBeGreaterThan(0);
    expect(oklch.h).toBeGreaterThanOrEqual(0);
    expect(oklch.h).toBeLessThan(360);
  });

  test('chromaLabel maps correctly', async ({ page }) => {
    const labels = await page.evaluate(() => [
      __ps._util.chromaLabel(0.01),
      __ps._util.chromaLabel(0.04),
      __ps._util.chromaLabel(0.10),
      __ps._util.chromaLabel(0.20),
      __ps._util.chromaLabel(0.30),
    ]);
    expect(labels).toEqual(['neutral', 'tinted neutral', 'moderate', 'vivid', 'intense']);
  });
});
