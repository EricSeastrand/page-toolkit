# Handoff: Toolkit v0.9 — Merged, Tested, Documented

## What We Did

Built and shipped 6 new/enhanced tools for the Playwright browser toolkit (v0.8 → v0.9), then smoke-tested them across 7 real websites + synthetic edge cases, then updated the `/browse` slash command to document everything.

## What's Done

### PRs merged (all 6, sequential merge with conflict resolution)
- PR #4: `typographyProfile()` — font families, type scale, semantic groups
- PR #5: Gradient stop colors in `paletteProfile` — `gradient` source tag
- PR #6: `pageMap` fold noise reduction — `foldWarnings` option + fold marker
- PR #7: `gradientProfile()` — CSS gradient extraction with OKLCH + classification
- PR #8: Section-aware `detectDarkMode` — `sectionTheme` field
- PR #9: `motionProfile()` — animation/transition inventory with classification

### Smoke testing (all pass)
Tested on: Wikipedia, GitHub, Craigslist, Stripe, Netflix, Apple, NY Times, synthetic edge-case page.
Full results: `docs/browse-toolkit-v09-test-results.md`

### `/browse` command updated
- Bootstrap fixed: `addInitScript` before `goto` (CSP lesson)
- All 3 new tools documented in reference tables
- Phase 1b: Design System Analysis workflow added
- `pageMap` foldWarnings, `scanAnomalies` sectionTheme, `paletteProfile` gradient source all documented
- New gotchas: sectionTheme limitation, pageMap returns string
- Version: v0.8/19 tools → v0.9/22 tools

## What's Not Done — v1.0 Roadmap

Parked in `threads/browse-toolkit-validation.md`. Three high-priority tools for frontend work:

1. **`spacingProfile()`** — spacing grid detection (base unit, frequency table, section rhythm). The last invisible dimension. Manual Netflix test showed 4px base grid.
2. **`responsiveProfile()`** — parse @media breakpoints from stylesheets. Currently can only see one viewport at a time.
3. **Layout pattern labels in `pageMap`** — heuristic detection of bento grid, hero, card grid, carousel, accordion. Currently shows structure but not semantics.

Medium priority: `imageProfile()`, comparative mode, `formProfile()`.

## Known Limitations (not bugs, fundamental CSS constraints)

- **sectionTheme can't see image-based dark sections** — Stripe/Apple heroes are visually dark from canvas/WebGL/background-images, but `backgroundColor` reads white. Would need pixel sampling to fix.
- **Gradient `transparent` stops invisible** — regex matches rgb/rgba/hex only. Low impact.

## Key Decisions

- **`addInitScript` is mandatory for public sites** — `addScriptTag` fails on CSP-strict sites (Stripe). Learned the hard way during field testing. Must call before `page.goto()`.
- **`pageMap` returns string, not `{text, data}`** — unlike other tools. This is by design (the tree structure IS the value), but it's a gotcha.
- **`detectDarkMode` is internal, not on `__ps`** — accessed through `scanAnomalies().darkMode` or `themeAudit()`. The sectionTheme enhancement flows through those tools automatically.
- **Merge order matters** — PRs had trivial registration block conflicts. Merged 4→5→6→7(local)→8→9. Gradient-profile (#7) needed manual conflict resolution (full function interleave with typographyProfile).

## Key Files

| File | Purpose |
|------|---------|
| `scripts/playwright-tools/toolkit.js` | Toolkit v0.9 source (22 tools) |
| `.claude/commands/browse.md` | `/browse` slash command (updated) |
| `docs/browse-toolkit-field-test.md` | v0.8 gap analysis that motivated v0.9 |
| `docs/browse-toolkit-v09-test-results.md` | Smoke test results matrix |
| `threads/browse-toolkit-validation.md` | Thread file with v1.0 roadmap |
