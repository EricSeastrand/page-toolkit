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

