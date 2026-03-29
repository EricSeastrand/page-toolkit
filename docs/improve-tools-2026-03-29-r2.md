# Tool Improvement Run 2 — 2026-03-29

## Sites tested
| Site | Category | Notes |
|------|----------|-------|
| linear.app | SaaS/marketing | Dark mode, Inter Variable + Berkeley Mono, 582 @layer rules, 0 images missing dims |
| target.com | E-commerce | Heaviest DOM (depth 36), 462 overflow:hidden, 57% images missing dims, 86 text truncations |
| vercel.com | Marketing/brand | 90 container queries, z-index max 999999999 (13 layers), Geist + Geist Mono |
| craigslist.org | Dense/data | Old school — 15 colors, baseUnit=1, DOM depth 12, 0 modern CSS, no images |
| a11yproject.com | Accessibility | 100% images missing dims (10/10), no modern CSS, baseUnit=20, DOM depth 10 |
| figma.com | SaaS/creative | 82 logical properties, figmaSans custom font, 34% images missing dims (39/116) |
| amazon.com | (blocked) | Bot detection — only 49 elements rendered |
| reddit.com | (blocked) | Bot detection — only 18 elements rendered |

## Implemented this run
- **What**: Image dimension audit (`imageStats`) in `platformProfile` — CLS risk detection
- **Where**: `src/tools/platform-profile.js`, `docs/api-reference.md`
- **Evidence**: Images missing width/height attributes ranged from 0% (Linear) to 100% (A11Y Project) across 6 sites. This was the highest-variance ad-hoc measurement — a direct layout shift risk signal not captured by any existing tool. Proposed in run 1 and confirmed with 6 new sites.
- **Fields**: `{ total, missingDimensions, pct, samples?[] }` — only present when page has images; samples capped at 5 with element path + truncated src
- **Checks**: attribute `width`/`height` and inline `style.width`/`style.height` — these are what prevent CLS before image load
- **Validation**:
  - Target: 91 imgs, 52 missing (57%) — correct, mostly lazy-loaded product images
  - Linear: 31 imgs, 0 missing (0%) — correct, all properly sized
  - Figma: 116 imgs, 39 missing (34%) — correct, mix of CDN images and data URIs
  - Text format confirmed working with sample paths

## Cross-site data

| Metric | Linear | Target | Vercel | Craigslist | A11Y | Figma |
|--------|--------|--------|--------|------------|------|-------|
| Elements | ~2000+ | 2145 | 2946 | 1520 | 284 | 1505 |
| Font families | 2 | 1 | 4 | 2 | 2 | 2 |
| Colors | 63 | 136 | 102 | 15 | 36 | 20 |
| baseUnit | 8 | 4 | 2 | 1 | 20 | 12 |
| CSS features | layer:582 | has,layer,cq,cm | has,layer,sub,cq | layer:1 | none | layer,lp |
| **Imgs missing dims** | **0%** | **57%** | **0%** | **n/a** | **100%** | **34%** |
| Z-index layers | 6 | 7 | 13 | 6 | 1 | 10 |
| Z-index max | 10000 | 1070 | 999M | 9000 | 1 | 40 |
| DOM depth | 23 | 36 | 24 | 12 | 10 | 23 |
| overflow:hidden | 500 | 462 | 221 | 4 | 12 | 69 |
| Text truncation | 4 | 86 | 36 | 1 | 0 | 0 |
| Line length 45-75ch | 33% | 3% | 8% | 0% | 0% | 4% |

## Remaining proposals

### Noise (candidates for removal or reduced prominence)

- **`vibes` array** (reconfirmed): "tinted-neutral" on 5/6 sites, "saturated" on 4/6, "filmic/dramatic" on 4/6. Still not differentiating. Either recalibrate thresholds or rethink the feature.
- **`lightnessShape` "bimodal"** (reconfirmed): 4/6 sites bimodal. Dark-text-on-light is the web's default. Only deviations (skewed-light on Linear's dark mode, uniform on Craigslist) are informative.
- **`baseUnit` trivial values** (reconfirmed): Craigslist=1, Vercel=2 — trivially true for almost any spacing set. Reject baseUnit < 4 or require higher coverage threshold for small units.

### Gaps (new measurements needed)

- **Z-index stacking complexity**: Vercel has 13 layers with max 999999999. A11Y Project has 1 layer with max 1. This is a CSS maintainability signal — high z-index spread indicates overlay/modal complexity and potential stacking context bugs. Belongs in `platformProfile` or `scanAnomalies`. Approach: collect distinct computed z-index values, report layer count, max value, and flag values >10000 as anti-patterns. Evidence: 6/6 sites, range from 1 to 13 layers.
- **DOM depth**: 10 (a11yproject) to 36 (Target). Correlates with framework complexity and rendering performance. Simple addition to `platformProfile` or `pageMap`. Approach: walk DOM, report max depth. Evidence: 6/6 sites.
- **overflow:hidden density**: 4 (Craigslist) to 500 (Linear). High counts suggest hidden content or excessive clipping. Could be a `scanAnomalies` check when overflow:hidden clips visible content (scrollHeight > clientHeight). Evidence: 6/6 sites, >100x range.
- **Text truncation count**: 0 (A11Y, Figma) to 86 (Target). text-overflow:ellipsis usage indicates content that doesn't fit — a content strategy or layout issue. Could be a field in `scanAnomalies` or `typographyProfile`. Evidence: 6/6 sites.
- **Line length / readability**: 0-33% of text blocks in comfortable 45-75ch range across all sites. However, all sites scored poorly — may need calibration. Marketing homepages use short blurbs, not long-form text, so low scores might be appropriate. Need to test on editorial/long-form pages to validate whether this metric is useful. Research needed.

### Threshold tuning

- **`baseUnit` minimum**: Current: accepts any value. Proposed: reject baseUnit < 4, or require >70% coverage for units <4. Evidence: Craigslist baseUnit=1 (trivially true), Vercel baseUnit=2 (trivially true).

### Quick wins (small changes, high value)

- **`imageStats` skip zero-src images**: Some pages have placeholder `<img>` elements with no src. Could filter these to avoid inflating the "missing dimensions" count. Low priority — didn't affect validation accuracy.

### Research needed (uncertain value, needs more data)

- **Line length on editorial pages**: All 6 sites scored <33% for 45-75ch text blocks. Is this because marketing homepages inherently use short copy, or is the measurement miscalibrated? Need to test on nytimes.com, theguardian.com, or Wikipedia article pages to assess.
- **scroll-snap usage**: Only Linear (2) used scroll-snap across 6 sites + 6 prior sites. May be too rare to warrant a dedicated metric. Prior run found Guardian uses 21. Need more data.
