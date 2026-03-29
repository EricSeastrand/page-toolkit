# Tool Improvement Run 4 — 2026-03-29

## Sites tested (validation only — data from r3 backlog)
| Site | Category | Notes |
|------|----------|-------|
| stripe.com | Marketing/brand | Clean baseline: domDepth 31, 0 truncated, vibes ["saturated"] |
| nytimes.com | Editorial/news | Complex: domDepth 33, 0 truncated, vibes ["high-contrast-hue"] |
| behance.net | Creative/portfolio | Card-heavy: domDepth 33, 117 truncated, vibes ["saturated"] |

## Implemented this run

Three backlog items from r3, implemented and validated together.

### 1. DOM depth in platformProfile
- **Where**: `src/tools/platform-profile.js`, `docs/api-reference.md`
- **What**: Added `domDepth` field — walks DOM from body, reports max nesting depth. Text output: "DOM depth: N levels".
- **Evidence**: 18 sites of prior data showed range 10–36. Framework-heavy sites (NYTimes, Behance) score 30+; minimal sites (usa.gov) score ~13. Correlates with framework complexity and component nesting depth.
- **Validation**: Stripe 31, NYTimes 33, Behance 33 — all in expected range, text format confirmed.

### 2. Text truncation count in typographyProfile
- **Where**: `src/tools/typography-profile.js`, `docs/api-reference.md`
- **What**: Added `truncatedElements` field — counts elements with `text-overflow: ellipsis`. Appears in text header line when > 0: "N text elements scanned, M truncated".
- **Evidence**: Prior data: 0 on editorial/marketing sites (NYTimes, Stripe, Notion, USA.gov), 44 on Nike (e-commerce cards), 117 on Behance (gallery cards). Strong card-layout correlate.
- **Validation**: Stripe 0, NYTimes 0, Behance 117 — matches prior measurements exactly.

### 3. Vibes noise: removed "tinted-neutral"
- **Where**: `src/tools/palette-profile.js`
- **What**: Removed `tinted-neutral` from vibes output. This vibe fired on 15/18 tested sites across 3 runs — nearly universal on the web and not differentiating.
- **Evidence**: Confirmed across r1 (5/6), r2 (5/6), r3 (5/6). The only sites without it had extremely desaturated palettes.
- **Validation**: All three test sites produce vibes arrays without tinted-neutral. The neutralTint detection logic and text output for "Neutral tint: h ≈ N°" remain intact — only the vibe label was removed.

## Remaining proposals (carried from r3)

### Noise
- **`lightnessShape` "bimodal"** (3rd confirmation): ~14/18 overall. Dark-text-on-light-bg is the web default. Only deviations carry signal.
- **`vibes` "filmic/dramatic"**: fires broadly, may need threshold recalibration.

### Gaps
- **overflow:hidden density**: 8 (usa.gov) to 363 (Behance). Could flag cases where overflow:hidden clips visible content.
- **Line length distribution**: editorial homepages score 35% for 45-75ch; marketing 8-11%. Valid but needs article-page testing.

### Threshold tuning
- **`baseUnit` minimum**: Nike/Behance baseUnit=6 is borderline. Proposed: reject baseUnit < 4 or require >70% coverage.

### Quick wins
- **Scroll-snap count in scrollAudit**: 0-4 across tested sites. Low priority.
