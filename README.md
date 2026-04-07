# Page Toolkit

26-tool frontend analysis toolkit for autonomous page inspection. Injects into any page via Playwright, analyzes color, layout, typography, touch interaction, and accessibility — then returns structured data, not screenshots.

## Quick Start — Give This to Claude

```
Clone https://github.com/EricSeastrand/page-toolkit and set it up for me.

1. Clone the repo and run `npm install` then `npx playwright install chromium`
2. Run `./build.sh` to produce `toolkit.js`
3. Install the Playwright MCP plugin: `claude plugins add playwright`
4. Read CLAUDE.md and .claude/commands/browse.md for usage instructions

Once set up, I can use `/browse <url>` to analyze any website.
```

## What It Does

Page Toolkit is a JavaScript bundle (`toolkit.js`) that gets injected into a browser page via Playwright's `addInitScript()`. Once injected, it exposes `window.__ps` with 26 analysis tools that return structured JSON — no screenshots needed.

### Tool Categories

| Category | Tools | What they answer |
|----------|-------|-----------------|
| **Color** | `colorProfile`, `paletteProfile`, `scanAnomalies`, `inspect`, `traceStyle` | Contrast issues, palette identity, dark mode bugs, CSS cascade |
| **Typography** | `typographyProfile`, `fontTuning` | Type scale, hierarchy, font sizing recommendations |
| **Layout** | `pageMap`, `layoutBox`, `layoutAggregate`, `layoutGap`, `layoutTree`, `layoutDensity`, `alignmentAudit`, `responsiveProfile`, `spacingProfile` | Page structure, box model, spacing system, breakpoints |
| **Theme** | `themeAudit`, `discoverOverlays`, `motionProfile`, `gradientProfile` | Theme escapes, overlays, animations, gradients |
| **Platform** | `platformProfile`, `siteProfile` | CMS, JS libraries, analytics, composite design system profile |
| **Touch** | `scrollAudit`, `eventMap`, `touchTargets`, `gesturePlan`, `gestureCapture`, `gestureResults` | Scroll traps, event handlers, tap target sizing, gesture simulation |

## Prerequisites

- **Node.js** (18+)
- **Claude Code** with the **Playwright MCP plugin**

## Setup

```bash
git clone https://github.com/EricSeastrand/page-toolkit.git
cd page-toolkit
npm install
npx playwright install chromium
./build.sh
```

### Playwright MCP Plugin

The toolkit requires Playwright MCP to control a browser. Install it as a Claude Code plugin:

```bash
claude plugins add playwright
```

This provides `browser_navigate`, `browser_evaluate`, `browser_snapshot`, and other browser control tools that Claude uses to drive analysis sessions.

## Usage

### Via the `/browse` Skill

The easiest way to use the toolkit is through the included Claude Code skill:

```
/browse https://example.com
```

This handles injection, navigation, and walks through a structured analysis workflow (pageMap → themeAudit → scanAnomalies → drill-down).

### Programmatic (in Playwright tests or scripts)

```js
const { chromium } = require('playwright');

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addInitScript({ path: './toolkit.js' });

const page = await context.newPage();
await page.goto('https://example.com');

const palette = await page.evaluate(() => __ps.paletteProfile());
const typography = await page.evaluate(() => __ps.typographyProfile());
const anomalies = await page.evaluate(() => __ps.scanAnomalies());
```

### Key Pattern

**Always `addInitScript` before `page.goto()`** — this registers the script for all future navigations and runs before CSP can block it.

## Architecture

```
src/
├── header.js              # IIFE open
├── utils/                 # Shared utilities (color math, OKLCH, DOM helpers, layout)
├── tools/                 # 22 tool implementation files
├── register.js            # Exposes window.__ps
└── footer.js              # IIFE close

build.sh                   # cat in dependency order → toolkit.js
toolkit.js                 # Built artifact (~5200 lines)
```

No bundler, no transpilation. `build.sh` concatenates source files in dependency order inside an IIFE wrapper. After editing any source file, rebuild with `./build.sh`.

## API Reference

Full tool signatures, parameters, and return types: **[docs/api-reference.md](docs/api-reference.md)**

## Tests

```bash
npm test                   # runs build.sh then playwright test
```
