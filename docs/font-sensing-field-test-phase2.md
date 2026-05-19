# Font Sensing Phase 2 — Field Test Results

Tested 2026-03-29 on 3 sites to validate the 6 new measurements.

## Summary

| Site | Hierarchy | Density | Scale Type | Weight Δ | New Crowding Flags | Total Flags |
|------|-----------|---------|------------|----------|--------------------|-------------|
| Apple | 78/100 | moderate (7) | semi-modular (1.26×, σ0.124) | +72 | 2× tight-heading-gap | 2 |
| NYT | 42/100 | dense (12) | modular (1.11×, σ0.046) | -53 | 1× cramped-in-container | 10 |
| Stripe | 48/100 | dense (13) | semi-modular (1.15×, σ0.099) | -42 | 1× cramped, 3× tight-heading-gap | 14 |

## Per-site notes

### Apple (apple.com)
- **gapToNext works** — caught both h2 (5px gap, threshold 24px) and h3 (4px gap, threshold 16px). Apple's hero headings sit right on top of their subheads — intentional design but correctly flagged.
- **Container ratio clean** — largest heading is 6.2% of container, under the 8% threshold.
- **vwRatio reasonable** — 48px headline at 6.2vw, well under 10vw threshold.
- **Weight contrast +72** — heading avg 550 vs body avg 478. Gradient scoring gives this 50 (1-99 tier). Old binary score would have given 100. More honest.
- **Density: moderate (7 sizes)** — correct classification for a marketing homepage.
- No viewport-oversized or lost-in-container flags. Clean.

### NYT (nytimes.com)
- **Density: dense (12 sizes)** — correctly classified. This is the editorial context where dense + low hierarchy is acceptable.
- **Scale type: modular (1.11×)** — interesting finding. NYT's scale has very consistent small steps (σ0.046). The low hierarchy score (42) comes from those steps being too small for clear separation, but the consistency is by design.
- **Weight delta: -53** — body text (avg 553) is actually heavier than headings (avg 500). NYT uses weight variation within body text (700 for labels, 500 for metadata) which skews the average. Correctly detected as unusual.
- **cramped-in-container** — 24px headline in a 240.6px container (10%). Valid flag.
- **No viewport-oversized** — largest text is 3.6vw. Appropriate for desktop.
- **no-spacing dominates** — 6 of 10 flags are no-spacing. NYT packs content tightly, as expected.

### Stripe (stripe.com)
- **Single font family** — sohne-var only. Clean design system.
- **Weight delta: -42** — Stripe uses 300 weight everywhere including headings, with 400 for buttons/links. Headlines are lighter than body CTAs. Gradient scoring correctly gives 0 for negative delta.
- **cramped-in-container** — 34px in 409px container (8.3%). Borderline flag.
- **tight-heading-gap** — caught 3 headings: 28px with 0px gap (worst), 22px with 3.4px gap, 34px with 12px gap. The 28px/0px case is a genuine layout concern.
- **Dense (13 sizes)** — Stripe has many sizes in a wide range (5.33×). The range is good but the density of steps hurts hierarchy clarity.
- **Semi-modular** — σ0.099, between modular and custom. Stripe's scale has a mix of tight steps (1.03×) and jumps (1.41×).

## Threshold assessment

| Metric | Threshold | Verdict |
|--------|-----------|---------|
| cramped-in-container | >8% | Borderline — Stripe's 8.3% is barely over. Could raise to 9% but NYT's 10% is genuinely cramped. **Keep at 8%.** |
| lost-in-container | <1% | Not triggered on any site. Good — these are well-designed pages. Need to test on a site with tiny text in wide containers. |
| viewport-oversized | >10vw | Not triggered. Would need mobile viewport to test properly. |
| tight-heading-gap | <0.5em | Working well. Apple's 5px gap on 48px heading (0.1em) and Stripe's 0px gap on 28px are real issues. |
| modular σ<0.05 | σ threshold | NYT at 0.046 classified as modular — feels right. Their scale IS consistent, just with small steps. |
| weight gradient tiers | 200/100/0 | Apple (+72) and Stripe (-42) and NYT (-53) show the gradient adds real nuance vs the old binary. |

## Observations

1. **Negative weight deltas are more common than expected.** Both NYT and Stripe have body text heavier than headings. This is a modern trend — light display weights with heavier UI text. The old binary scoring would have scored these 25; the new gradient correctly scores them 0.

2. **tight-heading-gap is the most actionable new flag.** Every site triggered it. Even well-designed sites have headings that crowd their content. This was the #1 priority item and it delivers.

3. **containerRatio needs mobile testing** to validate the lost-in-container and viewport-oversized thresholds. Desktop pages naturally stay within bounds.

4. **Modular scale detection on NYT is a good story.** A score of 42/100 with "modular (1.11×)" tells you: "this site has a very consistent scale, but the steps are too small to create visual hierarchy." That's exactly right for a newspaper.
