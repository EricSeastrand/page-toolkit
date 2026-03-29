# Font Sensing Field Test — 6 Sites

Tested the new typographyProfile measurements across diverse site types.

## Hierarchy Scores

| Site | Score | Sizes | Range | Avg Ratio | σ Ratio | Type |
|------|-------|-------|-------|-----------|---------|------|
| Apple | 88 | 7 | 4.0× | 1.26 | 0.124 | Product/marketing |
| Nike | 87 | 6 | 3.3× | 1.29 | 0.195 | Ecommerce/brand |
| Notion | 82 | 10 | 4.5× | 1.19 | 0.184 | SaaS landing |
| Microsoft | 64 | 9 | 2.9× | 1.15 | 0.082 | Corporate portal |
| NYT | 48 | 11 | 3.1× | 1.12 | 0.066 | News homepage |

## What the scores reveal

**Apple (88)** — Textbook type hierarchy. 7 clean sizes, well-separated (avg 1.26× ratio), headings are 600 weight vs 400 body. The only flags are tight-leading on display headings (1.08×) — intentional for short headlines.

**Nike (87)** — Bold, minimal scale with only 6 sizes. Big 1.67× jump from 40→24 creates strong drama. One oddity: 40px headings have `lineHeightRatio: 0.90` (negative leading) — the tool correctly flags this as abnormal.

**Notion (82)** — 10 sizes with wide 4.5× range gives it runway. The crowded mid-range (1.07× steps between 20/18.7/16/15) pulls it down. The σ of 0.184 confirms inconsistent stepping.

**Microsoft (64)** — 9 sizes crammed into only 2.9× range. Seven of eight ratios are under 1.2×, with two at 1.07× (barely distinguishable). Low σ (0.082) actually means consistently mediocre — every step is too small.

**NYT (48)** — Lowest score and it's revealing. 11 sizes in only 3.1× range, avg ratio 1.12×. Ten crowding flags. Multiple 1× lineHeightRatios (zero leading). 9px photo credits. But this is a *news homepage* — density is the feature, not a bug. The score correctly identifies the tight packing; editorial intent is context the tool can't know.

## Interesting spatial findings

### Negative leading (Nike 40px, NYT 16px)
```
Nike:  40px heading → lineHeightRatio 0.90 (-4px leading)
NYT:   16px h2      → lineHeightRatio 1.00 (0px leading)
```
These are real signals — the tool now surfaces them where before they were invisible.

### Breathing room patterns
```
Apple 48px heading: breathingRoom 1.0× (box = line-height exactly, tight)
Apple 19px body:    breathingRoom 2.01× (generous container space)
NYT 18px headline:  breathingRoom 2.5× (room for 2+ lines in card)
Nike 12px caption:  breathingRoom 17.22× (vertical text in narrow column — outlier)
```
The breathingRoom metric exposes where text is cramped vs floating in space. The Nike 17× outlier is a vertical sidebar label — weird but real.

### Chars-per-line anomalies
```
Nike 14px body:  ~64 chars/line (acceptable)
Apple 24px sub:  ~65 chars/line (acceptable)
NYT 10px meta:   ~38 chars/line (fine for small text)
Nike 12px:       ~3 chars/line (vertical text, not real reading)
```
No wide-measure flags fired on these sites — they all keep body text in reasonable widths. The metric is ready but needs a content-heavy site (blog, docs) to really show its value.

## Issues found during testing

1. **Spatial data is bucketed by rounded fontSize** — two entries at 14px with different weights share spatial averages. Acceptable trade-off for now since it's the *font size* that determines spatial needs, not weight.

2. **CSP blocks on 3/6 sites** (Airbnb, LinkedIn, gov.uk) — not a tool issue, just injection limitation. The `addInitScript` path via Playwright context avoids this.

3. **The no-margin flag is noisy** — fires on almost every site because many text elements get their spacing from parent padding, not own margin. Could improve by checking parent padding contribution.

4. **The 0.5 chars/px estimator is crude** — works for sans-serif body text but overestimates for wide display fonts and underestimates for condensed faces. A font-metric-aware approach would use canvas measureText.
