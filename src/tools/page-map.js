  // === Tool: Page Map — topographic text layout of the page ===

  function pageMap(opts) {
    const o = Object.assign({ scope: 'body', maxDepth: 8, foldWarnings: 'sections', patterns: true, summary: false, aboveFold: false }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dark = detectDarkMode();

    const SEMANTIC = new Set([
      'nav','main','header','footer','section','article','aside',
      'form','table','thead','tbody','tfoot','ul','ol',
      'input','select','textarea','button','a','img','video','iframe',
      'h1','h2','h3','h4','h5','h6','label','fieldset','canvas','svg',
    ]);

    const SECTIONING = new Set([
      'body','main','header','footer','section','article','aside','nav','form',
    ]);

    function hasOwnVisuals(el) {
      const s = window.getComputedStyle(el);
      const bg = parseRGB(s.backgroundColor);
      if (bg && bg.a > 0.1) return true;
      if (s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0) return true;
      const pad = parseFloat(s.paddingTop) + parseFloat(s.paddingRight)
        + parseFloat(s.paddingBottom) + parseFloat(s.paddingLeft);
      if (pad > 16) return true;
      return false;
    }

    function isSignificant(el) {
      const tag = el.tagName.toLowerCase();
      if (SEMANTIC.has(tag)) return true;
      if (el.id || el.getAttribute('role')) return true;
      if (hasOwnVisuals(el)) return true;
      const s = window.getComputedStyle(el);
      if (['absolute','fixed','sticky'].includes(s.position)) return true;
      // Multiple visible children = structural container
      let vc = 0;
      for (const c of el.children) {
        if (isVisible(c)) { vc++; if (vc > 1) return true; }
      }
      return false;
    }

    function shouldCollapse(el) {
      if (isSignificant(el)) return false;
      let visChild = null, count = 0;
      for (const c of el.children) {
        if (isVisible(c)) { visChild = c; count++; if (count > 1) return false; }
      }
      return count === 1;
    }

    // Layout pattern detection — returns label string like " [hero]" or ""
    let heroFound = false;
    function detectPattern(el) {
      if (!o.patterns) return '';
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tag = el.tagName.toLowerCase();

      // [sticky-header]
      if ((cs.position === 'sticky' || cs.position === 'fixed') &&
          (parseFloat(cs.top) || 0) < 5 &&
          rect.width > vw * 0.8 &&
          rect.height < vh * 0.2) {
        return ' [sticky-header]';
      }

      // [nav]
      if (tag === 'nav' || el.getAttribute('role') === 'navigation') {
        return ' [nav]';
      }
      if ((tag === 'ul' || tag === 'ol') && !el.closest('article, .article, [role="article"]')) {
        const links = el.querySelectorAll(':scope > li > a, :scope > a');
        if (links.length >= 3) return ' [nav]';
      }

      // [hero] — first big section with visual weight (only once)
      if (!heroFound && rect.height > vh * 0.5 && rect.width > vw * 0.8) {
        const parent = el.parentElement;
        if (parent && (parent === document.body || parent.tagName === 'MAIN' || parent.getAttribute('role') === 'main')) {
          const siblings = [...parent.children].filter(c => isVisible(c));
          const idx = siblings.indexOf(el);
          if (idx >= 0 && idx <= 1) {
            const bg = cs.backgroundImage;
            const hasBgImage = bg && bg !== 'none';
            const hasDarkBg = luminance(effectiveBackground(el)) < 0.3;
            const hasMedia = el.querySelector('img, video, picture, canvas, svg');
            if (hasBgImage || hasDarkBg || hasMedia) {
              heroFound = true;
              return ' [hero]';
            }
          }
        }
      }

      // [card-grid ×N]
      const display = cs.display;
      const flexWrap = cs.flexWrap;
      if (display === 'grid' || display === 'inline-grid' ||
          ((display === 'flex' || display === 'inline-flex') && flexWrap === 'wrap')) {
        const children = [...el.children].filter(c => isVisible(c));
        if (children.length >= 3) {
          const tags = children.map(c => c.tagName);
          const mainTag = tags[0];
          const sameTag = tags.filter(t => t === mainTag).length;
          if (sameTag >= children.length * 0.7) {
            const widths = children.map(c => c.getBoundingClientRect().width);
            const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
            const similar = widths.every(w => Math.abs(w - avgW) / avgW < 0.25);
            if (similar) {
              if (display === 'grid' || display === 'inline-grid') {
                const cols = cs.gridTemplateColumns.split(/\s+/).filter(v => v && v !== 'none').length;
                const rows = Math.ceil(children.length / (cols || 1));
                if (cols > 1) return ' [grid ' + cols + '\u00d7' + rows + ']';
              }
              return ' [card-grid \u00d7' + children.length + ']';
            }
          }
        }
      }

      // [grid NxM]
      if (display === 'grid' || display === 'inline-grid') {
        const cols = cs.gridTemplateColumns.split(/\s+/).filter(v => v && v !== 'none').length;
        if (cols > 1) {
          const visibleKids = [...el.children].filter(c => isVisible(c)).length;
          const rows = Math.ceil(visibleKids / cols);
          if (rows > 0) return ' [grid ' + cols + '\u00d7' + rows + ']';
        }
      }

      // [carousel]
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') {
        const children = [...el.children].filter(c => isVisible(c));
        if (children.length >= 3) {
          const tags = children.map(c => c.tagName);
          const mainTag = tags[0];
          const sameTag = tags.filter(t => t === mainTag).length;
          if (sameTag >= children.length * 0.7) {
            const childrenWidth = children.reduce((sum, c) => sum + c.getBoundingClientRect().width, 0);
            if (childrenWidth > rect.width * 1.2) {
              return ' [carousel \u00d7' + children.length + ']';
            }
          }
        }
      }

      // [accordion]
      if (el.querySelectorAll(':scope > details').length >= 3) {
        return ' [accordion \u00d7' + el.querySelectorAll(':scope > details').length + ']';
      }

      // [sidebar]
      if (rect.height > vh * 0.8 && rect.width > vw * 0.1 && rect.width < vw * 0.35) {
        const parent = el.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter(c => c !== el && isVisible(c));
          const widerSibling = siblings.some(s => s.getBoundingClientRect().width > rect.width * 1.5);
          if (widerSibling) return ' [sidebar]';
        }
      }

      return '';
    }

    function elLabel(el) {
      const tag = el.tagName.toLowerCase();
      let name = tag;
      if (el.id) name += '#' + el.id;
      else {
        const cls = typeof el.className === 'string'
          ? el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('ui-state')).slice(0, 2).join('.')
          : '';
        if (cls) name += '.' + cls;
      }
      // Layout pattern label
      const pat = detectPattern(el);
      if (pat) name += pat;
      // Semantic hints for interactive/content elements
      if (tag === 'input') {
        const type = el.type || 'text';
        const val = el.value ? ' "' + el.value.substring(0, 20) + '"' : '';
        name += '[' + type + ']' + val;
      } else if (tag === 'button' || (tag === 'a' && el.textContent?.trim())) {
        const text = el.textContent.trim().substring(0, 20);
        if (text) name += ' "' + text + '"';
      } else if (tag === 'img') {
        const alt = el.alt || el.src?.split('/').pop() || '';
        name += ' "' + alt.substring(0, 20) + '"';
      }
      return name;
    }

    function spatialDesc(rect) {
      const parts = [];
      const wp = Math.round(rect.width / vw * 100);
      const hp = Math.round(rect.height / vh * 100);
      const yp = Math.round(rect.top / vh * 100);
      const xp = Math.round(rect.left / vw * 100);
      const xr = Math.round((vw - rect.right) / vw * 100);

      // Width
      if (wp > 95) parts.push('full-width');
      else if (wp > 45 && wp < 55) parts.push('half-width');
      else parts.push('w:' + wp + '%');

      // Height (only if notable)
      if (hp > 150) parts.push('h:' + hp + '% of viewport!');
      else if (hp > 5) parts.push('h:' + hp + '%');

      // Y position
      if (rect.top < -10) parts.push(Math.abs(Math.round(rect.top)) + 'px above viewport');
      else if (yp <= 2) parts.push('top');
      else parts.push('y:' + yp + '%');

      // X alignment
      if (wp <= 95) {
        if (xp < 3) parts.push('left-aligned');
        else if (xr < 3) parts.push('right-aligned');
        else if (Math.abs(xp - xr) < 5) parts.push('centered');
        else parts.push('x:' + xp + '%');
      }

      return parts.join(', ');
    }

    function getWarnings(el, rect, depth) {
      const s = window.getComputedStyle(el);
      const warns = [];

      // Overflows parent
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement) {
        const pRect = parent.getBoundingClientRect();
        if (pRect.width > 50 && rect.width > pRect.width * 1.3) {
          warns.push('\u26a0 overflows parent (' + Math.round(rect.width / pRect.width * 100) + '% of parent width)');
        }
      }

      // Extends past viewport
      if (rect.bottom > vh * 2 && o.foldWarnings !== 'none') {
        const isSection = o.foldWarnings === 'all' || SECTIONING.has(el.tagName.toLowerCase()) ||
          el.parentElement === document.body ||
          el.parentElement === root ||
          (el.parentElement && el.parentElement.tagName === 'MAIN');
        if (isSection) {
          warns.push('\u26a0 extends ' + Math.round((rect.bottom - vh) / vh * 100) + '% below fold');
        }
      }
      if (rect.right > vw * 1.1) {
        warns.push('\u26a0 extends ' + Math.round((rect.right - vw) / vw * 100) + '% past right edge');
      }

      // Tall content with no scroll
      if (el.scrollHeight > el.clientHeight * 1.5 && el.scrollHeight > vh
        && s.overflow !== 'auto' && s.overflow !== 'scroll'
        && s.overflowY !== 'auto' && s.overflowY !== 'scroll') {
        warns.push('\u26a0 no scroll constraint (overflow:' + s.overflow + ')');
      }

      // Theme escape
      if (dark.isDark) {
        const bg = parseRGB(s.backgroundColor);
        if (bg && bg.a > 0.1 && luminance(bg) > 0.4) {
          warns.push('\u26a0 theme escape (white bg on dark page)');
        }
      }

      return warns;
    }

    // --- Tree builder ---

    function buildNode(el, depth) {
      if (depth > o.maxDepth || !isVisible(el)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;

      // Collapse through insignificant single-child wrappers
      if (shouldCollapse(el)) {
        const child = Array.from(el.children).find(c => isVisible(c));
        if (child) return buildNode(child, depth);
      }

      const tag = el.tagName.toLowerCase();
      const s = window.getComputedStyle(el);
      const overlay = ['absolute','fixed'].includes(s.position) && rect.height > 50;
      const node = {
        label: elLabel(el),
        spatial: spatialDesc(rect),
        warnings: getWarnings(el, rect, depth),
        overlay,
        children: [],
      };

      // Table: summarize columns and rows, don't recurse
      if (tag === 'table') {
        const ths = el.querySelectorAll('th');
        const rows = el.querySelectorAll('tbody tr');
        node.summary = ths.length + ' cols \u00d7 ' + rows.length + ' rows';
        if (ths.length > 0 && ths.length <= 12) {
          node.columns = Array.from(ths).map(th => th.textContent.trim().substring(0, 15));
        }
        return node;
      }

      // Large list: summarize count, sample first/last
      if ((tag === 'ul' || tag === 'ol') && el.children.length > 10) {
        const items = el.querySelectorAll(':scope > li');
        node.summary = items.length + ' items';
        if (items.length > 0) {
          const first = (items[0].textContent?.trim() || '').substring(0, 50);
          const last = (items[items.length - 1].textContent?.trim() || '').substring(0, 50);
          node.sample = [first, last];
        }
        return node;
      }

      // Recurse into visible children
      for (const child of el.children) {
        const childNode = buildNode(child, depth + 1);
        if (childNode) node.children.push(childNode);
      }

      return node;
    }

    // --- Text renderer ---

    function render(node, prefix, isLast, depth) {
      const lines = [];
      const branch = depth === 0 ? '' : (isLast ? '\u2514\u2500 ' : '\u251c\u2500 ');
      const cont   = depth === 0 ? '' : (isLast ? '   '           : '\u2502  ');

      let line = prefix + branch;
      if (node.overlay) line += '\u2b21 ';
      line += node.label;
      const padLen = Math.max(1, 46 - line.length);
      line += ' ' + '\u00b7'.repeat(padLen) + ' ' + node.spatial;
      lines.push(line);

      const cp = prefix + cont;
      for (const w of node.warnings) lines.push(cp + '  ' + w);
      if (node.summary) lines.push(cp + '  ' + node.summary);
      if (node.columns) lines.push(cp + '  [' + node.columns.join(' | ') + ']');
      if (node.sample) lines.push(cp + '  "' + node.sample[0] + '" \u2026 "' + node.sample[1] + '"');

      for (let i = 0; i < node.children.length; i++) {
        lines.push(...render(node.children[i], cp, i === node.children.length - 1, depth + 1));
      }
      return lines;
    }

    // --- Assemble output ---

    const tree = buildNode(root, 0);
    let header = 'PAGE ' + vw + '\u00d7' + vh;
    if (dark.isDark) header += ' [dark mode]';

    // Total page height
    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const pageVH = Math.round(docH / vh * 100);
    header += ' (' + pageVH + '% of viewport)';

    if (!tree) return header + '\n(empty)';

    // Summary mode: top-level sections only with size/position
    if (o.summary || o.aboveFold) {
      const nodes = tree.children.length > 0 ? tree.children : [tree];
      const slines = [header, ''];
      for (const n of nodes) {
        if (o.aboveFold) {
          const ym = n.spatial.match(/y:(\d+)%/);
          if (ym && parseInt(ym[1], 10) > 100) break;
        }
        const pat = n.label.match(/\[.*?\]/)?.[0] || '';
        const warnCount = n.warnings.length;
        let sline = n.label.replace(/\s*\[.*?\]/, '');
        sline += ' \u00b7\u00b7 ' + n.spatial;
        if (pat) sline += '  ' + pat;
        if (warnCount) sline += '  (' + warnCount + ' warning' + (warnCount > 1 ? 's' : '') + ')';
        const kidCount = n.children ? n.children.length : 0;
        if (kidCount) sline += '  [' + kidCount + ' children]';
        slines.push(sline);
      }
      return slines.join('\n');
    }

    const nodes = tree.children.length > 0 ? tree.children : [tree];
    const lines = [];
    for (let i = 0; i < nodes.length; i++) {
      lines.push(...render(nodes[i], '', i === nodes.length - 1, 0));
    }

    // Insert fold marker before the first line whose y-position exceeds 100%
    const foldRe = /y:(\d+)%/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(foldRe);
      if (m && parseInt(m[1], 10) > 100) {
        lines.splice(i, 0, '\u2500\u2500\u2500\u2500 fold \u2500\u2500\u2500\u2500');
        break;
      }
    }

    return header + '\n' + lines.join('\n');
  }

