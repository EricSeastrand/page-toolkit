  // === Tool: Theme Audit — find elements that escaped dark mode theming ===

  function themeAudit(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 1000, lumThreshold: 0.4 }, opts);
    const dark = detectDarkMode();
    if (!dark.isDark) return { darkMode: dark, note: 'Page is not in dark mode — theme audit not applicable' };

    const root = document.querySelector(o.scope) || document.body;
    const bodyLum = dark.bodyLum;
    const escapes = [];
    const seen = new Set(); // Ancestors already reported — skip their children
    let scanned = 0;

    const candidates = root.querySelectorAll('*');
    for (const el of candidates) {
      if (scanned >= o.maxElements) break;
      if (!isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) continue;
      scanned++;

      // Check element's OWN background (not effective/inherited)
      const bg = parseRGB(window.getComputedStyle(el).backgroundColor);
      if (!bg || bg.a < 0.1) continue;

      const elLum = luminance(bg);
      if (elLum < o.lumThreshold) continue;

      // Skip children of already-reported escapes
      let isChild = false;
      for (const ancestor of seen) {
        if (ancestor.contains(el)) { isChild = true; break; }
      }
      if (isChild) continue;

      seen.add(el);

      const s = window.getComputedStyle(el);
      escapes.push({
        path: elPath(el),
        tag: el.tagName.toLowerCase(),
        name: el.id || (typeof el.className === 'string' ? el.className.split(' ')[0] : null) || null,
        box: { x: Math.round(rect.x), y: Math.round(rect.y),
          w: Math.round(rect.width), h: Math.round(rect.height) },
        background: {
          color: s.backgroundColor,
          image: s.backgroundImage !== 'none' ? s.backgroundImage.substring(0, 100) : null,
          luminance: +elLum.toFixed(3),
        },
        bodyLuminance: +bodyLum.toFixed(3),
        lumRatio: +(elLum / Math.max(bodyLum, 0.001)).toFixed(1),
        contrastWithBody: +contrast(elLum, bodyLum).toFixed(2),
        overflow: s.overflow,
        position: s.position,
        zIndex: s.zIndex,
        childElements: el.querySelectorAll('*').length,
      });
    }

    return {
      darkMode: dark,
      scanned,
      escapes: escapes.length,
      items: escapes.sort((a, b) => b.background.luminance - a.background.luminance),
    };
  }

