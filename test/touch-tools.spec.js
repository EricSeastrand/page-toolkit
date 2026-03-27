const { test } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('touchTargets', () => {
  test('inventories interactive elements', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.touchTargets());
    expect(result).toBeDefined();
    expect(result.targets).toBeDefined();
  });
});

test.describe('eventMap', () => {
  test('returns handler info for a selector', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.eventMap('nav'));
    expect(result).toBeDefined();
  });
});

test.describe('gesturePlan', () => {
  test('generates CDP touch event steps for scroll', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() =>
      __ps.gesturePlan('touchScroll', {
        target: '.scroll-trap',
        deltaY: -50,
      }));
    expect(result.steps).toBeDefined();
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.totalMs).toBeGreaterThan(0);
  });

  test('generates tap steps', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() =>
      __ps.gesturePlan('touchTap', { target: '.card' }));
    expect(result.steps).toBeDefined();
    expect(result.gesture).toBe('touchTap');
  });
});

test.describe('gestureCapture + gestureResults', () => {
  test('capture starts and results return data', async ({ page }) => {
    await page.goto('/layout.html');

    const capture = await page.evaluate(() =>
      __ps.gestureCapture('.scroll-trap'));
    expect(capture.capturing).toBe(true);

    const results = await page.evaluate(() => __ps.gestureResults());
    expect(results).toBeDefined();
    expect(results.scrollDeltas).toBeDefined();
  });
});
