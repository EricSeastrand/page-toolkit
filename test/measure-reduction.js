/**
 * Measure raw JSON output size across tools on real sites.
 * Compares current toolkit output sizes and prints per-tool char counts.
 *
 * Usage: node test/measure-reduction.js
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
  { name: 'github', url: 'https://github.com' },
  { name: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
];

// Tools that changed + siteProfile composite
const TOOLS = [
  ['layoutDensity', '__ps.layoutDensity("body")'],
  ['gradientProfile', '__ps.gradientProfile()'],
  ['scrollAudit', '__ps.scrollAudit()'],
  ['touchTargets', '__ps.touchTargets()'],
  ['motionProfile', '__ps.motionProfile()'],
  ['pageMap', '__ps.pageMap()'],
  ['paletteProfile', '__ps.paletteProfile()'],
  ['siteProfile', '__ps.siteProfile()'],
];

async function measureSite(browser, site) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  await context.addInitScript(TOOLKIT_SCRIPT);
  const page = await context.newPage();

  try {
    await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
  }

  const sizes = {};
  for (const [name, expr] of TOOLS) {
    try {
      const chars = await Promise.race([
        page.evaluate(`JSON.stringify(${expr}).length`),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
      sizes[name] = chars;
    } catch (e) {
      sizes[name] = 'ERR: ' + e.message.split('\n')[0];
    }
  }

  await context.close();
  return sizes;
}

async function main() {
  console.log('Connecting to Browserless via CDP...');
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  console.log('Connected.\n');

  const allSizes = {};
  for (const site of SITES) {
    process.stdout.write(`${site.name}... `);
    allSizes[site.name] = await measureSite(browser, site);
    console.log('done');
  }

  // Print table
  console.log('\n--- Raw JSON.stringify().length (chars) ---\n');
  const tools = TOOLS.map(t => t[0]);
  const header = ['site', ...tools].map(s => s.padEnd(18)).join('');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const site of SITES) {
    const row = [site.name, ...tools.map(t => {
      const v = allSizes[site.name][t];
      return typeof v === 'number' ? v.toLocaleString() : v;
    })];
    console.log(row.map(s => String(s).padEnd(18)).join(''));
  }

  // Totals per tool
  console.log('-'.repeat(header.length));
  const totals = ['TOTAL', ...tools.map(t => {
    let sum = 0;
    for (const site of SITES) {
      const v = allSizes[site.name][t];
      if (typeof v === 'number') sum += v;
    }
    return sum.toLocaleString();
  })];
  console.log(totals.map(s => String(s).padEnd(18)).join(''));

  await browser.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
