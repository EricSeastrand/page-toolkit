const { test } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('typographyProfile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/typography.html');
  });

  test('returns text and data', async ({ page }) => {
    const result = await page.evaluate(() => __ps.typographyProfile());
    expect(result.text).toBeTruthy();
    expect(result.data).toBeDefined();
  });

  test('finds font families', async ({ page }) => {
    const result = await page.evaluate(() => __ps.typographyProfile());
    expect(result.data.families.length).toBeGreaterThan(0);
  });

  test('detects type scale with multiple sizes', async ({ page }) => {
    const result = await page.evaluate(() => __ps.typographyProfile());
    expect(result.data.scale.length).toBeGreaterThanOrEqual(4);
  });
});

test.describe('gradientProfile', () => {
  test('finds gradients on color fixture', async ({ page }) => {
    await page.goto('/color.html');
    const result = await page.evaluate(() => __ps.gradientProfile());
    expect(result.text).toBeTruthy();
    expect(result.data.gradients.length).toBeGreaterThan(0);
  });
});

test.describe('spacingProfile', () => {
  test('detects spacing values', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.spacingProfile());
    expect(result.text).toBeTruthy();
    expect(result.data).toBeDefined();
  });

  test('finds grid/flex gaps', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.spacingProfile());
    expect(result.data.gridFlexGaps.length).toBeGreaterThan(0);
  });
});

test.describe('responsiveProfile', () => {
  test('extracts media breakpoints', async ({ page }) => {
    await page.goto('/typography.html');
    const result = await page.evaluate(() => __ps.responsiveProfile());
    expect(result.text).toBeTruthy();
    expect(result.data.breakpoints.length).toBeGreaterThanOrEqual(2); // 480, 768, 1200
  });
});

test.describe('themeAudit', () => {
  test('finds theme escapes on dark page', async ({ page }) => {
    await page.goto('/color.html');
    const result = await page.evaluate(() => __ps.themeAudit());
    expect(result.darkMode.isDark).toBe(true);
    expect(result.escapes).toBeGreaterThan(0);
  });
});

test.describe('motionProfile', () => {
  test('returns animation and transition data', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.motionProfile());
    expect(result.text).toBeTruthy();
    expect(result.data).toBeDefined();
  });
});

test.describe('platformProfile', () => {
  test('returns platform detection data', async ({ page }) => {
    await page.goto('/color.html');
    const result = await page.evaluate(() => __ps.platformProfile());
    expect(result.text).toBeTruthy();
    expect(result.data).toBeDefined();
  });
});

test.describe('siteProfile', () => {
  test('runs all design system tools in one call', async ({ page }) => {
    await page.goto('/color.html');
    const result = await page.evaluate(() => __ps.siteProfile());
    expect(result.text).toBeTruthy();
    expect(result.data).toBeDefined();
    // Should contain results from sub-tools
    expect(result.data.palette).toBeDefined();
    expect(result.data.typography).toBeDefined();
  });
});
