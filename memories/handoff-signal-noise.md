# Signal/Noise Improvement — Handoff

## What and why

Reducing token waste in page-toolkit's tool output so AI consumers get more signal per context window. The full rationale is in `docs/signal-noise-recommendations.md`. The implementation plan is in `docs/implementation-plan-signal-noise.md`.

## What's done (all 3 batches complete)

### Batch 1: Color labeling system
- `hueName(h)` — 11 oklch hue buckets → English names (pink wraps around 0°)
- `colorTone(L, C, h)` — ISCC-NBS modifier + hue label with 4 zones:
  - Pure neutrals (C < 0.01): white/light gray/gray/dark gray/black
  - Tinted neutrals (C 0.01-0.04): "blue-ish gray" — noun is the neutral
  - Muted accents (C 0.04-0.08): "grayish blue" — noun is the hue
  - Chromatic (C > 0.08): ISCC-NBS modifiers using L and C/L (CIE saturation)
- `chromaLabel()` marked deprecated, still present
- 22 test cases in `test/color-tone.spec.js`
- C/L ratio is sufficient for the density axis — rgbToHsl/rgbToHsv not needed

### Batch 2: 10 parallel file changes
All profile tools now return data objects by default, `{ text, data }` only via `opts.format === 'text'`:
- `colorProfile` — dropped hex/rgb/luminance/saturation from entries, tone replaces chroma, flattened worstContrastPairs, pruned contrastDistribution
- `paletteProfile` — tone replaces label, hex opt-in
- `typographyProfile`, `gradientProfile`, `spacingProfile`, `motionProfile`, `responsiveProfile`, `platformProfile` — text dropped from default
- `spacingProfile` — gridFlexGaps capped at 5, totalGaps added
- `touchTargets` — default returns only tooSmall targets, box trimmed to {w,h,cx,cy}
- `dom.js` — elPath shortened to last 3 segments, #id shortcut

### Batch 3: Integration
- `siteProfile` updated to pass `opts.format` through to sub-tools, returns data-only by default
- All 114 tests passing
- Before/after on Stripe.com: **28.5% reduction** (111K → 79K chars)
  - Biggest wins: paletteProfile 43%, platformProfile 42%, motionProfile 40%, gradientProfile 35%

## What's NOT done — next session focus

The user said "check into other ways to improve signal." Ideas to explore:

1. **Review the per-tool breakdown** — colorProfile showed 0% text reduction because it never had text mode. Its structural changes (dropped fields) reduced absolute size but the comparison script couldn't show it. May want a more nuanced comparison.

2. **Look at what other noise remains** — the 28.5% came from dropping text and redundant fields. What else is noisy? Possible areas:
   - Are any remaining fields rarely useful?
   - Could tool outputs be more hierarchical/grouped?
   - Are there tools that return too much data by default (like scanAnomalies returning all issues when only critical ones matter)?

3. **The `chromaLabel()` deprecation cleanup** — callers still reference it in some places. Need to grep and migrate remaining uses to `colorTone()`.

4. **elPath quality check** — the dom.js shortening may have made some paths ambiguous. Worth spot-checking on real sites.

5. **Token counting** — the char-based comparison is a rough proxy. Actual token count (via tiktoken or similar) would be more precise.

## Key decisions and reasoning

- **C/L ratio over HSL/HSV saturation**: CIE saturation (C/L) maps directly to ISCC-NBS density modifiers. HSL-S and HSV-S measure different things and would require conversion functions that add complexity without improving label quality.
- **Noun/adjective flip at C=0.04**: "bluish gray" vs "grayish blue" — the noun tells the AI what the color fundamentally IS. Below 0.04 chroma, it's a gray with a tint. Above, it's a color that's been grayed.
- **Hue boundaries**: oklch hue angles don't map linearly to intuitive color names. Boundaries were set empirically — pink wraps around 0° (350-20), red is 20-45, etc. Burgundy at h≈20-25 lands in "red" not "pink".
- **Data-only default**: AI consumers parse JSON, not prose. Text is pure noise for them. Keeping `format: 'text'` as opt-in preserves human debugging path.

## Teaching moments

- **Parallel agent execution**: User asked if `/batch` slash command was needed for parallel work. Answer: no, the Agent tool can be called multiple times in one message for ad-hoc parallelism. `/batch` adds worktree isolation, per-unit PRs, plan-mode gating, and the simplify skill — it's a formalized playbook, not a different execution mechanism.
- **Explore script comparison trap**: The explore-real-sites.js summarize() function reduces output to metadata before storing. Comparing summary sizes showed -11% (worse!) because the new data-only format had more keys in the generic summarizer. Had to write an inline comparison measuring raw JSON.stringify().length to get the real 28.5% number.

## Key file paths
- `src/utils/oklch.js` — hueName, colorTone, chromaLabel (deprecated)
- `src/tools/site-profile.js` — composite tool, format passthrough
- `docs/implementation-plan-signal-noise.md` — full 3-batch plan
- `docs/signal-noise-recommendations.md` — original analysis
- `test/color-tone.spec.js` — colorTone test suite
- `test/explore-real-sites.js` — live-site exploration script
