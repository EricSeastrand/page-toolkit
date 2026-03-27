  // === spacingProfile: spacing scale, base grid, section rhythm ===
  function spacingProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 5000 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const els = root.querySelectorAll('*');
    let scanned = 0;

    const padding = new Map();
    const margin = new Map();
    const gapMap = new Map();
    const allValues = new Map();

    function inc(map, val) {
      if (val === 0) return;
      map.set(val, (map.get(val) || 0) + 1);
      allValues.set(val, (allValues.get(val) || 0) + 1);
    }

    const spacingProps = [
      ['paddingTop', padding], ['paddingRight', padding], ['paddingBottom', padding], ['paddingLeft', padding],
      ['marginTop', margin], ['marginRight', margin], ['marginBottom', margin], ['marginLeft', margin],
    ];

    for (const el of els) {
      if (scanned >= o.maxElements) break;
      if (!isVisible(el)) continue;
      scanned++;
      const cs = getComputedStyle(el);

      for (const [prop, map] of spacingProps) {
        const v = Math.round(parseFloat(cs[prop]) || 0);
        inc(map, v);
      }

      const display = cs.display;
      if (display === 'grid' || display === 'inline-grid' || display === 'flex' || display === 'inline-flex') {
        const g = Math.round(parseFloat(cs.gap) || 0);
        const rg = Math.round(parseFloat(cs.rowGap) || 0);
        const cg = Math.round(parseFloat(cs.columnGap) || 0);
        if (g) inc(gapMap, g);
        if (rg && rg !== g) inc(gapMap, rg);
        if (cg && cg !== g) inc(gapMap, cg);
      }
    }

    function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

    const sorted = [...allValues.entries()].sort((a, b) => b[1] - a[1]);
    const top20 = sorted.slice(0, 20).map(e => e[0]).filter(v => v > 0);
    let baseUnit = top20.length ? top20.reduce((a, b) => gcd(a, b)) : 0;
    if (baseUnit < 2) baseUnit = top20.length ? top20[0] : 0;

    let multCount = 0;
    let totalCount = 0;
    for (const [val, count] of allValues) {
      totalCount += count;
      if (baseUnit > 0 && val % baseUnit === 0) multCount += count;
    }
    const baseUnitCoverage = totalCount > 0 ? +(multCount / totalCount * 100).toFixed(1) : 0;

    const scale = sorted
      .filter(([, count]) => count >= 3)
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({
        value,
        count,
        timesBase: baseUnit > 0 && value % baseUnit === 0 ? value / baseUnit : null,
      }));

    const sectionRhythm = [];
    const mainEl = document.querySelector('main') || document.body;
    const topChildren = [...mainEl.children].filter(c => isVisible(c));
    for (let i = 1; i < topChildren.length; i++) {
      const prevRect = topChildren[i - 1].getBoundingClientRect();
      const currRect = topChildren[i].getBoundingClientRect();
      const gap = Math.round(currRect.top - prevRect.bottom);
      if (gap !== 0) {
        sectionRhythm.push({
          gap,
          between: elPath(topChildren[i - 1], 2) + ' \u2192 ' + elPath(topChildren[i], 2),
        });
      }
    }

    const gridFlexGapMap = new Map();
    const gfEls = root.querySelectorAll('*');
    let gfScanned = 0;
    for (const el of gfEls) {
      if (gfScanned >= 500) break;
      if (!isVisible(el)) continue;
      const cs = getComputedStyle(el);
      const display = cs.display;
      if (display === 'grid' || display === 'inline-grid' || display === 'flex' || display === 'inline-flex') {
        gfScanned++;
        const g = Math.round(parseFloat(cs.gap) || 0);
        const rg = Math.round(parseFloat(cs.rowGap) || 0);
        const cg = Math.round(parseFloat(cs.columnGap) || 0);
        if (g || rg || cg) {
          const sig = `${display}|${g}|${rg}|${cg}`;
          if (gridFlexGapMap.has(sig)) {
            gridFlexGapMap.get(sig).paths.push(elPath(el, 3));
          } else {
            gridFlexGapMap.set(sig, { display, gap: g, rowGap: rg, columnGap: cg, paths: [elPath(el, 3)] });
          }
        }
      }
    }
    const gridFlexGaps = [...gridFlexGapMap.values()];

    function fmtFreq(map, limit) {
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit || 10)
        .map(([v, c]) => v + 'px(' + c + ')')
        .join('  ');
    }

    const lines = [];
    lines.push('Spacing Profile \u2014 ' + scanned + ' elements scanned');
    lines.push('');
    lines.push('Base unit: ' + (baseUnit || 'none detected') + (baseUnit ? 'px (' + baseUnitCoverage + '% of values are multiples)' : ''));
    lines.push('');

    if (scale.length) {
      lines.push('Scale (values appearing 3+ times):');
      for (const s of scale) {
        const base = s.timesBase ? '  (' + s.timesBase + '\u00d7 base)' : '';
        lines.push('  ' + String(s.value).padStart(4) + 'px \u2014 ' + String(s.count).padStart(4) + '\u00d7' + base);
      }
      lines.push('');
    }

    lines.push('By type:');
    lines.push('  Padding: ' + fmtFreq(padding));
    lines.push('  Margin:  ' + fmtFreq(margin));
    lines.push('  Gap:     ' + fmtFreq(gapMap));
    lines.push('');

    if (sectionRhythm.length) {
      lines.push('Section rhythm:');
      for (const r of sectionRhythm) {
        lines.push('  ' + r.gap + 'px between ' + r.between);
      }
      lines.push('');
    }

    if (gridFlexGaps.length) {
      lines.push('Grid/flex gaps:');
      for (const g of gridFlexGaps.slice(0, 15)) {
        const parts = [g.display];
        if (g.gap) parts.push('gap:' + g.gap + 'px');
        if (g.rowGap && g.rowGap !== g.gap) parts.push('row-gap:' + g.rowGap + 'px');
        if (g.columnGap && g.columnGap !== g.gap) parts.push('col-gap:' + g.columnGap + 'px');
        const count = g.paths.length;
        if (count <= 2) {
          lines.push('  ' + parts.join(' ') + '  ' + g.paths.join(', '));
        } else {
          lines.push('  ' + parts.join(' ') + '  ×' + count + '  ' + g.paths[0] + ' …');
        }
      }
    }

    return {
      text: lines.join('\n'),
      data: {
        scanned,
        baseUnit,
        baseUnitCoverage,
        scale,
        byType: {
          padding: Object.fromEntries(padding),
          margin: Object.fromEntries(margin),
          gap: Object.fromEntries(gapMap),
        },
        sectionRhythm,
        gridFlexGaps,
      },
    };
  }


