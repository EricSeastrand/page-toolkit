# Page Toolkit API Reference

All tools are available on `window.__ps` after injection.

## Color Tools

### `colorProfile(opts?)`
Element-level color diagnostics: contrast distribution, worst pairs, top colors with OKLCH.
- `opts.scope` — CSS selector (default: `'body'`)
- `opts.maxElements` — scan limit (default: 500)
- Returns: `{ darkMode, contrastDistribution, topForegroundColors, topBackgroundColors, worstContrastPairs }`

### `paletteProfile(opts?)`
Design system color identity: CSS custom properties, hue clusters, harmony, lightness distribution, vibes.
- `opts.scope` — CSS selector (default: `'body'`)
- `opts.maxElements` — scan limit (default: 5000)
- Returns: `{ text, data: { totalColors, harmony, lightnessShape, chromaAvg, vibes, colors[] } }`

### `typographyProfile(opts?)`
Font families, type scale, weights, semantic groups (display/heading/body/caption).
- Returns: `{ text, data: { families[], scale[], groups, weights } }`

### `gradientProfile(opts?)`
Every CSS gradient deduplicated, classified (overlay/atmosphere/functional/separator).
- Returns: `{ text, data: { gradients[], summary } }`

### `spacingProfile(opts?)`
Spacing system: base grid unit (GCD), recurring value scale, section rhythm, grid/flex gap catalog.
- Returns: `{ text, data: { baseUnit, scale[], sectionRhythm[], gridFlexGaps[] } }`

### `scanAnomalies(opts?)`
Dark mode bugs: light backgrounds, low contrast text, white form controls, invisible borders.
- `opts.contrastMinimum` — WCAG threshold (default: 4.5)
- Returns: `{ darkMode, count, high, medium, low, anomalies[] }`

### `inspect(selector, properties?)`
Per-element computed styles, bounding box, inline styles, matched CSS rules.
- `properties` — array of CSS property names (default: 18 common ones)
- Returns: `[{ path, styles, matchedRules[] }]`

### `traceStyle(selector, property)`
CSS cascade trace: one element + one property, all competing rules with selector/value/priority/source.
- Returns: `{ element, property, computedValue, inline, matchedRules[] }`

## Theme Tools

### `themeAudit(opts?)`
Find light-background containers on dark pages ("theme escapes").
- `opts.lumThreshold` — luminance cutoff (default: 0.4)
- Returns: `{ darkMode, escapes, items[] }`
- **Almost never scope this tool** — if scope IS the escape, reports 0

### `discoverOverlays()`
All visible positioned elements: popups, dropdowns, modals, tooltips.
- Returns: `{ viewport, overlays, items[] }`

### `motionProfile(opts?)`
Animations and transitions with classifications (loading/entrance/hover/state-change/visual).
- Returns: `{ text, data: { animations[], transitions[], summary } }`

## Layout Tools

### `pageMap(opts?)`
Topographic page tree with viewport-relative positions, warnings, fold marker, layout patterns.
- `opts.summary` — top-level sections only (boolean)
- `opts.aboveFold` — only above fold (boolean)
- `opts.patterns` — detect [hero]/[nav]/[card-grid] etc. (default: true)
- Returns: **plain string** (not `{text, data}`)

### `responsiveProfile(opts?)`
CSSOM @media breakpoint extraction, tier classification (mobile/tablet/desktop/wide).
- Returns: `{ text, data: { breakpoints[], tiers, summary } }`

### `ancestry(selector, opts?)`
Element chain from target up to body with display, position, overflow, box dimensions.
- `opts.depth` — max ancestors (default: 6)
- Returns: `{ target, chain[] }`

### `layoutBox(selector)`
Full box model per match: content/padding/border/margin, % of parent.
- Returns: `[{ path, box, pctOfParent, display, position }]`

### `layoutAggregate(selector)`
Stats across all matches: width/height min/max/avg/median, display/position distribution.
- Returns: `{ selector, count, width, height, displays, positions }`

### `layoutGap(selectorA, selectorB)`
Edge gap (X and Y), center-to-center distance, overlap detection, arrangement label.
- Returns: `{ a, b, gapX, gapY, centerDistance, overlaps, arrangement }`

### `layoutTree(selector, opts?)`
Bidirectional traversal: N parents up + M children down with box dimensions.
- Returns: `{ target, parents[], children[] }`

### `layoutDensity(selector, opts?)`
Packing efficiency: fill ratios, gap inventories, text fill, headroom analysis.
- `opts.depth` — recursion depth (default: 3)
- `opts.mode` — `'full'` or `'summary'`
- Returns: `{ selector, axis, container, fill, headroom, children[], gaps[] }`

## Platform Tools

### `platformProfile()`
CMS detection, JS library fingerprinting, cookie consent, analytics inventory, meta tags.
- Returns: `{ text, data: { cms, libraries[], analytics[], meta } }`

### `siteProfile(opts?)`
Composite: runs paletteProfile + typographyProfile + spacingProfile + gradientProfile + motionProfile + responsiveProfile + platformProfile.
- Returns: `{ text, data: { palette, typography, spacing, gradient, motion, responsive, platform } }`

## Touch & Interaction Tools

### `scrollAudit(selector?, opts?)`
Auto-discover all overflow containers, detect scroll traps.
- Returns: `{ page, traps, items[] }`

### `eventMap(selector)`
jQuery + inline event handlers, touch/mouse classification, delegated handlers.
- Returns: `{ path, handlers, touchReady, mouseOnly, eventTypes[] }`

### `touchTargets(opts?)`
Interactive element inventory: viewport position, WCAG 44x44 check, widget type.
- Returns: `{ count, tooSmall, targets[] }`

### `gesturePlan(type, opts)`
CDP-ready touch event steps. Types: `touchScroll`, `touchTap`, `touchDrag`, `touchHold`.
- `opts.curve` — easing: linear/ease/easeIn/easeOut/easeInOut/flick/scroll or [x1,y1,x2,y2]
- Returns: `{ gesture, steps[], stepCount, totalMs }`

### `gestureCapture(selector?, opts?)`
Start recording events + snapshot scroll positions (call BEFORE gestures).
- Returns: `{ capturing: true, target, events }`

### `gestureResults()`
Harvest events + hitContext + scrollDeltas + trapped flag (call AFTER gestures).
- Returns: `{ entryCount, hitContext, scrollDeltas, touchSequence[], log[] }`
