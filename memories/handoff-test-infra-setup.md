---
name: Test infrastructure setup for remote Browserless
description: How we got the Playwright test suite running against the LAN Browserless instance — connection protocol, addInitScript fix, fixture patterns
type: project
---

# Test Infrastructure Setup — Remote Browserless CDP

**Date**: 2026-03-27
**Status**: Complete — 47/47 tests passing

## What We Did

Set up the page-toolkit as its own project (previously lived inside bu-aws) and got the test suite running against the LAN headless browser (Browserless Chromium v2 at 10.23.20.10:3000).

## Problems Solved

### 1. connectOptions vs connectOverCDP

**Symptom**: Tests hung indefinitely — "Running 47 tests using 1 worker" then nothing.

**Root cause**: `playwright.config.js` used `connectOptions.wsEndpoint` which calls `browserType.connect()` (Playwright server protocol). Browserless's root endpoint (`ws://10.23.20.10:3000`) speaks CDP, not Playwright protocol. The connection appeared to succeed but was protocol-mismatched.

**What we tried**:
- Browserless also serves Playwright protocol at `/playwright/chromium` — this connected but had the init script issue below
- `connectOverCDP()` works correctly with the bare CDP URL

**Fix**: Moved CDP connection into `test/helpers.js` using `chromium.connectOverCDP()` instead of config-level `connectOptions`. The config now only defines `baseURL` and the fixture web server.

### 2. addInitScript crashes before DOM exists

**Symptom**: All 47 tests failed with `__ps is not defined` even though the connection worked.

**Root cause**: `src/header.js` line 12 did `(document.head || document.documentElement).appendChild(aaStyle)` — injects an anti-aliasing stylesheet. When run via `addInitScript`, the script executes before the document is created, so both `document.head` and `document.documentElement` are `null`.

**Debugging sequence**:
1. First suspected CDP contention with the MCP Playwright server (both use same Browserless) — ruled out, Browserless supports 4 concurrent sessions
2. Tried Playwright protocol path `/playwright/chromium` — connected but same `__ps is not defined` error
3. Tried `addInitScript` with file content string instead of path — same error
4. Tested simple marker (`window.__test_marker = 42`) via addInitScript — worked
5. Tested full toolkit via addInitScript — marker worked, `__ps` undefined, caught `pageerror: Cannot read properties of null (reading 'appendChild')`
6. Found the `appendChild` call in `header.js`, added DOM-readiness guard

**Fix**: Guard the stylesheet injection — call immediately if DOM exists, defer to `DOMContentLoaded` if not.

### 3. paletteProfile test expected wrong data shape

**Symptom**: 46/47 passed, one test expected `first.oklch.L` but actual data has `first.L` at top level.

**Fix**: Updated test to match actual data shape (`L`, `C`, `h` at top level of color objects).

## Key Architecture Decisions

### helpers.js owns the CDP connection
The config file doesn't know about CDP. `test/helpers.js` reads `CDP_ENDPOINT` env var, connects via `connectOverCDP`, creates a fresh context per test with `addInitScript(TOOLKIT_SCRIPT)`, and provides the `page` fixture. This keeps the Playwright config simple and avoids protocol confusion.

### Toolkit script read at module load time
`helpers.js` does `fs.readFileSync(TOOLKIT_PATH, 'utf8')` at require time and passes the string to `addInitScript()`. This avoids path-resolution issues over remote connections and is slightly faster than re-reading per test.

### baseURL handled in page fixture
Since we override the `page` fixture, Playwright's built-in `baseURL` resolution doesn't apply. The helper wraps `page.goto()` to prepend `baseURL` for relative paths.

## Files Modified

| File | Change |
|------|--------|
| `src/header.js` | DOM-readiness guard for anti-aliasing injection |
| `toolkit.js` | Rebuilt (reflects header.js change) |
| `test/helpers.js` | Rewritten: connectOverCDP, script content injection, page fixture |
| `playwright.config.js` | Simplified: removed connectOptions, kept baseURL + webServer |
| `test/color-tools.spec.js` | Fixed OKLCH test data shape (L/C/h at top level, not nested) |
| `.gitignore` | New: excludes node_modules/ and test-results/ |
| `package.json` | New: Playwright test dependency, build/test scripts |

## Next Steps — Real Website Analysis & More Tests

User wants to:
1. Analyze real websites with the toolkit (not just fixtures)
2. Use findings to write more comprehensive tests
3. Iterate on toolkit capabilities based on what we discover

This is the natural evolution: fixtures test the mechanics, real sites test the judgment (color harmony classification, layout pattern detection, etc.).
