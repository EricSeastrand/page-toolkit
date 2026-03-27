  // === Tool: Color Profile ===

  function colorProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 500 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const dark = detectDarkMode();

    // Collect all fg/bg pairs
    const pairs = [];      // { fg, bg, fgLum, bgLum, ratio, path, tag }
    const bgColors = {};   // colorKey -> { rgb, count, lum, sat }
    const fgColors = {};   // colorKey -> { rgb, count, lum, sat }
    let scanned = 0;

    const candidates = root.querySelectorAll('*');
    for (const el of candidates) {
      if (scanned >= o.maxElements) break;
      if (!isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight * 2) continue;

      scanned++;

      // Only care about elements with direct text content or form controls
      const tag = el.tagName.toLowerCase();
      const isForm = ['input', 'select', 'textarea', 'button'].includes(tag);
      const hasText = isForm || Array.from(el.childNodes).some(
        n => n.nodeType === 3 && n.textContent.trim().length > 0
      );
      if (!hasText) continue;

      const computed = window.getComputedStyle(el);
      const fg = parseRGB(computed.color);
      const bg = effectiveBackground(el);
      if (!fg) continue;

      const fgLum = luminance(fg);
      const bgLum = luminance(bg);
      const ratio = contrast(fgLum, bgLum);

      pairs.push({ fg, bg, fgLum, bgLum, ratio, path: elPath(el), tag });

      // Track unique colors
      const fk = colorKey(fg);
      if (!fgColors[fk]) fgColors[fk] = { rgb: fg, count: 0, lum: fgLum, sat: saturation(fg) };
      fgColors[fk].count++;

      const bk = colorKey(bg);
      if (!bgColors[bk]) bgColors[bk] = { rgb: bg, count: 0, lum: bgLum, sat: saturation(bg) };
      bgColors[bk].count++;
    }

    // Compute distributions
    const ratios = pairs.map(p => p.ratio).sort((a, b) => a - b);
    const fgLums = pairs.map(p => p.fgLum).sort((a, b) => a - b);
    const bgLums = [...new Set(Object.values(bgColors).map(c => c.lum))].sort((a, b) => a - b);

    function percentile(arr, p) { return arr[Math.floor(arr.length * p)] || 0; }
    function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

    // Top unique colors by usage
    const topFg = Object.values(fgColors).sort((a, b) => b.count - a.count).slice(0, 8)
      .map(c => {
        const lch = rgbToOklch(c.rgb.r, c.rgb.g, c.rgb.b);
        return { color: rgbString(c.rgb), hex: hexFromRGB(c.rgb), count: c.count, luminance: +c.lum.toFixed(3), saturation: +c.sat.toFixed(3), oklch: { L: +(lch.L * 100).toFixed(1), C: +lch.C.toFixed(3), h: +lch.h.toFixed(1) }, chroma: chromaLabel(lch.C) };
      });
    const topBg = Object.values(bgColors).sort((a, b) => b.count - a.count).slice(0, 5)
      .map(c => {
        const lch = rgbToOklch(c.rgb.r, c.rgb.g, c.rgb.b);
        return { color: rgbString(c.rgb), hex: hexFromRGB(c.rgb), count: c.count, luminance: +c.lum.toFixed(3), saturation: +c.sat.toFixed(3), oklch: { L: +(lch.L * 100).toFixed(1), C: +lch.C.toFixed(3), h: +lch.h.toFixed(1) }, chroma: chromaLabel(lch.C) };
      });

    // Find worst contrast pairs
    const worstPairs = pairs
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5)
      .map(p => {
        const fgLch = rgbToOklch(p.fg.r, p.fg.g, p.fg.b);
        const bgLch = rgbToOklch(p.bg.r, p.bg.g, p.bg.b);
        return {
          path: p.path,
          fg: rgbString(p.fg), fgHex: hexFromRGB(p.fg), fgOklch: { L: +(fgLch.L * 100).toFixed(1), C: +fgLch.C.toFixed(3), h: +fgLch.h.toFixed(1) },
          bg: rgbString(p.bg), bgHex: hexFromRGB(p.bg), bgOklch: { L: +(bgLch.L * 100).toFixed(1), C: +bgLch.C.toFixed(3), h: +bgLch.h.toFixed(1) },
          ratio: +p.ratio.toFixed(2),
        };
      });

    return {
      darkMode: dark,
      scanned,
      uniqueFgColors: Object.keys(fgColors).length,
      uniqueBgColors: Object.keys(bgColors).length,
      contrastDistribution: {
        min: +(ratios[0] || 0).toFixed(2),
        p10: +percentile(ratios, 0.1).toFixed(2),
        p25: +percentile(ratios, 0.25).toFixed(2),
        median: +percentile(ratios, 0.5).toFixed(2),
        p75: +percentile(ratios, 0.75).toFixed(2),
        p90: +percentile(ratios, 0.9).toFixed(2),
        max: +(ratios[ratios.length - 1] || 0).toFixed(2),
        avg: +avg(ratios).toFixed(2),
        belowAA: ratios.filter(r => r < 4.5).length,
        belowAAA: ratios.filter(r => r < 7).length,
        total: ratios.length,
      },
      fgLuminanceSpread: {
        min: +(fgLums[0] || 0).toFixed(3),
        max: +(fgLums[fgLums.length - 1] || 0).toFixed(3),
        avg: +avg(fgLums).toFixed(3),
        range: +((fgLums[fgLums.length - 1] || 0) - (fgLums[0] || 0)).toFixed(3),
      },
      bgLuminanceSpread: {
        min: +(bgLums[0] || 0).toFixed(3),
        max: +(bgLums[bgLums.length - 1] || 0).toFixed(3),
        count: bgLums.length,
      },
      avgSaturation: {
        fg: +avg(Object.values(fgColors).map(c => c.sat)).toFixed(3),
        bg: +avg(Object.values(bgColors).map(c => c.sat)).toFixed(3),
      },
      topForegroundColors: topFg,
      topBackgroundColors: topBg,
      worstContrastPairs: worstPairs,
    };
  }

