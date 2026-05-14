---
name: Color labeling system design decisions
description: ISCC-NBS standard modifiers + CIE saturation for color tone labels — replaces ad-hoc chromaLabel
type: project
---

Decided to replace the simple `chromaLabel(C)` function with a rich perceptual labeling system based on established color science standards.

**Why:** AI consumers need words, not just numbers, to reason about color. The old label only described chroma intensity. The new system encodes lightness, saturation character, and hue in standardized vocabulary that will be in future model training data.

**Design:**
- **Modifiers:** ISCC-NBS standard terms (vivid, brilliant, strong, deep, pale, moderate, dark, grayish, etc.) mapped to oklch L and C ranges
- **Neutral zone:** ISCC-NBS noun/adjective flip — "bluish gray" (tinted neutral, C 0.01-0.04) vs "grayish blue" (muted accent, C 0.04-0.08)
- **Density axis:** CIE saturation (C/L ratio) captures dense/heavy vs luminous/glowing — derived from the insight that HSV saturation and HSL saturation measure different perceptual qualities
- **Hue names:** ~10-12 bucket map from oklch hue angle to color names (red, orange, yellow, lime, green, teal, cyan, blue, indigo, purple, pink)
- **Hex:** Dropped from default output; available via opt-in. oklch + label is the default representation.
- **Lightness numbers:** Still in oklch output for contrast computation; the modifier handles the human-readable version.

**How to apply:** The new labeling function replaces `chromaLabel()` in oklch.js. All tools that currently emit `chroma: chromaLabel(C)` switch to `tone: colorTone(L, C, h)`.
