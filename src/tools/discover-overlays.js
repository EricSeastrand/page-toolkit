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

