# Browserless v2 Stealth and Anti-Detection

Researched 2026-03-29. Sources: Browserless docs, GitHub issues, blog posts.

## 1. Built-in stealth mode

Browserless v2 has a **`stealth` launch parameter** (boolean, default `false`). Two ways to enable it:

**Query parameter on the connection URL:**
```
wss://host:port/?token=TOKEN&stealth=true
```

**JSON launch parameter:**
```
wss://host:port/?token=TOKEN&launch={"stealth":true}
```

The cloud-hosted BaaS also offers dedicated **stealth route paths** (`/stealth`, `/chromium/stealth`, `/chrome/stealth`) that apply fingerprint mitigations and entropy injection at the connection level. These modify browser APIs with "subtle, realistic values to closely emulate a real browser."

**Note:** The old v1 `DEFAULT_STEALTH` environment variable is gone in v2. Stealth is now per-request, not per-container.

## 2. Passing Chrome launch args

Chrome flags go in the `args` array inside a `launch` JSON object, URL-encoded as a query parameter:

```js
const launchArgs = {
  args: [
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    '--lang=en-US'
  ]
};

const ws = `ws://10.23.20.10:3000/?launch=${encodeURIComponent(JSON.stringify(launchArgs))}`;
const browser = await chromium.connectOverCDP(ws);
```

The old `DEFAULT_LAUNCH_ARGS` env var is **deprecated in v2**. All launch config is per-request now.

### Allowed flags (documented allowlist)

The docs explicitly list these as allowed for all accounts: `--disable-features`, `--disable-setuid-sandbox`, `--disable-site-isolation-trials`, `--disable-web-security`, `--enable-features`, `--font-render-hinting`, `--force-color-profile`, `--lang`, `--proxy-bypass-list`, `--proxy-server`, `--window-size`.

`--disable-blink-features` is **not on the documented allowlist**. Whether it's silently accepted or stripped depends on the deployment (self-hosted vs cloud). Self-hosted likely passes everything through; cloud may filter.

## 3. --disable-blink-features=AutomationControlled

Not explicitly documented as supported. However:
- The stealth routes/mode likely apply this internally (it's the standard technique)
- Self-hosted instances should accept any Chrome flag since there's no server-side filtering
- Worth testing: pass it in `args` and check `navigator.webdriver` to confirm

## 4. Custom user-agent at the Browserless level

**No native Browserless parameter for user-agent.** You must set it yourself via:
- Chrome flag: `--user-agent=...` in the `args` array (if accepted)
- CDP: `Network.setUserAgentOverride` after connecting
- Playwright: `context.newContext({ userAgent: '...' })` or `page.setExtraHTTPHeaders()`
- `addInitScript`: override `navigator.userAgent` getter

## 5. navigator.webdriver

When `stealth=true` or a `/stealth` route is used, Browserless should handle this (the underlying puppeteer-extra-plugin-stealth sets `navigator.webdriver` to `undefined`).

For non-stealth connections, `navigator.webdriver` will be `true` by default. To fix it yourself:

```js
// In addInitScript
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
});
```

Or pass `--disable-blink-features=AutomationControlled` in launch args (prevents Chrome from setting it in the first place).

## 6. puppeteer-extra-plugin-stealth integration

Browserless v1 bundled puppeteer-extra-plugin-stealth directly (via `DEFAULT_STEALTH=true`). In v2, the `stealth` parameter and stealth routes provide equivalent functionality at the platform level. The plugin itself was discontinued in February 2025.

You **cannot** use puppeteer-extra-plugin-stealth with Playwright directly (it's Puppeteer-only). For Playwright over CDP, you rely on either:
- Browserless `stealth=true` (server-side)
- Manual mitigations in `addInitScript` (client-side)

## What Browserless handles natively vs what we do in addInitScript

| Concern | Browserless stealth | Our addInitScript |
|---------|--------------------|--------------------|
| `navigator.webdriver` | Yes (stealth mode) | Backup: `Object.defineProperty` override |
| User-agent string | No | Yes: must set ourselves |
| `HeadlessChrome` in UA | Likely yes (stealth) | Backup: UA override |
| Chrome automation flags | Yes (stealth routes) | N/A |
| `window.chrome` runtime | Likely yes (stealth) | Backup: mock if needed |
| WebGL fingerprint | Partial (entropy) | Not needed for our use case |
| Plugin/mime arrays | Likely yes (stealth) | Backup: mock if needed |
| `Permissions.query` | Likely yes (stealth) | Backup if needed |

## Recommendation for page-toolkit

For our self-hosted instance at 10.23.20.10:3000:

1. **Add `stealth=true` to the CDP connection URL** -- cheapest win, handled server-side
2. **Keep `addInitScript` overrides as defense-in-depth** for `navigator.webdriver`, user-agent, and any other properties we need
3. **Test `--disable-blink-features=AutomationControlled` in launch args** to see if self-hosted accepts it
4. Pass a realistic user-agent via Playwright context options (not Browserless)
