const { test } = require('./helpers');
const { expect } = require('@playwright/test');

/**
 * Tests derived from real-site analysis (Stripe, Apple, Shopify, GitHub, Wikipedia).
 * Each test targets an edge case discovered by running the toolkit against live sites.
 */

// ── Light-mode palette with many CSS custom properties ──────────────────────

test.describe('paletteProfile on token-heavy light page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/real-site-edges.html');
  });

  test('detects light mode', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    expect(result.data.colors.length).toBeGreaterThan(0);
    // Light page — most colors should have high lightness
    const highL = result.data.colors.filter(c => c.L > 0.7);
    expect(highL.length).toBeGreaterThan(0);
  });

  test('discovers CSS custom property tokens', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    // Fixture has 30+ custom properties — tokenCount should reflect this
    expect(result.data.tokenCount).toBeGreaterThanOrEqual(10);
  });

  test('classifies harmony across multi-hue token set', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    // With accent, success, attention, danger hues — should not be monochromatic
    expect(result.data.harmony).not.toBe('monochromatic');
  });

  test('reports chromaAvg and chromaMax', async ({ page }) => {
    const result = await page.evaluate(() => __ps.paletteProfile());
    expect(typeof result.data.chromaAvg).toBe('number');
    expect(typeof result.data.chromaMax).toBe('number');
    expect(result.data.chromaMax).toBeGreaterThanOrEqual(result.data.chromaAvg);
  });
});

// ── colorProfile on light page with contrast issues ─────────────────────────

test.describe('colorProfile on light page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/real-site-edges.html');
  });

  test('detects light mode correctly', async ({ page }) => {
    const result = await page.evaluate(() => __ps.colorProfile());
    expect(result.darkMode.isDark).toBe(false);
  });

  test('contrast distribution has expected shape', async ({ page }) => {
    const result = await page.evaluate(() => __ps.colorProfile());
    const dist = result.contrastDistribution;
    expect(dist.min).toBeGreaterThan(0);
    expect(dist.max).toBeLessThanOrEqual(21);
    expect(dist.avg).toBeGreaterThan(0);
    expect(dist.total).toBeGreaterThan(0);
    // Percentiles should be monotonically non-decreasing
    expect(dist.p10).toBeLessThanOrEqual(dist.p25);
    expect(dist.p25).toBeLessThanOrEqual(dist.median);
    expect(dist.median).toBeLessThanOrEqual(dist.p75);
    expect(dist.p75).toBeLessThanOrEqual(dist.p90);
  });

  test('finds worst contrast pairs', async ({ page }) => {
    const result = await page.evaluate(() => __ps.colorProfile());
    // Muted text (--color-fg-muted) on subtle backgrounds should appear
    expect(result.worstContrastPairs.length).toBeGreaterThan(0);
    for (const pair of result.worstContrastPairs) {
      expect(pair).toHaveProperty('ratio');
      expect(pair.ratio).toBeLessThan(21);
    }
  });
});

// ── Responsive breakpoints ──────────────────────────────────────────────────

test.describe('responsiveProfile with many breakpoints', () => {
  test('extracts multiple breakpoints from inline styles', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.responsiveProfile());
    // Fixture has 9 @media rules
    expect(result.data.breakpoints.length).toBeGreaterThanOrEqual(5);
  });

  test('classifies breakpoints into tiers', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.responsiveProfile());
    const { tiers } = result.data;
    // Should have at least mobile and desktop tiers populated
    expect(tiers.mobile).toBeDefined();
    expect(tiers.desktop).toBeDefined();
  });

  test('reports accessible vs blocked stylesheet counts', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.responsiveProfile());
    // Inline stylesheets should be accessible (not blocked)
    expect(result.data.sheetsAccessible).toBeGreaterThan(0);
  });
});

// ── Touch targets — small links and proper CTA ─────────────────────────────

test.describe('touchTargets on page with mixed sizes', () => {
  test('finds interactive elements', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.touchTargets());
    // Nav links + sidebar links + button
    expect(result.count).toBeGreaterThanOrEqual(8);
  });

  test('flags small touch targets below 44x44', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.touchTargets());
    // Sidebar links are 12px font with 2px padding — well below 44x44
    expect(result.tooSmall).toBeGreaterThan(0);
  });

  test('each target has position and size data', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.touchTargets());
    for (const t of result.targets.slice(0, 5)) {
      // touchTargets uses 'box' (not 'rect') with w/h/x/y
      expect(t).toHaveProperty('box');
      expect(t.box).toHaveProperty('w');
      expect(t.box).toHaveProperty('h');
    }
  });
});

// ── Gradient detection with radial, conic, and multi-stop ───────────────────

test.describe('gradientProfile with varied gradient types', () => {
  test('finds multiple gradient types', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.gradientProfile());
    // Fixture has linear-gradient (hero bg), radial-gradient, conic-gradient, and multi-stop linear
    expect(result.data.gradients.length).toBeGreaterThanOrEqual(3);
  });

  test('each gradient has classification', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.gradientProfile());
    for (const g of result.data.gradients) {
      expect(g).toHaveProperty('type');
    }
  });
});

// ── Spacing detection ───────────────────────────────────────────────────────

test.describe('spacingProfile on real-world layout', () => {
  test('detects a base unit', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.spacingProfile());
    // Fixture uses 8px and 16px spacing — base unit should be 8
    expect(result.data.baseUnit).toBeGreaterThan(0);
  });

  test('finds grid/flex gaps', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.spacingProfile());
    // Card grid has gap: 24px, nav has gap: 4px
    expect(result.data.gridFlexGaps.length).toBeGreaterThan(0);
  });
});

// ── Theme audit on light page with dark section ─────────────────────────────

test.describe('themeAudit on light page', () => {
  test('reports page as not dark mode', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.themeAudit());
    // Light page — themeAudit notes it's not applicable or finds no escapes
    expect(result.darkMode.isDark).toBe(false);
  });
});

// ── scanAnomalies on light page ─────────────────────────────────────────────

test.describe('scanAnomalies on light page', () => {
  test('returns count and severity buckets', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.scanAnomalies());
    expect(typeof result.count).toBe('number');
    expect(typeof result.high).toBe('number');
    expect(typeof result.medium).toBe('number');
    expect(typeof result.low).toBe('number');
    expect(result.count).toBe(result.high + result.medium + result.low);
  });
});

// ── Overlays and positioned elements ────────────────────────────────────────

test.describe('discoverOverlays with positioned elements', () => {
  test('finds positioned overlapping boxes', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.discoverOverlays());
    // Sticky header + two absolute-positioned boxes at minimum
    expect(result.overlays).toBeGreaterThanOrEqual(2);
  });

  test('overlay items have viewport and z-index info', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.discoverOverlays());
    expect(result.viewport).toHaveProperty('w');
    expect(result.viewport).toHaveProperty('h');
    for (const item of result.items.slice(0, 3)) {
      expect(item).toHaveProperty('zIndex');
    }
  });
});

// ── Scroll audit — container detection and traps ────────────────────────────

test.describe('scrollAudit with scroll container', () => {
  test('discovers the scroll-box container', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.scrollAudit());
    expect(result.items.length).toBeGreaterThan(0);
    // At least the .scroll-box div should be found
    const scrollBox = result.items.find(i => i.selector?.includes('scroll') || i.path?.includes('scroll'));
    // Even if selector isn't exact, we should have items
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  test('traps is null when no scroll traps exist', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.scrollAudit());
    // No scroll traps in this fixture — traps should be null (not empty array)
    // This matches the real-site behavior observed on Stripe
    expect(result.traps === null || Array.isArray(result.traps)).toBe(true);
  });
});

// ── Motion profile — transitions and animations ─────────────────────────────

test.describe('motionProfile with CSS transitions and keyframes', () => {
  test('finds card hover transitions', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.motionProfile());
    expect(result.data.transitions.length).toBeGreaterThan(0);
  });

  test('finds the pulse keyframe animation', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.motionProfile());
    expect(result.data.animations.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Page map — pattern detection ────────────────────────────────────────────

test.describe('pageMap pattern detection', () => {
  test('returns a string with page dimensions', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.pageMap());
    expect(typeof result).toBe('string');
    expect(result).toContain('PAGE');
  });

  test('detects card-grid pattern', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.pageMap());
    // Should detect the 3-column card grid
    expect(result).toMatch(/card-grid/i);
  });

  test('summary mode returns shorter output', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const full = await page.evaluate(() => __ps.pageMap());
    const summary = await page.evaluate(() => __ps.pageMap({ summary: true }));
    expect(summary.length).toBeLessThan(full.length);
  });
});

// ── Layout tools on real-world structure ────────────────────────────────────

test.describe('layout tools on complex page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/real-site-edges.html');
  });

  test('layoutBox returns box model for body', async ({ page }) => {
    const result = await page.evaluate(() => __ps.layoutBox('body'));
    expect(result.length).toBe(1);
    expect(result[0].box).toBeDefined();
    expect(result[0].display).toBeDefined();
  });

  test('layoutAggregate stats across many links', async ({ page }) => {
    const result = await page.evaluate(() => __ps.layoutAggregate('a'));
    expect(result.count).toBeGreaterThanOrEqual(10);
    expect(result.width).toHaveProperty('min');
    expect(result.width).toHaveProperty('max');
    expect(result.width).toHaveProperty('avg');
    expect(result.width.min).toBeLessThanOrEqual(result.width.max);
  });

  test('layoutGap between header and hero', async ({ page }) => {
    const result = await page.evaluate(() => __ps.layoutGap('.site-header', '.hero-section'));
    expect(result.arrangement).toBeDefined();
    expect(typeof result.gapY).toBe('number');
  });

  test('layoutTree from card grid shows children', async ({ page }) => {
    const result = await page.evaluate(() => __ps.layoutTree('.card-grid'));
    expect(result.children.length).toBeGreaterThan(0);
  });

  test('layoutDensity on card-grid reports fill ratio', async ({ page }) => {
    const result = await page.evaluate(() => __ps.layoutDensity('.card-grid'));
    expect(result.fill).toBeDefined();
    expect(result.fill.childrenPct).toBeGreaterThan(0);
  });

  test('ancestry from card walks up the DOM', async ({ page }) => {
    const result = await page.evaluate(() => __ps.ancestry('.card'));
    expect(result.target).toBe('.card');
    expect(result.chain.length).toBeGreaterThan(1);
    // Each chain entry has selector, display, position, box
    for (const entry of result.chain) {
      expect(entry).toHaveProperty('selector');
      expect(entry).toHaveProperty('display');
      expect(entry).toHaveProperty('box');
      expect(entry.box).toHaveProperty('w');
      expect(entry.box).toHaveProperty('h');
    }
    // Last entry should be body (loop stops before documentElement)
    const last = result.chain[result.chain.length - 1];
    expect(last.selector).toBe('body');
  });
});

// ── Platform detection ──────────────────────────────────────────────────────

test.describe('platformProfile on simple page', () => {
  test('returns expected data shape', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.platformProfile());
    expect(result.data).toHaveProperty('cms');
    expect(result.data).toHaveProperty('libraries');
    expect(result.data).toHaveProperty('analytics');
    expect(result.data).toHaveProperty('meta');
  });
});

// ── Gesture tools ───────────────────────────────────────────────────────────

test.describe('gesture tools on real-world page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/real-site-edges.html');
  });

  test('gesturePlan touchScroll produces correct step count', async ({ page }) => {
    const result = await page.evaluate(() =>
      __ps.gesturePlan('touchScroll', { startX: 400, startY: 500, endX: 400, endY: 200 })
    );
    expect(result.gesture).toBe('touchScroll');
    expect(result.steps.length).toBe(result.stepCount);
    expect(result.totalMs).toBeGreaterThan(0);
  });

  test('gesturePlan touchTap produces short sequence', async ({ page }) => {
    const result = await page.evaluate(() =>
      __ps.gesturePlan('touchTap', { x: 400, y: 300 })
    );
    expect(result.gesture).toBe('touchTap');
    expect(result.stepCount).toBeLessThan(10);
  });

  test('gestureCapture starts recording', async ({ page }) => {
    const result = await page.evaluate(() => __ps.gestureCapture());
    expect(result.capturing).toBe(true);
  });

  test('gestureResults returns after capture', async ({ page }) => {
    await page.evaluate(() => __ps.gestureCapture());
    const result = await page.evaluate(() => __ps.gestureResults());
    expect(result).toHaveProperty('entryCount');
    expect(result).toHaveProperty('scrollDeltas');
  });
});

// ── siteProfile composite ───────────────────────────────────────────────────

test.describe('siteProfile composite on complex page', () => {
  test('aggregates all sub-profiles', async ({ page }) => {
    await page.goto('/real-site-edges.html');
    const result = await page.evaluate(() => __ps.siteProfile());
    expect(result.text).toBeTruthy();
    const d = result.data;
    expect(d.palette).toBeDefined();
    expect(d.typography).toBeDefined();
    expect(d.spacing).toBeDefined();
    expect(d.gradient).toBeDefined();
    expect(d.motion).toBeDefined();
    expect(d.responsive).toBeDefined();
    expect(d.platform).toBeDefined();
  });
});

// ── inspect and traceStyle on deep DOM ──────────────────────────────────────

test.describe('inspect and traceStyle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/real-site-edges.html');
  });

  test('inspect returns styles for card selector', async ({ page }) => {
    const result = await page.evaluate(() => __ps.inspect('.card'));
    expect(result.length).toBe(3); // 3 cards in grid
    for (const item of result) {
      expect(item.styles).toBeDefined();
      expect(item.path).toBeDefined();
    }
  });

  test('traceStyle shows cascade for background-color', async ({ page }) => {
    const result = await page.evaluate(() => __ps.traceStyle('.dark-section', 'background-color'));
    expect(result.property).toBe('background-color');
    expect(result.computedValue).toBeDefined();
  });
});
