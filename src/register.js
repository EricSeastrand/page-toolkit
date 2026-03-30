  // === Register on window ===

  window.__ps = {
    version: '2.0',
    // Color tools
    colorProfile,
    paletteProfile,
    typographyProfile,
    gradientProfile,
    spacingProfile,
    scanAnomalies,
    inspect,
    traceStyle,
    // Theme tools
    themeAudit,
    discoverOverlays,
    motionProfile,
    // Layout tools
    responsiveProfile,
    pageMap,
    ancestry,
    layoutBox,
    layoutAggregate,
    layoutGap,
    layoutTree,
    layoutDensity,
    fontTuning,
    // Platform & composite tools
    platformProfile,
    siteProfile,
    // Touch & interaction tools
    scrollAudit,
    eventMap,
    touchTargets,
    gesturePlan,
    gestureCapture,
    gestureResults,
    // Utility exports for ad-hoc use
    _util: { parseRGB, hexFromRGB, luminance, contrast, saturation, effectiveBackground, elPath, detectDarkMode, boxModel, pctOfParent, interpolate, resolveEasing, EASING, rgbToOklab, oklabToOklch, rgbToOklch, oklchToRgb, deltaEOK, hueName, colorTone, hueDistance, harmonyClass },
  };
