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
            events: names,
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
      viewport: { w: vw, h: vh },
      count: targets.length,
      tooSmall: targets.filter(t => t.tooSmall).length,
      withWidgets: targets.filter(t => t.widget).length,
      mouseOnly: targets.filter(t => t.events?.mouseOnly).length,
      targets: o.all ? targets : targets.filter(t => t.tooSmall),
    };
  }

