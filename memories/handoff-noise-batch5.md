# Signal/Noise Batch 5 — Parallel Plan

## What and why

Continuing tool output noise reduction. Batches 1-3 achieved 28.5% reduction (text-to-data, field pruning, colorTone). Batch 4 added structural pruning (layoutDensity 83.6%, scrollAudit 29.9%, chromaLabel removal, gradient paths cap, touchTargets trim). All committed and green.

The user wants to batch the remaining opportunities and execute them in parallel in a fresh chat.

## What's done (Batches 1-4)

All committed, 113 tests passing. See `memories/handoff-signal-noise.md` for Batches 1-3 detail. Batch 4 commit: `3e1fa98`.

## Batch 5 Plan — 3 parallel units

These are independent file changes with no overlap — safe for parallel agents.

### Unit A: motionProfile summary-only default

**File:** `src/tools/motion-profile.js`

**Change:** The full transitions/animations arrays are verbose (100-200 lines on complex sites). Default should return summary counts + distributions only. Full detail via `opts.detailed = true`.

**Specifically:**
- Keep: `summary` object (counts, timing distributions), `scrollTriggered`, `prefersReducedMotion`
- Default-hide: individual `transitions[]` and `animations[]` arrays
- Add `opts.detailed` — when true, include the full arrays
- The `format: 'text'` path should still work (it reads from the arrays, so generate them internally regardless, just don't return them unless detailed)

### Unit B: pageMap flatten to summary default

**File:** `src/tools/page-map.js`

**Change:** pageMap returns a deeply nested recursive tree. For AI consumers, a flat list of significant elements with depth levels is more useful by default. The full tree should be opt-in.

**Specifically:**
- Default: return flat array of "landmark" elements (headings, nav, main, section, article, aside, footer, form, table, [role]) with `{ tag, path, depth, box: {w,h}, childCount }`
- Add `opts.tree = true` to get the current recursive structure
- The existing `opts.summary = true` (which returns a different summary) should continue working — it's a separate mode
- Keep the `{ summary: true }` path intact, this is a third mode: `tree` (recursive), default (flat landmarks), `summary` (existing counts)

### Unit C: colorProfile/paletteProfile sources cleanup

**Files:** `src/tools/color-profile.js`, `src/tools/palette-profile.js`

**Change:** Each color entry includes `sources: []` tracking where the color was found (fg, bg, gradient, border). This is rarely actionable — the `count` field already captures usage frequency. Drop `sources` by default, add `opts.sources = true` to opt in.

**Specifically:**
- `color-profile.js`: in the entries array, stop including `sources` unless `opts.sources`
- `palette-profile.js`: same treatment for palette entries
- Both tools collect sources internally for dedup/counting — keep that logic, just don't emit the field

## How to execute

1. Launch 3 parallel agents (one per unit), each in a worktree
2. Each agent: edit source, rebuild (`./build.sh`), run tests (`npx playwright test`)
3. Merge results, run full test suite, measure with `test/measure-reduction.js`
4. Commit

## Measurement

Use `test/measure-reduction.js` for before/after comparison. The script connects to Browserless CDP and measures `JSON.stringify().length` across 4 live sites. To add tools to the measurement, edit the `TOOLS` array.

For motionProfile specifically, add:
```js
['motionProfile', '__ps.motionProfile()'],
```

For pageMap:
```js
['pageMap', '__ps.pageMap()'],
```

## Key decisions from this session

- **depth:1 default for layoutDensity**: The 83.6% reduction validated that recursion is almost never needed by default. AI consumers call with explicit depth when they need it.
- **textElements opt-in**: The `textFill` percentage (kept) gives the signal. The per-element breakdown (font size, line height, pctOfParent) is debugging detail.
- **chromaLabel fully removed**: `colorTone(L, C, h)` is the replacement everywhere. gradient-profile.js field renamed `label` → `tone`.
- **Gradient pathCount pattern**: When capping arrays, add a `*Count` field so consumers know the full extent. Applied to `paths[]` → `pathCount` + first 3.
- **Low-impact changes still worth doing**: gradientProfile and touchTargets changes showed <1% on test sites but prevent blowup on jQuery-heavy / gradient-dense pages. Hygiene matters.

## Key file paths

- `src/tools/motion-profile.js` — Unit A target
- `src/tools/page-map.js` — Unit B target
- `src/tools/color-profile.js` — Unit C target
- `src/tools/palette-profile.js` — Unit C target
- `test/measure-reduction.js` — comparison script
- `docs/signal-noise-recommendations.md` — original full audit
- `memories/handoff-signal-noise.md` — Batches 1-3 handoff
