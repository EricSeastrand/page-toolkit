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

