# Signal/Noise Improvement Recommendations

Reviewed all 26 tools' source code. These recommendations are ordered by impact.

---

## 1. Kill the dual text+data pattern

**Tools affected:** paletteProfile, typographyProfile, spacingProfile, gradientProfile, motionProfile, responsiveProfile, platformProfile, siteProfile (8 tools)

These tools return `{ text, data }` where the `text` field is a multi-line human-readable report that duplicates everything in `data`. An AI consumer parses the structured `data` — the `text` is pure noise eating tokens.

**Recommendation:** Drop `text` from the default return. If human-readable output is still useful somewhere, make it opt-in: `paletteProfile({ format: 'text' })`.

**Token savings estimate:** The text reports are 15-40 lines each. Across the 7 profile tools, this is easily 150-250 lines of redundant output per `siteProfile()` call.

---

## 2. Consolidate color representations

**Tools affected:** colorProfile, paletteProfile

Each color currently ships as 3-4 representations:
```js
{ color: "rgb(255,255,255)", hex: "#ffffff", oklch: { L: 100, C: 0, h: 0 }, chroma: "achromatic" }
```

An AI consumer reasons about color perceptually, not in hex codes. The oklch coordinates give precise perceptual position, and the chroma label ("neutral", "tinted neutral", "moderate", "vivid", "intense") gives an instant vibe read without doing math on C values. Hex is only useful when you need to grep a stylesheet or write CSS — rare during analysis.

**Recommendation:** Return `{ oklch, chroma, count }` by default. Drop `color` (RGB string), `hex`, `luminance`, and `saturation`. Keep `chroma` — it's a word that maps directly to design intent. Keep hex available via opt-in (`opts.hex = true`) for when the consumer needs to reference a specific CSS value.

**Before (colorProfile topFg entry):**
```js
{ color: "rgb(0,0,0)", hex: "#000000", count: 42, luminance: 0, saturation: 0,
  oklch: { L: 0, C: 0, h: 0 }, chroma: "achromatic" }
```

**After:**
```js
{ oklch: { L: 0, C: 0, h: 0 }, chroma: "neutral", count: 42 }
```

---

## 3. Flatten worstContrastPairs

**Tool:** colorProfile

Each pair currently has 9 fields (fg, fgHex, fgOklch, bg, bgHex, bgOklch, ratio, path). With recommendation #2 applied:

**Before:**
```js
{ path, fg: "rgb(...)", fgHex: "#...", fgOklch: {...}, bg: "rgb(...)", bgHex: "#...", bgOklch: {...}, ratio }
```

**After:**
```js
{ path, fg: { L: 45.2, C: 0.12, h: 264 }, bg: { L: 48.1, C: 0.03, h: 90 }, ratio: 1.15 }
```

The consumer already has the full color objects from topForegroundColors/topBackgroundColors. The pairs just need oklch coords (perceptually meaningful) + ratio + where.

---

## 4. Trim the box model in touchTargets

**Tool:** touchTargets

Each target's `box` has 8 values. The pixel positions (x, y) are only useful for debugging. The percentage positions have 4 values where 2 suffice (center is what gesture planning actually needs).

**Before:**
```js
box: { x: 120, y: 340, w: 200, h: 44, xPct: 12.5, yPct: 45.3, centerXPct: 22.9, centerYPct: 51.2 }
```

**After:**
```js
box: { w: 200, h: 44, cx: 22.9, cy: 51.2 }
```

Width/height for size checking + center viewport percentages for gesture targeting. 4 values instead of 8.

---

## 5. Prune contrastDistribution percentiles

**Tool:** colorProfile

Returns 7 percentiles (min, p10, p25, median, p75, p90, max) plus avg, belowAA, belowAAA, total. That's 11 values for a distribution summary.

**Recommendation:** Keep `min`, `median`, `avg`, `belowAA`, `total`. Drop p10, p25, p75, p90, max, belowAAA. The min tells you worst case, median tells you typical, belowAA tells you the problem count. That's the signal.

**Before:** 11 fields. **After:** 5 fields.

---

## 6. Drop luminance spread stats

**Tool:** colorProfile

`fgLuminanceSpread` and `bgLuminanceSpread` are secondary statistics that overlap with what's already visible from the top colors list. The consumer can see the luminance range from the topFg/topBg oklch.L values.

**Recommendation:** Remove both `fgLuminanceSpread` and `bgLuminanceSpread` entirely.

---

## 7. Cap and summarize array outputs

**Tools affected:** touchTargets, spacingProfile (gridFlexGaps), layoutDensity (children/gaps)

These tools can return very large arrays on real sites (50+ touch targets, 20+ grid gaps). Most of the array is noise — the AI consumer needs the pattern, not every instance.

**Recommendation:**
- `touchTargets`: Return only `tooSmall` targets by default (the problems). Add `opts.all` to get everything. Summary counts stay.
- `spacingProfile.gridFlexGaps`: Cap at 5 entries, add `totalGaps` count.
- Element paths: Truncate to last 3 segments (e.g., `div.card > a > span` instead of `html > body > main > section.hero > div.container > div.row > div.card > a > span`).

---

## 8. Shorten element paths globally

**All tools that use `elPath()`**

Full DOM paths like `html > body > main > section.products > div.container > div.row > div.col-md-4 > div.card > a.card-link` are 15+ tokens each and appear hundreds of times across tool outputs.

**Recommendation:** `elPath()` should return a compact identifier — tag + id if present, otherwise last 2-3 ancestors. Examples:
- `#main-nav > ul > li` instead of `html > body > header > nav#main-nav > ul > li`
- `section.hero > h1` instead of `html > body > main > section.hero > div > h1`

Trim from the root, keep from the target.

---

## 9. Make avgSaturation a single number

**Tool:** colorProfile

Currently `{ fg: 0.123, bg: 0.045 }`. The split between fg and bg saturation rarely matters for decision-making.

**Recommendation:** Single weighted average, or drop entirely (the oklch.C values on top colors convey this better).

---

## 10. Consider a `compact` output mode

Rather than breaking changes across all tools, add `opts.compact = true` (or make it default) that applies recommendations 2-9 automatically. The full verbose output stays available via `opts.compact = false` for debugging.

This lets you ship the improvements without breaking any existing consumers during the transition.

---

## Summary by impact

| Change | Tools | Token reduction | Effort |
|--------|-------|----------------|--------|
| Drop text from text+data tools | 8 | ~200 lines/siteProfile call | Low |
| Consolidate color representations | 2 | ~40% per color entry | Medium |
| Shorten element paths | All | ~50% per path | Low (one function) |
| Filter touchTargets to problems only | 1 | 60-90% of array | Low |
| Flatten worstContrastPairs | 1 | ~60% per pair | Low |
| Trim box model | 1 | 50% per target | Low |
| Prune percentiles | 1 | ~55% of distribution | Low |
| Drop luminance spreads | 1 | 2 objects removed | Trivial |

Recommended implementation order: 1, 8, 7, 2, 3, 4 (highest impact first, then cascade).
