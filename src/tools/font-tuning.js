  // === Tool: Font Tuning — per-element sizing recommendations ===
  //
  // Combines typography measurement with container headroom analysis.
  // For each text element: current size, max size (from headroom), and suggested size.
  // Designed for fixed-canvas contexts (slide decks) but works on any page.

  function fontTuning(opts) {
    const o = Object.assign({
      scope: 'body',
      maxElements: 200,
      // Role-based minimum floors (px) — scaled to canvas width at build time
      // Defaults are for 1920px-wide canvas (presentation slides)
      minSizes: null,
      // Breathing room: fraction of headroom to keep unused (0.15 = keep 15% as padding)
      breathingRoom: 0.15,
      // Output format: 'json' (default) or 'text'
      format: 'json',
    }, opts);

    const root = document.querySelector(o.scope) || document.body;

    // --- Canvas detection ---
    const canvas = {
      width: document.body.scrollWidth || window.innerWidth,
      height: document.body.scrollHeight || window.innerHeight,
    };

    // Scale-aware minimum floors: base values are for 1920px width
    const baseFloors = { display: 54, heading: 32, body: 22, label: 18, caption: 14 };
    const scaleFactor = canvas.width / 1920;
    const floors = o.minSizes || {};
    for (const [role, base] of Object.entries(baseFloors)) {
      if (!(role in floors)) floors[role] = Math.round(base * scaleFactor);
    }

    // --- Helpers ---
    const rd = n => +n.toFixed(1);
    const pct = (n, d) => d > 0 ? +(n / d * 100).toFixed(1) : 0;

    function parseLh(lhStr, fsPx) {
      if (!lhStr || lhStr === 'normal') return fsPx * 1.2;
      const px = parseFloat(lhStr);
      if (lhStr.endsWith('px')) return px;
      if (!isNaN(px) && px < 10) return px * fsPx;
      return px;
    }

    // Classify font role by size + tag + position
    function classifyRole(fsPx, tag, el) {
      if (fsPx >= 48 * scaleFactor) return 'display';
      if (fsPx >= 28 * scaleFactor || /^h[1-3]$/.test(tag)) return 'heading';
      if (fsPx >= 14 * scaleFactor) {
        // Distinguish body text from labels/stats
        const cs = getComputedStyle(el);
        if (cs.textTransform === 'uppercase' || cs.fontWeight >= 600) return 'label';
        return 'body';
      }
      return 'caption';
    }

    // Find the sizing-relevant container: nearest ancestor that is a flex/grid
    // container with multiple visible children (i.e., siblings compete for space).
    function findContainer(el) {
      let node = el.parentElement;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        const display = cs.display;
        if (display.includes('flex') || display === 'grid' || display === 'block') {
          // Must have at least 2 visible children to be a meaningful container
          let visKids = 0;
          for (const child of node.children) {
            if (isVisible(child)) visKids++;
            if (visKids >= 2) return node;
          }
        }
        node = node.parentElement;
      }
      return el.parentElement || root;
    }

    // Detect primary axis of a container
    function detectAxis(cs) {
      const display = cs.display;
      if (display.includes('flex')) {
        const dir = cs.flexDirection;
        return (dir === 'column' || dir === 'column-reverse') ? 'y' : 'x';
      }
      return 'y'; // block/grid default to vertical
    }

    // Is element single-line? Compare rendered height to line-height.
    function isSingleLine(el, fsPx) {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const lh = parseLh(cs.lineHeight, fsPx);
      // Allow 20% tolerance for padding/margin inside the element
      return rect.height <= lh * 1.4;
    }

    // Measure headroom at two levels:
    //   1. Inner: within the container, how much space is unused by text content
    //      (padding + empty space between text and container edges)
    //   2. Outer: in the parent/grandparent, redistributable gap space
    //      (space-evenly, space-between, or explicit gaps that could shrink)
    //
    // Returns { axis, innerPx, outerPx, totalPx, perChildPx, containerSize, textSize, childCount }
    function containerHeadroom(container) {
      const cs = getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      const axis = detectAxis(cs);
      const px = v => parseFloat(v) || 0;

      const padStart = px(axis === 'y' ? cs.paddingTop : cs.paddingLeft);
      const padEnd = px(axis === 'y' ? cs.paddingBottom : cs.paddingRight);
      const containerSize = (axis === 'y' ? rect.height : rect.width) - padStart - padEnd;

      // --- Inner headroom: content area minus actual text/child content ---
      // Sum text content height (leaf elements only)
      let textSize = 0;
      let childCount = 0;
      const childRects = [];
      for (const child of container.children) {
        if (!isVisible(child)) continue;
        const cr = child.getBoundingClientRect();
        if (cr.width === 0 && cr.height === 0) continue;
        const childCs = getComputedStyle(child);
        // Skip absolutely positioned children (ghost numbers, etc.)
        if (childCs.position === 'absolute' || childCs.position === 'fixed') continue;
        childRects.push(cr);
        childCount++;
        // Text height: for leaf elements, use their rendered height
        // For container elements, use their content (recursive would be ideal, but
        // we approximate with getBoundingClientRect)
        textSize += axis === 'y' ? cr.height : cr.width;
      }

      // Gaps between children (CSS gap, margins, or distributed space)
      let totalGaps = 0;
      childRects.sort((a, b) => axis === 'y' ? a.top - b.top : a.left - b.left);
      for (let i = 0; i < childRects.length - 1; i++) {
        const gap = axis === 'y'
          ? childRects[i + 1].top - childRects[i].bottom
          : childRects[i + 1].left - childRects[i].right;
        totalGaps += Math.max(0, gap);
      }

      // Inner headroom = content area - children - gaps between children
      // (leading/trailing space is part of headroom, not used space)
      const innerPx = Math.max(0, containerSize - textSize - totalGaps);

      // --- Outer headroom: walk up ancestors looking for redistributable space ---
      // Look at parent, grandparent, etc. — find the first ancestor with
      // meaningful redistributable space (space-evenly/space-between gaps,
      // or simply unused space in a flex/grid column container).
      // Accumulate from all levels — each ancestor can contribute.
      let outerPx = 0;
      let ancestor = container.parentElement;
      const maxLevels = 4;
      for (let level = 0; level < maxLevels && ancestor && ancestor !== document.documentElement; level++) {
        const aCs = getComputedStyle(ancestor);
        const aRect = ancestor.getBoundingClientRect();
        const aAxis = detectAxis(aCs);

        // Only count ancestors that flow in same axis direction
        if (aAxis === axis || aAxis === 'both') {
          const aPadStart = px(axis === 'y' ? aCs.paddingTop : aCs.paddingLeft);
          const aPadEnd = px(axis === 'y' ? aCs.paddingBottom : aCs.paddingRight);
          const ancestorSize = (axis === 'y' ? aRect.height : aRect.width) - aPadStart - aPadEnd;

          // Sum visible children sizes in this ancestor
          let childrenTotal = 0;
          let childrenCount = 0;
          for (const sib of ancestor.children) {
            if (!isVisible(sib)) continue;
            const sr = sib.getBoundingClientRect();
            if (sr.width === 0 && sr.height === 0) continue;
            const sibCs = getComputedStyle(sib);
            if (sibCs.position === 'absolute' || sibCs.position === 'fixed') continue;
            childrenTotal += axis === 'y' ? sr.height : sr.width;
            childrenCount++;
          }

          // Redistributable space at this level
          const redistributable = Math.max(0, ancestorSize - childrenTotal);

          // Only count if meaningful (>5px) to avoid noise
          if (redistributable > 5 && childrenCount > 0) {
            // This branch's share: divided among siblings at this level
            outerPx += redistributable / childrenCount;
          }
        }
        ancestor = ancestor.parentElement;
      }

      const totalPx = innerPx + outerPx;

      return {
        axis,
        innerPx: rd(innerPx),
        outerPx: rd(outerPx),
        totalPx: rd(totalPx),
        perChildPx: childCount > 0 ? rd(totalPx / childCount) : rd(totalPx),
        containerSize: rd(containerSize),
        textSize: rd(textSize),
        childCount,
      };
    }

    // --- Scan all text elements ---
    const selectors = 'h1,h2,h3,h4,h5,h6,p,a,span,button,li,label,td,th,figcaption,blockquote,div';
    const candidates = root.querySelectorAll(selectors);
    const elements = [];
    const containerMap = new Map(); // container element → headroom data

    for (let i = 0; i < candidates.length && elements.length < o.maxElements; i++) {
      const el = candidates[i];
      if (!isVisible(el)) continue;

      // Must have own text content
      let hasOwnText = false;
      for (let c = 0; c < el.childNodes.length; c++) {
        if (el.childNodes[c].nodeType === 3 && el.childNodes[c].textContent.trim().length > 0) {
          hasOwnText = true;
          break;
        }
      }
      // Also accept elements with no child elements (leaf elements with textContent)
      if (!hasOwnText && el.children.length > 0) continue;
      if (!el.textContent.trim()) continue;

      const cs = getComputedStyle(el);
      const fsPx = parseFloat(cs.fontSize);
      const tag = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();

      // Skip zero-size elements
      if (rect.width === 0 || rect.height === 0) continue;
      // Skip absolutely positioned elements (like ghost numbers)
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;

      const container = findContainer(el);
      if (!containerMap.has(container)) {
        containerMap.set(container, containerHeadroom(container));
      }
      const headroom = containerMap.get(container);

      const lhPx = parseLh(cs.lineHeight, fsPx);
      const singleLine = isSingleLine(el, fsPx);
      const role = classifyRole(fsPx, tag, el);
      const roleFloor = floors[role] || floors.caption;

      // Calculate max font size from headroom
      // For vertical containers: headroom lets this element grow taller
      // Growth factor: (element_height + share_of_headroom) / element_height
      const shareOfHeadroom = headroom.perChildPx;
      let maxSize;
      if (headroom.axis === 'y') {
        // Vertical: headroom allows the element to be taller
        if (singleLine) {
          // Single line: height ≈ lineHeight, scales linearly with font size
          maxSize = fsPx * ((rect.height + shareOfHeadroom) / Math.max(rect.height, 1));
        } else {
          // Multi-line: conservative — text reflow makes it nonlinear
          // Use sqrt scaling as approximation (doubling font height ≈ 1.4× font size)
          const growthRatio = (rect.height + shareOfHeadroom) / Math.max(rect.height, 1);
          maxSize = fsPx * Math.sqrt(growthRatio);
        }
      } else {
        // Horizontal: headroom allows wider elements but doesn't directly affect font size
        // Only relevant if element is width-constrained and wrapping
        maxSize = fsPx * 1.1; // conservative 10% bump for horizontal headroom
      }

      // Apply breathing room
      const suggestedMax = fsPx + (maxSize - fsPx) * (1 - o.breathingRoom);

      // Final suggestion: max of role floor and current size, capped by container max
      const suggested = Math.round(Math.max(roleFloor, Math.min(suggestedMax, maxSize)));

      // Build label
      let elLabel = tag;
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/)[0];
        if (cls) elLabel = '.' + cls;
      }
      const text = el.textContent.trim();
      const sample = text.length > 40 ? text.slice(0, 37) + '...' : text;

      // Container label
      let cLabel = container.tagName.toLowerCase();
      if (container.className && typeof container.className === 'string') {
        const cls = container.className.trim().split(/\s+/)[0];
        if (cls) cLabel = '.' + cls;
      }
      const cText = (container.querySelector('.label, .title, h1, h2, h3') || container);
      const cSample = (cText.textContent || '').trim().slice(0, 30);

      elements.push({
        selector: elLabel,
        text: sample,
        role,
        current: {
          fontSize: fsPx,
          lineHeight: rd(lhPx),
          lineHeightRatio: +(lhPx / fsPx).toFixed(2),
          fontWeight: cs.fontWeight,
          height: rd(rect.height),
          width: rd(rect.width),
        },
        singleLine,
        container: {
          selector: cLabel,
          text: cSample,
          axis: headroom.axis,
          size: headroom.containerSize,
          innerPx: headroom.innerPx,
          outerPx: headroom.outerPx,
          headroomPx: headroom.totalPx,
          headroomPct: pct(headroom.totalPx, headroom.containerSize),
        },
        floor: roleFloor,
        maxSize: Math.round(maxSize),
        suggested,
        delta: suggested - fsPx,
      });
    }

    // --- Hierarchy-preserving constraint pass ---
    // After computing raw suggestions, walk the size scale top-down and cap
    // smaller elements so each adjacent pair maintains ≥1.15× ratio.
    // This prevents detail and stat from converging to the same suggested size.
    const minRatio = 1.15;
    const distinctCurrentSizes = [...new Set(elements.map(e => e.current.fontSize))].sort((a, b) => b - a);

    // Build a map: currentSize → max allowed suggested size (constrained by hierarchy)
    const sugCap = new Map();
    for (let i = 0; i < distinctCurrentSizes.length; i++) {
      const size = distinctCurrentSizes[i];
      // Find the raw suggested for this size tier
      const rep = elements.find(e => e.current.fontSize === size);
      sugCap.set(size, rep ? rep.suggested : size);
    }
    // Top-down pass: each tier's suggested must be ≤ tier_above.suggested / minRatio
    for (let i = 1; i < distinctCurrentSizes.length; i++) {
      const aboveSize = distinctCurrentSizes[i - 1];
      const thisSize = distinctCurrentSizes[i];
      const aboveSuggested = sugCap.get(aboveSize);
      const thisSuggested = sugCap.get(thisSize);
      const maxAllowed = Math.floor(aboveSuggested / minRatio);
      if (thisSuggested > maxAllowed) {
        sugCap.set(thisSize, maxAllowed);
      }
    }
    // Apply constrained suggestions back to elements
    for (const el of elements) {
      const cap = sugCap.get(el.current.fontSize);
      if (cap !== undefined && cap < el.suggested) {
        el.suggested = cap;
        el.delta = el.suggested - el.current.fontSize;
        el.constrainedBy = 'hierarchy';
      }
    }

    // --- Build hierarchy check ---
    // Get distinct sizes sorted descending, check ratios between adjacent
    const distinctSizes = distinctCurrentSizes;
    const hierarchy = [];
    for (let i = 0; i < distinctSizes.length - 1; i++) {
      const larger = distinctSizes[i];
      const smaller = distinctSizes[i + 1];
      const ratio = +(larger / smaller).toFixed(2);
      // Find suggested sizes for these (now hierarchy-constrained)
      const sugLarger = sugCap.get(larger) || larger;
      const sugSmaller = sugCap.get(smaller) || smaller;
      const sugRatio = +(sugLarger / sugSmaller).toFixed(2);
      hierarchy.push({
        larger: { current: larger, suggested: sugLarger },
        smaller: { current: smaller, suggested: sugSmaller },
        currentRatio: ratio,
        suggestedRatio: sugRatio,
        ok: sugRatio >= 1.15,
      });
    }

    // --- Role floor check ---
    const roleChecks = [];
    const roleGroups = {};
    for (const el of elements) {
      if (!roleGroups[el.role]) roleGroups[el.role] = [];
      roleGroups[el.role].push(el);
    }
    for (const [role, group] of Object.entries(roleGroups)) {
      const minCurrent = Math.min(...group.map(e => e.current.fontSize));
      const floor = floors[role];
      roleChecks.push({
        role,
        floor,
        minCurrent,
        ok: minCurrent >= floor,
        count: group.length,
      });
    }

    // --- Recommendations: elements that should be bumped, sorted by delta ---
    const recommendations = elements
      .filter(e => e.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .map(e => ({
        selector: e.selector,
        text: e.text,
        role: e.role,
        current: e.current.fontSize,
        suggested: e.suggested,
        maxSize: e.maxSize,
        delta: e.delta,
        reason: e.current.fontSize < e.floor
          ? `below ${e.role} floor (${e.floor}px)`
          : e.constrainedBy === 'hierarchy'
          ? `capped by hierarchy (max ${e.maxSize}px from headroom)`
          : `${e.container.headroomPx}px headroom in ${e.container.selector}`,
        container: e.container.selector,
        singleLine: e.singleLine,
      }));

    // --- Canvas utilization ---
    const slideEl = root.querySelector('.slide') || root;
    const slideRect = slideEl.getBoundingClientRect();
    let contentBottom = 0;
    const allVisible = slideEl.querySelectorAll('*');
    for (const child of allVisible) {
      if (!isVisible(child)) continue;
      const cr = child.getBoundingClientRect();
      if (cr.bottom > contentBottom && cr.height > 0) contentBottom = cr.bottom;
    }
    const canvasUtil = pct(contentBottom - slideRect.top, slideRect.height);

    const data = {
      canvas,
      floors,
      canvasUtilization: canvasUtil,
      elements,
      hierarchy,
      roleChecks,
      recommendations,
    };

    // --- Text output ---
    if (o.format === 'text') {
      const lines = [];
      lines.push(`Font Tuning — ${canvas.width}×${canvas.height} canvas, ${canvasUtil}% utilized`);
      lines.push('');

      // Role floor check
      lines.push('ROLE FLOORS:');
      for (const rc of roleChecks) {
        const icon = rc.ok ? '  ok' : '  >>';
        lines.push(`${icon}  ${rc.role}: ${rc.minCurrent}px ${rc.ok ? '≥' : '<'} ${rc.floor}px floor (${rc.count} elements)`);
      }
      lines.push('');

      // Recommendations
      if (recommendations.length > 0) {
        lines.push(`RECOMMENDATIONS (${recommendations.length} elements to bump):`);
        for (const r of recommendations) {
          const line = r.singleLine ? 'single' : 'multi';
          lines.push(`  ${r.selector} (${r.current}px → ${r.suggested}px, +${r.delta}) — ${r.reason} [${line}-line]`);
          lines.push(`    "${r.text}"`);
        }
      } else {
        lines.push('No sizing recommendations — all elements at or above optimal.');
      }
      lines.push('');

      // Hierarchy
      lines.push('HIERARCHY RATIOS:');
      for (const h of hierarchy) {
        const icon = h.ok ? '  ok' : '  !!';
        const sugNote = h.suggestedRatio !== h.currentRatio
          ? ` → ${h.suggestedRatio}× after bump`
          : '';
        lines.push(`${icon}  ${h.larger.current}px / ${h.smaller.current}px = ${h.currentRatio}×${sugNote}`);
      }
      lines.push('');

      // Per-element detail
      lines.push('ALL ELEMENTS:');
      // Group by container
      const byContainer = new Map();
      for (const el of elements) {
        const key = el.container.selector + '|' + el.container.text;
        if (!byContainer.has(key)) byContainer.set(key, { info: el.container, items: [] });
        byContainer.get(key).items.push(el);
      }
      for (const [, group] of byContainer) {
        const c = group.info;
        lines.push(`  ${c.selector} "${c.text}" — ${c.axis}-axis, ${c.headroomPx}px headroom (${c.innerPx}px inner + ${c.outerPx}px outer)`);
        for (const el of group.items) {
          const arrow = el.delta > 0 ? ` → ${el.suggested}px` : '';
          lines.push(`    ${el.selector} ${el.current.fontSize}px${arrow} [${el.role}] "${el.text}"`);
        }
      }

      return { text: lines.join('\n'), data };
    }

    return data;
  }
