/**
 * Real-site exploration script — runs every toolkit tool against live websites
 * to discover edge cases, crashes, and gaps in tool output.
 *
 * Usage: node test/explore-real-sites.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'ws://10.23.20.10:3000?token=headless-browser-token';
const TOOLKIT_PATH = path.join(__dirname, '..', 'toolkit.js');
const TOOLKIT_SCRIPT = fs.readFileSync(TOOLKIT_PATH, 'utf8');

const SITES = [
  { name: 'stripe', url: 'https://stripe.com' },
  { name: 'apple', url: 'https://www.apple.com' },
  { name: 'shopify-dawn', url: 'https://themes.shopify.com/themes/dawn/styles/default/preview' },
  { name: 'github', url: 'https://github.com' },
  { name: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
];

// Tools to run — each is [name, expression]
const TOOLS = [
  ['colorProfile', '__ps.colorProfile()'],
  ['paletteProfile', '__ps.paletteProfile()'],
  ['typographyProfile', '__ps.typographyProfile()'],
  ['gradientProfile', '__ps.gradientProfile()'],
  ['spacingProfile', '__ps.spacingProfile()'],
  ['scanAnomalies', '__ps.scanAnomalies()'],
  ['themeAudit', '__ps.themeAudit()'],
  ['discoverOverlays', '__ps.discoverOverlays()'],
  ['motionProfile', '__ps.motionProfile()'],
  ['pageMap', '__ps.pageMap()'],
  ['pageMap_summary', '__ps.pageMap({ summary: true })'],
  ['responsiveProfile', '__ps.responsiveProfile()'],
  ['platformProfile', '__ps.platformProfile()'],
  ['touchTargets', '__ps.touchTargets()'],
  ['scrollAudit', '__ps.scrollAudit()'],
  ['siteProfile', '__ps.siteProfile()'],
  // Tools that need a selector — use body or first link
  ['inspect_body', '__ps.inspect("body")'],
  ['ancestry_link', '(() => { const el = document.querySelector("a"); return el ? __ps.ancestry("a") : { skipped: "no anchor found" }; })()'],
  ['layoutBox_body', '__ps.layoutBox("body")'],
  ['layoutAggregate_a', '__ps.layoutAggregate("a")'],
  ['layoutTree_body', '__ps.layoutTree("body")'],
  ['layoutDensity_body', '__ps.layoutDensity("body")'],
  ['eventMap_a', '(() => { const el = document.querySelector("a"); return el ? __ps.eventMap("a") : { skipped: "no anchor found" }; })()'],
  ['gesturePlan_scroll', '__ps.gesturePlan("touchScroll", { startX: 200, startY: 400, endX: 200, endY: 100 })'],
  ['gesturePlan_tap', '__ps.gesturePlan("touchTap", { x: 200, y: 200 })'],
];

async function exploreSite(browser, site) {
  const results = { site: site.name, url: site.url, tools: {}, errors: [], pageErrors: [] };
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  await context.addInitScript(TOOLKIT_SCRIPT);
  const page = await context.newPage();

  // Capture page errors
  page.on('pageerror', err => results.pageErrors.push(err.message));

  try {
    await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    // networkidle may timeout on heavy sites — try domcontentloaded fallback
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000); // let JS settle
    } catch (e2) {
      results.errors.push({ tool: '_navigation', error: e2.message });
      await context.close();
      return results;
    }
  }

  for (const [name, expr] of TOOLS) {
    try {
      const start = Date.now();
      const result = await Promise.race([
        page.evaluate(expr),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (15s)')), 15000)),
      ]);
      const elapsed = Date.now() - start;
      results.tools[name] = {
        ok: true,
        elapsed,
        type: typeof result,
        isNull: result === null || result === undefined,
        isEmpty: Array.isArray(result) ? result.length === 0
          : typeof result === 'object' && result !== null ? Object.keys(result).length === 0
          : false,
        // Store summary info, not full data (too large)
        summary: summarize(name, result),
      };
    } catch (e) {
      results.tools[name] = {
        ok: false,
        error: e.message.split('\n')[0],
      };
      results.errors.push({ tool: name, error: e.message.split('\n')[0] });
    }
  }

  await context.close();
  return results;
}

function summarize(name, result) {
  if (result === null || result === undefined) return null;
  if (typeof result === 'string') return { length: result.length, preview: result.slice(0, 200) };
  if (typeof result !== 'object') return result;

  // For tools returning { text, data }
  if (result.text && result.data) {
    const data = result.data;
    return {
      textLength: result.text.length,
      dataKeys: Object.keys(data),
      // Pull interesting stats
      ...(data.totalColors !== undefined && { totalColors: data.totalColors }),
      ...(data.harmony && { harmony: data.harmony }),
      ...(data.families && { familyCount: data.families.length }),
      ...(data.gradients && { gradientCount: data.gradients.length }),
      ...(data.baseUnit !== undefined && { baseUnit: data.baseUnit }),
      ...(data.breakpoints && { breakpointCount: data.breakpoints.length }),
      ...(data.animations && { animationCount: data.animations.length }),
      ...(data.transitions && { transitionCount: data.transitions.length }),
      ...(data.colors && { colorCount: data.colors.length }),
    };
  }

  // For array results
  if (Array.isArray(result)) {
    return { count: result.length, firstKeys: result[0] ? Object.keys(result[0]) : [] };
  }

  // For object results — top-level keys and counts
  const s = {};
  for (const [k, v] of Object.entries(result)) {
    if (Array.isArray(v)) s[k] = v.length;
    else if (typeof v === 'object' && v !== null) s[k] = Object.keys(v);
    else s[k] = v;
  }
  return s;
}

async function main() {
  console.log('Connecting to Browserless via CDP...');
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  console.log('Connected.\n');

  const allResults = [];

  for (const site of SITES) {
    console.log(`--- ${site.name} (${site.url}) ---`);
    const result = await exploreSite(browser, site);

    // Print summary
    const toolNames = Object.keys(result.tools);
    const passed = toolNames.filter(t => result.tools[t].ok);
    const failed = toolNames.filter(t => !result.tools[t].ok);
    const slow = toolNames.filter(t => result.tools[t].ok && result.tools[t].elapsed > 3000);
    const empty = toolNames.filter(t => result.tools[t].ok && (result.tools[t].isNull || result.tools[t].isEmpty));

    console.log(`  Tools: ${passed.length}/${toolNames.length} passed`);
    if (failed.length) console.log(`  FAILED: ${failed.join(', ')}`);
    if (slow.length) console.log(`  SLOW (>3s): ${slow.map(t => `${t}(${result.tools[t].elapsed}ms)`).join(', ')}`);
    if (empty.length) console.log(`  EMPTY: ${empty.join(', ')}`);
    if (result.pageErrors.length) console.log(`  Page errors: ${result.pageErrors.length}`);
    console.log('');

    allResults.push(result);
  }

  // Write full results to file
  const outPath = path.join(__dirname, '..', 'test-results', 'real-site-exploration.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`Full results written to ${outPath}`);

  await browser.close();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
