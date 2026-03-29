  // === Tool: Palette Profile — design-system-level color identity ===

  function paletteProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 5000, hex: false, format: 'data', sources: false }, opts);
    const root = document.querySelector(o.scope) || document.body;

    // --- Phase 1: Extract all colors ---
    const colorMap = new Map(); // hex -> { rgb, lch, sources: Set, count }

    function addColor(rgb, source) {
      if (!rgb || rgb.a < 0.1) return;
      const hex = hexFromRGB(rgb);
      if (!colorMap.has(hex)) {
        const lch = rgbToOklch(rgb.r, rgb.g, rgb.b);
        colorMap.set(hex, { rgb, lch, sources: new Set(), count: 0 });
      }
      const entry = colorMap.get(hex);
      entry.sources.add(source);
      entry.count++;
    }

    // CSS custom properties from all stylesheets
    let blockedSheets = 0;
    try {
      const rootStyles = getComputedStyle(document.documentElement);
      const bodyStyles = getComputedStyle(document.body);
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) {
                  // Try to resolve the variable value as a color
                  const val = rootStyles.getPropertyValue(prop).trim() || bodyStyles.getPropertyValue(prop).trim();
                  const rgb = parseRGB(val);
                  if (rgb) addColor(rgb, 'custom-prop');
                }
              }
            }
          }
        } catch(e) { blockedSheets++; }
      }
    } catch(e) { /* stylesheet access error */ }

    // Scan visible elements
    const els = root.querySelectorAll('*');
    let scanned = 0;
    for (const el of els) {
      if (scanned >= o.maxElements) break;
      if (!isVisible(el)) continue;
      scanned++;
      const cs = getComputedStyle(el);

      // Foreground & background
      addColor(parseRGB(cs.color), 'fg');
      addColor(parseRGB(cs.backgroundColor), 'bg');

      // Borders
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const w = parseFloat(cs[`border${side}Width`]);
        if (w > 0) addColor(parseRGB(cs[`border${side}Color`]), 'border');
      }

      // Box shadows
      const shadow = cs.boxShadow;
      if (shadow && shadow !== 'none') {
        const rgbMatches = shadow.match(/rgba?\([^)]+\)/g);
        if (rgbMatches) rgbMatches.forEach(m => addColor(parseRGB(m), 'box-shadow'));
      }

      // Outline
      if (parseFloat(cs.outlineWidth) > 0) {
        addColor(parseRGB(cs.outlineColor), 'outline');
      }

      // Gradient stop colors
      const bgImg = cs.backgroundImage;
      if (bgImg && bgImg !== 'none' && bgImg.includes('gradient')) {
        const rgbMatches = bgImg.match(/rgba?\([^)]+\)/g);
        if (rgbMatches) {
          for (const m of rgbMatches) {
            const parsed = parseRGB(m);
            if (parsed) addColor(parsed, 'gradient');
          }
        }
        const hexMatches = bgImg.match(/#[0-9a-fA-F]{3,8}(?=[\s,)\/%])/g);
        if (hexMatches) {
          for (const m of hexMatches) {
            const parsed = parseRGB(m);
            if (parsed) addColor(parsed, 'gradient');
          }
        }
      }
    }

    // SVG fills and strokes
    const svgs = root.querySelectorAll('svg [fill], svg [stroke]');
    for (const el of svgs) {
      const cs = getComputedStyle(el);
      addColor(parseRGB(cs.fill), 'svg-fill');
      addColor(parseRGB(cs.stroke), 'svg-stroke');
    }

    if (colorMap.size === 0) return { error: 'No colors found', scanned };

    // --- Phase 2: Analyze ---
    const colors = [...colorMap.entries()].map(([hex, d]) => ({
      hex, ...d, sources: [...d.sources],
    }));

    // Sort by usage count descending
    colors.sort((a, b) => b.count - a.count);

    // Separate chromatic vs neutral
    const chromatic = colors.filter(c => c.lch.C >= 0.02);
    const neutrals = colors.filter(c => c.lch.C < 0.02);
    const tintedNeutrals = colors.filter(c => c.lch.C >= 0.02 && c.lch.C < 0.06);

    // Lightness distribution (usage-weighted)
    const lValues = colors.map(c => c.lch.L);
    const lMin = Math.min(...lValues), lMax = Math.max(...lValues);
    const totalUsage = colors.reduce((s, c) => s + c.count, 0);
    const lAvg = colors.reduce((s, c) => s + c.lch.L * c.count, 0) / totalUsage;

    // Lightness histogram weighted by usage count
    const lBins = [0, 0, 0, 0, 0];
    colors.forEach(c => {
      const bin = Math.min(4, Math.floor(c.lch.L * 5));
      lBins[bin] += c.count;
    });
    const lTotal = totalUsage;
    const lPct = lBins.map(b => b / lTotal);

    // Lightness shape — detect bimodal even when one mode dominates,
    // as long as both dark and light clusters are non-trivial and mid is a valley
    let lightnessShape;
    const darkPct = lPct[0] + lPct[1];
    const lightPct = lPct[3] + lPct[4];
    const midPct = lPct[2];
    const darkCount = lBins[0] + lBins[1];
    const lightCount = lBins[3] + lBins[4];
    const midCount = lBins[2];
    // Bimodal: both poles have real clusters and the middle is a valley
    if (darkPct > 0.08 && lightPct > 0.08 && midPct < Math.min(darkPct, lightPct) && darkCount >= 5 && lightCount >= 5) lightnessShape = 'bimodal';
    else if (darkPct > 0.6) lightnessShape = 'skewed-dark';
    else if (lightPct > 0.6) lightnessShape = 'skewed-light';
    else lightnessShape = 'uniform';

    // Hue clustering (chromatic colors only, ignore neutrals)
    const hueGroups = [];
    const usedForGrouping = chromatic.filter(c => c.lch.C >= 0.06); // skip tinted neutrals
    const sortedByHue = [...usedForGrouping].sort((a, b) => a.lch.h - b.lch.h);

    if (sortedByHue.length > 0) {
      let group = [sortedByHue[0]];
      for (let i = 1; i < sortedByHue.length; i++) {
        const stepClose = hueDistance(sortedByHue[i].lch.h, group[group.length - 1].lch.h) < 30;
        const spanOk = hueDistance(sortedByHue[i].lch.h, group[0].lch.h) < 45;
        if (stepClose && spanOk) {
          group.push(sortedByHue[i]);
        } else {
          hueGroups.push(group);
          group = [sortedByHue[i]];
        }
      }
      hueGroups.push(group);
      // Check wrap-around: if first and last group are close, merge
      if (hueGroups.length > 1) {
        const first = hueGroups[0], last = hueGroups[hueGroups.length - 1];
        if (hueDistance(first[0].lch.h, last[last.length - 1].lch.h) < 30) {
          hueGroups[0] = [...last, ...first];
          hueGroups.pop();
        }
      }
    }

    // Representative hue per group (weighted by count)
    const groupHues = hueGroups.map(g => {
      const totalCount = g.reduce((s, c) => s + c.count, 0);
      // Circular mean using sin/cos
      let sinSum = 0, cosSum = 0;
      g.forEach(c => {
        const w = c.count / totalCount;
        sinSum += w * Math.sin(c.lch.h * Math.PI / 180);
        cosSum += w * Math.cos(c.lch.h * Math.PI / 180);
      });
      let h = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
      if (h < 0) h += 360;
      return h;
    });

    // Harmony classification
    const harmony = harmonyClass(groupHues);

    // Neutral tint detection
    let neutralTint = null;
    if (tintedNeutrals.length > 0) {
      // Weighted circular mean of tinted neutral hues
      const totalC = tintedNeutrals.reduce((s, c) => s + c.count, 0);
      let sinS = 0, cosS = 0;
      tintedNeutrals.forEach(c => {
        const w = c.count / totalC;
        sinS += w * Math.sin(c.lch.h * Math.PI / 180);
        cosS += w * Math.cos(c.lch.h * Math.PI / 180);
      });
      let nh = Math.atan2(sinS, cosS) * 180 / Math.PI;
      if (nh < 0) nh += 360;
      neutralTint = { hue: Math.round(nh), count: tintedNeutrals.length };
    }

    // Chroma stats
    const cValues = chromatic.map(c => c.lch.C);
    const cAvg = cValues.length ? cValues.reduce((a, b) => a + b, 0) / cValues.length : 0;
    const cMax = cValues.length ? Math.max(...cValues) : 0;

    // Vibe labeling
    const vibes = [];
    if (lightnessShape === 'bimodal' && cAvg < 0.15) vibes.push('filmic/dramatic');
    if (lightnessShape === 'skewed-dark' && cMax < 0.1) vibes.push('moody');
    if (lightnessShape === 'skewed-dark' && cMax >= 0.15) vibes.push('bold-dark');
    if (lightnessShape === 'skewed-light' && cAvg < 0.1) vibes.push('minimal/clean');
    if (lightnessShape === 'skewed-light' && cAvg >= 0.1) vibes.push('airy/pastel');
    if (cMax >= 0.25) vibes.push('saturated');
    if (harmony === 'complementary' || harmony === 'split-complementary') vibes.push('high-contrast-hue');
    if (harmony === 'analogous') vibes.push('harmonious');
    if (vibes.length === 0) vibes.push('balanced');

    // --- Phase 3: Build result ---
    const tokenColors = colors.filter(c => c.sources.includes('custom-prop'));

    const data = {
        totalColors: colors.length,
        scanned,
        tokenCount: tokenColors.length,
        blockedSheets,
        hueGroups: hueGroups.length,
        harmony,
        lightnessShape,
        chromaAvg: +cAvg.toFixed(3),
        chromaMax: +cMax.toFixed(3),
        neutralTint,
        vibes,
        colors: colors.slice(0, 30).map(c => {
          const entry = {
            L: +(c.lch.L * 100).toFixed(1), C: +c.lch.C.toFixed(3), h: +c.lch.h.toFixed(1),
            tone: colorTone(c.lch.L, c.lch.C, c.lch.h), count: c.count,
          };
          if (o.sources) entry.sources = c.sources;
          if (o.hex) entry.hex = c.hex;
          return entry;
        }),
    };

    if (o.format === 'text') {
      const lines = [];
      lines.push('=== PALETTE PROFILE ===');
      lines.push('');

      if (tokenColors.length > 0) {
        lines.push(`Design tokens: ${tokenColors.length} colors from CSS custom properties`);
        tokenColors.slice(0, 20).forEach(c => {
          const L = (c.lch.L * 100).toFixed(0);
          const C = c.lch.C.toFixed(3);
          const h = c.lch.h.toFixed(0);
          lines.push(`  ${c.hex}  L:${L} C:${C} h:${h}°  [${colorTone(c.lch.L, c.lch.C, c.lch.h)}]`);
        });
        lines.push('');
      }

      lines.push(`Palette: ${colors.length} unique colors (${scanned} elements scanned)`);
      lines.push('');
      lines.push('Top colors by usage:');
      colors.slice(0, 15).forEach((c, i) => {
        const L = (c.lch.L * 100).toFixed(0);
        const C = c.lch.C.toFixed(3);
        const h = c.lch.h.toFixed(0);
        let colorLine = `  ${i + 1}. ${c.hex}  L:${L} C:${C} h:${h}°  [${colorTone(c.lch.L, c.lch.C, c.lch.h)}]  ×${c.count}`;
        if (o.sources) colorLine += `  (${c.sources.join(', ')})`;
        lines.push(colorLine);
      });
      lines.push('');

      lines.push(`Hue clusters: ${hueGroups.length} group${hueGroups.length !== 1 ? 's' : ''}`);
      hueGroups.forEach((g, i) => {
        const repHue = groupHues[i].toFixed(0);
        const samples = g.slice(0, 3).map(c => c.hex).join(', ');
        lines.push(`  Group ${i + 1}: h ≈ ${repHue}°  (${g.length} colors: ${samples}${g.length > 3 ? '…' : ''})`);
      });
      lines.push(`Harmony: ${harmony}`);
      if (groupHues.length === 2) {
        lines.push(`  Hue gap: ${hueDistance(groupHues[0], groupHues[1]).toFixed(0)}°`);
      }
      lines.push('');

      lines.push(`Lightness distribution: ${lightnessShape}`);
      lines.push(`  Range: L ${(lMin * 100).toFixed(0)}–${(lMax * 100).toFixed(0)}, avg ${(lAvg * 100).toFixed(0)}`);
      const binLabels = ['0-20', '20-40', '40-60', '60-80', '80-100'];
      const hist = lBins.map((b, i) => `${binLabels[i]}:${b}`).join('  ');
      lines.push(`  Histogram: ${hist}`);
      lines.push('');

      lines.push(`Chroma: avg ${cAvg.toFixed(3)}, max ${cMax.toFixed(3)}`);
      lines.push(`  Pure neutrals: ${neutrals.length}, tinted neutrals: ${tintedNeutrals.length}, chromatic: ${chromatic.length - tintedNeutrals.length}`);
      if (neutralTint) {
        lines.push(`  Neutral tint: h ≈ ${neutralTint.hue}° across ${neutralTint.count} tinted neutrals`);
      }
      lines.push('');

      const fgColors = colors.filter(c => c.sources.includes('fg')).slice(0, 5);
      const bgColors = colors.filter(c => c.sources.includes('bg')).slice(0, 5);
      if (fgColors.length > 0 && bgColors.length > 0) {
        const worstPairs = [];
        for (const fg of fgColors) {
          for (const bg of bgColors) {
            const fgLum = luminance(fg.rgb);
            const bgLum = luminance(bg.rgb);
            const ratio = contrast(fgLum, bgLum);
            if (ratio < 4.5 && ratio > 1.1) {
              worstPairs.push({ fg: fg.hex, bg: bg.hex, ratio });
            }
          }
        }
        worstPairs.sort((a, b) => a.ratio - b.ratio);
        if (worstPairs.length > 0) {
          lines.push('WCAG contrast concerns:');
          worstPairs.slice(0, 5).forEach(p => {
            const level = p.ratio < 3 ? 'FAIL AA' : 'FAIL AA-large-only';
            lines.push(`  ${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)}:1 — ${level}`);
          });
          lines.push('');
        }
      }

      lines.push(`Vibe: ${vibes.join(', ')}`);
      return { text: lines.join('\n'), data };
    }
    return data;
  }

