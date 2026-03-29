# Toolkit Self-Improvement Loop

Autonomous tool improvement through cross-site field testing. Visit diverse websites, run the full toolkit, identify gaps/noise/improvements, implement the best one, validate it, and write up the rest as proposals.

## Input

$ARGUMENTS — optional: focus area (e.g. "typography", "color", "layout") or specific sites to test. If blank, run a general sweep.

## Site Corpus

Pick **5-6 sites** from different categories each run. Aim for diversity — the interesting findings come from sites that break assumptions.

| Category | Examples |
|----------|----------|
| Marketing/brand | apple.com, stripe.com, linear.app, vercel.com |
| Editorial/news | nytimes.com, theguardian.com, arstechnica.com, bloomberg.com |
| E-commerce | amazon.com, nike.com, target.com, wayfair.com |
| SaaS/dashboard | github.com, notion.so, figma.com, gitlab.com |
| Government/institutional | usa.gov, w3.org, gov.uk, archives.gov |
| Portfolio/creative | awwwards.com, dribbble.com, behance.net |
| Accessibility-focused | a11yproject.com, dequeuniversity.com |
| Dense/data-heavy | wikipedia.org, reddit.com, craigslist.org |

Don't repeat the same sites across recent runs. Check `docs/` for prior field test files to avoid overlap.

**Bot protection**: etsy.com, bookshop.org, medium.com, amazon.com, reddit.com, bloomberg.com, and wayfair.com are currently blocked by bot detection in headless browsers (Cloudflare challenges, PerimeterX, or skeleton pages with <50 elements). Swap them out rather than burning time on retries.

## Session Bootstrap

Always `addInitScript` before the first `page.goto()`:

```js
async (page) => {
  await page.context().addInitScript({ path: '/home/eric/page-toolkit/toolkit.js' });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return await page.evaluate(() => !!window.__ps);
}
```

## Phase 1: Data Collection

For each site, run the **full tool battery** and collect structured results. Use `siteProfile()` for the composite, then run the tools that `siteProfile` doesn't cover:

**Note**: `siteProfile()` returns sub-profiles directly on the object (e.g., `sp.typography`, `sp.palette`), not wrapped in `.data`. Each sub-profile has its own flat structure matching its standalone tool output (e.g., `sp.typography.families`, `sp.typography.scaleAnalysis`).

```js
// Composite: palette + typography + spacing + gradient + motion + responsive + platform
const sp = await page.evaluate(() => __ps.siteProfile());

// Additional tools not in siteProfile
const anomalies = await page.evaluate(() => __ps.scanAnomalies());
const theme = await page.evaluate(() => __ps.themeAudit());
const map = await page.evaluate(() => __ps.pageMap());
const touch = await page.evaluate(() => __ps.touchTargets());
const scroll = await page.evaluate(() => __ps.scrollAudit());
```

Also run **ad-hoc JavaScript measurements** for things the toolkit doesn't yet capture — this is how you find gaps. Examples:

```js
// === Structural / CSS measurements ===
// Vertical rhythm consistency
// Heading-to-body font family pairing
// Icon size consistency
// Button size/shape consistency
// Z-index stacking depth and max value
// Reading order vs visual order (flexbox order, grid placement)
// Text truncation / overflow:hidden cutting off content
// Aspect ratio consistency of images/cards
// Images without width/height attributes (CLS risk)
// DOM depth (max nesting level)
// overflow:hidden element count

// === Perceptual measurements ===
// Visual weight balance (left vs right of viewport)
// White space ratio per section — density vs spaciousness
// Containment signals: how sections are separated (bg shifts, borders, shadows, dividers, elevation)
// Grouping strength: ratio of intra-group spacing to inter-group spacing (Gestalt proximity)
// Affordance clarity: do interactive elements share visual cues (cursor, hover, underline, border)?
// Heading prominence delta: size/weight/color distance between heading levels
// Dominant focal point: what's the single largest/boldest/most-saturated element above the fold?
// Competing focal points: how many elements above the fold fight for attention?
// Line length distribution: what % of text blocks fall in the 45-75ch readable range? [NOW IN typographyProfile.readability]
// Scan structure: do headings/labels form a readable outline when body text is ignored?
```

## Phase 2: Cross-Site Analysis

After collecting data from all sites, analyze across the full dataset:

### Signal quality
- **Noise detection**: Which metrics return the same value on every site? Those may be candidates for removal or at least lower prominence.
- **Variance analysis**: Which metrics show interesting variation that correlates with design quality? Those are high-signal.
- **Threshold validation**: Do existing thresholds (crowding flags, anomaly scores, etc.) fire on the right sites and stay quiet on well-designed ones?

### Gap identification
Think about what a **senior frontend designer reviewing a page** would notice that the tools don't report. There are two lenses to apply:

#### Implementation lens — what CSS/DOM patterns are measurable but unreported?
- **Typography**: orphans/widows, text-indent patterns, drop caps, pull quotes, font optical sizing, variable font axis usage, font-display strategy, FOUT/FOIT risk
- **Color**: semantic color usage (success/warning/error consistency), color temperature shifts between sections, simultaneous contrast effects, color accessibility beyond WCAG (APCA), brand color dilution
- **Layout**: visual rhythm (consistent vertical spacing cadence), content-to-chrome ratio, above-fold information density, visual center of gravity, grid alignment consistency, rogue elements breaking the grid
- **Spacing**: Gestalt proximity (are related items closer than unrelated?), inconsistent padding within same component type, margin collapse surprises
- **Interaction**: hover state presence/absence consistency, focus indicator quality, scroll depth vs content density, tap target spacing (not just size)
- **Performance signals**: render-blocking resources, layout shift risk (images without dimensions, dynamic content injection), excessive DOM depth
- **Modern CSS adoption**: container queries, :has(), subgrid, color-mix(), light-dark(), @layer usage, logical properties, scroll-timeline

#### Perceptual lens — what would a human *feel* about this page that our tools can't express?
The tools measure properties. Humans perceive impressions. The highest-value improvements bridge that gap. For each site, ask whether the tools can answer these questions:

- **Visual hierarchy**: What draws the eye first? Is there a clear 1st/2nd/3rd level of attention, or do too many elements compete? Can the tools quantify heading prominence, CTA dominance, and focal point count?
- **Grouping and proximity**: Do related items read as belonging together? Is intra-group spacing consistently tighter than inter-group spacing? Can the tools express grouping strength, not just gap sizes?
- **Spacing rhythm**: Does spacing feel systematic or random? Are section gaps, card gaps, and paragraph gaps proportionate? Can the tools detect rhythm consistency vs irregularity?
- **Alignment and grid**: Do elements share visible edges, columns, baselines? Can the tools flag misalignment, ragged starts, or broken grid lines?
- **Density**: Does the page feel airy, comfortable, or cramped? Can the tools express information density relative to available space, not just element counts?
- **Containment**: How are sections bounded — whitespace, borders, shadows, background shifts, elevation? Can the tools describe *how* a page creates separation, not just *that* sections exist?
- **Affordances**: What looks clickable? Do interactive elements consistently advertise their behavior? Can the tools detect affordance confusion (interactive things that look inert, or inert things that look interactive)?
- **Readability**: Are text blocks at comfortable line lengths? Do headings form a scannable outline? Can the tools assess whether text supports scanning or creates walls?
- **Flow and scan path**: If a user lands on this page, what path would their eye follow? Can the tools express visual flow, not just element positions?

When you find a question the tools can't answer, that's a gap worth proposing. The best improvements translate a perceptual impression into a measurable signal.

### Missing perceptual signal check
After running all tools on a site, do this explicit check: **list 3-5 things a human would immediately notice about this page that appear nowhere in the tool output.** These are your highest-signal gap candidates. Common blind spots:
- Overall page personality (calm vs busy, polished vs improvised)
- Whether the page feels like a coherent composition or a pile of elements
- Strength of visual hierarchy (clear vs flat vs chaotic)
- Quality of section separation (clean vs ambiguous)
- Whether the dominant action is obvious

### Pattern recognition
- Do well-designed sites share patterns that poorly-designed ones lack?
- Are there emergent clusters (e.g., "marketing sites all do X, editorial sites all do Y")?
- What manual calculations did you have to do that should be a tool function?
- **Perceptual consistency**: Do the tools' outputs correlate with your perceptual impression of the site? If a site *feels* cluttered but the tools report normal metrics, something is unmeasured. If a site *feels* polished but the tools flag issues, a threshold may be miscalibrated.

## Phase 3: Pick and Build

From the analysis, select **one improvement** to implement this run. Pick based on:

### Selection criteria (in priority order)
1. **Highest signal** — the gap/noise/threshold issue that appeared on the most sites or would most change analysis quality. Perceptual gaps (things humans notice but tools can't express) rank above implementation gaps (CSS features not yet measured).
2. **Clearest implementation path** — you can see exactly which file to edit and what data to collect
3. **Testable in this session** — you can validate it on the sites you already have open
4. **Proportional scope** — one focused change, not a rewrite. If the best idea is huge, carve off the smallest useful slice.

### Implementation checklist
1. **Read the target source file** before editing — understand what's there
2. **Edit the source** in `src/tools/` or `src/utils/` — follow existing conventions (bare functions, no closures, no window assignments)
3. **Rebuild**: `./build.sh`
4. **Update `docs/api-reference.md`** if you added/changed any tool signatures, params, or return types

### What counts as an improvement
- **New measurement**: a field, metric, or flag added to an existing tool's output
- **New tool**: rare — only if the concept doesn't fit any existing tool. Requires adding to `src/tools/`, updating `register.js`, and updating `docs/api-reference.md`
- **Noise reduction**: removing or demoting a field that adds no signal
- **Threshold tuning**: adjusting a flag's trigger point based on field evidence
- **Representation change**: same data, better format (e.g., adding a text-format line, restructuring JSON output)
- **Bug fix**: a measurement that's wrong based on field evidence

### Scope guardrails
- **One improvement per run.** Don't batch multiple changes — each one needs its own validation.
- **Don't refactor surrounding code.** Touch only what's needed for the improvement.
- **Don't add configuration options** unless the improvement genuinely needs them. Hardcode sensible defaults.
- **If you're unsure**, write the proposal instead of building it. Bad code is worse than a good proposal.

## Phase 4: Validate

Re-run the improved tool on **at least 3 of the original test sites** to confirm:

1. **No regressions** — existing output still makes sense, no errors
2. **New signal fires correctly** — the improvement shows up where expected
3. **New signal stays quiet** — doesn't fire on sites where it shouldn't
4. **Text format** — if the tool has `format: 'text'`, confirm the new data appears in the text output

**Important**: `addInitScript` calls stack — calling it again after a rebuild won't replace the old toolkit, it will run both (old version wins). You must **close the browser** (`browser_close`) and re-open with a fresh `addInitScript` pointing to the rebuilt `toolkit.js`.

```js
// After rebuild: close browser, then re-bootstrap
// await browser_close()
// Then in a new browser_run_code:
async (page) => {
  await page.context().addInitScript({ path: '/home/eric/page-toolkit/toolkit.js' });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return await page.evaluate(() => __ps.toolName({ format: 'text' }));
}
```

### Validation failure protocol
If the improvement doesn't validate:
- **Broken output**: fix it and re-validate. Don't ship broken code.
- **Fires everywhere**: threshold is too sensitive. Tighten it and re-validate.
- **Fires nowhere**: threshold is too strict, or the measurement approach is wrong. Either fix or revert and write it up as a proposal with notes on what went wrong.
- **Revert if stuck**: `git checkout -- src/ toolkit.js docs/api-reference.md` and move on to proposals. Don't burn the whole session on one implementation.

## Phase 5: Write Up

Write findings to `docs/improve-tools-{date}.md`:

```markdown
# Tool Improvement Run — {date}

## Sites tested
| Site | Category | Notes |
|------|----------|-------|

## Implemented this run
- **What**: one-line description
- **Where**: file(s) changed
- **Evidence**: which sites showed the gap, what the before/after looks like
- **Validation**: results from re-running on test sites

## Remaining proposals

### Noise (candidates for removal or reduced prominence)
- metric: rationale, evidence

### Gaps (new measurements needed)
- concept: what it measures, why it matters, which tool it belongs in, rough approach

### Threshold tuning
- flag/threshold: current value, proposed change, evidence

### Representation improvements
- metric: current format, proposed format, why

### Quick wins (small changes, high value)
- description: file, estimated complexity

### Research needed (uncertain value, needs more data)
- concept: what we'd need to test to decide
```

### Proposal quality bar
- Every proposal needs **evidence from the field test** — at least 2 sites showing the pattern.
- "Gap" proposals must explain what a designer would notice that the tool misses, with a concrete example from the tested sites.
- "Noise" proposals must show the metric is the same across ≥4 sites.
- Include rough implementation approach (which file, what data to collect, how to expose it).

## Phase 6: Commit and Push

Commit the implementation + proposals doc + any api-reference updates. Use a descriptive commit message that captures what was implemented (not just "improve tools").

Example: `Add vertical rhythm scoring to spacingProfile, field-tested on 5 sites`

Push to `main`.

## Phase 7: Summary

Brief chat summary:
- How many sites tested
- What was implemented + key validation results
- Top 3 remaining proposals
- Any surprises
- Path to the proposals file

## Iteration tracking

If there are prior `docs/improve-tools-*.md` files, read them first. Prior proposals are your backlog — consider implementing one of those if it's still the highest-signal option. Don't re-propose things that were already proposed or implemented. Build on prior findings.

## Phase 8: Self-Improvement

**After** everything is committed and pushed — reflect on how this run went and propose edits to **this skill file itself** (`.claude/commands/improve-tools.md`).

Think about:
- **Missing categories**: Did you notice something during the run that the Phase 2 gap list doesn't mention? Add it.
- **Unproductive categories**: Did a section of the gap list consistently yield nothing across runs? Consider trimming or replacing it.
- **Site corpus**: Should new site categories be added based on what produced interesting findings? Should any be removed?
- **Process friction**: Was there a step that was awkward, redundant, or in the wrong order? Fix the flow.
- **Ad-hoc measurements**: Did you write JavaScript to measure something that should be listed in the Phase 1 ad-hoc examples so future runs check for it too?
- **Quality bar**: Were the proposal thresholds (2 sites for gaps, 4 for noise) too strict or too loose based on this run?
- **New phases**: Is there a whole category of analysis that should be its own phase?
- **Selection criteria**: Did the pick-and-build criteria lead to the right choice? Would different prioritization have been better?
- **Scope guardrails**: Were they too tight (blocked a good idea) or too loose (let scope creep in)?

Present your proposed edits as a brief rationale + the specific changes you'd make. Then **ask the user** whether to apply them. If approved, edit this file directly. If denied, note the suggestion in the proposals doc under a "## Skill meta-observations" section so it's not lost.

The goal: each run leaves the skill slightly better at finding improvements next time.
