# Thread: Signal/Noise Improvement

**Last updated:** 2026-03-27
**Status:** Batches 1-5 complete. All planned noise reduction implemented.
**Handoff:** `memories/handoff-noise-batch5.md` (Batch 5 plan + results), `memories/handoff-signal-noise.md` (Batches 1-3)

## Batch 5 results (2026-03-27)

| Tool | Before | After | Reduction |
|------|--------|-------|-----------|
| motionProfile | 20,418 | 1,434 | 93.0% |
| pageMap | 81,810 | 13,227 | 83.8% |
| paletteProfile | 10,932 | 7,846 | 28.2% |

Changes:
- **motionProfile**: `transitions[]`/`animations[]` hidden by default, `opts.detailed` to opt in
- **pageMap**: returns flat landmark array by default, `opts.tree` for full text tree
- **paletteProfile**: `sources` dropped from color entries by default, `opts.sources` to opt in

## Key files
- `src/utils/oklch.js` — colorTone(), hueName() (chromaLabel removed in Batch 4)
- `src/tools/motion-profile.js` — Batch 5 Unit A
- `src/tools/page-map.js` — Batch 5 Unit B
- `src/tools/palette-profile.js` — Batch 5 Unit C
- `test/measure-reduction.js` — live-site comparison script
- `docs/signal-noise-recommendations.md` — original analysis of all 26 tools
