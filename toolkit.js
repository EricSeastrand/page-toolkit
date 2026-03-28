(() => {
  'use strict';

  // Skip if already loaded
  if (window.__ps) return;

  // Force grayscale antialiasing — prevents subpixel color fringing in screenshots.
  // Without this, Chromium on Linux bakes RGB subpixel data into text edges,
  // which looks wrong on OLED, projectors, or any non-RGB-stripe display.
  function injectAA() {
    const aaStyle = document.createElement('style');
    aaStyle.textContent = '*, *::before, *::after { -webkit-font-smoothing: antialiased !important; -moz-osx-font-smoothing: grayscale !important; }';
    (document.head || document.documentElement).appendChild(aaStyle);
  }
  if (document.head || document.documentElement) injectAA();
  else document.addEventListener('DOMContentLoaded', injectAA);

  // === Color math utilities ===

  function parseRGB(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    // Try rgb()/rgba() first
    const m = str.match(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    // Try hex (#RGB, #RRGGBB, #RRGGBBAA)
    const h = str.match(/^#([0-9a-f]{3,8})$/i);
    if (h) {
      let hex = h[1];
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  function luminance(rgb) {
    const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrast(lum1, lum2) {
    return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
  }

  // Approximate saturation from RGB (HSL-style)
  function saturation(rgb) {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 0;
    const l = (max + min) / 2;
    return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  }

  function rgbString(rgb) {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  }

  function colorKey(rgb) {
    // Round to nearest 5 to group similar colors
    return `${Math.round(rgb.r/5)*5},${Math.round(rgb.g/5)*5},${Math.round(rgb.b/5)*5}`;
  }

  function hexFromRGB(rgb) {
    const h = c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0');
    return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
  }

  // === OKLCH color space (Ottosson 2020) ===

  function linearize(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function rgbToOklab(r, g, b) {
    const lr = linearize(r), lg = linearize(g), lb = linearize(b);
    // M1: linear sRGB → LMS
    const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
    // Cube root
    const lp = Math.cbrt(l), mp = Math.cbrt(m), sp = Math.cbrt(s);
    // M2: LMS' → OKLab
    return {
      L: 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp,
      a: 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp,
      b: 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp,
    };
  }

  function oklabToOklch(lab) {
    const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { L: lab.L, C, h };
  }

  function rgbToOklch(r, g, b) {
    return oklabToOklch(rgbToOklab(r, g, b));
  }

  function oklchToRgb(L, C, h) {
    const hRad = h * Math.PI / 180;
    const a = C * Math.cos(hRad), b = C * Math.sin(hRad);
    // Inverse M2: OKLab → LMS'
    const lp = L + 0.3963377774 * a + 0.2158037573 * b;
    const mp = L - 0.1055613458 * a - 0.0638541728 * b;
    const sp = L - 0.0894841775 * a - 1.2914855480 * b;
    // Cube: LMS' → LMS
    const l = lp * lp * lp, m = mp * mp * mp, s = sp * sp * sp;
    // Inverse M1: LMS → linear sRGB
    const lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    // Gamma encode
    const gamma = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return {
      r: Math.round(Math.min(255, Math.max(0, gamma(lr) * 255))),
      g: Math.round(Math.min(255, Math.max(0, gamma(lg) * 255))),
      b: Math.round(Math.min(255, Math.max(0, gamma(lb) * 255))),
    };
  }

  function deltaEOK(lch1, lch2) {
    const dL = lch1.L - lch2.L;
    const dC = lch1.C - lch2.C;
    const h1 = lch1.h * Math.PI / 180, h2 = lch2.h * Math.PI / 180;
    const dh = 2 * Math.sqrt(lch1.C * lch2.C) * Math.sin((h1 - h2) / 2);
    return Math.sqrt(dL * dL + dC * dC + dh * dh);
  }

  function hueName(h) {
    if (h >= 350 || h < 20)  return 'pink';
    if (h < 45)  return 'red';
    if (h < 70)  return 'orange';
    if (h < 100) return 'yellow';
    if (h < 130) return 'lime';
    if (h < 160) return 'green';
    if (h < 190) return 'teal';
    if (h < 225) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 290) return 'indigo';
    return 'purple';
  }

  function colorTone(L, C, h) {
    // Pure neutrals — no hue, describe by lightness only
    if (C < 0.01) {
      if (L >= 0.94) return 'white';
      if (L >= 0.75) return 'light gray';
      if (L >= 0.45) return 'gray';
      if (L >= 0.25) return 'dark gray';
      return 'black';
    }

    const hue = hueName(h);

    // Tinted neutrals — noun is the neutral, hue is the adjective
    if (C < 0.04) {
      if (L >= 0.85) return hue + '-ish white';
      if (L >= 0.35) return hue + '-ish gray';
      return hue + '-ish black';
    }

    // Muted accents — noun is the hue, grayness is the adjective
    if (C < 0.08) {
      if (L >= 0.75) return 'pale ' + hue;
      if (L >= 0.35) return 'grayish ' + hue;
      return 'dark grayish ' + hue;
    }

    // Chromatic — ISCC-NBS modifiers selected by L and CIE saturation (C/L)
    var s = L > 0.01 ? C / L : 0;

    if (L >= 0.75) {
      if (s >= 0.25) return 'vivid ' + hue;
      if (s >= 0.12) return 'brilliant ' + hue;
      return 'light ' + hue;
    }
    if (L >= 0.55) {
      if (s >= 0.25) return 'strong ' + hue;
      return 'moderate ' + hue;
    }
    if (L >= 0.35) {
      if (s >= 0.25) return 'deep ' + hue;
      return 'moderate ' + hue;
    }
    if (s >= 0.25) return 'deep ' + hue;
    return 'dark ' + hue;
  }

  function hueDistance(h1, h2) {
    const d = Math.abs(h1 - h2) % 360;
    return d > 180 ? 360 - d : d;
  }

  function harmonyClass(hues) {
    if (hues.length < 2) return 'monochromatic';
    // Sort hues, compute gaps
    const sorted = [...hues].sort((a, b) => a - b);
    if (sorted.length === 2) {
      const d = hueDistance(sorted[0], sorted[1]);
      if (d <= 30) return 'analogous';
      if (d >= 150 && d <= 210) return 'complementary';
      if (d >= 120 && d < 150) return 'split-complementary';
      if (d >= 210 && d <= 240) return 'split-complementary';
      return 'contrast';
    }
    // 3+ hues: check triadic (roughly 120° apart) or other
    const gaps = [];
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      gaps.push(hueDistance(sorted[i], next));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const maxDev = Math.max(...gaps.map(g => Math.abs(g - avgGap)));
    if (sorted.length === 3 && avgGap > 100 && maxDev < 30) return 'triadic';
    if (sorted.length === 4 && avgGap > 70 && maxDev < 25) return 'tetradic';
    // Compute occupied arc: the smallest arc that contains all hues
    // = 360 minus the largest gap between consecutive sorted hues
    const wrappedGaps = [];
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const gap = ((next - sorted[i]) % 360 + 360) % 360;
      wrappedGaps.push(gap || 360); // 0 means same hue, treat as full circle
    }
    const occupiedArc = 360 - Math.max(...wrappedGaps);
    if (occupiedArc < 90) return 'analogous';
    return 'multi-hue';
  }

  function effectiveBackground(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parseRGB(window.getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.1) return bg;
      node = node.parentElement;
    }
    const bodyBg = parseRGB(window.getComputedStyle(document.body).backgroundColor);
    return bodyBg && bodyBg.a > 0.1 ? bodyBg : { r: 255, g: 255, b: 255, a: 1 };
  }

  function elPath(el, maxDepth) {
    const parts = [];
    let node = el;
    const depth = maxDepth || 4;
    let foundId = false;
    while (node && node !== document.body && parts.length < depth) {
      let seg = node.tagName.toLowerCase();
      if (node.id) {
        seg = `#${node.id}`;
        parts.unshift(seg);
        foundId = true;
        break;
      } else if (node.className && typeof node.className === 'string') {
        const c = node.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (c) seg += `.${c}`;
      }
      parts.unshift(seg);
      node = node.parentElement;
    }
    // If no id anchor found, walk further up looking for an ancestor with an id
    if (!foundId && node && node !== document.body) {
      while (node && node !== document.body) {
        if (node.id) {
          parts.unshift(`#${node.id}`);
          foundId = true;
          break;
        }
        node = node.parentElement;
      }
    }
    // If still no id, trim to last 3 segments
    if (!foundId && parts.length > 3) {
      parts.splice(0, parts.length - 3);
    }
    return parts.join(' > ');
  }

  function isVisible(el) {
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  // === Page detection ===

  function detectDarkMode() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bodyBg = effectiveBackground(document.body);
    const bodyLum = luminance(bodyBg);

    // Find first visible section/main/body-child filling >80% viewport width
    let sectionTheme = null;
    const candidates = document.querySelectorAll('section, main, body > div, body > header');
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < window.innerWidth * 0.8) continue;
      if (rect.height < 50) continue;
      // Must be in the viewport (top area of the page)
      if (rect.top > window.innerHeight) continue;
      const bg = effectiveBackground(el);
      const lum = luminance(bg);
      sectionTheme = {
        selector: elPath(el, 2),
        bg: rgbString(bg),
        lum: +lum.toFixed(3),
        isDark: lum < 0.2,
      };
      break;
    }

    const isDark = mq || bodyLum < 0.2 || (sectionTheme !== null && sectionTheme.isDark);
    return { isDark, mediaQuery: mq, bodyLum, bodyBg, sectionTheme };
  }

  // === Tool: Color Profile ===

  function colorProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 500 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const dark = detectDarkMode();

    // Collect all fg/bg pairs
    const pairs = [];      // { fg, bg, fgLum, bgLum, ratio, path, tag }
    const bgColors = {};   // colorKey -> { rgb, count, lum }
    const fgColors = {};   // colorKey -> { rgb, count, lum }
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
      if (!fgColors[fk]) fgColors[fk] = { rgb: fg, count: 0, lum: fgLum };
      fgColors[fk].count++;

      const bk = colorKey(bg);
      if (!bgColors[bk]) bgColors[bk] = { rgb: bg, count: 0, lum: bgLum };
      bgColors[bk].count++;
    }

    // Compute distributions
    const ratios = pairs.map(p => p.ratio).sort((a, b) => a - b);

    function percentile(arr, p) { return arr[Math.floor(arr.length * p)] || 0; }
    function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

    // Top unique colors by usage
    const topFg = Object.values(fgColors).sort((a, b) => b.count - a.count).slice(0, 8)
      .map(c => {
        const lch = rgbToOklch(c.rgb.r, c.rgb.g, c.rgb.b);
        const entry = { count: c.count, oklch: { L: +(lch.L * 100).toFixed(1), C: +lch.C.toFixed(3), h: +lch.h.toFixed(1) }, tone: colorTone(lch.L * 100, lch.C, lch.h) };
        if (o.hex) entry.hex = hexFromRGB(c.rgb);
        return entry;
      });
    const topBg = Object.values(bgColors).sort((a, b) => b.count - a.count).slice(0, 5)
      .map(c => {
        const lch = rgbToOklch(c.rgb.r, c.rgb.g, c.rgb.b);
        const entry = { count: c.count, oklch: { L: +(lch.L * 100).toFixed(1), C: +lch.C.toFixed(3), h: +lch.h.toFixed(1) }, tone: colorTone(lch.L * 100, lch.C, lch.h) };
        if (o.hex) entry.hex = hexFromRGB(c.rgb);
        return entry;
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
          fg: { L: +(fgLch.L * 100).toFixed(1), C: +fgLch.C.toFixed(3), h: +fgLch.h.toFixed(1) },
          bg: { L: +(bgLch.L * 100).toFixed(1), C: +bgLch.C.toFixed(3), h: +bgLch.h.toFixed(1) },
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
        median: +percentile(ratios, 0.5).toFixed(2),
        avg: +avg(ratios).toFixed(2),
        belowAA: ratios.filter(r => r < 4.5).length,
        total: ratios.length,
      },
      topForegroundColors: topFg,
      topBackgroundColors: topBg,
      worstContrastPairs: worstPairs,
    };
  }
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

  // === Tool: Style Inspector ===

  function inspect(selector, properties) {
    const DEFAULT_PROPS = [
      'color', 'background-color', 'border-color', 'border-width', 'border-style',
      'font-size', 'font-weight', 'font-family',
      'padding', 'margin', 'width', 'height',
      'display', 'visibility', 'opacity', 'overflow', 'position',
      'box-shadow', 'outline', 'outline-color',
    ];
    const props = properties || DEFAULT_PROPS;
    const elements = document.querySelectorAll(selector);
    const results = [];

    for (const el of elements) {
      if (!isVisible(el)) continue;
      const computed = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const styles = {};
      for (const prop of props) styles[prop] = computed.getPropertyValue(prop);

      // Matched CSS rules (same-origin)
      const matched = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && el.matches(rule.selectorText)) {
              const relevant = {};
              for (const prop of props) {
                const val = rule.style?.getPropertyValue(prop);
                if (val) relevant[prop] = val;
              }
              if (Object.keys(relevant).length > 0) {
                matched.push({
                  selector: rule.selectorText,
                  source: (sheet.href || 'inline').split('/').pop(),
                  properties: relevant,
                });
              }
            }
          }
        } catch (e) { /* CORS */ }
      }

      results.push({
        path: elPath(el),
        tag: el.tagName.toLowerCase(),
        name: el.name || el.id || null,
        box: { x: Math.round(rect.x), y: Math.round(rect.y),
          w: Math.round(rect.width), h: Math.round(rect.height) },
        styles,
        inline: el.getAttribute('style') || null,
        matchedRules: matched,
      });
    }
    return results;
  }

  // === Tool: Style Trace ===
  // For a single element + property, show which rules compete

  function traceStyle(selector, property) {
    const el = document.querySelector(selector);
    if (!el) return { error: `No element matches: ${selector}` };

    const computed = window.getComputedStyle(el);
    const rules = [];

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && el.matches(rule.selectorText)) {
            const val = rule.style?.getPropertyValue(property);
            if (val) {
              rules.push({
                selector: rule.selectorText,
                value: val,
                priority: rule.style.getPropertyPriority(property),
                source: (sheet.href || 'inline').split('/').pop(),
              });
            }
          }
        }
      } catch (e) { /* CORS */ }
    }

    return {
      element: elPath(el),
      property,
      computedValue: computed.getPropertyValue(property),
      inline: el.style?.getPropertyValue(property) || null,
      matchedRules: rules,
      hasTypeAttr: el.getAttribute('type'),
    };
  }

  // === Layout utilities ===

  function boxModel(el) {
    const rect = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    const px = v => parseFloat(v) || 0;
    const margin = { top: px(s.marginTop), right: px(s.marginRight), bottom: px(s.marginBottom), left: px(s.marginLeft) };
    const border = { top: px(s.borderTopWidth), right: px(s.borderRightWidth), bottom: px(s.borderBottomWidth), left: px(s.borderLeftWidth) };
    const padding = { top: px(s.paddingTop), right: px(s.paddingRight), bottom: px(s.paddingBottom), left: px(s.paddingLeft) };
    const contentW = rect.width - padding.left - padding.right - border.left - border.right;
    const contentH = rect.height - padding.top - padding.bottom - border.top - border.bottom;
    return {
      content: { w: +contentW.toFixed(1), h: +contentH.toFixed(1) },
      padding, border, margin,
      inner: { w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
      outer: {
        w: +(rect.width + margin.left + margin.right).toFixed(1),
        h: +(rect.height + margin.top + margin.bottom).toFixed(1),
      },
      rect: { x: +rect.x.toFixed(1), y: +rect.y.toFixed(1), w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
    };
  }

  function pctOfParent(el) {
    const parent = el.offsetParent || el.parentElement;
    if (!parent) return null;
    const elRect = el.getBoundingClientRect();
    const pRect = parent.getBoundingClientRect();
    if (pRect.width === 0 || pRect.height === 0) return null;
    return {
      parent: elPath(parent),
      wPct: +(elRect.width / pRect.width * 100).toFixed(1),
      hPct: +(elRect.height / pRect.height * 100).toFixed(1),
    };
  }

  // === Tool: Layout — ancestry with box dimensions ===

  function ancestry(selector, opts) {
    const o = Object.assign({ depth: 6 }, opts);
    const el = document.querySelector(selector);
    if (!el) return { error: 'No element matches: ' + selector };

    const chain = [];
    let node = el;
    while (node && node !== document.documentElement && chain.length < o.depth) {
      const s = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      let label = node.tagName.toLowerCase();
      if (node.id) label += '#' + node.id;
      else if (node.className && typeof node.className === 'string') {
        const c = node.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (c) label += '.' + c;
      }
      chain.push({
        selector: label,
        display: s.display,
        position: s.position,
        overflow: s.overflow,
        box: { w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
        textLen: node.textContent ? node.textContent.length : 0,
      });
      node = node.parentElement;
    }
    return { target: selector, chain };
  }

  // === Tool: Layout — detailed box model for elements ===

  function layoutBox(selector) {
    const elements = document.querySelectorAll(selector);
    const results = [];
    for (const el of elements) {
      if (!isVisible(el)) continue;
      results.push({
        path: elPath(el),
        tag: el.tagName.toLowerCase(),
        name: el.id || el.name || null,
        box: boxModel(el),
        pctOfParent: pctOfParent(el),
        display: window.getComputedStyle(el).display,
        position: window.getComputedStyle(el).position,
      });
    }
    return results;
  }

  // === Tool: Layout — aggregate dimensions across multiple matches ===

  function layoutAggregate(selector) {
    const elements = document.querySelectorAll(selector);
    const widths = [], heights = [], displays = {}, positions = {};
    let count = 0;

    for (const el of elements) {
      if (!isVisible(el)) continue;
      count++;
      const rect = el.getBoundingClientRect();
      widths.push(rect.width);
      heights.push(rect.height);
      const s = window.getComputedStyle(el);
      displays[s.display] = (displays[s.display] || 0) + 1;
      positions[s.position] = (positions[s.position] || 0) + 1;
    }

    if (count === 0) return { selector, count: 0 };

    widths.sort((a, b) => a - b);
    heights.sort((a, b) => a - b);
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      selector,
      count,
      width: {
        min: +widths[0].toFixed(1),
        max: +widths[widths.length - 1].toFixed(1),
        avg: +avg(widths).toFixed(1),
        median: +widths[Math.floor(widths.length / 2)].toFixed(1),
        distinct: new Set(widths.map(w => Math.round(w))).size,
      },
      height: {
        min: +heights[0].toFixed(1),
        max: +heights[heights.length - 1].toFixed(1),
        avg: +avg(heights).toFixed(1),
        median: +heights[Math.floor(heights.length / 2)].toFixed(1),
        distinct: new Set(heights.map(h => Math.round(h))).size,
      },
      displays,
      positions,
    };
  }

  // === Tool: Layout — measure gap between two elements ===

  function layoutGap(selectorA, selectorB) {
    const elA = document.querySelector(selectorA);
    const elB = document.querySelector(selectorB);
    if (!elA) return { error: 'No element matches: ' + selectorA };
    if (!elB) return { error: 'No element matches: ' + selectorB };

    const a = elA.getBoundingClientRect();
    const b = elB.getBoundingClientRect();

    // Gaps between edges
    const gapX = b.left > a.right ? b.left - a.right
      : a.left > b.right ? a.left - b.right : 0;
    const gapY = b.top > a.bottom ? b.top - a.bottom
      : a.top > b.bottom ? a.top - b.bottom : 0;

    // Center-to-center distance
    const cxA = a.left + a.width / 2, cyA = a.top + a.height / 2;
    const cxB = b.left + b.width / 2, cyB = b.top + b.height / 2;
    const centerDist = Math.sqrt((cxB - cxA) ** 2 + (cyB - cyA) ** 2);

    const overlapsX = a.left < b.right && b.left < a.right;
    const overlapsY = a.top < b.bottom && b.top < a.bottom;

    return {
      a: { path: elPath(elA), rect: { x: +a.x.toFixed(1), y: +a.y.toFixed(1), w: +a.width.toFixed(1), h: +a.height.toFixed(1) } },
      b: { path: elPath(elB), rect: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } },
      gapX: +gapX.toFixed(1),
      gapY: +gapY.toFixed(1),
      centerDistance: +centerDist.toFixed(1),
      overlaps: overlapsX && overlapsY,
      arrangement: gapY > 0 ? 'stacked' : gapX > 0 ? 'side-by-side'
        : (overlapsX && overlapsY) ? 'overlapping' : 'flush',
    };
  }

  // === Tool: Layout — depth traversal (parents + children with dimensions) ===

  function layoutTree(selector, opts) {
    const o = Object.assign({ parents: 3, children: 2 }, opts);
    const el = document.querySelector(selector);
    if (!el) return { error: 'No element matches: ' + selector };

    function nodeInfo(node) {
      const rect = node.getBoundingClientRect();
      const s = window.getComputedStyle(node);
      return {
        selector: elPath(node, 2),
        tag: node.tagName.toLowerCase(),
        display: s.display,
        box: { w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
        childCount: node.children.length,
      };
    }

    // Walk up
    const parents = [];
    let node = el.parentElement;
    for (let i = 0; i < o.parents && node && node !== document.documentElement; i++) {
      parents.push(nodeInfo(node));
      node = node.parentElement;
    }

    // Walk down (breadth-first, depth-limited)
    function getChildren(root, maxDepth) {
      if (maxDepth <= 0) return [];
      const result = [];
      for (const child of root.children) {
        if (!isVisible(child)) continue;
        const info = nodeInfo(child);
        info.children = getChildren(child, maxDepth - 1);
        result.push(info);
      }
      return result;
    }

    return {
      target: nodeInfo(el),
      parents: parents,
      children: getChildren(el, o.children),
    };
  }

  // === Tool: Layout Density — content-vs-whitespace analysis ===
  //
  // Answers: "how full are my containers?" Reports fill ratios, gap inventories,
  // and vertical budgets — everything in % of parent, not raw pixels.
  // Designed for fixed-frame layouts (slides, dashboards) where wasted space is the enemy.
  //
  // Usage:
  //   layoutDensity('.slide')                    — full analysis of a root container
  //   layoutDensity('.slide', { depth: 1 })      — just immediate children
  //   layoutDensity('.component', { axis: 'y' }) — vertical density of a single card

  function layoutDensity(selector, opts) {
    const o = Object.assign({ depth: 1, axis: 'both', maxChildren: 50, mode: 'full' }, opts);
    const root = document.querySelector(selector);
    if (!root) return { error: 'No element matches: ' + selector };

    const pct = (n, d) => d > 0 ? +(n / d * 100).toFixed(1) : 0;
    const rd = n => +n.toFixed(1);

    // Auto-detect primary axis from computed styles
    function detectAxis(cs) {
      const display = cs.display;
      const flexDir = cs.flexDirection;
      if (display.includes('flex')) {
        return (flexDir === 'column' || flexDir === 'column-reverse') ? 'y' : 'x';
      } else if (display === 'grid') {
        return 'both';
      }
      return 'y'; // block flow default
    }

    // Measure text fill using only direct children — avoids double-counting nested text.
    // For each direct child: if it's a leaf (no visible sub-elements), count its height.
    // If it has children, skip it — its internal text is measured when we recurse into it.
    function measureTextFill(el, elRect) {
      const textElements = [];
      let totalHeight = 0;

      for (const child of el.children) {
        if (!isVisible(child)) continue;
        const hasVisibleKids = Array.from(child.children).some(ch => isVisible(ch));
        if (!hasVisibleKids && child.textContent.trim()) {
          const cr = child.getBoundingClientRect();
          const childCs = getComputedStyle(child);
          totalHeight += cr.height;
          textElements.push({
            class: child.className && typeof child.className === 'string'
              ? child.className.trim().split(/\s+/)[0] : child.tagName.toLowerCase(),
            text: child.textContent.trim().slice(0, 30),
            fontSize: childCs.fontSize,
            lineHeight: rd(parseFloat(childCs.lineHeight) || 0),
            height: rd(cr.height),
            pctOfParent: pct(cr.height, elRect.height),
          });
        }
      }

      // Also check for direct text nodes (text not wrapped in child elements)
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && node.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rr = range.getBoundingClientRect();
          if (rr.height > 0) {
            const parentCs = getComputedStyle(el);
            totalHeight += rr.height;
            textElements.push({
              class: '(text-node)',
              text: node.textContent.trim().slice(0, 30),
              fontSize: parentCs.fontSize,
              lineHeight: rd(parseFloat(parentCs.lineHeight) || 0),
              height: rd(rr.height),
              pctOfParent: pct(rr.height, elRect.height),
            });
          }
        }
      }

      return { totalHeight, textElements };
    }

    // Analyze one container: its children, gaps, and fill ratio
    function analyzeContainer(el, depth, isRoot) {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const px = v => parseFloat(v) || 0;

      const pad = {
        top: px(cs.paddingTop), right: px(cs.paddingRight),
        bottom: px(cs.paddingBottom), left: px(cs.paddingLeft)
      };
      const contentW = rect.width - pad.left - pad.right;
      const contentH = rect.height - pad.top - pad.bottom;

      // Identify visible children
      const children = [];
      for (const child of el.children) {
        if (!isVisible(child)) continue;
        const cr = child.getBoundingClientRect();
        if (cr.width === 0 && cr.height === 0) continue;
        children.push({ el: child, rect: cr });
      }

      // Axis: root uses the user's option (or auto-detect), recursive calls always auto-detect
      let axis;
      if (isRoot && o.axis !== 'both' && o.axis !== 'auto') {
        axis = o.axis;
      } else {
        axis = detectAxis(cs);
      }

      // Measure children along primary axis
      let childrenTotalPrimary = 0;
      const gaps = [];
      const childInfos = [];

      // Sort children by position on primary axis
      const sorted = [...children].sort((a, b) => {
        return axis === 'x' ? a.rect.left - b.rect.left : a.rect.top - b.rect.top;
      });

      const containerPrimary = axis === 'x' ? contentW : contentH;
      const containerSecondary = axis === 'x' ? contentH : contentW;

      for (let i = 0; i < sorted.length && i < o.maxChildren; i++) {
        const c = sorted[i];
        const cr = c.rect;
        const primary = axis === 'x' ? cr.width : cr.height;
        const secondary = axis === 'x' ? cr.height : cr.width;
        const childCs = getComputedStyle(c.el);

        childrenTotalPrimary += primary;

        // Label the child
        let label = c.el.tagName.toLowerCase();
        if (c.el.className && typeof c.el.className === 'string') {
          const cls = c.el.className.trim().split(/\s+/)[0];
          if (cls) label = '.' + cls;
        }
        // Try to get meaningful text
        const textEl = c.el.querySelector('.label, .title, h1, h2, h3, h4') || c.el;
        const text = (textEl.textContent || '').trim().slice(0, 40);

        const info = {
          label: text ? `${label} "${text}"` : label,
          size: rd(primary),
          pctOfContainer: pct(primary, containerPrimary),
          crossFill: pct(secondary, containerSecondary),
        };

        // Padding breakdown for this child
        const cPad = {
          top: px(childCs.paddingTop), right: px(childCs.paddingRight),
          bottom: px(childCs.paddingBottom), left: px(childCs.paddingLeft)
        };
        const totalPad = cPad.top + cPad.right + cPad.bottom + cPad.left;
        if (totalPad > 0) {
          info.padding = {};
          if (cPad.top) info.padding.top = rd(cPad.top);
          if (cPad.right) info.padding.right = rd(cPad.right);
          if (cPad.bottom) info.padding.bottom = rd(cPad.bottom);
          if (cPad.left) info.padding.left = rd(cPad.left);
          // Padding as % of the child's own primary dimension
          const padPrimary = axis === 'x' ? cPad.left + cPad.right : cPad.top + cPad.bottom;
          info.padding.pctOfSelf = pct(padPrimary, primary);
        }

        // Text fill — direct children only (fixes double-counting bug)
        const tf = measureTextFill(c.el, cr);
        if (tf.totalHeight > 0) {
          info.textFill = pct(tf.totalHeight, cr.height);
          if (o.textElements && tf.textElements.length > 0) {
            info.textElements = tf.textElements;
          }
        }

        // Headroom: how much room to grow before overflowing the container
        const remainingInContainer = containerPrimary - childrenTotalPrimary;
        // The child's share of remaining space (simple: remaining / remaining-children)
        const remainingChildren = sorted.length - i - 1;
        // Calculate gaps that follow this child
        let gapAfter = 0;
        if (i < sorted.length - 1) {
          const next = sorted[i + 1].rect;
          gapAfter = axis === 'x' ? next.left - cr.right : next.top - cr.bottom;
        }

        childInfos.push(info);

        // Gap to next sibling
        if (i < sorted.length - 1) {
          const next = sorted[i + 1].rect;
          const gap = axis === 'x'
            ? next.left - cr.right
            : next.top - cr.bottom;
          if (gap > 0) {
            gaps.push({
              between: `${i + 1} → ${i + 2}`,
              size: rd(gap),
              pctOfContainer: pct(gap, containerPrimary),
            });
          }
        }
      }

      // Calculate overall density
      const totalGaps = gaps.reduce((sum, g) => sum + g.size, 0);
      const paddingPrimary = axis === 'x' ? pad.left + pad.right : pad.top + pad.bottom;

      // Leading space (before first child) and trailing space (after last child)
      let leadingSpace = 0, trailingSpace = 0;
      if (sorted.length > 0) {
        const first = sorted[0].rect;
        const last = sorted[sorted.length - 1].rect;
        if (axis === 'x') {
          leadingSpace = first.left - (rect.left + pad.left);
          trailingSpace = (rect.right - pad.right) - last.right;
        } else {
          leadingSpace = first.top - (rect.top + pad.top);
          trailingSpace = (rect.bottom - pad.bottom) - last.bottom;
        }
      }

      // Headroom: total unused space in the container
      const usedSpace = childrenTotalPrimary + totalGaps +
        Math.max(0, leadingSpace) + Math.max(0, trailingSpace);
      const headroomPx = Math.max(0, containerPrimary - usedSpace);
      let constrainedBy = 'container ' + (axis === 'x' ? 'width' : 'height');
      if (headroomPx < 5 && totalGaps > 20) constrainedBy = 'inter-child gaps';
      if (headroomPx < 5 && paddingPrimary > 20) constrainedBy = 'container padding';

      const result = {
        selector: elPath(el, 2),
        axis,
        container: {
          outer: axis === 'x' ? rd(rect.width) : rd(rect.height),
          padding: rd(paddingPrimary),
          content: rd(containerPrimary),
        },
        fill: {
          children: rd(childrenTotalPrimary),
          childrenPct: pct(childrenTotalPrimary, containerPrimary),
          gaps: rd(totalGaps),
          gapsPct: pct(totalGaps, containerPrimary),
          leading: rd(Math.max(0, leadingSpace)),
          leadingPct: pct(Math.max(0, leadingSpace), containerPrimary),
          trailing: rd(Math.max(0, trailingSpace)),
          trailingPct: pct(Math.max(0, trailingSpace), containerPrimary),
        },
        headroom: {
          px: rd(headroomPx),
          pct: pct(headroomPx, containerPrimary),
          constrainedBy,
        },
        children: childInfos,
      };

      // Sort gaps largest-first for easy scanning
      if (gaps.length > 0) {
        result.gaps = gaps.sort((a, b) => b.size - a.size);
      }

      // Recurse into children
      if (depth > 1) {
        result.childDensity = [];
        for (let i = 0; i < sorted.length && i < o.maxChildren; i++) {
          const c = sorted[i].el;
          if (c.children.length > 0) {
            result.childDensity.push(analyzeContainer(c, depth - 1, false));
          }
        }
      }

      return result;
    }

    // Full analysis tree
    const tree = analyzeContainer(root, o.depth, true);

    // Summary mode: flatten the tree into a sorted array of findings
    if (o.mode === 'summary') {
      const findings = [];

      function flatten(node) {
        const entry = {
          selector: node.selector,
          axis: node.axis,
          fillPct: node.fill.childrenPct,
          gapPct: node.fill.gapsPct,
          headroomPx: node.headroom.px,
          headroomPct: node.headroom.pct,
        };

        // Include children with textFill data
        if (node.children) {
          for (const child of node.children) {
            if (child.textFill !== undefined) {
              findings.push({
                selector: child.label,
                textFill: child.textFill,
                crossFill: child.crossFill,
                size: child.size,
                padding: child.padding || null,
              });
            }
          }
        }

        findings.push(entry);

        if (node.childDensity) {
          for (const sub of node.childDensity) flatten(sub);
        }
      }

      flatten(tree);

      // Sort: emptiest containers first (lowest fillPct), then lowest textFill
      findings.sort((a, b) => {
        const aFill = a.fillPct ?? a.textFill ?? 100;
        const bFill = b.fillPct ?? b.textFill ?? 100;
        return aFill - bFill;
      });

      return findings;
    }

    return tree;
  }

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
        } catch(e) { /* cross-origin stylesheet */ }
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
    if (neutralTint) vibes.push('tinted-neutral');
    if (harmony === 'complementary' || harmony === 'split-complementary') vibes.push('high-contrast-hue');
    if (harmony === 'analogous') vibes.push('harmonious');
    if (vibes.length === 0) vibes.push('balanced');

    // --- Phase 3: Build result ---
    const tokenColors = colors.filter(c => c.sources.includes('custom-prop'));

    const data = {
        totalColors: colors.length,
        scanned,
        tokenCount: tokenColors.length,
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

    const data = {
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
    };

    if (o.format === 'text') {
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

      return { text: lines.join('\n'), data };
    }

    return data;
  }

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
            tone: colorTone(lch.L, lch.C, lch.h),
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
          stops: stops.map(({ hex, L, C, h, tone, position }) => ({ hex, L, C, h, tone, position })),
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
    const deduped = [...sigMap.values()].map(g => {
      g.pathCount = g.paths.length;
      if (g.paths.length > 3) g.paths = g.paths.slice(0, 3);
      return g;
    });

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

    const data = {
      scanned,
      gradients: deduped,
      bgImageCount,
      bgImageSamplePath: bgImageSample,
      summary,
    };

    if (o.format === 'text') {
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
      return { text: lines.join('\n'), data };
    }

    return data;
  }


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
    const allGridFlexGaps = [...gridFlexGapMap.values()];
    const totalGaps = allGridFlexGaps.length;
    const gridFlexGaps = allGridFlexGaps.slice(0, 5);

    const data = {
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
      totalGaps,
    };

    if (o.format !== 'text') return data;

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
      lines.push('Grid/flex gaps (' + totalGaps + ' total):');
      for (const g of gridFlexGaps) {
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
      data,
    };
  }


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

  // === Tool: Discover Overlays — find visible popups, dropdowns, modals ===

  function discoverOverlays() {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const results = [];

    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (!isVisible(el)) continue;
      const s = window.getComputedStyle(el);
      const pos = s.position;

      if (pos !== 'absolute' && pos !== 'fixed' && pos !== 'sticky') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) continue;

      const zIndex = parseInt(s.zIndex) || 0;
      const isOverlay = zIndex > 0 || pos === 'fixed' || (pos === 'absolute' && rect.height > 100);
      if (!isOverlay) continue;

      const tag = el.tagName.toLowerCase();
      const classes = typeof el.className === 'string' ? el.className.trim() : '';
      const role = el.getAttribute('role') || '';

      // Categorize
      let type = 'positioned';
      if (classes.match(/modal/i) || role === 'dialog') type = 'modal';
      else if (classes.match(/dropdown|autocomplete|menu|popover|tooltip|typeahead/i)) type = 'dropdown';
      else if (tag === 'ul' && classes.match(/ui-/i)) type = 'dropdown';
      else if (classes.match(/toast|notification|alert|snackbar/i)) type = 'notification';
      else if (pos === 'fixed' && rect.width > viewportW * 0.8 && rect.height > viewportH * 0.8) type = 'modal';
      else if (pos === 'fixed') type = 'fixed-element';

      results.push({
        path: elPath(el),
        tag,
        type,
        classes: classes.substring(0, 80),
        position: pos,
        zIndex,
        box: { x: Math.round(rect.x), y: Math.round(rect.y),
          w: Math.round(rect.width), h: Math.round(rect.height) },
        childElements: el.querySelectorAll('*').length,
        hasScrollbar: el.scrollHeight > el.clientHeight,
        overflow: s.overflow,
      });
    }

    results.sort((a, b) => b.zIndex - a.zIndex || (b.box.w * b.box.h) - (a.box.w * a.box.h));

    return {
      viewport: { w: viewportW, h: viewportH },
      overlays: results.length,
      items: results,
    };
  }

  // === Tool: Motion Profile ===

  function motionProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 3000, detailed: false }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const els = root.querySelectorAll('*');

    let scanned = 0;
    const seenAnimations = new Map(); // name -> { details, elementCount }
    const seenTransitions = new Map(); // signature -> { details, elementCount }

    function parseDuration(d) {
      if (!d) return 0;
      d = d.trim();
      if (d.endsWith('ms')) return parseFloat(d);
      if (d.endsWith('s')) return parseFloat(d) * 1000;
      return parseFloat(d) || 0;
    }

    function splitCSV(val) {
      if (!val) return [];
      // Split on commas but respect parentheses (e.g. cubic-bezier(0.4, 0, 0.68, 0.06))
      const parts = [];
      let depth = 0, start = 0;
      for (let k = 0; k < val.length; k++) {
        if (val[k] === '(') depth++;
        else if (val[k] === ')') depth--;
        else if (val[k] === ',' && depth === 0) {
          parts.push(val.substring(start, k).trim());
          start = k + 1;
        }
      }
      parts.push(val.substring(start).trim());
      return parts.filter(Boolean);
    }

    function classifyAnimation(name, iterationCount, duration) {
      if (iterationCount === 'infinite') return 'loading';
      const lc = (name || '').toLowerCase();
      const ms = parseDuration(duration);
      if (/fade|slide|appear|enter|reveal/.test(lc)) return 'entrance';
      if (ms > 0 && ms <= 800 && /opacity|transform/.test(lc)) return 'entrance';
      return 'state-change';
    }

    function classifyTransition(el, properties, computedStyle) {
      const tag = el.tagName.toLowerCase();
      const isInteractive = tag === 'a' || tag === 'button'
        || el.getAttribute('role') === 'button'
        || computedStyle.cursor === 'pointer';
      if (isInteractive) return 'hover';
      const structural = ['height', 'width', 'max-height', 'max-width', 'min-height', 'min-width', 'display'];
      if (properties.some(p => structural.includes(p))) return 'structural';
      return 'visual';
    }

    for (let i = 0; i < els.length && scanned < o.maxElements; i++) {
      const el = els[i];
      if (!isVisible(el)) continue;
      scanned++;

      const s = window.getComputedStyle(el);
      const path = elPath(el);
      const tag = el.tagName.toLowerCase();

      // Check animations
      const animName = s.animationName;
      if (animName && animName !== 'none') {
        const names = splitCSV(animName);
        const durations = splitCSV(s.animationDuration);
        const timings = splitCSV(s.animationTimingFunction);
        const iterations = splitCSV(s.animationIterationCount);
        const fillModes = splitCSV(s.animationFillMode);
        const delays = splitCSV(s.animationDelay);

        for (let j = 0; j < names.length; j++) {
          const n = names[j];
          if (n === 'none') continue;
          if (seenAnimations.has(n)) {
            seenAnimations.get(n).elementCount++;
          } else {
            const dur = durations[j] || durations[0] || '0s';
            const iter = iterations[j] || iterations[0] || '1';
            seenAnimations.set(n, {
              name: n,
              duration: dur,
              timing: timings[j] || timings[0] || 'ease',
              iterationCount: iter,
              fillMode: fillModes[j] || fillModes[0] || 'none',
              delay: delays[j] || delays[0] || '0s',
              path,
              tag,
              classification: classifyAnimation(n, iter, dur),
              elementCount: 1,
            });
          }
        }
      }

      // Check transitions
      const transProp = s.transitionProperty;
      if (transProp && transProp !== 'all' && transProp !== 'none') {
        const properties = splitCSV(transProp);
        const durations = splitCSV(s.transitionDuration);
        const delays = splitCSV(s.transitionDelay);
        const timings = splitCSV(s.transitionTimingFunction);

        // Skip if all durations are 0
        const hasNonZero = durations.some(d => parseDuration(d) > 0);
        if (hasNonZero) {
          const sig = [...properties].sort().join('+') + '|' + durations.join(',') + '|' + timings.join(',');
          if (seenTransitions.has(sig)) {
            seenTransitions.get(sig).elementCount++;
          } else {
            seenTransitions.set(sig, {
              properties,
              duration: durations,
              delay: delays,
              timing: timings,
              path,
              tag,
              classification: classifyTransition(el, properties, s),
              elementCount: 1,
            });
          }
        }
      }
    }

    const animations = [...seenAnimations.values()];
    const transitions = [...seenTransitions.values()];

    // Collect all durations in ms
    const allDurationsMs = [];
    animations.forEach(a => allDurationsMs.push(parseDuration(a.duration)));
    transitions.forEach(t => t.duration.forEach(d => allDurationsMs.push(parseDuration(d))));
    const validDurations = allDurationsMs.filter(d => d > 0).sort((a, b) => a - b);

    const durationRange = { min: 0, max: 0, median: 0 };
    if (validDurations.length > 0) {
      durationRange.min = validDurations[0];
      durationRange.max = validDurations[validDurations.length - 1];
      const mid = Math.floor(validDurations.length / 2);
      durationRange.median = validDurations.length % 2 === 0
        ? (validDurations[mid - 1] + validDurations[mid]) / 2
        : validDurations[mid];
    }

    // Most common easings
    const easingCounts = new Map();
    animations.forEach(a => {
      easingCounts.set(a.timing, (easingCounts.get(a.timing) || 0) + a.elementCount);
    });
    transitions.forEach(t => {
      t.timing.forEach(fn => {
        easingCounts.set(fn, (easingCounts.get(fn) || 0) + t.elementCount);
      });
    });
    const topEasings = [...easingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([easing, count]) => ({ easing, count }));

    // Classifications
    const classifications = {};
    animations.forEach(a => {
      classifications[a.classification] = (classifications[a.classification] || 0) + 1;
    });
    transitions.forEach(t => {
      classifications[t.classification] = (classifications[t.classification] || 0) + 1;
    });

    const summary = {
      totalAnimations: animations.length,
      totalTransitions: transitions.length,
      durationRange,
      topEasings,
      classifications,
    };

    const data = {
      scanned,
      summary,
    };
    if (o.detailed) {
      data.animations = animations;
      data.transitions = transitions;
    }

    if (o.format === 'text') {
      const lines = [];
      lines.push('=== MOTION PROFILE ===');
      lines.push('');
      lines.push(`Scanned ${scanned} elements`);
      lines.push(`Animations: ${animations.length} unique (${animations.reduce((s, a) => s + a.elementCount, 0)} elements)`);
      lines.push(`Transitions: ${transitions.length} unique (${transitions.reduce((s, t) => s + t.elementCount, 0)} elements)`);
      lines.push('');

      if (animations.length > 0) {
        lines.push('Animations:');
        animations.forEach(a => {
          lines.push(`  ${a.name} — ${a.duration} ${a.timing} [${a.classification}] ×${a.elementCount} (${a.path})`);
        });
        lines.push('');
      }

      if (transitions.length > 0) {
        lines.push('Transitions:');
        transitions.forEach(t => {
          lines.push(`  ${t.properties.join(', ')} — ${t.duration.join(', ')} ${t.timing.join(', ')} [${t.classification}] ×${t.elementCount} (${t.path})`);
        });
        lines.push('');
      }

      if (validDurations.length > 0) {
        lines.push(`Duration range: ${durationRange.min}ms – ${durationRange.max}ms (median ${durationRange.median}ms)`);
      }

      if (topEasings.length > 0) {
        lines.push(`Top easings: ${topEasings.map(e => `${e.easing} (×${e.count})`).join(', ')}`);
      }

      if (Object.keys(classifications).length > 0) {
        lines.push(`Classifications: ${Object.entries(classifications).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      }

      return { text: lines.join('\n'), data };
    }

    return data;
  }

  // === Tool: Page Map — topographic text layout of the page ===

  function pageMap(opts) {
    const o = Object.assign({ scope: 'body', maxDepth: 8, foldWarnings: 'sections', patterns: true, summary: false, aboveFold: false, tree: false }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dark = detectDarkMode();

    const SEMANTIC = new Set([
      'nav','main','header','footer','section','article','aside',
      'form','table','thead','tbody','tfoot','ul','ol',
      'input','select','textarea','button','a','img','video','iframe',
      'h1','h2','h3','h4','h5','h6','label','fieldset','canvas','svg',
    ]);

    const SECTIONING = new Set([
      'body','main','header','footer','section','article','aside','nav','form',
    ]);

    function hasOwnVisuals(el) {
      const s = window.getComputedStyle(el);
      const bg = parseRGB(s.backgroundColor);
      if (bg && bg.a > 0.1) return true;
      if (s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0) return true;
      const pad = parseFloat(s.paddingTop) + parseFloat(s.paddingRight)
        + parseFloat(s.paddingBottom) + parseFloat(s.paddingLeft);
      if (pad > 16) return true;
      return false;
    }

    function isSignificant(el) {
      const tag = el.tagName.toLowerCase();
      if (SEMANTIC.has(tag)) return true;
      if (el.id || el.getAttribute('role')) return true;
      if (hasOwnVisuals(el)) return true;
      const s = window.getComputedStyle(el);
      if (['absolute','fixed','sticky'].includes(s.position)) return true;
      // Multiple visible children = structural container
      let vc = 0;
      for (const c of el.children) {
        if (isVisible(c)) { vc++; if (vc > 1) return true; }
      }
      return false;
    }

    function shouldCollapse(el) {
      if (isSignificant(el)) return false;
      let visChild = null, count = 0;
      for (const c of el.children) {
        if (isVisible(c)) { visChild = c; count++; if (count > 1) return false; }
      }
      return count === 1;
    }

    // Layout pattern detection — returns label string like " [hero]" or ""
    let heroFound = false;
    function detectPattern(el) {
      if (!o.patterns) return '';
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tag = el.tagName.toLowerCase();

      // [sticky-header]
      if ((cs.position === 'sticky' || cs.position === 'fixed') &&
          (parseFloat(cs.top) || 0) < 5 &&
          rect.width > vw * 0.8 &&
          rect.height < vh * 0.2) {
        return ' [sticky-header]';
      }

      // [nav]
      if (tag === 'nav' || el.getAttribute('role') === 'navigation') {
        return ' [nav]';
      }
      if ((tag === 'ul' || tag === 'ol') && !el.closest('article, .article, [role="article"]')) {
        const links = el.querySelectorAll(':scope > li > a, :scope > a');
        if (links.length >= 3) return ' [nav]';
      }

      // [hero] — first big section with visual weight (only once)
      if (!heroFound && rect.height > vh * 0.5 && rect.width > vw * 0.8) {
        const parent = el.parentElement;
        if (parent && (parent === document.body || parent.tagName === 'MAIN' || parent.getAttribute('role') === 'main')) {
          const siblings = [...parent.children].filter(c => isVisible(c));
          const idx = siblings.indexOf(el);
          if (idx >= 0 && idx <= 1) {
            const bg = cs.backgroundImage;
            const hasBgImage = bg && bg !== 'none';
            const hasDarkBg = luminance(effectiveBackground(el)) < 0.3;
            const hasMedia = el.querySelector('img, video, picture, canvas, svg');
            if (hasBgImage || hasDarkBg || hasMedia) {
              heroFound = true;
              return ' [hero]';
            }
          }
        }
      }

      // [card-grid ×N]
      const display = cs.display;
      const flexWrap = cs.flexWrap;
      if (display === 'grid' || display === 'inline-grid' ||
          ((display === 'flex' || display === 'inline-flex') && flexWrap === 'wrap')) {
        const children = [...el.children].filter(c => isVisible(c));
        if (children.length >= 3) {
          const tags = children.map(c => c.tagName);
          const mainTag = tags[0];
          const sameTag = tags.filter(t => t === mainTag).length;
          if (sameTag >= children.length * 0.7) {
            const widths = children.map(c => c.getBoundingClientRect().width);
            const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
            const similar = widths.every(w => Math.abs(w - avgW) / avgW < 0.25);
            if (similar) {
              if (display === 'grid' || display === 'inline-grid') {
                const cols = cs.gridTemplateColumns.split(/\s+/).filter(v => v && v !== 'none').length;
                const rows = Math.ceil(children.length / (cols || 1));
                if (cols > 1) return ' [grid ' + cols + '\u00d7' + rows + ']';
              }
              return ' [card-grid \u00d7' + children.length + ']';
            }
          }
        }
      }

      // [grid NxM]
      if (display === 'grid' || display === 'inline-grid') {
        const cols = cs.gridTemplateColumns.split(/\s+/).filter(v => v && v !== 'none').length;
        if (cols > 1) {
          const visibleKids = [...el.children].filter(c => isVisible(c)).length;
          const rows = Math.ceil(visibleKids / cols);
          if (rows > 0) return ' [grid ' + cols + '\u00d7' + rows + ']';
        }
      }

      // [carousel]
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') {
        const children = [...el.children].filter(c => isVisible(c));
        if (children.length >= 3) {
          const tags = children.map(c => c.tagName);
          const mainTag = tags[0];
          const sameTag = tags.filter(t => t === mainTag).length;
          if (sameTag >= children.length * 0.7) {
            const childrenWidth = children.reduce((sum, c) => sum + c.getBoundingClientRect().width, 0);
            if (childrenWidth > rect.width * 1.2) {
              return ' [carousel \u00d7' + children.length + ']';
            }
          }
        }
      }

      // [accordion]
      if (el.querySelectorAll(':scope > details').length >= 3) {
        return ' [accordion \u00d7' + el.querySelectorAll(':scope > details').length + ']';
      }

      // [sidebar]
      if (rect.height > vh * 0.8 && rect.width > vw * 0.1 && rect.width < vw * 0.35) {
        const parent = el.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter(c => c !== el && isVisible(c));
          const widerSibling = siblings.some(s => s.getBoundingClientRect().width > rect.width * 1.5);
          if (widerSibling) return ' [sidebar]';
        }
      }

      return '';
    }

    function elLabel(el) {
      const tag = el.tagName.toLowerCase();
      let name = tag;
      if (el.id) name += '#' + el.id;
      else {
        const cls = typeof el.className === 'string'
          ? el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('ui-state')).slice(0, 2).join('.')
          : '';
        if (cls) name += '.' + cls;
      }
      // Layout pattern label
      const pat = detectPattern(el);
      if (pat) name += pat;
      // Semantic hints for interactive/content elements
      if (tag === 'input') {
        const type = el.type || 'text';
        const val = el.value ? ' "' + el.value.substring(0, 20) + '"' : '';
        name += '[' + type + ']' + val;
      } else if (tag === 'button' || (tag === 'a' && el.textContent?.trim())) {
        const text = el.textContent.trim().substring(0, 20);
        if (text) name += ' "' + text + '"';
      } else if (tag === 'img') {
        const alt = el.alt || el.src?.split('/').pop() || '';
        name += ' "' + alt.substring(0, 20) + '"';
      }
      return name;
    }

    function spatialDesc(rect) {
      const parts = [];
      const wp = Math.round(rect.width / vw * 100);
      const hp = Math.round(rect.height / vh * 100);
      const yp = Math.round(rect.top / vh * 100);
      const xp = Math.round(rect.left / vw * 100);
      const xr = Math.round((vw - rect.right) / vw * 100);

      // Width
      if (wp > 95) parts.push('full-width');
      else if (wp > 45 && wp < 55) parts.push('half-width');
      else parts.push('w:' + wp + '%');

      // Height (only if notable)
      if (hp > 150) parts.push('h:' + hp + '% of viewport!');
      else if (hp > 5) parts.push('h:' + hp + '%');

      // Y position
      if (rect.top < -10) parts.push(Math.abs(Math.round(rect.top)) + 'px above viewport');
      else if (yp <= 2) parts.push('top');
      else parts.push('y:' + yp + '%');

      // X alignment
      if (wp <= 95) {
        if (xp < 3) parts.push('left-aligned');
        else if (xr < 3) parts.push('right-aligned');
        else if (Math.abs(xp - xr) < 5) parts.push('centered');
        else parts.push('x:' + xp + '%');
      }

      return parts.join(', ');
    }

    function getWarnings(el, rect, depth) {
      const s = window.getComputedStyle(el);
      const warns = [];

      // Overflows parent
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement) {
        const pRect = parent.getBoundingClientRect();
        if (pRect.width > 50 && rect.width > pRect.width * 1.3) {
          warns.push('\u26a0 overflows parent (' + Math.round(rect.width / pRect.width * 100) + '% of parent width)');
        }
      }

      // Extends past viewport
      if (rect.bottom > vh * 2 && o.foldWarnings !== 'none') {
        const isSection = o.foldWarnings === 'all' || SECTIONING.has(el.tagName.toLowerCase()) ||
          el.parentElement === document.body ||
          el.parentElement === root ||
          (el.parentElement && el.parentElement.tagName === 'MAIN');
        if (isSection) {
          warns.push('\u26a0 extends ' + Math.round((rect.bottom - vh) / vh * 100) + '% below fold');
        }
      }
      if (rect.right > vw * 1.1) {
        warns.push('\u26a0 extends ' + Math.round((rect.right - vw) / vw * 100) + '% past right edge');
      }

      // Tall content with no scroll
      if (el.scrollHeight > el.clientHeight * 1.5 && el.scrollHeight > vh
        && s.overflow !== 'auto' && s.overflow !== 'scroll'
        && s.overflowY !== 'auto' && s.overflowY !== 'scroll') {
        warns.push('\u26a0 no scroll constraint (overflow:' + s.overflow + ')');
      }

      // Theme escape
      if (dark.isDark) {
        const bg = parseRGB(s.backgroundColor);
        if (bg && bg.a > 0.1 && luminance(bg) > 0.4) {
          warns.push('\u26a0 theme escape (white bg on dark page)');
        }
      }

      return warns;
    }

    // --- Tree builder ---

    function buildNode(el, depth) {
      if (depth > o.maxDepth || !isVisible(el)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;

      // Collapse through insignificant single-child wrappers
      if (shouldCollapse(el)) {
        const child = Array.from(el.children).find(c => isVisible(c));
        if (child) return buildNode(child, depth);
      }

      const tag = el.tagName.toLowerCase();
      const s = window.getComputedStyle(el);
      const overlay = ['absolute','fixed'].includes(s.position) && rect.height > 50;
      const node = {
        label: elLabel(el),
        spatial: spatialDesc(rect),
        warnings: getWarnings(el, rect, depth),
        overlay,
        children: [],
      };

      // Table: summarize columns and rows, don't recurse
      if (tag === 'table') {
        const ths = el.querySelectorAll('th');
        const rows = el.querySelectorAll('tbody tr');
        node.summary = ths.length + ' cols \u00d7 ' + rows.length + ' rows';
        if (ths.length > 0 && ths.length <= 12) {
          node.columns = Array.from(ths).map(th => th.textContent.trim().substring(0, 15));
        }
        return node;
      }

      // Large list: summarize count, sample first/last
      if ((tag === 'ul' || tag === 'ol') && el.children.length > 10) {
        const items = el.querySelectorAll(':scope > li');
        node.summary = items.length + ' items';
        if (items.length > 0) {
          const first = (items[0].textContent?.trim() || '').substring(0, 50);
          const last = (items[items.length - 1].textContent?.trim() || '').substring(0, 50);
          node.sample = [first, last];
        }
        return node;
      }

      // Recurse into visible children
      for (const child of el.children) {
        const childNode = buildNode(child, depth + 1);
        if (childNode) node.children.push(childNode);
      }

      return node;
    }

    // --- Text renderer ---

    function render(node, prefix, isLast, depth) {
      const lines = [];
      const branch = depth === 0 ? '' : (isLast ? '\u2514\u2500 ' : '\u251c\u2500 ');
      const cont   = depth === 0 ? '' : (isLast ? '   '           : '\u2502  ');

      let line = prefix + branch;
      if (node.overlay) line += '\u2b21 ';
      line += node.label;
      const padLen = Math.max(1, 46 - line.length);
      line += ' ' + '\u00b7'.repeat(padLen) + ' ' + node.spatial;
      lines.push(line);

      const cp = prefix + cont;
      for (const w of node.warnings) lines.push(cp + '  ' + w);
      if (node.summary) lines.push(cp + '  ' + node.summary);
      if (node.columns) lines.push(cp + '  [' + node.columns.join(' | ') + ']');
      if (node.sample) lines.push(cp + '  "' + node.sample[0] + '" \u2026 "' + node.sample[1] + '"');

      for (let i = 0; i < node.children.length; i++) {
        lines.push(...render(node.children[i], cp, i === node.children.length - 1, depth + 1));
      }
      return lines;
    }

    // --- Assemble output ---

    const tree = buildNode(root, 0);

    // Flat landmark mode (default)
    if (!o.tree && !o.summary && !o.aboveFold) {
      if (!tree) return [];
      const LANDMARKS = new Set(['nav','main','header','footer','section','article','aside','form','table','h1','h2','h3','h4','h5','h6']);
      const landmarks = [];
      function collectLandmarks(node, depth) {
        const tag = node.label.split(/[#.\s\[]/)[0];
        const hasRole = node.label.includes('[') && !node.label.includes('[grid') && !node.label.includes('[card-grid') && !node.label.includes('[carousel') && !node.label.includes('[accordion') && !node.label.includes('[sidebar') && !node.label.includes('[sticky-header') && !node.label.includes('[hero') && !node.label.includes('[nav]');
        if (LANDMARKS.has(tag) || hasRole) {
          landmarks.push({ tag, label: node.label, depth, spatial: node.spatial, childCount: node.children ? node.children.length : 0 });
        }
        if (node.children) {
          for (const child of node.children) collectLandmarks(child, depth + 1);
        }
      }
      const nodes = tree.children && tree.children.length > 0 ? tree.children : [tree];
      for (const n of nodes) collectLandmarks(n, 0);
      return landmarks;
    }

    let header = 'PAGE ' + vw + '\u00d7' + vh;
    if (dark.isDark) header += ' [dark mode]';

    // Total page height
    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const pageVH = Math.round(docH / vh * 100);
    header += ' (' + pageVH + '% of viewport)';

    if (!tree) return header + '\n(empty)';

    // Summary mode: top-level sections only with size/position
    if (o.summary || o.aboveFold) {
      const nodes = tree.children.length > 0 ? tree.children : [tree];
      const slines = [header, ''];
      for (const n of nodes) {
        if (o.aboveFold) {
          const ym = n.spatial.match(/y:(\d+)%/);
          if (ym && parseInt(ym[1], 10) > 100) break;
        }
        const pat = n.label.match(/\[.*?\]/)?.[0] || '';
        const warnCount = n.warnings.length;
        let sline = n.label.replace(/\s*\[.*?\]/, '');
        sline += ' \u00b7\u00b7 ' + n.spatial;
        if (pat) sline += '  ' + pat;
        if (warnCount) sline += '  (' + warnCount + ' warning' + (warnCount > 1 ? 's' : '') + ')';
        const kidCount = n.children ? n.children.length : 0;
        if (kidCount) sline += '  [' + kidCount + ' children]';
        slines.push(sline);
      }
      return slines.join('\n');
    }

    const nodes = tree.children.length > 0 ? tree.children : [tree];
    const lines = [];
    for (let i = 0; i < nodes.length; i++) {
      lines.push(...render(nodes[i], '', i === nodes.length - 1, 0));
    }

    // Insert fold marker before the first line whose y-position exceeds 100%
    const foldRe = /y:(\d+)%/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(foldRe);
      if (m && parseInt(m[1], 10) > 100) {
        lines.splice(i, 0, '\u2500\u2500\u2500\u2500 fold \u2500\u2500\u2500\u2500');
        break;
      }
    }

    return header + '\n' + lines.join('\n');
  }

  // === Bezier curve interpolation ===

  // Named easing presets: [x1, y1, x2, y2] control points
  const EASING = {
    linear:    [0, 0, 1, 1],
    ease:      [0.25, 0.1, 0.25, 1],
    easeIn:    [0.42, 0, 1, 1],
    easeOut:   [0, 0, 0.58, 1],
    easeInOut: [0.42, 0, 0.58, 1],
    // Gesture-specific: fast start, long deceleration (flick)
    flick:     [0.2, 0.8, 0.3, 1],
    // Deliberate scroll: even acceleration
    scroll:    [0.4, 0, 0.6, 1],
  };

  function cubicBezier(t, p1, p2) {
    // Attempt Newton-Raphson to solve for bezier parameter u at time t
    // Then evaluate the y-coordinate
    const [x1, y1, x2, y2] = [...p1, ...p2];
    // Bezier x(u) = 3(1-u)^2*u*x1 + 3(1-u)*u^2*x2 + u^3
    function bx(u) { return 3*(1-u)*(1-u)*u*x1 + 3*(1-u)*u*u*x2 + u*u*u; }
    function by(u) { return 3*(1-u)*(1-u)*u*y1 + 3*(1-u)*u*u*y2 + u*u*u; }
    function bxPrime(u) { return 3*(1-u)*(1-u)*x1 + 6*(1-u)*u*(x2-x1) + 3*u*u*(1-x2); }

    // Newton-Raphson to find u where bx(u) ≈ t
    let u = t;
    for (let i = 0; i < 8; i++) {
      const dx = bx(u) - t;
      if (Math.abs(dx) < 1e-6) break;
      const deriv = bxPrime(u);
      if (Math.abs(deriv) < 1e-6) break;
      u -= dx / deriv;
      u = Math.max(0, Math.min(1, u));
    }
    return by(u);
  }

  function resolveEasing(curve) {
    if (!curve || curve === 'linear') return null;
    if (typeof curve === 'string') {
      const preset = EASING[curve];
      if (!preset) return null;
      if (curve === 'linear') return null;
      return [[preset[0], preset[1]], [preset[2], preset[3]]];
    }
    // Array of 4 numbers: [x1, y1, x2, y2]
    if (Array.isArray(curve) && curve.length === 4) {
      return [[curve[0], curve[1]], [curve[2], curve[3]]];
    }
    return null;
  }

  function interpolate(t, easing) {
    if (!easing) return t; // linear
    return cubicBezier(t, easing[0], easing[1]);
  }

  // === Tool: Scroll Containment Audit ===
  //
  // Two modes:
  //   scrollAudit()          — auto-discover ALL scroll containers on the page + detect traps
  //   scrollAudit(selector)  — audit specific element(s)
  //
  // A "scroll trap" is a container with overflow:auto/scroll that has very little
  // scrollable content (< trapThreshold px). On mobile, touch gestures land on it,
  // it consumes the gesture, and scroll doesn't propagate to the page.

  function scrollAudit(selector, opts) {
    const o = Object.assign({ trapThreshold: 50 }, opts);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // --- Discover all scroll containers on the page ---
    function findScrollContainers() {
      const containers = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node;
      while ((node = walker.nextNode())) {
        if (!isVisible(node)) continue;
        const s = getComputedStyle(node);
        const ovX = s.overflowX;
        const ovY = s.overflowY;
        if (['auto', 'scroll'].includes(ovX) || ['auto', 'scroll'].includes(ovY)) {
          containers.push(node);
        }
      }
      return containers;
    }

    const targets = selector
      ? Array.from(document.querySelectorAll(selector))
      : findScrollContainers();

    // --- Check if the page itself scrolls ---
    const html = document.documentElement;
    const pageScrollable = html.scrollHeight > vh;
    const pageDelta = html.scrollHeight - vh;

    // --- Audit each container ---
    const items = [];
    const traps = [];

    for (const el of targets) {
      if (!isVisible(el)) continue;
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const scrollH = el.scrollHeight;
      const clientH = el.clientHeight;
      const scrollW = el.scrollWidth;
      const clientW = el.clientWidth;
      const deltaY = scrollH - clientH;
      const deltaX = scrollW - clientW;
      const ovX = s.overflowX;
      const ovY = s.overflowY;
      const isScroller = ['auto', 'scroll'].includes(ovX) || ['auto', 'scroll'].includes(ovY);
      const ta = s.touchAction;
      const osb = s.overscrollBehavior;
      const pos = s.position;
      const maxH = s.maxHeight;

      const issues = [];

      // --- Scroll trap detection ---
      // Container has overflow:auto/scroll, tiny scrollable delta, and sits
      // inside a larger scrollable context (the page or another scroller).
      // On mobile, touch gestures hitting this element get consumed by the
      // tiny scroll range and don't propagate to the page.
      if (isScroller && deltaY > 0 && deltaY <= o.trapThreshold) {
        // How much of the viewport does this cover?
        const viewportCoverage = Math.round(rect.height / vh * 100);
        const issue = {
          type: 'scroll-trap', severity: 'critical',
          detail: `overflow: ${ovY} with only ${deltaY}px of scroll range — will trap touch gestures. ` +
            `Covers ${viewportCoverage}% of viewport` +
            (pageScrollable ? ` (page has ${pageDelta}px of scroll that won't be reachable here).` : '.'),
          delta: deltaY,
          viewportCoverage,
        };
        issues.push(issue);
        traps.push({
          path: elPath(el),
          delta: deltaY,
          viewportCoverage,
          rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) },
        });
      }

      // No max-height on large element
      const hasMaxHeight = maxH && maxH !== 'none' && maxH !== '0px';
      if (!hasMaxHeight && rect.height > vh * 0.5 && !isScroller) {
        issues.push({ type: 'no-max-height', severity: 'high',
          detail: `Element is ${Math.round(rect.height)}px tall (${Math.round(rect.height / vh * 100)}% of viewport) with no max-height` });
      }

      // Missing overflow on large content
      if (!isScroller && (scrollH > clientH + 2 || rect.height > vh * 0.5)) {
        issues.push({ type: 'no-overflow-scroll', severity: 'high',
          detail: `overflow: ${ovY} — content ${scrollH > clientH + 2 ? 'overflows' : 'may overflow'} without scroll` });
      }

      // touch-action: none blocks everything
      if (ta === 'none') {
        issues.push({ type: 'touch-action-none', severity: 'medium',
          detail: 'touch-action: none blocks all touch gestures' });
      }

      // Missing overscroll-behavior on scroller
      if (isScroller && (!osb || osb === 'auto auto' || osb === 'auto')) {
        issues.push({ type: 'no-overscroll-containment', severity: 'low',
          detail: `overscroll-behavior: ${osb || 'auto'} — scroll chains to parent at boundary` });
      }

      // Positioned overlay without scroll
      if (['absolute', 'fixed'].includes(pos) && !isScroller && rect.height > vh * 0.3) {
        issues.push({ type: 'overlay-no-scroll', severity: 'high',
          detail: `Positioned overlay (${pos}) with no scroll containment` });
      }

      items.push({
        path: elPath(el),
        tag: el.tagName.toLowerCase(),
        box: { w: Math.round(rect.width), h: Math.round(rect.height) },
        scrollDelta: { x: deltaX, y: deltaY },
        scrollable: { x: deltaX > 0, y: deltaY > 0 },
        position: pos,
        isScroller,
        issueCount: issues.length,
        issues,
      });
    }

    return {
      page: { scrollable: pageScrollable, scrollDelta: pageDelta },
      scanned: items.length,
      withIssues: items.filter(r => r.issueCount > 0).length,
      traps: traps.length > 0 ? traps : null,
      items,
    };
  }

  // === Tool: Event Map — discover all event handlers on an element ===

  function eventMap(selector) {
    const el = document.querySelector(selector);
    if (!el) return { error: 'No element matches: ' + selector };

    const result = { path: elPath(el), handlers: {} };

    // jQuery handlers (if jQuery is present)
    if (window.jQuery && jQuery._data) {
      const jqEvents = jQuery._data(el, 'events') || {};
      for (const [eventName, handlers] of Object.entries(jqEvents)) {
        if (!result.handlers[eventName]) result.handlers[eventName] = [];
        for (const h of handlers) {
          result.handlers[eventName].push({
            source: 'jquery',
            namespace: h.namespace || null,
            selector: h.selector || null,
            preview: h.handler.toString().substring(0, 120),
          });
        }
      }
    }

    // Native getEventListeners (Chrome DevTools protocol — only available in console)
    // We can't access these from page JS, but we can check for on* attributes
    const onAttrs = [];
    for (const attr of el.attributes) {
      if (attr.name.startsWith('on')) {
        onAttrs.push({ event: attr.name.substring(2), value: attr.value.substring(0, 80) });
      }
    }
    if (onAttrs.length > 0) result.inlineHandlers = onAttrs;

    // Classify touch readiness
    const hasTouch = Object.keys(result.handlers).some(k => k.startsWith('touch'));
    const hasMouse = Object.keys(result.handlers).some(k =>
      ['mousedown', 'mouseup', 'mouseover', 'mouseout', 'mousemove', 'click'].includes(k));
    const hasPointer = Object.keys(result.handlers).some(k => k.startsWith('pointer'));

    result.touchReady = hasTouch || hasPointer;
    result.mouseOnly = hasMouse && !hasTouch && !hasPointer;
    result.eventTypes = Object.keys(result.handlers).sort();

    // Also check document-level handlers that might affect this element
    if (window.jQuery && jQuery._data) {
      const docEvents = jQuery._data(document, 'events') || {};
      const relevant = {};
      for (const [eventName, handlers] of Object.entries(docEvents)) {
        for (const h of handlers) {
          if (h.selector && el.matches(h.selector)) {
            if (!relevant[eventName]) relevant[eventName] = [];
            relevant[eventName].push({
              source: 'jquery-delegated',
              namespace: h.namespace || null,
              selector: h.selector,
            });
          }
        }
      }
      if (Object.keys(relevant).length > 0) result.delegatedHandlers = relevant;
    }

    return result;
  }

  // === Tool: Touch Targets — inventory interactive elements and classify touch readiness ===

  function touchTargets(opts) {
    const o = Object.assign({ scope: 'body' }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Find interactive elements
    const selectors = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[tabindex]', '[onclick]', '[data-toggle]', '[data-target]',
      '.dropdown-toggle', '.ui-autocomplete-input',
    ];
    const elements = root.querySelectorAll(selectors.join(','));
    const targets = [];

    for (const el of elements) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      // Only in or near viewport
      if (rect.bottom < -100 || rect.top > vh + 100) continue;

      const tag = el.tagName.toLowerCase();
      const s = window.getComputedStyle(el);

      // Touch target size (WCAG recommends 44x44 CSS pixels minimum)
      const tooSmall = rect.width < 44 || rect.height < 44;

      // Check for associated widgets
      let widget = null;
      if (el.classList.contains('ui-autocomplete-input')) widget = 'autocomplete';
      else if (el.getAttribute('data-toggle') === 'dropdown') widget = 'dropdown';
      else if (el.getAttribute('data-toggle') === 'modal') widget = 'modal';
      else if (el.classList.contains('hasDatepicker')) widget = 'datepicker';

      // jQuery event check
      let eventSummary = null;
      if (window.jQuery && jQuery._data) {
        const evts = jQuery._data(el, 'events') || {};
        const names = Object.keys(evts);
        if (names.length > 0) {
          const hasTouch = names.some(n => n.startsWith('touch'));
          eventSummary = {
            touchReady: hasTouch,
            mouseOnly: !hasTouch && names.some(n => ['mousedown', 'mouseup', 'click', 'mouseover'].includes(n)),
          };
        }
      }

      targets.push({
        path: elPath(el),
        tag,
        type: el.type || null,
        text: (el.textContent || '').trim().substring(0, 40) || null,
        widget,
        box: {
          w: Math.round(rect.width), h: Math.round(rect.height),
          cx: +((rect.x + rect.width / 2) / vw * 100).toFixed(1),
          cy: +((rect.y + rect.height / 2) / vh * 100).toFixed(1),
        },
        tooSmall,
        events: eventSummary,
      });
    }

    return {
      count: targets.length,
      tooSmall: targets.filter(t => t.tooSmall).length,
      withWidgets: targets.filter(t => t.widget).length,
      mouseOnly: targets.filter(t => t.events?.mouseOnly).length,
      targets: o.all ? targets : targets.filter(t => t.tooSmall),
    };
  }

  // === Tool: Gesture Planner — compute CDP-ready touch event sequences ===

  // Returns an array of CDP Input.dispatchTouchEvent steps.
  // Execute with browser_run_code + CDPSession.
  //
  // Supported gestures:
  //   touchScroll  — single-finger scroll on/near an element
  //   touchTap     — tap an element (touchstart → pause → touchend → click synthesis)
  //   touchDrag    — drag from one point to another
  //   touchHold    — long press
  //
  // Coordinates: viewport percentages by default, or px if `{px: true}`
  // Curves: named presets or [x1,y1,x2,y2] cubic-bezier

  function gesturePlan(type, opts) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    function resolvePoint(spec) {
      if (typeof spec === 'string') {
        // Selector — use center of element
        const el = document.querySelector(spec);
        if (!el) return { error: 'No element: ' + spec };
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      if (spec.px) return { x: spec.x, y: spec.y };
      // Percentage of viewport
      return { x: Math.round(spec.x / 100 * vw), y: Math.round(spec.y / 100 * vh) };
    }

    const steps = [];
    const fps = opts?.fps || 60;
    const frameMs = Math.round(1000 / fps);

    if (type === 'touchScroll') {
      // opts: { target, deltaX?, deltaY, duration?, curve?, fps? }
      const o = Object.assign({ deltaX: 0, deltaY: -200, duration: 300, curve: 'scroll' }, opts);
      const start = resolvePoint(o.target || { x: 50, y: 50 });
      if (start.error) return { error: start.error };

      const easing = resolveEasing(o.curve);
      const frames = Math.max(2, Math.round(o.duration / frameMs));

      steps.push({ type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }], wait: frameMs });

      for (let i = 1; i <= frames; i++) {
        const t = i / frames;
        const progress = interpolate(t, easing);
        steps.push({
          type: 'touchMove',
          touchPoints: [{
            x: Math.round(start.x + o.deltaX * progress),
            y: Math.round(start.y + o.deltaY * progress),
          }],
          wait: frameMs,
        });
      }

      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else if (type === 'touchTap') {
      // opts: { target, holdMs? }
      const o = Object.assign({ holdMs: 50 }, opts);
      const pt = resolvePoint(o.target || { x: 50, y: 50 });
      if (pt.error) return { error: pt.error };

      steps.push({ type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }], wait: o.holdMs });
      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else if (type === 'touchDrag') {
      // opts: { from, to, duration?, curve?, fps? }
      const o = Object.assign({ duration: 400, curve: 'ease', fps: 60 }, opts);
      const from = resolvePoint(o.from);
      const to = resolvePoint(o.to);
      if (from.error) return { error: from.error };
      if (to.error) return { error: to.error };

      const easing = resolveEasing(o.curve);
      const frames = Math.max(2, Math.round(o.duration / frameMs));
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      steps.push({ type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }], wait: frameMs });

      for (let i = 1; i <= frames; i++) {
        const t = i / frames;
        const progress = interpolate(t, easing);
        steps.push({
          type: 'touchMove',
          touchPoints: [{
            x: Math.round(from.x + dx * progress),
            y: Math.round(from.y + dy * progress),
          }],
          wait: frameMs,
        });
      }

      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else if (type === 'touchHold') {
      // opts: { target, holdMs? }
      const o = Object.assign({ holdMs: 600 }, opts);
      const pt = resolvePoint(o.target || { x: 50, y: 50 });
      if (pt.error) return { error: pt.error };

      steps.push({ type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }], wait: o.holdMs });
      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else {
      return { error: 'Unknown gesture type: ' + type };
    }

    return {
      gesture: type,
      steps,
      stepCount: steps.length,
      totalMs: steps.reduce((sum, s) => sum + (s.wait || 0), 0),
      viewport: { w: vw, h: vh },
    };
  }

  // === Tool: Gesture Capture — instrument touch/mouse/focus events for analysis ===

  let _captureLog = null;
  let _captureCleanup = null;
  let _captureScrollSnap = null; // snapshot of all scroller positions at capture start

  function gestureCapture(selector, opts) {
    const o = Object.assign({ events: ['touchstart','touchmove','touchend','mousedown','mouseup','click','focus','blur','scroll'] }, opts);

    // Clean up any previous capture
    if (_captureCleanup) _captureCleanup();

    _captureLog = [];
    const removers = [];
    const startTime = Date.now();

    // Snapshot scroll positions of ALL overflow containers + window at start
    _captureScrollSnap = { windowScrollY: window.scrollY, containers: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let wNode;
    while ((wNode = walker.nextNode())) {
      const s = getComputedStyle(wNode);
      if (['auto', 'scroll'].includes(s.overflowX) || ['auto', 'scroll'].includes(s.overflowY)) {
        if (wNode.scrollHeight > wNode.clientHeight || wNode.scrollWidth > wNode.clientWidth) {
          _captureScrollSnap.containers.push({
            el: wNode,
            path: elPath(wNode),
            scrollTop: wNode.scrollTop,
            scrollLeft: wNode.scrollLeft,
            deltaY: wNode.scrollHeight - wNode.clientHeight,
          });
        }
      }
    }

    // Element-level events
    const el = selector ? document.querySelector(selector) : null;
    const listenTarget = el || document;

    for (const eventName of o.events) {
      const handler = (e) => {
        const entry = {
          event: eventName,
          t: Date.now() - startTime,
          target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
        };
        if (e.touches) entry.touches = e.touches.length;
        if (e.touches && e.touches.length > 0) {
          entry.x = Math.round(e.touches[0].clientX); entry.y = Math.round(e.touches[0].clientY);
        } else if (e.clientX !== undefined) {
          entry.x = Math.round(e.clientX); entry.y = Math.round(e.clientY);
        }
        if (eventName === 'scroll') {
          entry.scrollTop = (e.target === document ? window.scrollY : e.target.scrollTop);
        }
        if (eventName === 'blur' || eventName === 'focus') {
          entry.activeElement = document.activeElement?.tagName + '#' + (document.activeElement?.id || '');
        }
        entry.defaultPrevented = e.defaultPrevented;
        _captureLog.push(entry);
      };
      listenTarget.addEventListener(eventName, handler, { capture: true, passive: true });
      removers.push(() => listenTarget.removeEventListener(eventName, handler, { capture: true }));
    }

    // Also capture on window for scroll
    if (o.events.includes('scroll')) {
      const scrollHandler = () => {
        _captureLog.push({ event: 'window-scroll', t: Date.now() - startTime, scrollY: window.scrollY });
      };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      removers.push(() => window.removeEventListener('scroll', scrollHandler));
    }

    _captureCleanup = () => { removers.forEach(r => r()); _captureCleanup = null; };

    return { capturing: true, target: selector || 'document', events: o.events };
  }

  function gestureResults() {
    const log = _captureLog || [];
    if (_captureCleanup) _captureCleanup();
    _captureLog = null;
    const snap = _captureScrollSnap;
    _captureScrollSnap = null;

    // Analyze the log
    const eventCounts = {};
    for (const entry of log) {
      eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
    }

    const blurEvents = log.filter(e => e.event === 'blur');
    const scrollEvents = log.filter(e => e.event === 'window-scroll');
    const touchEvents = log.filter(e => e.event.startsWith('touch'));
    const mouseEvents = log.filter(e => ['mousedown', 'mouseup', 'click'].includes(e.event));

    // --- Hit context: what element did the touch land on? ---
    let hitContext = null;
    const firstTouch = touchEvents.find(e => e.event === 'touchstart');
    if (firstTouch && firstTouch.x !== undefined) {
      const hitEl = document.elementFromPoint(firstTouch.x, firstTouch.y);
      if (hitEl) {
        // Walk up to find the nearest scroll container
        let scrollParent = null;
        let walk = hitEl;
        while (walk && walk !== document.documentElement) {
          const s = getComputedStyle(walk);
          if (['auto', 'scroll'].includes(s.overflowX) || ['auto', 'scroll'].includes(s.overflowY)) {
            const deltaY = walk.scrollHeight - walk.clientHeight;
            scrollParent = {
              path: elPath(walk),
              overflow: s.overflowY,
              scrollDelta: deltaY,
              isTrap: deltaY > 0 && deltaY <= 50,
            };
            break;
          }
          walk = walk.parentElement;
        }
        hitContext = {
          touchPoint: { x: firstTouch.x, y: firstTouch.y },
          element: elPath(hitEl),
          scrollParent,
        };
      }
    }

    // --- Scroll deltas: compare before/after for all containers ---
    let scrollDeltas = null;
    if (snap) {
      const windowDelta = window.scrollY - snap.windowScrollY;
      const containerDeltas = [];
      for (const c of snap.containers) {
        const now = c.el.scrollTop;
        const delta = now - c.scrollTop;
        if (delta !== 0) {
          containerDeltas.push({
            path: c.path,
            before: c.scrollTop,
            after: now,
            moved: delta,
            maxRange: c.deltaY,
            consumedAll: now >= c.deltaY || now <= 0,
          });
        }
      }
      scrollDeltas = {
        window: { before: snap.windowScrollY, after: window.scrollY, moved: windowDelta },
        containers: containerDeltas,
        trapped: containerDeltas.length > 0 && windowDelta === 0,
      };
    }

    return {
      entryCount: log.length,
      eventCounts,
      blurFired: blurEvents.length > 0,
      blurEvents,
      scrolled: scrollEvents.length > 0,
      finalScrollY: scrollEvents.length > 0 ? scrollEvents[scrollEvents.length - 1].scrollY : null,
      hitContext,
      scrollDeltas,
      touchSequence: touchEvents.map(e => ({ event: e.event, t: e.t, touches: e.touches })),
      mouseSequence: mouseEvents.map(e => ({ event: e.event, t: e.t, defaultPrevented: e.defaultPrevented })),
      log,
    };
  }

  // === platformProfile: CMS, libraries, meta tags, analytics ===

  function platformProfile(opts) {
    opts = opts || {};
    const wantText = opts.format === 'text';
    const data = { cms: null, theme: null, generator: null, libraries: [], analytics: [], meta: {} };
    const lines = wantText ? [] : null;

    // Meta generator tag
    const gen = document.querySelector('meta[name="generator"]');
    if (gen) {
      data.generator = gen.content;
      if (wantText) lines.push('Generator: ' + gen.content);
    }

    // Shopify detection
    if (window.Shopify) {
      data.cms = 'Shopify';
      if (window.Shopify.theme) {
        data.theme = { name: window.Shopify.theme.name, id: window.Shopify.theme.id, role: window.Shopify.theme.role };
      }
      if (wantText) lines.push('CMS: Shopify' + (data.theme ? ' (' + data.theme.name + ', ' + data.theme.role + ')' : ''));
    }

    // WordPress detection
    if (document.querySelector('meta[name="generator"][content*="WordPress"]') ||
        document.querySelector('link[href*="wp-content"]') ||
        document.querySelector('script[src*="wp-includes"]')) {
      data.cms = data.cms || 'WordPress';
      const wpGen = document.querySelector('meta[name="generator"][content*="WordPress"]');
      if (wpGen) data.generator = wpGen.content;
      if (wantText) lines.push('CMS: WordPress' + (data.generator ? ' (' + data.generator + ')' : ''));
    }

    // Squarespace
    if (window.Static?.SQUARESPACE_CONTEXT || document.querySelector('meta[name="generator"][content*="Squarespace"]')) {
      data.cms = data.cms || 'Squarespace';
      if (wantText) lines.push('CMS: Squarespace');
    }

    // Wix
    if (document.querySelector('meta[name="generator"][content*="Wix"]') || window.wixBiSession) {
      data.cms = data.cms || 'Wix';
      if (wantText) lines.push('CMS: Wix');
    }

    if (!data.cms && wantText) lines.push('CMS: not detected');

    // JS library detection
    const libs = [];
    if (window.jQuery) libs.push('jQuery ' + (window.jQuery.fn?.jquery || '?'));
    if (window.React || document.querySelector('[data-reactroot], [data-reactid]')) libs.push('React');
    if (window.Vue || document.querySelector('[data-v-]')) libs.push('Vue');
    if (window.angular || document.querySelector('[ng-app], [data-ng-app]')) libs.push('Angular');
    if (window.Swiper) libs.push('Swiper');
    if (window.Flickity) libs.push('Flickity');
    if (window.gsap || window.TweenMax) libs.push('GSAP');
    if (window.Lodash || window._?.VERSION) libs.push('Lodash ' + (window._?.VERSION || ''));
    if (window.Alpine) libs.push('Alpine.js');
    if (window.htmx) libs.push('htmx');
    if (window.Turbo || window.Turbolinks) libs.push('Turbo');
    if (window.bootstrap) libs.push('Bootstrap');
    if (window.tailwind || document.querySelector('link[href*="tailwind"], script[src*="tailwind"]')) libs.push('Tailwind CSS');
    data.libraries = libs;
    if (libs.length && wantText) lines.push('Libraries: ' + libs.join(', '));

    // Cookie consent / CMP
    const cmps = [];
    if (window.Termly) cmps.push('Termly');
    if (window.OneTrust) cmps.push('OneTrust');
    if (window.CookieConsent || window.cookieconsent) cmps.push('CookieConsent');
    if (window.__cmp) cmps.push('CMP (IAB)');
    if (document.querySelector('[class*="cookie-banner"], [id*="cookie-banner"], [class*="consent"]')) cmps.push('cookie banner (DOM)');
    if (cmps.length) {
      data.cookieConsent = cmps;
      if (wantText) lines.push('Cookie consent: ' + cmps.join(', '));
    }

    // Analytics / tracking pixels by script src and known globals
    const analyticsMap = new Map();
    const scriptSrcs = [...document.querySelectorAll('script[src]')].map(s => s.src);
    const patterns = [
      [/google-analytics\.com|googletagmanager\.com|gtag/, 'Google Analytics/GTM'],
      [/facebook\.net|fbevents|connect\.facebook/, 'Meta Pixel'],
      [/klaviyo\.com/, 'Klaviyo'],
      [/hotjar\.com/, 'Hotjar'],
      [/segment\.com|cdn\.segment/, 'Segment'],
      [/mixpanel\.com/, 'Mixpanel'],
      [/fullstory\.com/, 'FullStory'],
      [/intercom\.io/, 'Intercom'],
      [/drift\.com/, 'Drift'],
      [/tiktok\.com\/i18n/, 'TikTok Pixel'],
      [/snaptr|sc-static\.net/, 'Snap Pixel'],
      [/pinterest\.com\/ct/, 'Pinterest Tag'],
      [/bing\.com\/bat/, 'Microsoft Ads'],
      [/clarity\.ms/, 'Microsoft Clarity'],
      [/sentry\.io|browser\.sentry/, 'Sentry'],
      [/newrelic\.com|nr-data/, 'New Relic'],
      [/datadoghq\.com/, 'Datadog'],
      [/salesforce\.com|pardot\.com|sfdc/, 'Salesforce'],
      [/hubspot\.com|hs-scripts/, 'HubSpot'],
      [/mailchimp\.com/, 'Mailchimp'],
      [/zendesk\.com/, 'Zendesk'],
      [/freshdesk\.com|freshchat/, 'Freshdesk'],
      [/tawk\.to/, 'Tawk.to'],
      [/livechat|livechatinc/, 'LiveChat'],
    ];
    for (const src of scriptSrcs) {
      for (const [re, name] of patterns) {
        if (re.test(src)) analyticsMap.set(name, true);
      }
    }
    // Also check known globals
    if (window.ga || window.gtag) analyticsMap.set('Google Analytics/GTM', true);
    if (window.fbq) analyticsMap.set('Meta Pixel', true);
    if (window.klaviyo || window._klOnsite) analyticsMap.set('Klaviyo', true);
    if (window.hj) analyticsMap.set('Hotjar', true);

    data.analytics = [...analyticsMap.keys()];
    if (data.analytics.length && wantText) {
      lines.push('');
      lines.push('Integrations (' + data.analytics.length + '):');
      for (const a of data.analytics) lines.push('  ' + a);
    }

    // Useful meta tags
    const metaTags = ['viewport', 'description', 'theme-color', 'robots', 'og:type', 'og:title'];
    for (const name of metaTags) {
      const el = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
      if (el) data.meta[name] = el.content;
    }
    if (Object.keys(data.meta).length && wantText) {
      lines.push('');
      lines.push('Meta:');
      for (const [k, v] of Object.entries(data.meta)) {
        lines.push('  ' + k + ': ' + v.substring(0, 80));
      }
    }

    if (wantText) return { text: lines.join('\n'), data };
    return data;
  }


  // === siteProfile: composite design system tool ===

  function siteProfile(opts) {
    var o = Object.assign({ format: 'data' }, opts);
    var results = {};
    var wantText = o.format === 'text';
    var sections = wantText ? [] : null;

    var tools = [
      ['palette', paletteProfile],
      ['typography', typographyProfile],
      ['spacing', spacingProfile],
      ['gradient', gradientProfile],
      ['motion', motionProfile],
      ['responsive', responsiveProfile],
      ['platform', platformProfile],
    ];

    for (var i = 0; i < tools.length; i++) {
      var name = tools[i][0], fn = tools[i][1];
      try {
        var r = fn(wantText ? Object.assign({}, opts, { format: 'text' }) : opts);
        results[name] = r.data || r;
        if (wantText) {
          sections.push('=== ' + name.toUpperCase() + ' ===');
          sections.push(r.text || JSON.stringify(r).substring(0, 500));
          sections.push('');
        }
      } catch (e) {
        results[name] = { error: e.message };
        if (wantText) {
          sections.push('=== ' + name.toUpperCase() + ' ===');
          sections.push('ERROR: ' + e.message);
          sections.push('');
        }
      }
    }

    if (wantText) return { text: sections.join('\n'), data: results };
    return results;
  }


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
})();
