# Font Sensing Audit: What We Have vs What We Need

## What the tools return today (pixel-level)

### typographyProfile()
For each distinct text style on the page:
- `fontSize` — exact px (e.g. 48, 32, 24, 17, 14, 12)
- `lineHeight` — computed CSS value (e.g. "52.0075px", "normal")
- `fontWeight` — computed (400, 600, 700)
- `letterSpacing` — computed CSS value
- Semantic bucketing: display (>48), heading (24–48), body (14–24), caption (<14)
- `count` — how many elements use this exact style
- `tags` — which HTML elements (h2, p, a, span…)
- `sample` — first 60 chars of text

### What's NOT captured that matters for font sensing

| Gap | Why it matters |
|-----|----------------|
| **No bounding box per text element** | Can't tell if 12px text is crammed in a 40px-tall card or floating in 400px of whitespace |
| **No margin/padding around text** | "Space around the font" — the core ask. layoutDensity has this but only for explicitly targeted selectors |
| **No line-height as a ratio** | lineHeight "52.0075px" for 48px font = 1.083×. That's tight. But we report raw CSS, not the ratio |
| **No scale ratios between sizes** | Apple: 48→32→24→19→17→14→12. The jumps are 1.5×, 1.33×, 1.26×, 1.12×, 1.21×, 1.17×. Not computed. |
| **No hierarchy % score** | No way to say "this page has 85% clear hierarchy" |
| **No container context** | Is that 14px text in a hero or a footer? Tag name is a weak proxy |
| **No rendered line length** | 16px body text in a 1400px container = ~140 chars/line (bad). Not measured. |
| **No "crowding" detection** | When text has <0.5em of breathing room to adjacent non-text elements |

## Real-world data from 3 major sites

### Apple.com — Type Scale
| px | weight | lineHeight ratio | role | sample |
|----|--------|-----------------|------|--------|
| 48 | 600 | 1.08× | heading | "iPhone" |
| 32 | 600 | 1.13× | heading | "AirPods Max 2" |
| 24 | 400 | 1.17× | heading | "Meet the latest iPhone lineup." |
| 19 | 400 | 1.21× | body | "Apple Worldwide Developers Conference…" |
| 17 | 400 | 1.18× | body | "Learn more" |
| 14 | 400 | 1.43× | body | "Read the letter from Tim" |
| 12 | 400 | 1.33× | caption | footer/legal text |

**Scale ratios:** 48→32 (1.50×), 32→24 (1.33×), 24→19 (1.26×), 19→17 (1.12×), 17→14 (1.21×), 14→12 (1.17×)

### Microsoft.com — Type Scale
| px | weight | lineHeight ratio | role | sample |
|----|--------|-----------------|------|--------|
| 32 | 500 | 1.25× | heading | "Meet the computer you can talk to" |
| 24 | 500 | 1.33× | heading | "$15 off select Xbox Wireless Controllers" |
| 18 | 600 | 1.33× | body | "Your productivity, supercharged" |
| 16 | 400 | 1.50× | body | paragraph copy |
| 15 | 600 | 1.47× | body | CTAs "Meet Windows 11" |
| 14 | 600 | 1.43× | body | "Learn more" |
| 12 | 600 | 1.33× | caption | badges |
| 11 | 400 | 1.45× | caption | nav/footer links |

**Scale ratios:** 32→24 (1.33×), 24→18 (1.33×), 18→16 (1.13×), 16→15 (1.07×), 15→14 (1.07×), 14→12 (1.17×), 12→11 (1.09×)

### IBM.com — Type Scale
| px | weight | lineHeight ratio | role | sample |
|----|--------|-----------------|------|--------|
| 48 | 300 | 1.17× | heading | "Stay connected" |
| 37.7 | 300 | 1.22× | heading | "Secure AI at scale" |
| 29.9 | 400 | 1.29× | heading | "US Open" |
| 20 | 400 | 1.40× | body | paragraph copy |
| 16 | 400 | 1.50× | body | card descriptions |
| 14 | 400 | 1.29× | body | form/cookie UI |
| 12 | 400 | 1.33× | caption | labels |

**Scale ratios:** 48→37.7 (1.27×), 37.7→29.9 (1.26×), 29.9→20 (1.50×), 20→16 (1.25×), 16→14 (1.14×), 14→12 (1.17×)

## Patterns observed across all 3 sites

1. **Heading line-height is tight** — consistently 1.08×–1.29×. Body is looser: 1.33×–1.50×.
2. **Scale ratios are NOT uniform** — no site uses a strict modular scale. Jumps range from 1.07× to 1.50× even within the same page.
3. **11–12px is the universal floor** — all three sites bottom out there for nav/legal/labels.
4. **The "crowding" signal isn't in the type data** — it's in the relationship between font size and the box/spacing around it, which typographyProfile doesn't capture.

## Proposed new measurements for typographyProfile

### 1. Scale analysis (computed from existing data)
```js
scaleAnalysis: {
  ratios: [1.50, 1.33, 1.26, 1.12, 1.21, 1.17],  // between adjacent sizes
  ratioAvg: 1.27,
  ratioStdDev: 0.12,     // uniformity measure
  range: 4.0,            // largest / smallest (48/12)
  sizeCount: 7,
  hierarchyScore: 82     // 0-100, penalize crowded mid-range, reward clear separation
}
```

### 2. Line-height ratios (computed from existing data)
```js
// In each scale entry:
{
  fontSize: 48,
  lineHeight: "52.0075px",
  lineHeightRatio: 1.08,  // NEW: lineHeight / fontSize
  leading: 4,             // NEW: lineHeight - fontSize (px of "air" between lines)
}
```

### 3. Per-element spatial context (NEW measurement)
```js
// In each scale entry or as separate detail:
{
  fontSize: 17,
  boxContext: {
    avgBoxHeight: 42,        // average bounding box height of elements at this size
    avgPaddingY: 10,         // average vertical padding
    avgMarginY: 13,          // average vertical margin
    breathingRoom: 1.47,     // (boxHeight / lineHeight) — how much vertical space vs text
    avgBoxWidth: 340,        // average element width
    avgCharsPerLine: 52,     // estimated from fontSize + avgBoxWidth
  }
}
```

### 4. Hierarchy score (0–100)
Factors:
- **Separation clarity** (40%): Are adjacent scale steps distinguishable? (>1.15× ratio = good)
- **Role coverage** (20%): Does the page have display, heading, body, caption?
- **Weight differentiation** (20%): Do headings use heavier weights than body?
- **Size range** (20%): Is the largest/smallest ratio healthy? (3×–6× = ideal)

### 5. Crowding flags
```js
crowding: [
  { fontSize: 14, issue: "tight-leading", lineHeightRatio: 1.08, threshold: 1.2 },
  { fontSize: 12, issue: "no-margin", avgMarginY: 0, context: "footer li" },
  { fontSize: 16, issue: "wide-measure", avgCharsPerLine: 120, threshold: 80 },
]
```
