# Thread: Font Sensing

**Last updated:** 2026-03-28
**Status:** All 6 improvements implemented

## Key files
- `src/tools/typography-profile.js` — all changes live here
- `docs/font-sensing-audit.md` — research: current tools vs gaps
- `docs/font-sensing-field-test.md` — field test results (5 sites)
- `docs/api-reference.md` — updated docs
- `memories/handoff-font-sensing.md` — handoff from Phase 1

## What was added (Phase 2)

1. **gapToNext** — For h1-h6, measures gap to next sibling via getBoundingClientRect. Reported as `avgGapToNext` in spatial. Flags `tight-heading-gap` when gap < 0.5em.

2. **Container width ratio** — Walks up to nearest block/flex/grid ancestor. Reports `avgContainerW` and `containerRatio` in spatial. Flags `cramped-in-container` (heading >8% of container) and `lost-in-container` (body <1% of container).

3. **vwRatio** — `fontSize / window.innerWidth` per scale entry. Flags `viewport-oversized` when >10%.

4. **Density classification** — `sparse` (≤5 sizes), `moderate` (5-8), `dense` (>8) in scaleAnalysis. Lets consumers decide if dense + low-hierarchy is acceptable.

5. **Gradient weight contrast** — Replaced binary weightScore with 5-tier gradient: 200+ delta = 100, 100-199 = 75, 1-99 = 50, 0 = 25, negative = 0. Reports `weightDelta` in scaleAnalysis.

6. **Modular scale detection** — Classifies by ratioStdDev: `modular` (σ<0.05, shows base ratio), `semi-modular` (σ≤0.15), `custom` (>0.15). In scaleAnalysis as `scaleType`.

## Next steps
- Field test Phase 2 on the original 5 sites to validate new flags
- Tune thresholds if needed (especially cramped-in-container 8% and lost-in-container 1%)
