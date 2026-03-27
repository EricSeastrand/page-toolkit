# Thread: Test Suite Expansion

**Last updated**: 2026-03-27
**Status**: Real-site analysis complete, 89 tests passing
**Handoff**: `memories/handoff-test-infra-setup.md`

## Key files

- `test/helpers.js` — CDP connection + toolkit injection fixture
- `playwright.config.js` — fixture server config
- `test/*.spec.js` — 89 tests across 6 spec files
- `test/fixtures/*.html` — 4 HTML fixtures (color, layout, typography, real-site-edges)
- `test/explore-real-sites.js` — exploration script that runs all tools against live sites
- `test-results/real-site-exploration.json` — raw results from 5 real sites

## Completed: Real-site analysis

Ran all 25 toolkit tools against 5 live sites (Stripe, Apple, Shopify Dawn, GitHub, Wikipedia):
- **Zero crashes** — all tools returned valid data on all sites
- **Zero empty results** — every tool produced meaningful output
- **Performance**: all tools <50ms per site, siteProfile composite <75ms

### Edge cases found and tested

| Finding | Source site | Test |
|---------|-----------|------|
| 0 breakpoints due to CORS-blocked stylesheets | Stripe (6/7 sheets blocked) | `reports accessible vs blocked stylesheet counts` |
| 31/33 touch targets too small on desktop page | Stripe | `flags small touch targets below 44x44` |
| Large CSS token set (380 colors, 61 breakpoints) | GitHub | `discovers CSS custom property tokens` |
| Monochromatic harmony classification | Wikipedia | `classifies harmony across multi-hue token set` |
| Dark section theme escape on light page | Shopify Dawn | `themeAudit on light page` |
| `traps: null` (not `[]`) when no scroll traps | Stripe | `traps is null when no scroll traps exist` |
| `touchTargets` uses `box` not `rect` for positions | All | `each target has position and size data` |
| Contrast distribution percentile monotonicity | All | `contrast distribution has expected shape` |
| `ancestry` chain entries use `selector` not `tag` | All | `ancestry from card walks up the DOM` |

## Next step

Potential directions:
- Add tests for scoped tool calls (e.g., `colorProfile({ scope: '.dark-section' })`)
- Test error handling for invalid selectors
- Test layoutDensity `mode: 'summary'` vs `mode: 'full'`
- Add a fixture for heavy animation/motion pages

## Context

- 89/89 tests passing in 9s against Browserless at 10.23.20.10:3000
- Fixture server binds to 10.23.7.50:8787 (LAN-routable from browser)
- Tests use `connectOverCDP` (not Playwright protocol) — this matters
