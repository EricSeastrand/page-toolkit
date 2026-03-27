  // === Tool: Gradient Profile ===

  function gradientProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 3000 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const els = root.querySelectorAll('*');
    let scanned = 0;
    const gradients = [];
    let bgImageCount = 0;
    let bgImageSample = null;

    const gradientRe = /(linear|radial|conic)-gradient\(/;

    for (let i = 0; i < els.length && scanned < o.maxElements; i++) {
      const el = els[i];
      if (!isVisible(el)) continue;
      scanned++;

      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none') continue;

      // Count url() background images
      const urlMatches = bg.match(/url\(/g);
      if (urlMatches) {
        bgImageCount += urlMatches.length;
        if (!bgImageSample) bgImageSample = elPath(el);
      }

      // Pre-compute element metadata (used for classification of each gradient)
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const rect = el.getBoundingClientRect();
      const path = elPath(el);

      // Find all gradient functions in the background-image value
      let searchIdx = 0;
      while (searchIdx < bg.length) {
        const sub = bg.slice(searchIdx);
        const m = sub.match(gradientRe);
        if (!m) break;

        const gradType = m[1] + '-gradient';
        const funcStart = searchIdx + m.index;
        const openParen = funcStart + gradType.length;

        // Balance parentheses to find the closing paren
        let depth = 0;
        let funcEnd = -1;
        for (let ci = openParen; ci < bg.length; ci++) {
          if (bg[ci] === '(') depth++;
          else if (bg[ci] === ')') {
            depth--;
            if (depth === 0) { funcEnd = ci; break; }
          }
        }
        if (funcEnd === -1) { searchIdx = openParen + 1; continue; }

        const body = bg.slice(openParen + 1, funcEnd);

        // Extract direction/position: everything before the first color
        // Split on commas (top-level only) to get arguments
        const topArgs = [];
        let argDepth = 0;
        let argStart = 0;
        for (let ci = 0; ci < body.length; ci++) {
          if (body[ci] === '(') argDepth++;
          else if (body[ci] === ')') argDepth--;
          else if (body[ci] === ',' && argDepth === 0) {
            topArgs.push(body.slice(argStart, ci).trim());
            argStart = ci + 1;
          }
        }
        topArgs.push(body.slice(argStart).trim());

        // First arg is direction if it starts with "to " or is a degree, or for radial/conic patterns
        let direction = null;
        const firstArg = topArgs[0] || '';
        if (/^(to\s|[\d.]+deg|[\d.]+turn|circle|ellipse|closest|farthest|from\s)/i.test(firstArg)) {
          direction = firstArg;
        }

        // Extract color stops from the full body string using regex
        const stops = [];
        const colorRe = /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|#[0-9a-fA-F]{3,8}/g;
        let cm;
        while ((cm = colorRe.exec(body)) !== null) {
          const raw = cm[0];
          const rgb = parseRGB(raw);
          if (!rgb) continue;
          const lch = rgbToOklch(rgb.r, rgb.g, rgb.b);
          // Check for position after the color match
          const after = body.slice(cm.index + cm[0].length, cm.index + cm[0].length + 20).trim();
          const posMatch = after.match(/^([\d.]+%)/);
          stops.push({
            hex: hexFromRGB(rgb),
            L: +(lch.L * 100).toFixed(1),
            C: +lch.C.toFixed(3),
            h: +lch.h.toFixed(1),
            label: chromaLabel(lch.C),
            alpha: rgb.a,
            position: posMatch ? posMatch[1] : null,
          });
        }

        // Classify the gradient
        const hasAlpha = stops.some(s => s.alpha < 1);
        let classification;
        if (hasAlpha) classification = 'overlay';
        else if (tag === 'button' || tag === 'a' || tag === 'input' || role === 'button') classification = 'functional';
        else if (rect.height < 5 || rect.width < 5) classification = 'separator';
        else classification = 'atmosphere';

        gradients.push({
          type: gradType,
          direction,
          stops: stops.map(({ hex, L, C, h, label, position }) => ({ hex, L, C, h, label, position })),
          path,
          classification,
        });

        searchIdx = funcEnd + 1;
      }
    }

    // Deduplicate gradients by {type, direction, stops} signature
    const sigMap = new Map();
    for (const g of gradients) {
      const sig = JSON.stringify({ type: g.type, direction: g.direction, stops: g.stops });
      if (sigMap.has(sig)) {
        sigMap.get(sig).paths.push(g.path);
      } else {
        sigMap.set(sig, { type: g.type, direction: g.direction, stops: g.stops, classification: g.classification, paths: [g.path] });
      }
    }
    const deduped = [...sigMap.values()];

    // Build summary counts (from original, pre-dedup)
    const summary = { linear: 0, radial: 0, conic: 0, overlay: 0, atmosphere: 0, functional: 0, separator: 0, total: gradients.length, unique: deduped.length };
    for (const g of gradients) {
      if (g.type === 'linear-gradient') summary.linear++;
      else if (g.type === 'radial-gradient') summary.radial++;
      else if (g.type === 'conic-gradient') summary.conic++;
      summary[g.classification]++;
    }

    // Unique colors across all gradient stops
    const uniqueHexes = new Set();
    for (const g of deduped) {
      for (const s of g.stops) uniqueHexes.add(s.hex);
    }

    // Build text report
    const lines = [];
    lines.push(`Gradient Profile — ${gradients.length} gradients found, ${deduped.length} unique (scanned ${scanned} elements)`);
    lines.push('');
    lines.push('By type:');
    if (summary.linear) lines.push(`  linear-gradient: ${summary.linear}`);
    if (summary.radial) lines.push(`  radial-gradient: ${summary.radial}`);
    if (summary.conic) lines.push(`  conic-gradient: ${summary.conic}`);
    lines.push('');
    lines.push('By classification:');
    for (const cls of ['atmosphere', 'overlay', 'functional', 'separator']) {
      if (summary[cls]) lines.push(`  ${cls}: ${summary[cls]}`);
    }
    lines.push('');
    lines.push(`Unique colors in gradient stops: ${uniqueHexes.size}`);
    if (bgImageCount > 0) {
      lines.push(`Background images (url()): ${bgImageCount}${bgImageSample ? ' — sample: ' + bgImageSample : ''}`);
    }
    lines.push('');
    for (const g of deduped) {
      const stopStr = g.stops.map(s => s.hex + (s.position ? ' ' + s.position : '')).join(' → ');
      lines.push(`  ${g.type}${g.direction ? ' ' + g.direction : ''}: ${stopStr} [${g.classification}] ×${g.paths.length}`);
      if (g.paths.length <= 3) {
        for (const p of g.paths) lines.push(`    ${p}`);
      } else {
        lines.push(`    ${g.paths[0]} … +${g.paths.length - 1} more`);
      }
    }

    return {
      text: lines.join('\n'),
      data: {
        scanned,
        gradients: deduped,
        bgImageCount,
        bgImageSamplePath: bgImageSample,
        summary,
      },
    };
  }


