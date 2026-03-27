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

