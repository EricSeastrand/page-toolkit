# Tool Improvement Run — 2026-03-29

## Sites tested
| Site | Category | Notes |
|------|----------|-------|
| theguardian.com | Editorial/news | Rich ad ecosystem, custom serif fonts, 1 blocked sheet |
| github.com | SaaS/marketing | Heaviest modern CSS adopter by far, 363 design tokens |
| gov.uk | Government | Minimal, high-contrast, accessibility-focused, font-display:fallback |
| en.wikipedia.org | Dense/data | Flat hierarchy (score 39), negative weightDelta, baseUnit=2 trivially |
| dribbble.com | Creative/portfolio | 9 blocked sheets, 31 anomalies, heavy overflow:hidden (425) |
| arstechnica.com | Editorial/tech | WordPress, 5 font families, 3 heading + 2 body, strong weightDelta (188) |
| etsy.com | (blocked) | Bot detection — captcha wall |
| bookshop.org | (blocked) | Cloudflare challenge |
| medium.com | (blocked) | Cloudflare challenge |

## Implemented this run
- **What**: Modern CSS features census in `platformProfile` — new `cssFeatures` field
- **Where**: `src/tools/platform-profile.js`, `docs/api-reference.md`
- **Evidence**: GitHub uses :has(242), @layer(122), subgrid(14), @container(25), color-mix(3), logical-props(1536). Dribbble uses zero modern features. Gov.uk uses font-display:fallback (performance-conscious) vs Guardian's swap. This is the most differentiating ad-hoc measurement found — no other metric showed this range.
- **Features detected**: `:has()`, `@layer`, `subgrid`, `@container`, `color-mix()`, `light-dark()`, logical properties, `font-display` strategies
- **Only includes present features** — empty `cssFeatures` object when nothing found
- **Recursive rule scanning** — catches features inside @media, @supports, @layer blocks
- **Validation**:
  - Guardian: `{ has: 12, fontDisplay: { swap: 29 } }` — correct
  - GitHub: `{ has: 242, layer: 122, subgrid: 14, containerQuery: 25, colorMix: 3, logicalProps: 1536, fontDisplay: { swap: 4 } }` — correct, richest
  - gov.uk: `{ has: 6, logicalProps: 5, fontDisplay: { fallback: 4 } }` — correct, minimal

## Remaining proposals

### Noise (candidates for removal or reduced prominence)

- **`vibes` array**: "filmic/dramatic" + "tinted-neutral" appeared on 5/6 sites. The vibe labels aren't differentiating real-world sites — they may be calibrated for a narrow band. Either the thresholds need recalibration or the feature needs rethinking. Evidence: Guardian, GitHub, gov.uk, Dribbble, Ars all share "filmic/dramatic".
- **`lightnessShape` "bimodal"**: 5/6 sites are bimodal (dark text on light bg is nearly universal). This is correct but adds no information. Consider whether "bimodal" should be the unlabeled default with only deviations reported.
- **`cramped-in-container` crowding flag**: Fires on 4/6 sites for hero headings in normal-sized containers. The 0.08 threshold is too aggressive for display headings. Evidence: GitHub 56px in 680px (0.082 — barely over), gov.uk 55px in 576px (0.095). Proposed: raise threshold to 0.12 for headings in the display/heading group, or only flag when containerW < 300px.

### Gaps (new measurements needed)

- **Images without dimensions (CLS risk)**: Guardian has 125/126 images missing width/height attributes. GitHub 19/24, Dribbble 38/82. This is a massive layout shift risk signal not captured anywhere. A designer reviewing a page would notice content jumping during load. Belongs in `scanAnomalies` as a new anomaly type or a dedicated `layoutShiftRisk()` measurement. Approach: scan `img` elements for missing width/height attributes and CSS sizing.
- **Z-index stacking complexity**: Ranged from 1 layer (gov.uk: just `z-index:2`) to 14 layers with values up to 2147483647 (Guardian). High z-index spread correlates with CSS maintainability problems. Could be a field in `platformProfile.cssFeatures` or a standalone measurement. Approach: collect all computed z-index values, report count of distinct layers, max value, and whether any exceed 1000 (common anti-pattern).
- **DOM depth**: 16 (gov.uk, Dribbble) to 27 (GitHub, Wikipedia). Deep DOM trees slow rendering and indicate wrapper div bloat. Belongs in `platformProfile` or `pageMap`. Simple: walk DOM, report max depth.
- **overflow:hidden count**: 30 (gov.uk) to 425 (Dribbble). High counts may indicate hidden content or excessive clipping. Potentially useful as a `scanAnomalies` check when overflow:hidden clips visible content (requires checking if scrollHeight > clientHeight).

### Threshold tuning

- **`cramped-in-container`**: Current threshold 0.08 (8% of container width). Proposed: 0.12 for display-group headings, keep 0.08 for body text. Evidence: fires on hero headings across 4 well-designed sites.
- **`baseUnit` detection**: Wikipedia gets baseUnit=2 with 81% coverage. A baseUnit of 2 is trivially true for most spacing values and not a useful design system signal. Proposed: reject baseUnit < 4 (or apply a minimum coverage threshold that's harder to meet for small units).

### Representation improvements

- **`sectionRhythm` often empty**: 0 on 3/6 sites, 1 on 2/6. The algorithm may be too strict about what constitutes a "section". Many pages use semantic sections that the detector misses. Worth investigating why Guardian (a highly sectioned page) returns 0.

### Quick wins (small changes, high value)

- **`font-display` in text output**: Already done as part of this run's implementation.
- **`scroll-snap` detection**: Ad-hoc found Guardian uses 21 scroll-snap elements. Could be a one-line addition to `scrollAudit` or `platformProfile.cssFeatures`. File: `src/tools/scroll-audit.js` or `platform-profile.js`.

### Research needed (uncertain value, needs more data)

- **Heading-to-body font family pairing**: Ars Technica uses 3 heading fonts + 2 body fonts (5 total families). Is multi-font pairing a quality signal or noise? Need more sites with diverse typography to assess.
- **Text-transform usage patterns**: Ars has 129 uppercase transforms, Dribbble has 31. Is this a meaningful design pattern signal? Need to correlate with design category.
- **Blocked stylesheets impact**: Dribbble had 9 blocked sheets — does this systematically reduce toolkit accuracy? Need to assess whether blocked sheet count should trigger a warning.
