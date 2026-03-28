const { test } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('hueName()', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/color.html');
  });

  test('maps oklch hue angles to correct color names', async ({ page }) => {
    const cases = await page.evaluate(() => {
      const hn = __ps._util.hueName;
      return [
        [0, hn(0)], [10, hn(10)], [355, hn(355)],   // pink (wraps 0)
        [25, hn(25)], [40, hn(40)],                    // red
        [50, hn(50)], [65, hn(65)],                    // orange
        [80, hn(80)], [95, hn(95)],                    // yellow
        [110, hn(110)], [125, hn(125)],                // lime
        [140, hn(140)], [155, hn(155)],                // green
        [170, hn(170)], [185, hn(185)],                // teal
        [200, hn(200)], [220, hn(220)],                // cyan
        [230, hn(230)], [255, hn(255)],                // blue
        [270, hn(270)], [285, hn(285)],                // indigo
        [300, hn(300)], [340, hn(340)],                // purple
      ];
    });
    const map = Object.fromEntries(cases);
    expect(map[0]).toBe('pink');
    expect(map[10]).toBe('pink');
    expect(map[355]).toBe('pink');
    expect(map[25]).toBe('red');
    expect(map[40]).toBe('red');
    expect(map[50]).toBe('orange');
    expect(map[65]).toBe('orange');
    expect(map[80]).toBe('yellow');
    expect(map[95]).toBe('yellow');
    expect(map[110]).toBe('lime');
    expect(map[125]).toBe('lime');
    expect(map[140]).toBe('green');
    expect(map[155]).toBe('green');
    expect(map[170]).toBe('teal');
    expect(map[185]).toBe('teal');
    expect(map[200]).toBe('cyan');
    expect(map[220]).toBe('cyan');
    expect(map[230]).toBe('blue');
    expect(map[255]).toBe('blue');
    expect(map[270]).toBe('indigo');
    expect(map[285]).toBe('indigo');
    expect(map[300]).toBe('purple');
    expect(map[340]).toBe('purple');
  });
});

test.describe('colorTone()', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/color.html');
  });

  // --- Pure neutrals (C < 0.01) ---

  test('pure white', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(255, 255, 255);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toBe('white');
  });

  test('pure black', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(0, 0, 0);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toBe('black');
  });

  test('mid gray', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(128, 128, 128);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toBe('gray');
  });

  test('light gray', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(200, 200, 200);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toBe('light gray');
  });

  test('dark gray', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(50, 50, 50);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toBe('dark gray');
  });

  // --- Tinted neutrals (C 0.01–0.04): noun is the neutral ---

  test('near-white with slight blue tint', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(230, 232, 240);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/-ish (white|gray)$/);
  });

  test('near-black with slight red tint', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(35, 25, 25);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/-ish (black|gray)$/);
  });

  // --- Tinted neutral vs muted accent boundary (C ≈ 0.04) ---

  test('boundary: C just below 0.04 is tinted neutral (hue-ish noun)', async ({ page }) => {
    const tone = await page.evaluate(() =>
      __ps._util.colorTone(0.60, 0.039, 240));
    expect(tone).toMatch(/-ish gray$/);
  });

  test('boundary: C just above 0.04 is muted accent (grayish hue)', async ({ page }) => {
    const tone = await page.evaluate(() =>
      __ps._util.colorTone(0.60, 0.041, 240));
    expect(tone).toMatch(/^(grayish|pale|dark grayish) /);
  });

  // --- Muted accents (C 0.04–0.08) ---

  test('pale muted accent at high lightness', async ({ page }) => {
    const tone = await page.evaluate(() =>
      __ps._util.colorTone(0.80, 0.06, 240));
    expect(tone).toBe('pale blue');
  });

  test('grayish muted accent at mid lightness', async ({ page }) => {
    const tone = await page.evaluate(() =>
      __ps._util.colorTone(0.50, 0.06, 140));
    expect(tone).toBe('grayish green');
  });

  test('dark grayish muted accent at low lightness', async ({ page }) => {
    const tone = await page.evaluate(() =>
      __ps._util.colorTone(0.25, 0.06, 30));
    expect(tone).toBe('dark grayish red');
  });

  // --- Known colors ---

  test('hot pink → strong or vivid pink', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(255, 105, 180);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/^(vivid|strong|brilliant) pink$/);
  });

  test('navy → deep blue or deep indigo', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(0, 0, 128);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/^deep (blue|indigo)$/);
  });

  test('burgundy → deep red or deep pink', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(128, 0, 32);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/^deep (red|pink)$/);
  });

  test('pastel blue → light or pale or tinted neutral', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(174, 198, 207);
      return __ps._util.colorTone(L, C, h);
    });
    // Pastel blue has very low chroma — could land in tinted neutral or pale
    expect(tone).toMatch(/(pale|light|ish)/);
  });

  test('neon green → vivid green or vivid lime', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(57, 255, 20);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/^vivid (green|lime)$/);
  });

  // --- Edge cases ---

  test('near-black with tint stays in tinted/muted zone, not chromatic', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(20, 5, 5);
      return __ps._util.colorTone(L, C, h);
    });
    // Very dark, low chroma — should be a dark neutral or tinted neutral
    expect(tone).toMatch(/(black|dark gray|ish black)/);
  });

  test('near-white with tint stays in tinted/pale zone', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(255, 250, 240);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/(white|ish white|pale)/);
  });

  test('pure red → strong red', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(255, 0, 0);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/^(strong|vivid) red$/);
  });

  test('pure blue → deep or strong blue', async ({ page }) => {
    const tone = await page.evaluate(() => {
      const { L, C, h } = __ps._util.rgbToOklch(0, 0, 255);
      return __ps._util.colorTone(L, C, h);
    });
    expect(tone).toMatch(/^(deep|strong) (blue|indigo)$/);
  });
});
