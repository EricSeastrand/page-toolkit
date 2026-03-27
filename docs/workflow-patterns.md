# Workflow Patterns

## Session Bootstrap

**Always `addInitScript` before `page.goto()`** — bypasses CSP, persists across navigations.

```js
async (page) => {
  await page.context().addInitScript({ path: '/home/eric/page-toolkit/toolkit.js' });
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return { url: page.url(), title: await page.title(), toolkit: await page.evaluate(() => !!window.__ps) };
}
```

## Phase 1: Static Analysis

1. **Bootstrap** — inject toolkit + navigate
2. **`pageMap()`** — first call after navigation. Shows page structure, warnings, fold position.
3. **`themeAudit()` unscoped** — catch theme escapes against the body. Never skip or scope this first.
4. **`scanAnomalies()`** — contrast failures, light backgrounds, invisible borders.
5. **Drill into specifics** — `traceStyle` for CSS cascade, `ancestry` for overflow chains, `inspect` for matched rules.

## Phase 1b: Design System Analysis

For comparing sites or replicating a look: **`siteProfile()`** runs all 7 design system tools in one call.

## Phase 2: Interactive Widget Probing

`pageMap` only sees static state. Dropdowns, modals, tooltips are hidden until triggered.

1. **Trigger each widget** — type into autocompletes, click toggles, hover for tooltips
2. **`discoverOverlays()`** — find the overlay structurally
3. **`themeAudit()` UNSCOPED** — the overlay itself may be the theme escape. Scoping to it checks children against itself — finds nothing.
4. **`scanAnomalies({ scope: '.the-overlay' })`** — NOW scope to find issues within the escape

## Scoping Rules

| Tool | When to scope | Why |
|------|---------------|-----|
| `themeAudit()` | Almost never — run unscoped | If the scope IS the escape, it reports 0 escapes |
| `scanAnomalies()` | After unscoped themeAudit finds an escape | Enumerate issues within the escape |
| `pageMap()` | When full page is too large | Just narrows the tree |

## Which Tool When?

| Question | Tool |
|----------|------|
| Site's color personality? | `paletteProfile` |
| What's wrong with color? | `colorProfile` |
| Dark mode bugs? | `scanAnomalies` |
| What CSS rule causes this? | `traceStyle` |
| Fonts and type scale? | `typographyProfile` |
| Gradient atmosphere? | `gradientProfile` |
| Spacing system / grid? | `spacingProfile` |
| Responsive breakpoints? | `responsiveProfile` |
| CMS / libraries / analytics? | `platformProfile` |
| Full design system, one call? | `siteProfile` |
| Touch gesture simulation? | `gesturePlan` → CDP pattern (see api-reference) |

## Gotchas

- **`addInitScript` before `goto`** — registers for future navigations, runs before CSP
- **`themeAudit` scoping trap** — never scope to an overlay first. If the overlay IS the escape, scoping finds nothing.
- **Interactive state is invisible** to `pageMap`/`themeAudit`/`scanAnomalies` — trigger widgets first
- **`pageMap` returns a string**, not `{text, data}`
- **`responsiveProfile` CORS**: only extracts from same-origin/CORS-enabled sheets
- **`sectionTheme`** reads `backgroundColor`, not visual luminance — can't see through canvas/images
- **Screenshots mislead** — compositing hides bg colors. Only screenshot when user explicitly asks for visual documentation.
