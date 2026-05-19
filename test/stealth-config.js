/**
 * Shared stealth configuration for all browser sessions.
 *
 * Centralizes CDP endpoint, user-agent, viewport, and stealth script
 * so every test/exploration script uses consistent anti-detection settings.
 */
const path = require('path');
const fs = require('fs');

const BASE_CDP = process.env.CDP_ENDPOINT || 'ws://10.23.20.10:3000?token=headless-browser-token';

// Append stealth mode and launch args for anti-detection
const stealthParams = new URLSearchParams();
if (!BASE_CDP.includes('stealth=')) stealthParams.set('stealth', 'true');
if (!BASE_CDP.includes('launch=')) {
  stealthParams.set('launch', JSON.stringify({
    args: [
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
  }));
}
const separator = BASE_CDP.includes('?') ? '&' : '?';
const CDP_ENDPOINT = BASE_CDP + separator + stealthParams.toString();

const TOOLKIT_PATH = path.join(__dirname, '..', 'toolkit.js');
const STEALTH_PATH = path.join(__dirname, '..', 'src', 'stealth.js');
const TOOLKIT_SCRIPT = fs.readFileSync(TOOLKIT_PATH, 'utf8');
const STEALTH_SCRIPT = fs.readFileSync(STEALTH_PATH, 'utf8');

// Current Chrome stable UA — update periodically
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

const CONTEXT_OPTIONS = {
  viewport: { width: 1280, height: 800 },
  screen: { width: 1440, height: 900 },
  userAgent: USER_AGENT,
  locale: 'en-US',
  timezoneId: 'America/New_York',
};

/**
 * Create a new browser context with stealth + toolkit injected.
 * @param {import('playwright').Browser} browser
 * @param {object} [extraOptions] - Additional context options to merge
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function createStealthContext(browser, extraOptions = {}) {
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, ...extraOptions });
  await context.addInitScript(STEALTH_SCRIPT);
  await context.addInitScript(TOOLKIT_SCRIPT);
  return context;
}

module.exports = {
  CDP_ENDPOINT,
  TOOLKIT_PATH,
  TOOLKIT_SCRIPT,
  STEALTH_SCRIPT,
  USER_AGENT,
  CONTEXT_OPTIONS,
  createStealthContext,
};
