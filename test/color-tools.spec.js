const { test } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('colorProfile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/color.html');
  });

  test('detects dark mode from dark body background', async ({ page }) => {
    const result = await page.evaluate(() => __ps.colorProfile());
    expect(result.darkMode.isDark).toBe(true);
  });

  test('finds foreground and background colors', async ({ page }) => {
    const result = await page.evaluate(() => __ps.colorProfile());
    expect(result.topForegroundColors.length).toBeGreaterThan(0);
    expect(result.topBackgroundColors.length).toBeGreaterThan(0);
  });

  test('reports contrast distribution', async ({ page }) => {
    const result = await page.evaluate(() => __ps.colorProfile());
    expect(result.contrastDistribution).toBeDefined();
    expect(result.worstContrastPairs).toBeDefined();
  });
});

test.describe('paletteProfile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/color.html');
  });

  test('returns data object by default', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    expect(result.colors).toBeDefined();
    expect(result.harmony).toBeDefined();
  });

  test('returns text and data with format opt-in', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile({ format: 'text' }));
    expect(result.text).toBeTruthy();
    expect(result.data).toBeDefined();
  });

  test('finds CSS custom properties as design tokens', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    expect(result.tokenCount).toBeGreaterThanOrEqual(4);
  });

  test('detects harmony classification', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    expect(result.harmony).toBeTruthy();
  });

  test('reports OKLCH values for colors', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    const colors = result.colors;
    expect(colors.length).toBeGreaterThan(0);
    const first = colors[0];
    expect(first.L).toBeGreaterThanOrEqual(0);
    expect(first.L).toBeLessThanOrEqual(100);
    expect(first.C).toBeDefined();
    expect(first.h).toBeDefined();
  });
});

test.describe('scanAnomalies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/color.html');
  });

  test('finds contrast failures', async ({ page }) => {
    const result = await page.evaluate(() => __ps.scanAnomalies());
    expect(result.count).toBeGreaterThan(0);
  });

  test('reports dark mode state', async ({ page }) => {
    const result = await page.evaluate(() => __ps.scanAnomalies());
    expect(result.darkMode).toBeDefined();
    expect(result.darkMode.isDark).toBe(true);
  });
});

test.describe('inspect', () => {
  test('returns computed styles for a selector', async ({ page }) => {
    await page.goto('/color.html');
    const result = await page.evaluate(() => __ps.inspect('.hero h1'));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].styles).toBeDefined();
    expect(result[0].path).toBeTruthy();
  });
});

test.describe('traceStyle', () => {
  test('traces CSS cascade for a property', async ({ page }) => {
    await page.goto('/color.html');
    const result = await page.evaluate(() => __ps.traceStyle('.hero h1', 'color'));
    expect(result.computedValue).toBeTruthy();
    expect(result.matchedRules).toBeDefined();
  });
});
