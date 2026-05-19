const { test: base, chromium } = require('@playwright/test');
const { CDP_ENDPOINT, createStealthContext } = require('./stealth-config');

// Extend Playwright's test to connect via CDP and auto-inject the toolkit
const test = base.extend({
  // Connect to the remote browser over CDP instead of launching locally
  browser: async ({}, use) => {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    await use(browser);
    await browser.close();
  },

  // Fresh context per test with stealth + toolkit init scripts
  context: async ({ browser }, use) => {
    const context = await createStealthContext(browser);
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
