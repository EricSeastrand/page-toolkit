  // === Tool: Motion Profile ===

  function motionProfile(opts) {
    const o = Object.assign({ scope: 'body', maxElements: 3000 }, opts);
    const root = document.querySelector(o.scope) || document.body;
    const els = root.querySelectorAll('*');

    let scanned = 0;
    const seenAnimations = new Map(); // name -> { details, elementCount }
    const seenTransitions = new Map(); // signature -> { details, elementCount }

    function parseDuration(d) {
      if (!d) return 0;
      d = d.trim();
      if (d.endsWith('ms')) return parseFloat(d);
      if (d.endsWith('s')) return parseFloat(d) * 1000;
      return parseFloat(d) || 0;
    }

    function splitCSV(val) {
      if (!val) return [];
      // Split on commas but respect parentheses (e.g. cubic-bezier(0.4, 0, 0.68, 0.06))
      const parts = [];
      let depth = 0, start = 0;
      for (let k = 0; k < val.length; k++) {
        if (val[k] === '(') depth++;
        else if (val[k] === ')') depth--;
        else if (val[k] === ',' && depth === 0) {
          parts.push(val.substring(start, k).trim());
          start = k + 1;
        }
      }
      parts.push(val.substring(start).trim());
      return parts.filter(Boolean);
    }

    function classifyAnimation(name, iterationCount, duration) {
      if (iterationCount === 'infinite') return 'loading';
      const lc = (name || '').toLowerCase();
      const ms = parseDuration(duration);
      if (/fade|slide|appear|enter|reveal/.test(lc)) return 'entrance';
      if (ms > 0 && ms <= 800 && /opacity|transform/.test(lc)) return 'entrance';
      return 'state-change';
    }

    function classifyTransition(el, properties, computedStyle) {
      const tag = el.tagName.toLowerCase();
      const isInteractive = tag === 'a' || tag === 'button'
        || el.getAttribute('role') === 'button'
        || computedStyle.cursor === 'pointer';
      if (isInteractive) return 'hover';
      const structural = ['height', 'width', 'max-height', 'max-width', 'min-height', 'min-width', 'display'];
      if (properties.some(p => structural.includes(p))) return 'structural';
      return 'visual';
    }

    for (let i = 0; i < els.length && scanned < o.maxElements; i++) {
      const el = els[i];
      if (!isVisible(el)) continue;
      scanned++;

      const s = window.getComputedStyle(el);
      const path = elPath(el);
      const tag = el.tagName.toLowerCase();

      // Check animations
      const animName = s.animationName;
      if (animName && animName !== 'none') {
        const names = splitCSV(animName);
        const durations = splitCSV(s.animationDuration);
        const timings = splitCSV(s.animationTimingFunction);
        const iterations = splitCSV(s.animationIterationCount);
        const fillModes = splitCSV(s.animationFillMode);
        const delays = splitCSV(s.animationDelay);

        for (let j = 0; j < names.length; j++) {
          const n = names[j];
          if (n === 'none') continue;
          if (seenAnimations.has(n)) {
            seenAnimations.get(n).elementCount++;
          } else {
            const dur = durations[j] || durations[0] || '0s';
            const iter = iterations[j] || iterations[0] || '1';
            seenAnimations.set(n, {
              name: n,
              duration: dur,
              timing: timings[j] || timings[0] || 'ease',
              iterationCount: iter,
              fillMode: fillModes[j] || fillModes[0] || 'none',
              delay: delays[j] || delays[0] || '0s',
              path,
              tag,
              classification: classifyAnimation(n, iter, dur),
              elementCount: 1,
            });
          }
        }
      }

      // Check transitions
      const transProp = s.transitionProperty;
      if (transProp && transProp !== 'all' && transProp !== 'none') {
        const properties = splitCSV(transProp);
        const durations = splitCSV(s.transitionDuration);
        const delays = splitCSV(s.transitionDelay);
        const timings = splitCSV(s.transitionTimingFunction);

        // Skip if all durations are 0
        const hasNonZero = durations.some(d => parseDuration(d) > 0);
        if (hasNonZero) {
          const sig = [...properties].sort().join('+') + '|' + durations.join(',') + '|' + timings.join(',');
          if (seenTransitions.has(sig)) {
            seenTransitions.get(sig).elementCount++;
          } else {
            seenTransitions.set(sig, {
              properties,
              duration: durations,
              delay: delays,
              timing: timings,
              path,
              tag,
              classification: classifyTransition(el, properties, s),
              elementCount: 1,
            });
          }
        }
      }
    }

    const animations = [...seenAnimations.values()];
    const transitions = [...seenTransitions.values()];

    // Collect all durations in ms
    const allDurationsMs = [];
    animations.forEach(a => allDurationsMs.push(parseDuration(a.duration)));
    transitions.forEach(t => t.duration.forEach(d => allDurationsMs.push(parseDuration(d))));
    const validDurations = allDurationsMs.filter(d => d > 0).sort((a, b) => a - b);

    const durationRange = { min: 0, max: 0, median: 0 };
    if (validDurations.length > 0) {
      durationRange.min = validDurations[0];
      durationRange.max = validDurations[validDurations.length - 1];
      const mid = Math.floor(validDurations.length / 2);
      durationRange.median = validDurations.length % 2 === 0
        ? (validDurations[mid - 1] + validDurations[mid]) / 2
        : validDurations[mid];
    }

    // Most common easings
    const easingCounts = new Map();
    animations.forEach(a => {
      easingCounts.set(a.timing, (easingCounts.get(a.timing) || 0) + a.elementCount);
    });
    transitions.forEach(t => {
      t.timing.forEach(fn => {
        easingCounts.set(fn, (easingCounts.get(fn) || 0) + t.elementCount);
      });
    });
    const topEasings = [...easingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([easing, count]) => ({ easing, count }));

    // Classifications
    const classifications = {};
    animations.forEach(a => {
      classifications[a.classification] = (classifications[a.classification] || 0) + 1;
    });
    transitions.forEach(t => {
      classifications[t.classification] = (classifications[t.classification] || 0) + 1;
    });

    // Build text report
    const lines = [];
    lines.push('=== MOTION PROFILE ===');
    lines.push('');
    lines.push(`Scanned ${scanned} elements`);
    lines.push(`Animations: ${animations.length} unique (${animations.reduce((s, a) => s + a.elementCount, 0)} elements)`);
    lines.push(`Transitions: ${transitions.length} unique (${transitions.reduce((s, t) => s + t.elementCount, 0)} elements)`);
    lines.push('');

    if (animations.length > 0) {
      lines.push('Animations:');
      animations.forEach(a => {
        lines.push(`  ${a.name} — ${a.duration} ${a.timing} [${a.classification}] ×${a.elementCount} (${a.path})`);
      });
      lines.push('');
    }

    if (transitions.length > 0) {
      lines.push('Transitions:');
      transitions.forEach(t => {
        lines.push(`  ${t.properties.join(', ')} — ${t.duration.join(', ')} ${t.timing.join(', ')} [${t.classification}] ×${t.elementCount} (${t.path})`);
      });
      lines.push('');
    }

    if (validDurations.length > 0) {
      lines.push(`Duration range: ${durationRange.min}ms – ${durationRange.max}ms (median ${durationRange.median}ms)`);
    }

    if (topEasings.length > 0) {
      lines.push(`Top easings: ${topEasings.map(e => `${e.easing} (×${e.count})`).join(', ')}`);
    }

    if (Object.keys(classifications).length > 0) {
      lines.push(`Classifications: ${Object.entries(classifications).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }

    const summary = {
      totalAnimations: animations.length,
      totalTransitions: transitions.length,
      durationRange,
      topEasings,
      classifications,
    };

    return {
      text: lines.join('\n'),
      data: {
        scanned,
        animations,
        transitions,
        summary,
      },
    };
  }

