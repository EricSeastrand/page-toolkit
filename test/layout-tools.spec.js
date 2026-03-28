const { test } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('pageMap', () => {
  test('returns a string with page structure', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.pageMap({ tree: true }));
    expect(typeof result).toBe('string');
    expect(result).toContain('hero');
  });

  test('includes fold marker', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.pageMap({ tree: true }));
    expect(result).toContain('fold');
  });

  test('detects layout patterns', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.pageMap({ patterns: true, tree: true }));
    expect(result).toMatch(/\[.*\]/); // pattern labels like [hero], [card-grid]
  });

  test('summary mode returns abbreviated output', async ({ page }) => {
    await page.goto('/layout.html');
    const full = await page.evaluate(() => __ps.pageMap({ tree: true }));
    const summary = await page.evaluate(() => __ps.pageMap({ summary: true }));
    expect(summary.length).toBeLessThan(full.length);
  });
});

test.describe('ancestry', () => {
  test('returns chain from element to body', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.ancestry('.card'));
    expect(result.chain).toBeDefined();
    expect(result.chain.length).toBeGreaterThan(0);
  });
});

test.describe('layoutBox', () => {
  test('returns box model for matched elements', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.layoutBox('.card'));
    expect(result.length).toBe(6); // 6 cards
    expect(result[0].box).toBeDefined();
    expect(result[0].pctOfParent).toBeDefined();
  });
});

test.describe('layoutAggregate', () => {
  test('returns stats across matches', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.layoutAggregate('.card'));
    expect(result.count).toBe(6);
    expect(result.width).toBeDefined();
    expect(result.height).toBeDefined();
  });
});

test.describe('layoutGap', () => {
  test('measures gap between two elements', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() =>
      __ps.layoutGap('.sticky-header', '.hero'));
    expect(result.gapY).toBeDefined();
    expect(result.arrangement).toBeTruthy();
  });
});

test.describe('layoutTree', () => {
  test('traverses parents and children', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() =>
      __ps.layoutTree('.card-grid', { parents: 2, children: 2 }));
    expect(result.parents).toBeDefined();
    expect(result.children).toBeDefined();
  });
});

test.describe('scrollAudit', () => {
  test('finds scroll containers', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.scrollAudit());
    expect(result.items).toBeDefined();
  });

  test('detects scroll traps', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.scrollAudit());
    expect(result.traps).toBeDefined();
    expect(result.traps.length).toBeGreaterThan(0);
  });
});

test.describe('discoverOverlays', () => {
  test('finds fixed/absolute positioned elements', async ({ page }) => {
    await page.goto('/layout.html');
    const result = await page.evaluate(() => __ps.discoverOverlays());
    expect(result.items).toBeDefined();
    // Should find the sticky header and fixed overlay
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });
});
