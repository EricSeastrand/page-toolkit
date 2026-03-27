# Page Toolkit API Reference (`window.__ps` v2.0 — 26 tools)

All tools called via `browser_evaluate`. All return `{text, data}` unless noted.

## Page Overview

| Tool | Call | Returns |
|------|------|---------|
| **pageMap** | `__ps.pageMap({scope?, maxDepth?, foldWarnings?, patterns?, summary?, aboveFold?})` | **Returns text string, not `{text, data}`.** Topographic tree of the page: element labels, viewport-relative positions (%), warnings (overflow, theme escapes, no-scroll). Header includes total page height as % of viewport. Collapses meaningless wrapper divs. Summarizes tables (cols × rows + headers) and long lists (count + first/last sample). Overlays marked with ⬡. Fold marker (`──── fold ────`) at viewport bottom. `foldWarnings`: `'sections'` (default) only warns on top-level sections, `'all'` warns on every element (noisy), `'none'` suppresses all fold warnings. **Layout pattern labels** (v1.0): `patterns: true` (default) appends semantic labels — `[hero]`, `[nav]`, `[sticky-header]`, `[card-grid ×N]`, `[grid NxM]`, `[carousel]`, `[accordion]`, `[sidebar]` — detected via computed styles and DOM structure, not class name sniffing. Disable with `{ patterns: false }`. **Summary modes** (v1.1): `summary: true` — top-level sections only (name, spatial, pattern, warning count, child count). `aboveFold: true` — same but stops at the fold. Use for initial orientation on very tall pages. |

## Theme Tools

| Tool | Call | Returns |
|------|------|---------|
| **themeAudit** | `__ps.themeAudit({scope?, maxElements?, lumThreshold?})` | Containers with light backgrounds on a dark page — the "theme escapes." Reports root-level escapes only (skips children of already-flagged containers). Each has bg luminance, contrast with body, child count, position/overflow/z-index. |
| **discoverOverlays** | `__ps.discoverOverlays()` | All visible positioned elements (absolute/fixed/sticky) — popups, dropdowns, modals, tooltips. Categorized by type. Use this to find what to scope into before running other tools. |
| **motionProfile** | `__ps.motionProfile({scope?, maxElements?})` | Animations: name, duration, timing, iteration-count, fill-mode, classification. Transitions: properties, duration, delay, easing. Classifications: `loading` (infinite), `entrance` (opacity/transform), `hover` (on interactive elements), `state-change`, `visual`. |

## Color & Design System Tools

| Tool | Call | Returns |
|------|------|---------|
| **paletteProfile** | `__ps.paletteProfile({scope?, maxElements?})` | Design-system-level color identity. CSS custom properties + all color channels (fg/bg/border/shadow/SVG/gradient). OKLCH values, chroma labels, hue clusters, harmony classification, lightness distribution, neutral tint, WCAG concerns, vibe labels. |
| **typographyProfile** | `__ps.typographyProfile({scope?, maxElements?})` | Font families with full stacks and element counts. Type scale sorted by size: fontSize, fontWeight, lineHeight, letterSpacing, textTransform, count, tags, sample text. Semantic groups: display (>48px), heading (24-48px), body (14-20px), caption (<14px). |
| **gradientProfile** | `__ps.gradientProfile({scope?, maxElements?})` | Every CSS gradient, deduplicated by signature. `paths[]` shows all elements sharing each gradient. Classification: `overlay`, `atmosphere`, `functional`, `separator`. Also counts `url()` background images. |
| **colorProfile** | `__ps.colorProfile({scope?, maxElements?})` | Element-level diagnostic. Contrast distribution, belowAA/belowAAA counts, fg/bg luminance spread, top colors with OKLCH + chroma labels, worst contrast pairs with element paths. |
| **scanAnomalies** | `__ps.scanAnomalies({contrastMinimum?, scope?, maxElements?})` | Dark mode bugs: light backgrounds, low contrast text, white form controls, invisible borders. `darkMode.sectionTheme` for section-level dark detection. |
| **spacingProfile** | `__ps.spacingProfile({scope?, maxElements?})` | Spacing design system: base grid unit (GCD), recurring value scale with ×base annotations, section rhythm, grid/flex gap catalog grouped by value with `paths[]`. |
| **responsiveProfile** | `__ps.responsiveProfile({scope?})` | CSSOM @media breakpoint extraction. Tier classification: mobile/tablet/desktop/wide. Reports CORS-blocked vs accessible sheets. |
| **platformProfile** | `__ps.platformProfile()` | CMS detection, JS library fingerprinting, cookie consent provider, analytics inventory, meta tags. |
| **siteProfile** | `__ps.siteProfile({scope?, maxElements?})` | **Composite** — runs all 7 design system tools in one call. Use instead of 7 separate `browser_evaluate` calls. |
| **inspect** | `__ps.inspect(selector, [properties])` | Per-element: computed styles, bounding box, inline styles, matched CSS rules. Default checks 18 common properties. |
| **traceStyle** | `__ps.traceStyle(selector, property)` | One element + one property: computed value, inline value, all competing CSS rules with selector/value/priority/source. |

## Layout Tools

| Tool | Call | Returns |
|------|------|---------|
| **ancestry** | `__ps.ancestry(selector, {depth?})` | Element chain from target up to body: selector, display, position, overflow, box dimensions. Default depth=6. |
| **layoutBox** | `__ps.layoutBox(selector)` | Full box model for each match: content/padding/border/margin, inner/outer size, bounding rect, % of parent. |
| **layoutAggregate** | `__ps.layoutAggregate(selector)` | Stats across all matches: width/height min/max/avg/median/distinct, display and position distribution. |
| **layoutGap** | `__ps.layoutGap(selectorA, selectorB)` | Edge gap (X and Y), center-to-center distance, overlap detection, arrangement label. |
| **layoutTree** | `__ps.layoutTree(selector, {parents?, children?})` | Bidirectional traversal: N parents up + M children down, each with tag/display/box/childCount. |

## Touch & Interaction Tools

| Tool | Call | Returns |
|------|------|---------|
| **scrollAudit** | `__ps.scrollAudit(selector?, {trapThreshold?})` | All `overflow:auto/scroll` containers. Detects scroll traps (≤50px range). Returns `traps[]` at top level. |
| **eventMap** | `__ps.eventMap(selector)` | jQuery + inline event handlers. `touchReady`/`mouseOnly` classification, delegated handlers, namespaces. |
| **touchTargets** | `__ps.touchTargets({scope?})` | Interactive element inventory: viewport position, WCAG 44×44 check, widget type, event handlers. |
| **gesturePlan** | `__ps.gesturePlan(type, opts)` | CDP-ready touch event steps. Types: `touchScroll`, `touchTap`, `touchDrag`, `touchHold`. |
| **gestureCapture** | `__ps.gestureCapture(selector?, {events?})` | Start recording events + snapshot scroll positions. Call BEFORE gestures. |
| **gestureResults** | `__ps.gestureResults()` | Harvest events + `hitContext` (what was hit, `isTrap`) + `scrollDeltas` (before/after, `trapped`). |

### CDP Gesture Execution Pattern

```js
async (page) => {
  await page.evaluate(() => __ps.gestureCapture('.target'));
  const plan = await page.evaluate(() =>
    __ps.gesturePlan('touchScroll', { target: '.target', deltaY: -200, curve: 'scroll' }));
  const cdp = await page.context().newCDPSession(page);
  for (const step of plan.steps) {
    await cdp.send('Input.dispatchTouchEvent', { type: step.type, touchPoints: step.touchPoints });
    if (step.wait) await page.waitForTimeout(step.wait);
  }
  return await page.evaluate(() => __ps.gestureResults());
}
```

CDP touch events don't reproduce iOS keyboard-dismiss. To test blur-on-touch, also call `.blur()` after the gesture.

### Gesture Types

| Type | Options | Description |
|------|---------|-------------|
| `touchScroll` | `{ target, deltaX?, deltaY, duration?, curve?, fps? }` | Single-finger scroll. |
| `touchTap` | `{ target, holdMs? }` | Tap (default 50ms hold). |
| `touchDrag` | `{ from, to, duration?, curve? }` | Drag between two points. |
| `touchHold` | `{ target, holdMs? }` | Long press (default 600ms). |

Coordinates: viewport percentages by default. Use `{x, y, px: true}` for pixels. Selectors resolve to element center.
Easing curves: `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `flick`, `scroll`, or `[x1,y1,x2,y2]`.

## Utility Exports (`__ps._util`)

`parseRGB`, `hexFromRGB`, `luminance`, `contrast`, `saturation`, `effectiveBackground`, `elPath`, `detectDarkMode`, `boxModel`, `pctOfParent`, `interpolate`, `resolveEasing`, `EASING`, `rgbToOklab`, `oklabToOklch`, `rgbToOklch`, `oklchToRgb`, `deltaEOK`, `chromaLabel`, `hueDistance`, `harmonyClass`.

`parseRGB` accepts `rgb()`/`rgba()` and hex. OKLCH chroma scale is 0–0.37 (not 0–100). `chromaLabel` maps: neutral (<0.02), tinted neutral (0.02–0.06), moderate (0.06–0.15), vivid (0.15–0.25), intense (0.25+).
