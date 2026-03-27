# Handoff: Toolkit OKLCH Colorimetry Upgrade

**Date**: 2026-03-24
**Status**: Phase 1-3 implemented (v0.7)

## What We Were Doing

Evaluating the Playwright frontend toolkit's color analysis capabilities by running a real colorimetric audit of bubbleup.net. The goal was to find where the toolkit falls short for understanding color harmony, palette vibe, and design intent — not just WCAG contrast.

## Key Findings

### Site Analysis (bubbleup.net)

Full analysis written to `docs/bubbleup-net-color-analysis.md`. Summary:

- **18-color design system** defined in CSS custom properties, only ~6 in active use
- **Palette identity**: split-complementary — deep indigo (LCH h:305°) + warm gold accent (h:81°), ~224° apart
- **Vibe**: filmic/dramatic. Bimodal lightness (L:6-20 darks, L:86-100 lights), blue-violet tinted neutrals (the "blacks" have C:11.8 at h:291°), zero gradients, brand-tinted hard-offset box shadows
- **WCAG issue**: gold on blue buttons = 3.18:1, fails AA
- Pages analyzed: homepage, services, work, about — palette is consistent across all

### Toolkit Gaps Identified (5 major)

1. **`colorProfile()` maxElements is broken** — always returns 13 elements regardless of setting. Raw DOM scan of same page found 585 visible elements.
2. **No perceptually uniform color space** — sRGB luminance + saturation only. Can't compute hue harmony, chroma, Delta E, or detect tinted neutrals.
3. **No CSS custom property extraction** — misses the design system. Found 4 colors vs actual 18.
4. **Blind to non-fg/bg channels** — borders (1,032 uses of #111222), box shadows (brand-tinted), SVG fills, gradients all invisible.
5. **No palette-level analysis** — no lightness distribution, chroma envelope, hue clustering, harmony classification, or vibe labeling.

## Decisions Made

### OKLCH over CIE LCH
CIE LCH (1976) has non-uniform hue — blues appear more saturated than yellows at equal chroma. OKLCH (Ottosson 2020) fixes this. Since BubbleUp's palette is heavily blue-violet, CIE's distortion would hit exactly where we need accuracy. OKLCH is also the CSS Color Level 4 native format (`oklch()`), so we can emit valid CSS from analysis results. No reason to use the older standard.

### paletteProfile() as a single tool (not extract + analyze split)
Originally considered separate `paletteExtract()` and `paletteAnalyze()` tools. Decided against because you'd never call one without the other — extraction without analysis is just a color list, analysis requires extraction first. Two tools = two round-trips for the same answer. One tool: `paletteProfile()`.

### paletteProfile() vs colorProfile() — keep both
- `colorProfile()` = element-level diagnostic. "What's wrong with color on this page right now?" Scoped, finds WCAG failures, reports CSS selectors. Like a blood test.
- `paletteProfile()` = design-system-level identity. "What is this site's color personality?" Extracts CSS custom props + all color channels, does harmony/vibe analysis. Like a physical.
- Both need OKLCH in their output; the `_util` layer serves both.

### Ideal output format for paletteProfile()
Designed a specific text format optimized for LLM reasoning (not JSON). Key features:
- LCH values as primary representation, hex for reference
- Chroma gets plain-English labels: neutral (C:0-5), tinted neutral (C:5-15), moderate (C:15-40), vivid (C:40-70), intense (C:70+)
- Harmony pre-computed (not raw hue angles requiring mental math)
- Lightness distribution as a shape label: bimodal, uniform, skewed-dark, skewed-light
- Neutral tint called out explicitly
- Vibe label(s) at the end
See the example block in `docs/bubbleup-net-color-analysis.md` under "Toolkit Gaps" → "Recommendations", and the conversation contained a detailed mockup of the output format.

## Implementation — Completed

All three phases implemented in toolkit v0.7.

### Phase 1: OKLCH in `_util` ✓
Added 9 functions: `linearize`, `rgbToOklab`, `oklabToOklch`, `rgbToOklch`, `oklchToRgb`, `deltaEOK`, `chromaLabel`, `hueDistance`, `harmonyClass`. Also `hexFromRGB`. All exported on `_util`. Math verified: red round-trips clean, DeltaE(white,black) = 1.0, harmony classification correct.

OKLCH chroma thresholds (these are OKLCH scale 0–0.37, not CIE 0–100):
- neutral: C < 0.02, tinted neutral: 0.02–0.06, moderate: 0.06–0.15, vivid: 0.15–0.25, intense: 0.25+

### Phase 2: `paletteProfile()` ✓
New tool on `__ps`. Extracts colors from: CSS custom properties, fg/bg, borders, box-shadows, outlines, SVG fill/stroke. Deduplicates by hex. Returns `{ text, data }` — text is the LLM-optimized format, data is structured for programmatic use.

Analysis: lightness distribution (bimodal/skewed-dark/skewed-light/uniform), hue clustering with circular mean, harmony classification, neutral tint detection, chroma stats, WCAG contrast concerns, vibe labels.

### Phase 3: `colorProfile()` upgraded ✓
- **maxElements bug fixed**: `scanned++` now increments for all visible in-viewport elements, not just text-bearing ones. The cap now actually limits DOM traversal.
- OKLCH values + hex + chroma labels added to `topForegroundColors`, `topBackgroundColors`, `worstContrastPairs`.

### Tuning fixes after live testing on bubbleup.net
- **`parseRGB` now handles hex** — CSS custom property values resolve as hex strings (`#1E7DB2`), not `rgb()`. Added `#RGB`, `#RRGGBB`, `#RRGGBBAA` parsing. This was blocking all 19 design tokens.
- **Hue clustering chain-merge bug** — adjacent step check (<30°) allowed chaining across >45° total span. Added max group span check (<45°).
- **Lightness bimodal detection** — usage-weighted histogram now. Old thresholds (>35% each pole) missed bimodal sites where white dominates by count but darks form a distinct cluster. New heuristic: both poles >8%, mid is a valley below the smaller pole, and both poles have ≥5 elements.
- **Harmony occupied-arc calculation** — was using `hueDistance(first, last)` which takes shortest arc, incorrectly labeling full-wheel palettes as "analogous". Now computes actual occupied arc (360° minus largest gap).

### Validated against manual analysis
All key metrics match the manual bubbleup.net audit: 19 tokens found, bimodal lightness, tinted neutral h≈281° (OKLCH), gold-on-blue 3.18:1 WCAG failure, filmic/dramatic vibe.

## Key File Paths

- `scripts/playwright-tools/toolkit.js` — toolkit source (v0.7)
- `docs/bubbleup-net-color-analysis.md` — bubbleup.net color audit that motivated this work
