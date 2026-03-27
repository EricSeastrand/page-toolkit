  // === Tool: Typography Profile ===

  function typographyProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 2000 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const selectors = 'h1,h2,h3,h4,h5,h6,p,a,span,button,li,label,td,th,figcaption,blockquote';
    const candidates = root.querySelectorAll(selectors);

    const familySet = new Map(); // family string → count
    const sigMap = new Map();    // style signature → {style, count, tags, sample}
    const weights = {};
    const letterSpacingMap = {};
    const textTransformMap = {};
    let scanned = 0;

    for (let i = 0; i < candidates.length && scanned < o.maxElements; i++) {
      const el = candidates[i];
      if (!isVisible(el)) continue;

      // Only count elements with own text content (text nodes, not just child elements)
      let hasOwnText = false;
      for (let c = 0; c < el.childNodes.length; c++) {
        if (el.childNodes[c].nodeType === 3 && el.childNodes[c].textContent.trim().length > 0) {
          hasOwnText = true;
          break;
        }
      }
      if (!hasOwnText) continue;

      scanned++;
      const cs = window.getComputedStyle(el);
      const fontFamily = cs.fontFamily;
      const fontSize = cs.fontSize;
      const fontWeight = cs.fontWeight;
      const lineHeight = cs.lineHeight;
      const letterSpacing = cs.letterSpacing;
      const textTransform = cs.textTransform;

      // Track font families
      familySet.set(fontFamily, (familySet.get(fontFamily) || 0) + 1);

      // Track weights
      weights[fontWeight] = (weights[fontWeight] || 0) + 1;

      // Track letter-spacing (non-normal)
      if (letterSpacing !== 'normal' && letterSpacing !== '0px') {
        letterSpacingMap[letterSpacing] = (letterSpacingMap[letterSpacing] || 0) + 1;
      }

      // Track text-transform (non-none)
      if (textTransform !== 'none') {
        textTransformMap[textTransform] = (textTransformMap[textTransform] || 0) + 1;
      }

      // Deduplicate by style signature
      const sig = `${fontFamily}|${fontSize}|${fontWeight}|${lineHeight}|${letterSpacing}`;
      const tag = el.tagName.toLowerCase();

      if (sigMap.has(sig)) {
        const entry = sigMap.get(sig);
        entry.count++;
        if (!entry.tags.includes(tag)) entry.tags.push(tag);
      } else {
        const text = el.textContent.trim();
        const sample = text.length > 60 ? text.slice(0, 57) + '...' : text;
        sigMap.set(sig, {
          fontFamily,
          fontSize: parseFloat(fontSize),
          fontWeight,
          lineHeight,
          letterSpacing,
          textTransform,
          count: 1,
          tags: [tag],
          sample,
        });
      }
    }

    // Build scale sorted descending by size
    const scale = [...sigMap.values()].sort((a, b) => b.fontSize - a.fontSize);

    // Group by semantic role
    const groups = { display: [], heading: [], body: [], caption: [] };
    for (const entry of scale) {
      const sz = entry.fontSize;
      if (sz > 48) groups.display.push(entry);
      else if (sz >= 24) groups.heading.push(entry);
      else if (sz >= 14) groups.body.push(entry);
      else groups.caption.push(entry);
    }

    // Deduplicate families
    const families = [...familySet.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([family, count]) => ({ family, count }));

    // Build text report
    const lines = [];
    lines.push(`Typography Profile — ${scanned} text elements scanned`);
    lines.push('');

    lines.push('Font families:');
    families.forEach(f => {
      lines.push(`  ${f.family}  (${f.count} elements)`);
    });
    lines.push('');

    lines.push(`Type scale (${scale.length} distinct styles):`);
    scale.forEach(s => {
      lines.push(`  ${s.fontSize}px / ${s.fontWeight} / ${s.lineHeight} — ${s.count}× [${s.tags.join(', ')}] "${s.sample}"`);
    });
    lines.push('');

    lines.push('Semantic groups:');
    for (const [role, entries] of Object.entries(groups)) {
      if (entries.length === 0) continue;
      const sizes = entries.map(e => e.fontSize + 'px').join(', ');
      lines.push(`  ${role}: ${entries.length} styles (${sizes})`);
    }
    lines.push('');

    lines.push('Weight distribution:');
    Object.entries(weights).sort((a, b) => +a[0] - +b[0]).forEach(([w, c]) => {
      lines.push(`  ${w}: ${c} elements`);
    });

    if (Object.keys(letterSpacingMap).length > 0) {
      lines.push('');
      lines.push('Letter-spacing patterns:');
      Object.entries(letterSpacingMap).sort((a, b) => b[1] - a[1]).forEach(([v, c]) => {
        lines.push(`  ${v}: ${c} elements`);
      });
    }

    if (Object.keys(textTransformMap).length > 0) {
      lines.push('');
      lines.push('Text-transform usage:');
      Object.entries(textTransformMap).sort((a, b) => b[1] - a[1]).forEach(([v, c]) => {
        lines.push(`  ${v}: ${c} elements`);
      });
    }

    return {
      text: lines.join('\n'),
      data: {
        scanned,
        families,
        scale: scale.map(s => ({
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          textTransform: s.textTransform,
          count: s.count,
          tags: s.tags,
          sample: s.sample,
        })),
        groups,
        weights,
        letterSpacing: letterSpacingMap,
        textTransform: textTransformMap,
      },
    };
  }

