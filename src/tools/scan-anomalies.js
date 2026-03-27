  // === Tool: Anomaly Scanner ===

  function scanAnomalies(opts) {
    const o = Object.assign({
      contrastMinimum: 4.5,
      scope: 'body',
      maxElements: 500,
    }, opts);

    const dark = detectDarkMode();
    const root = document.querySelector(o.scope) || document.body;
    const candidates = root.querySelectorAll('*');
    const anomalies = [];
    let scanned = 0;

    for (const el of candidates) {
      if (scanned >= o.maxElements) break;
      if (!isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight * 2) continue;
      if (rect.width === 0 && rect.height === 0) continue;
      scanned++;

      const computed = window.getComputedStyle(el);
      const bgColor = parseRGB(computed.backgroundColor);
      const fgColor = parseRGB(computed.color);
      const effBg = effectiveBackground(el);
      const bgLum = luminance(effBg);
      const tag = el.tagName.toLowerCase();
      const isForm = ['input', 'select', 'textarea', 'button'].includes(tag);
      const hasText = isForm || Array.from(el.childNodes).some(
        n => n.nodeType === 3 && n.textContent.trim()
      );
      const issues = [];

      // Light background on dark page
      if (dark.isDark && bgColor && bgColor.a > 0.1) {
        const elBgLum = luminance(bgColor);
        if (elBgLum > 0.7) {
          issues.push({ type: 'light-background', severity: 'high',
            detail: `luminance ${elBgLum.toFixed(3)}`, computed: computed.backgroundColor });
        } else if (elBgLum > 0.4) {
          issues.push({ type: 'medium-background', severity: 'medium',
            detail: `luminance ${elBgLum.toFixed(3)}`, computed: computed.backgroundColor });
        }
      }

      // Low contrast text
      if (hasText && fgColor && fgColor.a > 0.1) {
        const fgLum = luminance(fgColor);
        const ratio = contrast(fgLum, bgLum);
        if (ratio < o.contrastMinimum) {
          issues.push({ type: 'low-contrast', severity: ratio < 2 ? 'high' : 'medium',
            detail: `${ratio.toFixed(2)}:1`, fg: computed.color, bg: rgbString(effBg) });
        }
      }

      // Form controls with white bg in dark mode
      if (isForm && dark.isDark && bgColor && bgColor.a > 0.1 && luminance(bgColor) > 0.85) {
        issues.push({ type: 'form-light-bg', severity: 'high',
          detail: `${tag}[${el.type || ''}]`, computed: computed.backgroundColor,
          name: el.name || el.id || null });
      }

      // Invisible borders
      if (computed.borderStyle !== 'none' && computed.borderWidth !== '0px') {
        const bc = parseRGB(computed.borderColor);
        if (bc && bc.a > 0.1 && contrast(luminance(bc), bgLum) < 1.3) {
          issues.push({ type: 'invisible-border', severity: 'low',
            borderColor: computed.borderColor });
        }
      }

      if (issues.length > 0) {
        anomalies.push({
          path: elPath(el), tag,
          name: el.name || el.id || null,
          box: { x: Math.round(rect.x), y: Math.round(rect.y),
            w: Math.round(rect.width), h: Math.round(rect.height) },
          issues,
        });
      }
    }

    return {
      darkMode: dark,
      scanned,
      count: anomalies.length,
      high: anomalies.filter(a => a.issues.some(i => i.severity === 'high')).length,
      medium: anomalies.filter(a => a.issues.some(i => i.severity === 'medium')).length,
      low: anomalies.filter(a => a.issues.every(i => i.severity === 'low')).length,
      anomalies,
    };
  }

