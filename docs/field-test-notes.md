# Browse Toolkit Field Test — Popular Websites

Field-tested toolkit v0.8 on Stripe, Apple (homepage + iPhone), Amazon, Netflix to identify gaps and improvement opportunities.

## Sites Tested

| Site | Colors | CSS Tokens | Vibe | Chromatic | Elements |
|------|--------|-----------|------|-----------|----------|
| Stripe | 80 | 0 | saturated, tinted-neutral | 44 | 1737 |
| Apple homepage | 34 | 25 | saturated, tinted-neutral | 16 | 740 |
| Apple iPhone | 86 | 72 | filmic/dramatic | 23 | 1289 |
| Amazon | 33 | 0 | tinted-neutral | 5 | 1875 |
| Netflix | 18 | 0 | filmic/dramatic | 4 | 455 |

## What Works Well

**paletteProfile** — The standout tool. Clearly distinguishes design personalities. Stripe's intense purple brand, Apple's disciplined 286° neutral tint, Amazon's utilitarian grays, Netflix's iconic single-accent red. OKLCH colorimetry, chroma labels, hue clustering, and harmony classification all produce immediately useful intelligence. CSS custom property extraction works well on Apple (25–72 tokens detected).

**pageMap** — Produces thorough structural overviews. Correctly identifies overlays (⬡), overflow issues, and section boundaries. Good at showing the page's information architecture.

**scanAnomalies** — Found real contrast failures on Stripe (orange on light orange, 2.41:1 in payments graphic) and Netflix (dark-on-dark text pairs). Legitimate findings.

**CSP compatibility** — `addInitScript` injects before CSP enforcement, working universally across all tested sites including Stripe's strict CSP. `addScriptTag` fails on CSP-strict sites.

## Gaps Identified

### Priority 1: New Tools Needed

#### 1. `typographyProfile()` — Font families, type scale, text hierarchy

Currently zero visibility into typography. Manual extraction on Netflix revealed a clear type scale:

| Role | Size | Weight | Line-height | Font |
|------|------|--------|-------------|------|
| Display | 100px | 700 | 100px | Netflix Sans |
| H1 | 56px | 900 | 70px | Netflix Sans |
| H2/Button | 24px | 500 | 24px | Netflix Sans |
| Body | 20px | 500 | normal | Netflix Sans |
| Secondary | 16px | 400 | 24px | Netflix Sans |
| Nav | 14px | 500 | 14px | Netflix Sans |
| Fine print | 13px | 400 | normal | Netflix Sans |

**Use case**: "Match Apple's typography" or "Use Netflix's heading scale on our site." Without this, I can describe colors perfectly but can't tell you the first thing about how text looks.

**Proposed output**: Font families with fallback stacks, size/weight/lineHeight scale with semantic labels (display/heading/body/caption/ui), letter-spacing patterns, text-transform usage, font-feature-settings. Both LLM text report and structured data, matching paletteProfile's format.

#### 2. `gradientProfile()` — Gradient extraction and atmosphere analysis

Gradients are invisible to current tools. Netflix has 7 gradients that define its visual atmosphere:
- Radial glows: `radial-gradient(11% 56% at 17% 50%, rgb(70, 21, 24) 0%, transparent 100%)`
- Multi-stop fades: 7+ stop linear gradients for text readability over images
- Atmospheric: `linear-gradient(91deg, rgb(38, 23, 51), rgb(21, 26, 63))`

**Use case**: "Match Netflix's dark overlay feel" or "How does Stripe create that gradient background?" The gradients carry brand identity just as much as solid colors.

**Proposed output**: Each gradient with type (linear/radial/conic), direction/position, color stops with OKLCH values, semantic classification (overlay/atmosphere/decorative/functional), and the element context.

#### 3. `motionProfile()` — Animation and transition inventory

Netflix has 12 animations/transitions invisible to the toolkit:
- Accordion FAQ: `height, opacity` 0.5s transitions
- Card hover: `transform` 0.2s transitions
- Loading spinner: `loading` 4s linear animation
- Button hover: `background-color, border-color` 0.25s

**Use case**: "Replicate that smooth accordion effect from Netflix" or "How fast are Apple's hover transitions?"

**Proposed output**: CSS animations (name, duration, timing, iteration, keyframe summary) and transitions (trigger properties, duration, easing curve). Categorized by type (hover, state-change, entrance, loading, scroll-driven).

### Priority 2: Enhancements to Existing Tools

#### 4. `paletteProfile` — Section-aware theme detection

**Problem**: Stripe's `<body>` background is white, so tools report it as light mode. But the hero section fills the viewport with a dark animated canvas. The visual experience is dark, but the toolkit says light.

**Fix**: After checking body bg, also check the first visible `<section>` or `<main>` child's effective background. Report section-level theme changes: "body is light, but hero section (0–85% viewport) is dark, next section (85–329%) uses gradient overlay."

#### 5. `pageMap` — Reduce below-fold noise

**Problem**: On Stripe's 1611% viewport page, virtually every element after the hero gets `⚠ extends X% below fold`. This is correct but useless — once you know the page is 16x viewport height, you don't need every element annotated.

**Fix options**:
- Only show fold warnings on top-level sections, not their children
- Show a fold marker line (`──── fold ────`) at y:100% and stop annotating individual elements
- Add `foldThreshold` option (default: suppress after first fold-crossing section)

#### 6. `paletteProfile` — Include gradient stop colors

**Problem**: Gradient colors are brand-relevant but invisible because they're in `background-image`, not `background-color`. Netflix's signature red glow (`rgb(70, 21, 24)`) only exists in gradients.

**Fix**: Parse gradient stop colors and include them in the palette with a `gradient` source tag, similar to how `svg-fill` is already tracked.

### Priority 3: Nice-to-Have

#### 7. `spacingProfile()` — Spacing scale and rhythm

Manual extraction on Netflix revealed a 4px base grid (80% of values are multiples of 4): 16→24→12→32→64→128. This tells you the design system's spatial logic.

**Proposed output**: Detected base unit (4px/8px/custom), frequency table of padding/margin/gap values, section gap rhythm, grid/flexbox gap patterns.

#### 8. Layout pattern labels in `pageMap`

**Problem**: pageMap shows structure but doesn't name patterns. A human looks at Stripe and sees "bento grid with hero cards." The tool shows nested divs.

**Possible approach**: Heuristic detection of common patterns — bento grid (mixed-size grid children), hero section (full-width + heading + CTA), card grid (repeated same-size children), carousel (overflow + horizontal scroll), accordion (toggle + collapse pairs).

#### 9. Responsive breakpoint detection

Parse `@media` queries from loaded stylesheets to identify breakpoints. Report the design system's responsive tiers (mobile/tablet/desktop). This is harder but high value for replication work.

## CSP Compatibility Note

For the toolkit docs: `addScriptTag` fails on CSP-strict sites (Stripe, likely many others). `addInitScript` works universally because it runs before CSP enforcement. However, `addInitScript` must be called BEFORE `page.goto()` — it registers for future navigations.

**Recommended bootstrap for any public site**:
```js
await page.addInitScript({ path: '/path/to/toolkit.js' });
await page.goto(url);
```

Not:
```js
await page.goto(url);
await page.addScriptTag({ path: '/path/to/toolkit.js' }); // fails on CSP sites
```

## Comparison: What the Toolkit Sees vs. What a Human Sees

| Dimension | Toolkit sees? | Quality |
|-----------|:---:|:---:|
| Color palette & brand identity | Yes | Excellent |
| WCAG contrast issues | Yes | Good |
| Dark mode escapes | Yes | Good |
| Page structure & hierarchy | Yes | Good |
| Interactive widgets (when triggered) | Yes | Good |
| Touch targets & scroll traps | Yes | Good |
| **Typography** | **No** | — |
| **Gradients** | **No** | — |
| **Animations/transitions** | **No** | — |
| **Spacing rhythm** | **No** | — |
| **Background images** | **No** | — |
| **Section-level theming** | Partial | Body only |
| **Layout patterns** | Partial | Structure, not semantics |
| **Responsive behavior** | **No** | — |
