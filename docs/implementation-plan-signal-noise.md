# Signal/Noise Implementation Plan

## Execution strategy

Three batches. Batch 1 is a blocking prerequisite. Batch 2 is fully parallel (10 independent file changes). Batch 3 is sequential validation.

```
Batch 1 (sequential)
  └─ colorTone() + hueName() in oklch.js
     colorTone tests

Batch 2 (ALL PARALLEL — each task is a different source file)
  ├─ colorProfile: apply colorTone, drop redundant fields, flatten pairs
  ├─ paletteProfile: apply colorTone, drop text, drop hex default
  ├─ typographyProfile: drop text
  ├─ spacingProfile: drop text, cap gridFlexGaps
  ├─ gradientProfile: drop text
  ├─ motionProfile: drop text
  ├─ responsiveProfile: drop text
  ├─ platformProfile: drop text
  ├─ touchTargets: filter to problems, trim box model
  └─ elPath: shorten to last 2-3 segments

Batch 3 (sequential)
  ├─ siteProfile: pass format option through to sub-tools
  ├─ ./build.sh
  ├─ Run test suite, fix broken assertions
  └─ Before/after token count via explore-real-sites.js
```

---

## Batch 1: Color labeling system (blocking — do first)

### 1a. New `colorTone(L, C, h)` in `src/utils/oklch.js`

Replace `chromaLabel(C)` with `colorTone(L, C, h)` returning an ISCC-NBS-based modifier + hue name string.

**Hue name map** (~12 buckets from oklch hue angle):
```
red, orange, yellow, lime, green, teal, cyan, blue, indigo, purple, pink
```

**Modifier selection** (from oklch L and C, plus CIE saturation C/L):
- Pure neutrals (C < 0.01): "white", "light gray", "gray", "dark gray", "black" (by L)
- Tinted neutrals (C 0.01–0.04): "[hue]-ish gray/white/black" — noun is the neutral
- Muted accents (C 0.04–0.08): "grayish [hue]", "pale [hue]", "dark grayish [hue]" — noun is the hue
- Chromatic (C > 0.08): ISCC-NBS modifiers (vivid, brilliant, strong, deep, moderate, dark, light) selected by L and C/L ratio

**Density axis** — CIE saturation (C/L) distinguishes:
- Dense/heavy colors (high C relative to low L) → "deep", "dark"
- Luminous/bright colors (high C relative to high L) → "brilliant", "vivid"

Keep `chromaLabel()` temporarily for backward compat but mark deprecated.

### 1b. Add `hueName(h)` helper in `src/utils/oklch.js`

Simple bucket map from oklch hue angle to English color name.

### 1c. Possibly add `rgbToHsl()` and `rgbToHsv()` in `src/utils/color-math.js`

Needed for the HSL-S / HSV-S density ratio if we want it as a secondary signal beyond C/L. May not be needed if ISCC-NBS modifiers + C/L cover the space well enough — evaluate during implementation.

### 1d. Update tests

Add unit-style test cases for `colorTone()` covering:
- Pure neutrals at various lightness
- Tinted neutral vs muted accent boundary
- Known colors (hot pink, navy, burgundy, pastel blue, neon green)
- Edge cases: near-black with tint, near-white with tint

---

## Batch 2: Parallel file changes (10 independent tasks)

Each task below touches exactly one source file. No merge conflicts. All can run as parallel agents.

### Task: `color-profile.js` — apply colorTone + prune fields
- Replace `chroma: chromaLabel(C)` with `tone: colorTone(L, C, h)` in topFg/topBg entries
- Drop `color` (RGB string), `luminance`, `saturation` from top color entries
- Drop `hex` from default output (add `opts.hex` opt-in)
- Keep `oklch` and `count`
- Flatten `worstContrastPairs`: `{ path, fg: oklch, bg: oklch, ratio }`
- Prune `contrastDistribution` to: min, median, avg, belowAA, total
- Drop `fgLuminanceSpread` and `bgLuminanceSpread`
- Merge or drop `avgSaturation`

### Task: `palette-profile.js` — apply colorTone + drop text + drop hex
- Replace `label: chromaLabel(C)` with `tone: colorTone(L, C, h)` in color entries
- Drop `hex` from default (opt-in via `opts.hex`)
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in to restore human-readable output

### Task: `typography-profile.js` — drop text
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in

### Task: `spacing-profile.js` — drop text + cap arrays
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in
- Cap `gridFlexGaps` at 5 entries, add `totalGaps` count

### Task: `gradient-profile.js` — drop text
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in

### Task: `motion-profile.js` — drop text
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in

### Task: `responsive-profile.js` — drop text
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in

### Task: `platform-profile.js` — drop text
- Remove text generation, return data object only
- Add `opts.format === 'text'` opt-in

### Task: `touch-targets.js` — filter + trim
- Return only `tooSmall` targets by default, add `opts.all` for everything
- Summary counts stay (count, tooSmall, withWidgets, mouseOnly)
- Trim `box` to `{ w, h, cx, cy }` (width, height, center viewport %)
- Drop pixel x/y and corner percentages

### Task: `dom.js` — shorten elPath
- Trim from root, keep last 2-3 segments
- Use `#id` shortcut when available (skip ancestors above the id)
- All tools that emit element paths benefit automatically

---

## Batch 3: Integration + validation (sequential)

### 3a. `site-profile.js` passthrough
- Pass `opts.format` through to all sub-tool calls
- Adjust return structure if sub-tools now return data directly instead of `{ text, data }`

### 3b. Rebuild
- `./build.sh`

### 3c. Fix tests
- Run full test suite
- Update assertions broken by field name changes, removed fields, or restructured output
- The explore-real-sites.js script can run before/after to compare token counts

### 3d. Before/after comparison
- Run `test/explore-real-sites.js` against live sites
- Compare output size and structure vs baseline

---

## File → task mapping

| File | Batch | Task |
|------|-------|------|
| `src/utils/oklch.js` | 1 | `colorTone()`, `hueName()`, deprecate `chromaLabel()` |
| `src/utils/color-math.js` | 1 | Possibly `rgbToHsl()`, `rgbToHsv()` |
| `src/tools/color-profile.js` | 2 (parallel) | Apply colorTone, drop fields, flatten pairs |
| `src/tools/palette-profile.js` | 2 (parallel) | Apply colorTone, drop text, drop hex |
| `src/tools/typography-profile.js` | 2 (parallel) | Drop text |
| `src/tools/spacing-profile.js` | 2 (parallel) | Drop text, cap gridFlexGaps |
| `src/tools/gradient-profile.js` | 2 (parallel) | Drop text |
| `src/tools/motion-profile.js` | 2 (parallel) | Drop text |
| `src/tools/responsive-profile.js` | 2 (parallel) | Drop text |
| `src/tools/platform-profile.js` | 2 (parallel) | Drop text |
| `src/tools/touch-targets.js` | 2 (parallel) | Filter to problems, trim box |
| `src/utils/dom.js` | 2 (parallel) | Shorten elPath |
| `src/tools/site-profile.js` | 3 | Format passthrough |
| `test/` | 1 + 3 | colorTone tests, fix broken assertions |
