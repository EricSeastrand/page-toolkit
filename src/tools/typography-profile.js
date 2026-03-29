  // === Tool: Typography Profile ===

  function typographyProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 2000 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const selectors = 'h1,h2,h3,h4,h5,h6,p,a,span,button,li,label,td,th,figcaption,blockquote';
    const candidates = root.querySelectorAll(selectors);

    const familySet = new Map(); // family string → count
    const sigMap = new Map();    // style signature → {style, count, tags, sample}
    const weights = {};
    const letterSpacingMap = {};
    const textTransformMap = {};
    // Spatial data keyed by fontSize bucket (rounded to int)
    const spatialBySize = new Map();
    let scanned = 0;

    for (let i = 0; i < candidates.length && scanned < o.maxElements; i++) {
      const el = candidates[i];
      if (!isVisible(el)) continue;

      // Only count elements with own text content (text nodes, not just child elements)
      let hasOwnText = false;
      for (let c = 0; c < el.childNodes.length; c++) {
        if (el.childNodes[c].nodeType === 3 && el.childNodes[c].textContent.trim().length > 0) {
          hasOwnText = true;
          break;
        }
      }
      if (!hasOwnText) continue;

      scanned++;
      const cs = window.getComputedStyle(el);
      const fontFamily = cs.fontFamily;
      const fontSize = cs.fontSize;
      const fontWeight = cs.fontWeight;
      const lineHeight = cs.lineHeight;
      const letterSpacing = cs.letterSpacing;
      const textTransform = cs.textTransform;
      const fsPx = parseFloat(fontSize);

      // Track font families
      familySet.set(fontFamily, (familySet.get(fontFamily) || 0) + 1);

      // Track weights
      weights[fontWeight] = (weights[fontWeight] || 0) + 1;

      // Track letter-spacing (non-normal)
      if (letterSpacing !== 'normal' && letterSpacing !== '0px') {
        letterSpacingMap[letterSpacing] = (letterSpacingMap[letterSpacing] || 0) + 1;
      }

      // Track text-transform (non-none)
      if (textTransform !== 'none') {
        textTransformMap[textTransform] = (textTransformMap[textTransform] || 0) + 1;
      }

      // Collect spatial measurements per fontSize bucket
      const rect = el.getBoundingClientRect();
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const mt = parseFloat(cs.marginTop) || 0;
      const mb = parseFloat(cs.marginBottom) || 0;
      // Check parent's vertical padding contribution
      let parentPadY = 0;
      const par = el.parentElement;
      if (par) {
        const pcs = window.getComputedStyle(par);
        parentPadY = (parseFloat(pcs.paddingTop) || 0) + (parseFloat(pcs.paddingBottom) || 0);
      }
      const sizeBucket = Math.round(fsPx);
      if (!spatialBySize.has(sizeBucket)) {
        spatialBySize.set(sizeBucket, []);
      }
      // Container width: nearest block-level ancestor
      let containerW = 0;
      let ancestor = par;
      while (ancestor && ancestor !== document.body) {
        const aDisp = window.getComputedStyle(ancestor).display;
        if (aDisp === 'block' || aDisp === 'flex' || aDisp === 'grid') {
          containerW = ancestor.getBoundingClientRect().width;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!containerW && par) containerW = par.getBoundingClientRect().width;

      // Gap to next sibling for heading elements
      let gapToNext = null;
      const tagLower = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tagLower)) {
        const nextEl = el.nextElementSibling;
        if (nextEl) {
          const nextRect = nextEl.getBoundingClientRect();
          gapToNext = Math.max(0, +(nextRect.top - rect.bottom).toFixed(1));
        }
      }

      spatialBySize.get(sizeBucket).push({
        boxW: rect.width,
        boxH: rect.height,
        padY: pt + pb,
        padX: pl + pr,
        marginY: mt + mb,
        parentPadY,
        containerW,
        gapToNext,
      });

      // Deduplicate by style signature
      const sig = `${fontFamily}|${fontSize}|${fontWeight}|${lineHeight}|${letterSpacing}`;
      const tag = el.tagName.toLowerCase();

      if (sigMap.has(sig)) {
        const entry = sigMap.get(sig);
        entry.count++;
        if (!entry.tags.includes(tag)) entry.tags.push(tag);
      } else {
        const text = el.textContent.trim();
        const sample = text.length > 60 ? text.slice(0, 57) + '...' : text;
        sigMap.set(sig, {
          fontFamily,
          fontSize: fsPx,
          fontWeight,
          lineHeight,
          letterSpacing,
          textTransform,
          count: 1,
          tags: [tag],
          sample,
        });
      }
    }

    // Build scale sorted descending by size
    const scale = [...sigMap.values()].sort((a, b) => b.fontSize - a.fontSize);

    // --- Line-height ratios & leading ---
    function parseLh(lhStr, fsPx) {
      if (!lhStr || lhStr === 'normal') return fsPx * 1.2; // browser default
      const px = parseFloat(lhStr);
      if (lhStr.endsWith('px')) return px;
      // unitless multiplier
      if (!isNaN(px) && px < 10) return px * fsPx;
      return px;
    }

    // --- Spatial context per scale entry ---
    function avgOf(arr) {
      if (!arr.length) return 0;
      return arr.reduce((s, v) => s + v, 0) / arr.length;
    }

    // Canvas for accurate character width measurement
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    function measureCharWidth(fontFamily, fontSize, fontWeight) {
      // Measure average character width using a representative sample string
      measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
      return measureCtx.measureText(sample).width / sample.length;
    }

    // Enrich scale entries with computed metrics
    const enrichedScale = scale.map(s => {
      const lhPx = parseLh(s.lineHeight, s.fontSize);
      const lineHeightRatio = +(lhPx / s.fontSize).toFixed(2);
      const leading = +((lhPx - s.fontSize)).toFixed(1);

      // Aggregate spatial data for this fontSize
      const bucket = Math.round(s.fontSize);
      const spatials = spatialBySize.get(bucket) || [];
      const avgBoxW = +avgOf(spatials.map(d => d.boxW)).toFixed(1);
      const avgBoxH = +avgOf(spatials.map(d => d.boxH)).toFixed(1);
      const avgPadY = +avgOf(spatials.map(d => d.padY)).toFixed(1);
      const avgPadX = +avgOf(spatials.map(d => d.padX)).toFixed(1);
      const avgMarginY = +avgOf(spatials.map(d => d.marginY)).toFixed(1);
      const avgParentPadY = +avgOf(spatials.map(d => d.parentPadY)).toFixed(1);
      // Effective vertical spacing: own margin + own padding + parent padding
      const effectiveSpaceY = +(avgMarginY + avgPadY + avgParentPadY).toFixed(1);
      // Chars per line: use canvas measureText for accuracy
      const charW = measureCharWidth(s.fontFamily, s.fontSize, s.fontWeight);
      const textWidth = Math.max(avgBoxW - avgPadX, 0);
      const avgCharsPerLine = charW > 0 ? Math.round(textWidth / charW) : 0;
      // Breathing room: total vertical space (box) vs line-height
      const breathingRoom = lhPx > 0 ? +(avgBoxH / lhPx).toFixed(2) : 0;
      // Container width ratio
      const avgContainerW = +avgOf(spatials.map(d => d.containerW).filter(w => w > 0)).toFixed(1);
      const containerRatio = avgContainerW > 0 ? +(s.fontSize / avgContainerW).toFixed(4) : 0;
      // Viewport-relative sizing
      const vwRatio = +(s.fontSize / window.innerWidth).toFixed(4);
      // Gap to next (heading elements only — average non-null values)
      const gapVals = spatials.map(d => d.gapToNext).filter(v => v !== null);
      const avgGapToNext = gapVals.length ? +avgOf(gapVals).toFixed(1) : null;

      return {
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        lineHeightRatio,
        leading,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        count: s.count,
        tags: s.tags,
        sample: s.sample,
        spatial: {
          avgBoxW, avgBoxH,
          avgPadY, avgMarginY, avgParentPadY, effectiveSpaceY,
          breathingRoom,
          avgCharsPerLine,
          avgContainerW, containerRatio,
          avgGapToNext,
        },
        vwRatio,
      };
    });

    // --- Scale analysis: ratios between distinct font sizes ---
    const distinctSizes = [...new Set(scale.map(s => s.fontSize))].sort((a, b) => b - a);
    const scaleRatios = [];
    for (let i = 0; i < distinctSizes.length - 1; i++) {
      scaleRatios.push(+(distinctSizes[i] / distinctSizes[i + 1]).toFixed(2));
    }
    const ratioAvg = scaleRatios.length
      ? +(scaleRatios.reduce((s, r) => s + r, 0) / scaleRatios.length).toFixed(2) : 0;
    const ratioStdDev = scaleRatios.length > 1
      ? +(Math.sqrt(scaleRatios.reduce((s, r) => s + (r - ratioAvg) ** 2, 0) / scaleRatios.length)).toFixed(3) : 0;
    const sizeRange = distinctSizes.length >= 2
      ? +(distinctSizes[0] / distinctSizes[distinctSizes.length - 1]).toFixed(2) : 1;

    // --- Hierarchy score (0–100) ---
    // Separation clarity (40%): penalize adjacent sizes with ratio < 1.15
    const wellSeparated = scaleRatios.filter(r => r >= 1.15).length;
    const separationScore = scaleRatios.length
      ? (wellSeparated / scaleRatios.length) * 100 : 0;

    // Role coverage (20%): does the page have display/heading/body/caption?
    const groups = { display: [], heading: [], body: [], caption: [] };
    for (const entry of enrichedScale) {
      const sz = entry.fontSize;
      if (sz > 48) groups.display.push(entry);
      else if (sz >= 24) groups.heading.push(entry);
      else if (sz >= 14) groups.body.push(entry);
      else groups.caption.push(entry);
    }
    const rolesPresent = [groups.display, groups.heading, groups.body, groups.caption]
      .filter(g => g.length > 0).length;
    const coverageScore = (rolesPresent / 4) * 100;

    // Weight differentiation (20%): headings use heavier weight than body?
    const headingWeights = [...groups.display, ...groups.heading].map(e => +e.fontWeight);
    const bodyWeights = [...groups.body, ...groups.caption].map(e => +e.fontWeight);
    const avgHeadingW = headingWeights.length ? avgOf(headingWeights) : 400;
    const avgBodyW = bodyWeights.length ? avgOf(bodyWeights) : 400;
    const weightDelta = avgHeadingW - avgBodyW;
    const weightScore = weightDelta >= 200 ? 100
      : weightDelta >= 100 ? 75
      : weightDelta > 0 ? 50
      : weightDelta === 0 ? 25 : 0;

    // Size range (20%): 3×–6× = ideal
    const rangeScore = sizeRange >= 3 && sizeRange <= 6 ? 100
      : sizeRange >= 2 && sizeRange < 3 ? 70
      : sizeRange > 6 && sizeRange <= 8 ? 70
      : sizeRange >= 1.5 ? 40 : 20;

    const hierarchyScore = Math.round(
      separationScore * 0.4 + coverageScore * 0.2 + weightScore * 0.2 + rangeScore * 0.2
    );

    // --- Crowding flags (deduplicated by fontSize + issue) ---
    const crowding = [];
    const crowdSeen = new Set();
    for (const entry of enrichedScale) {
      const fs = entry.fontSize;
      // Tight leading: only flag for multi-line text (body/caption range, or tall boxes)
      if (entry.lineHeightRatio < 1.15 && fs >= 14 && fs <= 24
          && !crowdSeen.has(fs + '|tight-leading')) {
        crowding.push({
          fontSize: fs, issue: 'tight-leading',
          lineHeightRatio: entry.lineHeightRatio, threshold: 1.15,
        });
        crowdSeen.add(fs + '|tight-leading');
      }
      // No spacing: flag body/caption text with no effective vertical space
      // (checks own margin + own padding + parent padding)
      if (entry.spatial.effectiveSpaceY < 4 && entry.spatial.avgBoxH > 0
          && entry.count >= 3 && fs <= 20
          && !crowdSeen.has(fs + '|no-spacing')) {
        crowding.push({
          fontSize: fs, issue: 'no-spacing',
          effectiveSpaceY: entry.spatial.effectiveSpaceY,
        });
        crowdSeen.add(fs + '|no-spacing');
      }
      // Wide measure: lines too long for comfortable reading
      if (entry.spatial.avgCharsPerLine > 80 && fs <= 20
          && !crowdSeen.has(fs + '|wide-measure')) {
        crowding.push({
          fontSize: fs, issue: 'wide-measure',
          avgCharsPerLine: entry.spatial.avgCharsPerLine, threshold: 80,
        });
        crowdSeen.add(fs + '|wide-measure');
      }
      // Cramped heading: font > 8% of container width
      if (entry.spatial.containerRatio > 0.08 && fs >= 24
          && !crowdSeen.has(fs + '|cramped-in-container')) {
        crowding.push({
          fontSize: fs, issue: 'cramped-in-container',
          containerRatio: entry.spatial.containerRatio, threshold: 0.08,
          avgContainerW: entry.spatial.avgContainerW,
        });
        crowdSeen.add(fs + '|cramped-in-container');
      }
      // Lost body text: font < 1% of container width
      if (entry.spatial.containerRatio > 0 && entry.spatial.containerRatio < 0.01 && fs <= 20
          && !crowdSeen.has(fs + '|lost-in-container')) {
        crowding.push({
          fontSize: fs, issue: 'lost-in-container',
          containerRatio: entry.spatial.containerRatio, threshold: 0.01,
          avgContainerW: entry.spatial.avgContainerW,
        });
        crowdSeen.add(fs + '|lost-in-container');
      }
      // Viewport-oversized: text > 10% of viewport width
      if (entry.vwRatio > 0.1 && !crowdSeen.has(fs + '|viewport-oversized')) {
        crowding.push({
          fontSize: fs, issue: 'viewport-oversized',
          vwRatio: entry.vwRatio, threshold: 0.1,
        });
        crowdSeen.add(fs + '|viewport-oversized');
      }
      // Heading gap too small: heading with <0.5em gap to next element
      if (entry.spatial.avgGapToNext !== null && entry.spatial.avgGapToNext < fs * 0.5
          && fs >= 18 && !crowdSeen.has(fs + '|tight-heading-gap')) {
        crowding.push({
          fontSize: fs, issue: 'tight-heading-gap',
          avgGapToNext: entry.spatial.avgGapToNext, threshold: +(fs * 0.5).toFixed(1),
        });
        crowdSeen.add(fs + '|tight-heading-gap');
      }
    }

    // Density classification
    const density = distinctSizes.length <= 5 ? 'sparse'
      : distinctSizes.length <= 8 ? 'moderate' : 'dense';

    // Modular scale detection
    const scaleType = ratioStdDev < 0.05 ? 'modular'
      : ratioStdDev <= 0.15 ? 'semi-modular' : 'custom';

    const scaleAnalysis = {
      distinctSizes,
      ratios: scaleRatios,
      ratioAvg,
      ratioStdDev,
      range: sizeRange,
      hierarchyScore,
      weightDelta: +weightDelta.toFixed(0),
      density,
      scaleType: scaleType + (scaleType === 'modular' && ratioAvg ? ` (${ratioAvg}×)` : ''),
    };

    // Deduplicate families
    const families = [...familySet.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([family, count]) => ({ family, count }));

    // Text truncation count
    let truncatedElements = 0;
    const truncCandidates = root.querySelectorAll('*');
    for (let i = 0; i < truncCandidates.length; i++) {
      const cs2 = window.getComputedStyle(truncCandidates[i]);
      if (cs2.textOverflow === 'ellipsis') truncatedElements++;
    }

    const data = {
      scanned,
      truncatedElements,
      families,
      scale: enrichedScale.map(s => ({
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        lineHeightRatio: s.lineHeightRatio,
        leading: s.leading,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        count: s.count,
        tags: s.tags,
        sample: s.sample,
        vwRatio: s.vwRatio,
        spatial: s.spatial,
      })),
      scaleAnalysis,
      groups,
      crowding,
      weights,
      letterSpacing: letterSpacingMap,
      textTransform: textTransformMap,
    };

    if (o.format === 'text') {
      // Build text report
      const lines = [];
      lines.push(`Typography Profile — ${scanned} text elements scanned` + (truncatedElements ? `, ${truncatedElements} truncated` : ''));
      lines.push('');

      lines.push('Font families:');
      families.forEach(f => {
        lines.push(`  ${f.family}  (${f.count} elements)`);
      });
      lines.push('');

      lines.push(`Type scale (${enrichedScale.length} distinct styles):`);
      enrichedScale.forEach(s => {
        lines.push(`  ${s.fontSize}px / ${s.fontWeight} / lh:${s.lineHeightRatio}× (${s.leading}px leading) — ${s.count}× [${s.tags.join(', ')}] "${s.sample}"`);
        let spatialLine = `    spatial: ${s.spatial.avgBoxW}×${s.spatial.avgBoxH}px box, spaceY:${s.spatial.effectiveSpaceY}px (${s.spatial.avgMarginY}m+${s.spatial.avgPadY}p+${s.spatial.avgParentPadY}pp), ~${s.spatial.avgCharsPerLine} chars/line, ${s.spatial.breathingRoom}× breathing room`;
        if (s.spatial.avgContainerW) spatialLine += `, container:${s.spatial.avgContainerW}px (${(s.spatial.containerRatio * 100).toFixed(1)}%)`;
        if (s.spatial.avgGapToNext !== null) spatialLine += `, gapToNext:${s.spatial.avgGapToNext}px`;
        spatialLine += `, vw:${(s.vwRatio * 100).toFixed(1)}%`;
        lines.push(spatialLine);
      });
      lines.push('');

      lines.push(`Scale analysis: ${distinctSizes.length} sizes, range ${sizeRange}×, hierarchy ${hierarchyScore}/100, ${density} density, ${scaleAnalysis.scaleType} scale`);
      if (scaleRatios.length) {
        lines.push(`  Ratios: ${scaleRatios.join(', ')} (avg ${ratioAvg}, σ${ratioStdDev})`);
      }
      lines.push(`  Weight contrast: ${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(0)} (heading avg ${avgHeadingW.toFixed(0)} vs body avg ${avgBodyW.toFixed(0)})`);
      lines.push('');

      lines.push('Semantic groups:');
      for (const [role, entries] of Object.entries(groups)) {
        if (entries.length === 0) continue;
        const sizes = entries.map(e => e.fontSize + 'px').join(', ');
        lines.push(`  ${role}: ${entries.length} styles (${sizes})`);
      }
      lines.push('');

      lines.push('Weight distribution:');
      Object.entries(weights).sort((a, b) => +a[0] - +b[0]).forEach(([w, c]) => {
        lines.push(`  ${w}: ${c} elements`);
      });

      if (Object.keys(letterSpacingMap).length > 0) {
        lines.push('');
        lines.push('Letter-spacing patterns:');
        Object.entries(letterSpacingMap).sort((a, b) => b[1] - a[1]).forEach(([v, c]) => {
          lines.push(`  ${v}: ${c} elements`);
        });
      }

      if (Object.keys(textTransformMap).length > 0) {
        lines.push('');
        lines.push('Text-transform usage:');
        Object.entries(textTransformMap).sort((a, b) => b[1] - a[1]).forEach(([v, c]) => {
          lines.push(`  ${v}: ${c} elements`);
        });
      }

      if (crowding.length) {
        lines.push('');
        lines.push('Crowding flags:');
        crowding.forEach(c => {
          if (c.issue === 'tight-leading') lines.push(`  ⚠ ${c.fontSize}px: tight leading (${c.lineHeightRatio}× < ${c.threshold}×)`);
          if (c.issue === 'no-spacing') lines.push(`  ⚠ ${c.fontSize}px: no vertical spacing (${c.effectiveSpaceY}px effective)`);
          if (c.issue === 'wide-measure') lines.push(`  ⚠ ${c.fontSize}px: wide measure (~${c.avgCharsPerLine} chars/line, max ${c.threshold})`);
          if (c.issue === 'cramped-in-container') lines.push(`  ⚠ ${c.fontSize}px: cramped in container (${(c.containerRatio * 100).toFixed(1)}% of ${c.avgContainerW}px)`);
          if (c.issue === 'lost-in-container') lines.push(`  ⚠ ${c.fontSize}px: lost in container (${(c.containerRatio * 100).toFixed(1)}% of ${c.avgContainerW}px)`);
          if (c.issue === 'viewport-oversized') lines.push(`  ⚠ ${c.fontSize}px: oversized for viewport (${(c.vwRatio * 100).toFixed(1)}vw > 10vw)`);
          if (c.issue === 'tight-heading-gap') lines.push(`  ⚠ ${c.fontSize}px: tight heading gap (${c.avgGapToNext}px < ${c.threshold}px)`);
        });
      }

      return { text: lines.join('\n'), data };
    }

    return data;
  }

