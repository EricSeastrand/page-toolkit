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

