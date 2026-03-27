---
name: Browse toolkit v1.1 improvement plan
description: Pain points found during Lodge/FINEX Shopify store analysis — round-trip cost, noisy payloads, missing metadata tools
type: project
---

# Browse Toolkit v1.1 Improvements

## Context

Ran full design system analysis on two Shopify cast iron stores (lodgecastiron.com, finexusa.com) as a toolkit stress test. All 7+ tools worked correctly. User confirmed: apply all fixes when we return.

## Pain Points Identified (in priority order)

### 1. Round-trip cost — composite `siteProfile()` tool
Currently requires 7 separate `browser_evaluate` calls: pageMap, paletteProfile, typographyProfile, spacingProfile, gradientProfile, motionProfile, responsiveProfile. Even with 3-at-a-time parallelism, that's 3 sequential batches.

**Fix:** Add `__ps.siteProfile()` that runs all design system tools (everything except pageMap) in one call. Returns combined `{text, data}` with sections. pageMap stays separate since it returns a string and is always the first call.

### 2. gradientProfile — deduplicate identical gradients
Lodge returned 33 gradient objects but most were duplicates (same black overlay on each Flickity slide, same white-to-white on each footer link). The text summary was great but the data array was huge.

**Fix:** Group by `{type, direction, stops}` signature. Return `{..., paths: ["path1", "path2"]}` instead of separate objects. Text summary already groups well — just needs data dedup.

### 3. spacingProfile gridFlexGaps — group by value
Lodge returned 48 gap entries, many with identical values on sibling components (e.g., 16px grid gap repeated 15 times).

**Fix:** Group by `{display, gap, rowGap, columnGap}` signature. Return paths as array. Text can show count + first example.

### 4. platformProfile() — new tool for site metadata
Had to piece together platform info from console logs and network requests. Needed for every site analysis.

**Should extract:**
- `<meta name="generator">`, `Shopify.theme` object, platform fingerprint
- JS library detection: jQuery version, Swiper, Flickity, React, Vue, etc.
- CMS/platform: Shopify, WordPress, Squarespace, etc.
- Cookie consent provider (Termly, OneTrust, CookieBot, etc.)
- Analytics/pixel summary by category (analytics, ads, chat, email)

### 5. Network request summarizer
Raw network request list dominated by tracking pixels. Manual scan of 60+ URLs needed to build integration table.

**Options:**
- Add as toolkit tool `networkProfile()` that categorizes by domain
- Or post-process in the slash command workflow description
- Domain → category mapping: google-analytics.com → Analytics, facebook.net → Meta Ads, etc.

### 6. pageMap summary mode
Very tall pages (FINEX: 1271% viewport) produce long output. An `{ aboveFold: true }` or `{ summary: true }` option that lists section names/sizes without full tree would help for initial orientation.

## Files to Modify

- `scripts/playwright-tools/toolkit.js` — all tool changes
- `.claude/commands/browse.md` (the /browse slash command) — update tool reference table, add siteProfile docs, update workflow

## Analysis Artifacts (not saved to files)

The Lodge and FINEX analyses were delivered in chat only — they were a toolkit stress test, not a deliverable. Key findings for reference:
- Lodge: Concept 3.0 theme, 34 colors, Roboto Slab + Open Sans, 16px base, Flickity, broken Salesforce chat
- FINEX: Dawn-based theme, 11 colors, Jost only, 10px base (40% coverage), Swiper, broken Klaviyo + Termly
