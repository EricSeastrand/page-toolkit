# Tool Improvement Run — 2026-03-29 (Run 5)

## Sites tested
| Site | Category | Elements | Notes |
|------|----------|----------|-------|
| archives.gov | Government | 377 | jQuery 1.7.2, z-index 9999999, 100% images missing dims |
| awwwards.com | Portfolio/creative | 1517 | 171 overflow:hidden, h2=14px/h3=67px semantic inversion |
| gitlab.com (about) | SaaS/marketing | 1372 | z-index INT_MAX, 96% images missing dims, 96px headings |
| w3.org | Standards/institutional | 391 | 87 logical properties, font-display:fallback, baseUnit=2 |
| dequeuniversity.com | Accessibility | 364 | weightDelta -167 (headings lighter than body), no crowding |
| shopify.com | Marketing/brand | 2349 | 243 overflow:hidden, 18 theme escapes, 32 gradients |

Blocked: bloomberg.com (bot detection), wayfair.com (bot detection 429)

## Implemented this run
- **What**: Line length readability measurement in `typographyProfile`
- **Where**: `src/tools/typography-profile.js`, `docs/api-reference.md`
- **Evidence**: Ad-hoc measurements across 6 sites showed strong variance (0-42%) that correlates with site purpose. Content-focused sites (w3.org, dequeuniversity.com) score higher than marketing/portfolio sites (awwwards, archives.gov). This was the #1 backlog item from prior runs.
- **How it works**: Scans leaf text elements in reading range (12-24px, 80+ chars content), measures container width, uses canvas `measureText` for accurate character width, reports what % of text blocks fall in the comfortable 45-75 chars/line range.
- **Output**: `readability: { blocks, comfortable, comfortablePct, tooWide, tooNarrow, avgCharsPerLine }` — null when <2 qualifying blocks found.
- **Validation**:

| Site | Blocks | Comfortable % | Avg CPL | Assessment |
|------|--------|--------------|---------|------------|
| w3.org | 16 | 25% | 43 | Short blocks on compact homepage |
| gitlab.com | 12 | 42% | 42 | Marketing body text mixed sizes |
| shopify.com | 19 | 58% | 59 | Well-sized prose blocks |
| awwwards.com | 12 | 0% | 25 | Card-heavy, no prose — correct |

## Remaining proposals

### Noise (candidates for removal or reduced prominence)

- **"filmic/dramatic" vibe**: Fired on 4/6 sites this run (archives.gov, awwwards, gitlab, shopify). Combined with prior runs, ~80% of all sites tested trigger it. Not differentiating. Either tighten threshold significantly or remove. File: `src/tools/palette-profile.js`.

### Gaps (new measurements needed)

- **Heading semantic order violations**: Awwwards uses h2 at 14px as category labels but h3 at 67px as actual headings. GitLab has h3 ranging from 14-32px. Archives.gov h3 at 23px > some h2 at 16px. W3.org and Deque have proper hierarchies. A "heading inversion" flag would detect when a lower heading level (h3) is visually larger than a higher level (h2). Belongs in `typographyProfile` crowding flags. Implementation: group heading elements by level, compare average font sizes between levels, flag when h(n+1) avg > h(n) avg. Evidence: 3/6 sites had inversions this run.

- **overflow:hidden density**: Archives.gov 16, Deque 18, w3.org 21, GitLab 88, Awwwards 171, Shopify 243. Strong variance correlating with layout complexity and card-based designs. Behance had 363 in prior runs. Belongs in `platformProfile`. Implementation: count elements with overflow:hidden/overflowX:hidden/overflowY:hidden. Evidence: 6/6 sites this run + 3 from prior runs show 16-363 range.

- **Containment strategy**: How sections separate themselves varies meaningfully. Shopify: 75% bgShift + 80% padding. W3.org: mixed bgShift + border + padding. Awwwards: minimal (1/5 bgShift). This tells you about design sophistication — polished sites combine multiple containment signals while basic sites rely on a single method. Could be a `layoutProfile` or `siteProfile` addition. Implementation: scan semantic section elements, classify containment method (bgShift, border, shadow, padding, gap). Evidence: 6/6 sites showed distinct patterns.

### Threshold tuning

- **baseUnit minimum**: w3.org reports baseUnit=2 with 81% coverage. Archives.gov reports baseUnit=4 with 76.7% coverage. Prior runs flagged Craigslist=1, Vercel=2. Trivially small values are mathematically correct (everything is divisible by 2) but not meaningful as design system units. Proposed: reject baseUnit < 4 or add a `meaningful` flag. File: `src/tools/spacing-profile.js`. Evidence: 4+ sites across runs with trivially small units.

- **"filmic/dramatic" vibe threshold**: See noise section above. If not removing, needs significant recalibration. Current trigger is too broad. Evidence: ~80% of all sites tested across 5 runs.

### Quick wins

- **Grammar fix in text output**: "1 blocks too wide" should be "1 block too wide" (singular). File: `src/tools/typography-profile.js`.

### Research needed

- **Affordance cursor consistency**: Range was 84-99% across sites. Modern/polished sites (awwwards 99%, shopify 99%) vs institutional (gitlab 84%, archives 85%). Interesting signal but narrow range — needs more data points to determine if it's worth reporting. Would it differentiate well on a broader corpus?

- **Variable font axis usage**: GitLab uses fontWeight 660 (variable font). Shopify uses 450. These non-standard weights indicate variable font adoption. Could be added to `platformProfile.cssFeatures` but needs more sites to confirm prevalence and signal value.
