#!/bin/bash
#
# Build toolkit.js by concatenating source modules.
# No transpilation, no minification — output IS the source, just combined.
#
# Order matters: matches the original toolkit.js layout.
# Utils are interleaved with tools (layout utils before layout tools, easing before scroll).
#
set -euo pipefail
cd "$(dirname "$0")"

cat \
  src/header.js \
  src/utils/color-math.js \
  src/utils/oklch.js \
  src/utils/harmony.js \
  src/utils/dom.js \
  src/tools/color-profile.js \
  src/tools/scan-anomalies.js \
  src/tools/inspect.js \
  src/tools/trace-style.js \
  src/utils/layout.js \
  src/tools/layout-tools.js \
  src/tools/palette-profile.js \
  src/tools/typography-profile.js \
  src/tools/gradient-profile.js \
  src/tools/spacing-profile.js \
  src/tools/responsive-profile.js \
  src/tools/theme-audit.js \
  src/tools/discover-overlays.js \
  src/tools/motion-profile.js \
  src/tools/page-map.js \
  src/utils/easing.js \
  src/tools/scroll-audit.js \
  src/tools/event-map.js \
  src/tools/touch-targets.js \
  src/tools/gestures.js \
  src/tools/platform-profile.js \
  src/tools/site-profile.js \
  src/register.js \
  src/footer.js \
  > toolkit.js

echo "Built toolkit.js ($(wc -l < toolkit.js) lines)"
