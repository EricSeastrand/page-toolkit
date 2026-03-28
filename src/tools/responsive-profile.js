  // === responsiveProfile: @media breakpoint detection from CSSOM ===
  function responsiveProfile(opts) {
    const o = Object.assign({ baseFontSize: 16 }, opts);
    let sheetsTotal = 0, sheetsAccessible = 0, sheetsBlocked = 0;

    const bpMap = new Map();
    const bpRegex = /(min|max)-(width|height)\s*:\s*(\d+(?:\.\d+)?)\s*(px|em|rem)/gi;

    function toPx(value, unit) {
      const v = parseFloat(value);
      if (unit === 'em' || unit === 'rem') return Math.round(v * o.baseFontSize);
      return Math.round(v);
    }

    function tierFor(px) {
      if (px < 640) return 'mobile';
      if (px < 1024) return 'tablet';
      if (px < 1440) return 'desktop';
      return 'wide';
    }

    function processMediaRule(rule) {
      const mediaText = rule.conditionText || (rule.media && rule.media.mediaText) || '';
      let match;
      bpRegex.lastIndex = 0;
      const directions = [];

      while ((match = bpRegex.exec(mediaText)) !== null) {
        const direction = match[1];
        const dimension = match[2];
        const px = toPx(match[3], match[4].toLowerCase());
        directions.push({ direction, dimension, px });
      }

      const properties = new Set();
      try {
        if (rule.cssRules) {
          for (const inner of rule.cssRules) {
            if (inner.style) {
              for (let i = 0; i < inner.style.length; i++) {
                properties.add(inner.style[i]);
              }
            }
          }
        }
      } catch (e) { /* skip */ }

      for (const { direction, dimension, px } of directions) {
        const key = px + ':' + direction + ':' + dimension;
        if (!bpMap.has(key)) {
          bpMap.set(key, {
            value: px,
            direction,
            dimension,
            ruleCount: 0,
            tier: tierFor(px),
            properties: new Set(),
          });
        }
        const entry = bpMap.get(key);
        entry.ruleCount++;
        for (const p of properties) entry.properties.add(p);
      }
    }

    function walkRules(rules) {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule || rule.type === 4) {
          processMediaRule(rule);
          try { if (rule.cssRules) walkRules(rule.cssRules); } catch (e) { /* skip */ }
        } else if (rule instanceof CSSSupportsRule || rule.type === 12) {
          try { if (rule.cssRules) walkRules(rule.cssRules); } catch (e) { /* skip */ }
        }
      }
    }

    for (const sheet of document.styleSheets) {
      sheetsTotal++;
      try {
        walkRules(sheet.cssRules);
        sheetsAccessible++;
      } catch (e) {
        sheetsBlocked++;
      }
    }

    const breakpoints = [...bpMap.values()]
      .sort((a, b) => a.value - b.value)
      .map(bp => ({
        value: bp.value,
        direction: bp.direction,
        dimension: bp.dimension,
        ruleCount: bp.ruleCount,
        tier: bp.tier,
        topProperties: [...bp.properties].slice(0, 8),
      }));

    const tiers = { mobile: { breakpoints: [], totalRules: 0 }, tablet: { breakpoints: [], totalRules: 0 }, desktop: { breakpoints: [], totalRules: 0 }, wide: { breakpoints: [], totalRules: 0 } };
    for (const bp of breakpoints) {
      tiers[bp.tier].breakpoints.push(bp.value);
      tiers[bp.tier].totalRules += bp.ruleCount;
    }

    const propFreq = new Map();
    for (const bp of bpMap.values()) {
      for (const p of bp.properties) {
        propFreq.set(p, (propFreq.get(p) || 0) + 1);
      }
    }
    const topProperties = [...propFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const uniqueValues = new Set(breakpoints.map(b => b.value)).size;
    const mostUsed = breakpoints.length ? breakpoints.reduce((a, b) => a.ruleCount >= b.ruleCount ? a : b) : null;

    const data = {
      sheetsTotal,
      sheetsAccessible,
      sheetsBlocked,
      breakpoints,
      tiers,
      summary: {
        totalBreakpoints: breakpoints.length,
        uniqueValues,
        mostUsedBreakpoint: mostUsed ? mostUsed.value : null,
        topProperties: topProperties.map(([p, c]) => ({ property: p, breakpointCount: c })),
      },
    };

    if (o.format === 'text') {
      const lines = [];
      lines.push('Responsive Profile \u2014 ' + sheetsTotal + ' stylesheets (' + sheetsAccessible + ' accessible, ' + sheetsBlocked + ' blocked by CORS)');
      lines.push('');

      if (breakpoints.length) {
        lines.push('Breakpoints (' + uniqueValues + ' unique values):');
        for (const bp of breakpoints) {
          const props = bp.topProperties.length ? bp.topProperties.join(', ') : '';
          lines.push('  ' + String(bp.value).padStart(5) + 'px  (' + bp.direction + '-' + bp.dimension + ') \u2014 ' + String(bp.ruleCount).padStart(3) + ' rules  [' + bp.tier + ']' + (props ? '   ' + props : ''));
        }
        lines.push('');

        lines.push('Tier summary:');
        for (const [name, tier] of Object.entries(tiers)) {
          if (tier.breakpoints.length) {
            lines.push('  ' + name + ':  ' + tier.breakpoints.length + ' breakpoint' + (tier.breakpoints.length > 1 ? 's' : '') + ', ' + tier.totalRules + ' rules');
          }
        }
        lines.push('');

        if (topProperties.length) {
          lines.push('Most changed properties: ' + topProperties.map(([p, c]) => p + ' (' + c + ' breakpoints)').join(', '));
        }
      } else {
        lines.push('No @media breakpoints found in accessible stylesheets.');
      }

      return { text: lines.join('\n'), data };
    }

    return data;
  }


