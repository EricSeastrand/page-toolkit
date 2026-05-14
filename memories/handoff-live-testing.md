---
name: Live testing handoff
description: Results from testing toolkit on real sites — all issues found and fixed (colorTone, sr-only, gridFlexGaps, blockedSheets)
type: project
---

## What we did

Tested the full 29-tool toolkit on 4 production websites via Playwright MCP:
- **GitHub** (dark mode SaaS), **NYT** (light mode editorial), **Linear** (dark→light product), **Spotify** (dark mode consumer)

## Bugs found and fixed

1. **colorTone scale mismatch** (d8a1e4d) — colorProfile passed `lch.L * 100` to `colorTone()` which expects 0–1. Dark colors labeled as white.
2. **sr-only false positives** (da3adb8) — `isVisible()` now detects `clip:rect(0,0,0,0)`, `clip-path:inset(50%)`, and tiny-absolute+overflow:hidden. Eliminates false contrast violations from screen-reader-only elements.
3. **gridFlexGaps path noise** (da3adb8) — spacingProfile caps `paths` at 3 samples, adds `pathCount` for the total. Spotify's 31 near-identical react-aria paths now show as 3+count.
4. **blockedSheets visibility** (da3adb8) — paletteProfile reports `blockedSheets` count so consumers know when CORS limits token coverage (Spotify: 13 blocked, NYT: 6).

## Injection pattern for Playwright MCP

CSP on major sites blocks `addScriptTag`, `fetch('localhost')`, and `eval()`. The working pattern:
```js
const ctx = await browser.newContext();
await ctx.addInitScript({ path: '/home/eric/page-toolkit/toolkit.js' });
const p = await ctx.newPage();
await p.goto(url);
await p.evaluate(() => __ps.paletteProfile());
```
