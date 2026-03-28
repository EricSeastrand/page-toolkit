# Thread: Signal/Noise Improvement

**Last parked:** 2026-03-27
**Status:** Batches 1-4 complete. Batch 5 planned (3 parallel units: motionProfile, pageMap, color sources).
**Handoff:** `memories/handoff-noise-batch5.md` (Batch 5 plan), `memories/handoff-signal-noise.md` (Batches 1-3)

## Key files
- `src/utils/oklch.js` — colorTone(), hueName() (chromaLabel removed in Batch 4)
- `src/tools/motion-profile.js` — Batch 5 Unit A target
- `src/tools/page-map.js` — Batch 5 Unit B target
- `src/tools/color-profile.js`, `src/tools/palette-profile.js` — Batch 5 Unit C targets
- `test/measure-reduction.js` — live-site comparison script
- `docs/signal-noise-recommendations.md` — original analysis of all 26 tools
