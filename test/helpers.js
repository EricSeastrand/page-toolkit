const { test: base, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'ws://10.23.20.10:3000?token=headless-browser-token';
const TOOLKIT_PATH = path.join(__dirname, '..', 'toolkit.js');
const TOOLKIT_SCRIPT = fs.readFileSync(TOOLKIT_PATH, 'utf8');

// Extend Playwright's test to connect via CDP and auto-inject the toolkit
const test = base.extend({
  // Connect to the remote browser over CDP instead of launching locally
  browser: async ({}, use) => {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    await use(browser);
    await browser.close();
  },

  // Fresh context per test with the toolkit init script
  context: async ({ browser }, use) => {
    const context = await browser.newContext();
    await context.addInitScript(TOOLKIT_SCRIPT);
    await use(context);
    await context.close();
  },

  // Fresh page from our context
  page: async ({ context, baseURL }, use) => {
    const page = await context.newPage();
    const originalGoto = page.goto.bind(page);
    page.goto = (url, opts) => {
      if (url.startsWith('/')) url = baseURL + url;
      return originalGoto(url, opts);
    };
    await use(page);
  },
});

module.exports = { test };
