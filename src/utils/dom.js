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
    const depth = maxDepth || 3;
    let foundId = false;
    while (node && node !== document.body && parts.length < depth) {
      let seg = node.tagName.toLowerCase();
      if (node.id) {
        seg += `#${node.id}`;
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
          parts.unshift(`${node.tagName.toLowerCase()}#${node.id}`);
          foundId = true;
          break;
        }
        node = node.parentElement;
      }
    }
    // If still no id, trim to last 2 segments
    if (!foundId && parts.length > 2) {
      parts.splice(0, parts.length - 2);
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

