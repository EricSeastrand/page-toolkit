  // === Tool: Alignment Audit — cross-element edge/center alignment checks ===
  //
  // Finds groups of elements that should share an alignment axis (same class,
  // repeated siblings, semantic role) and flags when their edges or centers
  // drift. Stacking-axis aware: ignores expected spread along the parent's
  // layout direction (e.g. top/bottom drift in a flex-column).
  //
  // Designed for slide decks and fixed-canvas layouts but works on any page.

  function alignmentAudit(opts) {
    const o = Object.assign({
      scope: 'body',
      maxElements: 500,
      // Tolerance in px — edges within this distance count as aligned
      tolerance: 2,
      // Output format: 'json' (default) or 'text'
      format: 'json',
    }, opts);

    const root = document.querySelector(o.scope) || document.body;
    const rd = n => +n.toFixed(1);

    // ---------------------------------------------------------------
    // Helper: detect parent's stacking axis
    // ---------------------------------------------------------------
    function stackingAxis(parent) {
      if (!parent) return null;
      const cs = getComputedStyle(parent);
      const d = cs.display;
      if (d.includes('flex')) {
        // flex-wrap means items spread on both axes
        if (cs.flexWrap && cs.flexWrap !== 'nowrap') return 'xy';
        const dir = cs.flexDirection;
        if (dir === 'column' || dir === 'column-reverse') return 'y';
        return 'x';
      }
      if (d.includes('grid')) {
        const cols = cs.gridTemplateColumns.split(/\s+/).length;
        const rows = cs.gridTemplateRows.split(/\s+/).length;
        // Multi-column, multi-row grid: items spread on both axes
        if (cols > 1 && rows > 1) return 'xy';
        if (cols > 1) return 'x';
        return 'y';
      }
      // Block flow — stacking is vertical
      if (d === 'block' || d === 'list-item') return 'y';
      return null;
    }

    // Axes that are expected to spread for a given stacking direction
    const stackingAxes = {
      x: new Set(['left', 'right', 'centerX']),
      y: new Set(['top', 'bottom', 'centerY']),
      xy: new Set(['left', 'right', 'centerX', 'top', 'bottom', 'centerY']),
    };

    // ---------------------------------------------------------------
    // Helper: build a unique, readable label for an element
    // ---------------------------------------------------------------
    function elLabel(el) {
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string'
        ? el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      let label = cls ? tag + '.' + cls : tag;
      // Add disambiguating text snippet
      const text = el.textContent.trim();
      if (text.length > 0 && text.length < 60) {
        label += ' "' + (text.length > 30 ? text.slice(0, 27) + '...' : text) + '"';
      }
      return label;
    }

    // ---------------------------------------------------------------
    // 1. Collect visible elements with bounding rects
    // ---------------------------------------------------------------
    const allEls = root.querySelectorAll('*');
    const measured = [];
    for (let i = 0; i < allEls.length && measured.length < o.maxElements; i++) {
      const el = allEls[i];
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const classes = el.className && typeof el.className === 'string'
        ? el.className.trim().split(/\s+/).sort().join(' ')
        : '';

      measured.push({
        el,
        tag: el.tagName.toLowerCase(),
        classes,
        label: elLabel(el),
        left: rd(rect.left),
        right: rd(rect.right),
        top: rd(rect.top),
        bottom: rd(rect.bottom),
        centerX: rd(rect.left + rect.width / 2),
        centerY: rd(rect.top + rect.height / 2),
        width: rd(rect.width),
        height: rd(rect.height),
      });
    }

    // ---------------------------------------------------------------
    // 2. Build alignment groups
    // ---------------------------------------------------------------
    // Sibling groups: same parent + same first class
    // Cross-parent groups: same first class, multiple parents

    const siblingGroups = new Map();  // key: parentElement DOM node + class
    const classGroups = new Map();
    let parentId = 0;
    const parentIds = new WeakMap();  // DOM node → unique id

    for (const m of measured) {
      if (!m.classes) continue;
      const firstClass = m.classes.split(' ')[0];
      if (!firstClass) continue;

      // Skip broad container elements
      if (m.el.children.length > 3 && m.el.textContent.trim().length > 200) continue;

      const parent = m.el.parentElement;
      if (parent) {
        // Use actual DOM identity, not path string, to avoid false siblings
        if (!parentIds.has(parent)) parentIds.set(parent, parentId++);
        const sibKey = parentIds.get(parent) + '|.' + firstClass;
        if (!siblingGroups.has(sibKey)) {
          siblingGroups.set(sibKey, { members: [], parent, label: elPath(parent, 3) + '|.' + firstClass });
        }
        siblingGroups.get(sibKey).members.push(m);
      }

      if (!classGroups.has(firstClass)) classGroups.set(firstClass, []);
      classGroups.get(firstClass).push(m);
    }

    // ---------------------------------------------------------------
    // 3. Analyze alignment — stacking-axis aware
    // ---------------------------------------------------------------
    const tol = o.tolerance;

    function analyzeGroup(members, groupLabel, parentEl) {
      if (members.length < 2) return null;

      // Determine which axes to skip (expected spread along stacking direction)
      const skip = new Set();
      if (parentEl) {
        const axis = stackingAxis(parentEl);
        if (axis && stackingAxes[axis]) {
          for (const a of stackingAxes[axis]) skip.add(a);
        }
      }
      // For cross-parent groups, walk up the tree to find the nearest
      // common ancestor whose children (or descendants) contain all members.
      // Skip that ancestor's stacking axis since vertical/horizontal spread
      // is expected when elements live inside stacked containers.
      if (!parentEl) {
        const els = members.map(m => m.el);
        // Walk up to 5 levels from each element, collecting ancestor chains
        const maxWalk = 5;
        for (let level = 1; level <= maxWalk; level++) {
          const ancestors = els.map(el => {
            let node = el;
            for (let i = 0; i < level; i++) {
              if (node.parentElement) node = node.parentElement;
            }
            return node;
          });
          // Check if all ancestors at this level share the same parent
          const ancestorParents = [...new Set(ancestors.map(a => a.parentElement).filter(Boolean))];
          if (ancestorParents.length === 1) {
            const axis = stackingAxis(ancestorParents[0]);
            if (axis && stackingAxes[axis]) {
              for (const a of stackingAxes[axis]) skip.add(a);
            }
            break;
          }
        }
      }

      const allAxes = ['left', 'right', 'top', 'bottom', 'centerX', 'centerY'];
      const issues = [];

      for (const axis of allAxes) {
        if (skip.has(axis)) continue;

        const values = members.map(m => m[axis]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const spread = rd(max - min);

        if (spread > tol) {
          const sorted = values.slice().sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const outliers = members
            .filter(m => Math.abs(m[axis] - median) > tol)
            .map(m => ({
              label: m.label,
              value: m[axis],
              drift: rd(m[axis] - median),
            }));

          if (outliers.length > 0) {
            issues.push({ axis, spread, median, min, max, outliers });
          }
        }
      }

      if (issues.length === 0) return null;

      return {
        group: groupLabel,
        count: members.length,
        members: members.map(m => ({
          label: m.label,
          left: m.left, right: m.right, top: m.top, bottom: m.bottom,
          centerX: m.centerX, centerY: m.centerY,
        })),
        issues,
      };
    }

    // ---------------------------------------------------------------
    // 4. Run analysis, collect findings
    // ---------------------------------------------------------------
    const findings = [];

    for (const [, { members, parent, label: groupLabel }] of siblingGroups) {
      if (members.length < 2) continue;
      const result = analyzeGroup(members, groupLabel, parent);
      if (result) {
        result.type = 'sibling';
        findings.push(result);
      }
    }

    for (const [cls, members] of classGroups) {
      if (members.length < 2) continue;
      const parents = [...new Set(members.map(m => m.el.parentElement).filter(Boolean))];
      if (parents.length < 2) continue;

      // Skip cross-parent groups where every member lives inside an
      // independent multi-column GRID (not flex). Grid cells in different
      // columns are expected to have x-spread. Flex-rows (marker + body)
      // should have consistent alignment across cards.
      const allInGrid = parents.every(p => {
        for (let node = p, depth = 0; node && depth < 2; node = node.parentElement, depth++) {
          if (!node) break;
          const cs = getComputedStyle(node);
          if (cs.display.includes('grid')) {
            const cols = cs.gridTemplateColumns.split(/\s+/).length;
            if (cols > 1) return true;
          }
        }
        return false;
      });
      if (allInGrid) continue;

      const result = analyzeGroup(members, '.' + cls, null);
      if (result) {
        result.type = 'cross-parent';
        findings.push(result);
      }
    }

    // Sort by worst spread
    findings.sort((a, b) => {
      const aMax = Math.max(...a.issues.map(i => i.spread));
      const bMax = Math.max(...b.issues.map(i => i.spread));
      return bMax - aMax;
    });

    // ---------------------------------------------------------------
    // 5. Summary
    // ---------------------------------------------------------------
    const summary = {
      elementsScanned: measured.length,
      siblingGroupsChecked: [...siblingGroups.values()].filter(g => g.members.length >= 2).length,
      classGroupsChecked: [...classGroups.values()].filter(g => g.length >= 2).length,
      issuesFound: findings.length,
      worstSpread: findings.length > 0 ? Math.max(...findings.flatMap(f => f.issues.map(i => i.spread))) : 0,
    };

    const data = { summary, findings };

    // ---------------------------------------------------------------
    // 6. Text output
    // ---------------------------------------------------------------
    if (o.format === 'text') {
      const lines = [];
      lines.push(`Alignment Audit — ${summary.elementsScanned} elements, ${summary.issuesFound} issues`);
      lines.push('');

      if (findings.length === 0) {
        lines.push('No alignment issues found (within ' + tol + 'px tolerance).');
      } else {
        for (const f of findings) {
          const worstIssue = f.issues.reduce((a, b) => a.spread > b.spread ? a : b);
          lines.push(`[${f.type}] ${f.group} (${f.count} elements)`);

          for (const issue of f.issues) {
            lines.push(`  ${issue.axis}: ${issue.spread}px spread (${issue.min} → ${issue.max})`);
            for (const out of issue.outliers) {
              const sign = out.drift > 0 ? '+' : '';
              lines.push(`    ${out.label}: ${out.value}px (${sign}${out.drift})`);
            }
          }
          lines.push('');
        }
      }

      return { text: lines.join('\n'), data };
    }

    return data;
  }
