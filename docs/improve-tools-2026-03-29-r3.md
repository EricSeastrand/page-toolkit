# Tool Improvement Run 3 — 2026-03-29

## Sites tested
| Site | Category | Notes |
|------|----------|-------|
| nytimes.com | Editorial/news | 3373 els, 10 font families, 5 custom NYT fonts, 100% imgs missing dims, z-max 1B |
| nike.com | E-commerce | 3886 els, Helvetica Now + Nike Futura, 96% imgs missing dims, 44 text truncations |
| stripe.com | Marketing/brand | 2378 els, single font (sohne-var), cleanest site: 3 anomalies, z-max 3, 3% imgs missing |
| notion.so | SaaS/marketing | 1367 els, 143 container queries, z-max MAX_INT, 0 anomalies |
| usa.gov | Government | 488 els, USWDS design system, font-display:fallback, 100% imgs missing dims |
| behance.net | Creative/portfolio | 2909 els, Acumin Pro, 117 text truncations, 363 overflow:hidden |

## Implemented this run
- **What**: Z-index stacking complexity (`zIndexStats`) in `platformProfile`
- **Where**: `src/tools/platform-profile.js`, `docs/api-reference.md`
- **Evidence**: Z-index stacking has been the most-proposed gap across 3 runs with 18 sites of data. Layer counts range from 1 (a11yproject) to 14 (Guardian). Max values range from 1 to 2,147,483,647 (MAX_INT). This is a CSS maintainability signal — high z-index spread indicates overlay/modal complexity and potential stacking context bugs. Well-designed sites (Stripe: max 3, Linear: max 10000) use restrained z-index values; ad-heavy sites (NYTimes: max 1B) and sites with complex overlays (Notion: MAX_INT) show inflation.
- **Fields**: `{ layers, max, values[], antiPattern? }` — only present when page uses non-zero z-index. `antiPattern: true` when max > 10000.
- **Validation**:
  - Stripe: 4 layers, max 3, no anti-pattern — correct (clean marketing site)
  - NYTimes: 10 layers, max 1,000,000,150, anti-pattern flagged — correct (ad ecosystem inflates)
  - USA.gov: 5 layers, max 2,000,000,003, anti-pattern flagged — correct (USWDS banner overlay)
  - Text format confirmed: "Z-index: N layers, max N,NNN" with warning emoji for anti-patterns

## Cross-site data

| Metric | NYTimes | Nike | Stripe | Notion | USA.gov | Behance |
|--------|---------|------|--------|--------|---------|---------|
| Elements | 3373 | 3886 | 2378 | 1367 | 488 | 2909 |
| Font families | 10 | 4 | 1 | 2 | 2 | 2 |
| hierarchyScore | 42 | 77 | 48 | 72 | 64 | 46 |
| weightDelta | -42 | 14 | -42 | 53 | 146 | 52 |
| vibes | high-contrast-hue | filmic+sat+tinted | sat+tinted | filmic+tinted | bold-dark+tinted+hc | sat+tinted |
| lightnessShape | bimodal | bimodal | uniform | bimodal | skewed-dark | bimodal |
| baseUnit | 20 | 6 | 16 | 24 | 15 | 6 |
| CSS features | has,layer,sub,cm,lp,fd | has,layer,cq,lp | none | has,layer,sub,cq,cm,lp,fd | layer,lp,fd | has,layer,cq,lp |
| Imgs missing dims | 100% | 96% | 3% | 3% | 100% | 55% |
| Anomalies (high) | 36 | 20 | 0 | 0 | 0 | 2 |
| **Z-index layers** | **10** | **9** | **4** | **8** | **5** | **9** |
| **Z-index max** | **1B** | **999** | **3** | **MAX_INT** | **2B** | **252** |
| DOM depth | 32 | 24 | 30 | 22 | 13 | 32 |
| overflow:hidden | 162 | 357 | 276 | 114 | 8 | 363 |
| Truncated | 0 | 44 | 0 | 0 | 0 | 117 |
| Line length 45-75ch | 35% | 8% | 26% | 11% | 1% | 3% |
| Uppercase | 158 | 15 | 0 | 0 | 1 | 33 |
| Scroll-snap | 4 | 2 | 3 | 1 | 0 | 1 |

## Remaining proposals

### Noise (candidates for removal or reduced prominence)

- **`vibes` "tinted-neutral"** (3rd confirmation): 5/6 sites this run. Now 15/18 across all runs. Not differentiating — nearly universal on the web. Either remove it or only report when absent.
- **`lightnessShape` "bimodal"** (3rd confirmation): 4/6 this run, ~14/18 overall. Dark-text-on-light-bg is the web's default. Only deviations (uniform, skewed-dark) carry signal.
- **`vibes` "filmic/dramatic"** (2nd confirmation): appeared on NYTimes (via high-contrast-hue overlap), Notion. Still fires broadly. May need threshold recalibration.

### Gaps (new measurements needed)

- **DOM depth**: 13 (usa.gov) to 32 (NYTimes, Behance). Correlates with framework complexity. Proposed in runs 1-2, now 18 sites of data. Simple addition to `platformProfile`. Approach: walk DOM, report max depth. File: `src/tools/platform-profile.js`.
- **Text truncation count**: 0 (NYTimes, Stripe, Notion, USA.gov) to 117 (Behance). Correlates strongly with card-based layouts — e-commerce and gallery sites have many, editorial and marketing sites have zero. Could be a field in `scanAnomalies` or `typographyProfile`. Approach: count elements with `text-overflow: ellipsis`. File: `src/tools/typography-profile.js` or `src/tools/scan-anomalies.js`.
- **overflow:hidden density**: 8 (usa.gov) to 363 (Behance). High counts suggest hidden content or excessive clipping. Could flag cases where overflow:hidden actually clips visible content (scrollHeight > clientHeight). File: `src/tools/scan-anomalies.js`.

### Threshold tuning

- **`baseUnit` minimum** (3rd confirmation): Still seeing trivially small baseUnits. Nike and Behance both have baseUnit=6 which is borderline. Craigslist=1 and Vercel=2 from prior runs remain the clearest examples. Proposed: reject baseUnit < 4 or require >70% coverage for small units.
- **`antiPattern` z-index threshold**: 10000 works well for this run. Nike max 999 (no flag), USA.gov max 2B (flagged). Edge case: Linear from run 2 had max 10000 which wouldn't flag (correct — it's a deliberate modal overlay). Threshold validated.

### Research resolved

- **Line length on editorial pages**: NYTimes scored 35% for 45-75ch text blocks — the highest across all 18 sites. Confirms that editorial homepages score better than marketing pages (8-11%) but still modestly, because homepage layouts use columns and blurbs rather than long-form article text. The metric is valid but scores will be low on homepages by design. Would need to test on article pages (nytimes.com/2026/...) to see higher scores.

### Quick wins

- **DOM depth in platformProfile**: Single `maxDepth` field alongside `zIndexStats`. Walk DOM, report depth. ~10 lines of code. File: `src/tools/platform-profile.js`.
- **Scroll-snap count in scrollAudit**: Already partially captured but not consistently surfaced. 0-4 across 6 sites this run. Low priority.

### Research needed

- **Z-index anti-pattern source**: On NYTimes and USA.gov, the billion-range z-index values likely come from third-party ad scripts or government banner frameworks, not the site's own CSS. Could be worth distinguishing "site z-index" from "third-party z-index" by checking if the element's z-index comes from inline styles vs stylesheet rules.
- **Text truncation as design quality signal**: Behance (117) and Nike (44) truncate heavily. Is this a negative signal (content doesn't fit) or a neutral design pattern (cards are inherently space-constrained)? Need to correlate with perceived quality.
