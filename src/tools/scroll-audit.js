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

