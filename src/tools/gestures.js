  // === Tool: Gesture Planner — compute CDP-ready touch event sequences ===

  // Returns an array of CDP Input.dispatchTouchEvent steps.
  // Execute with browser_run_code + CDPSession.
  //
  // Supported gestures:
  //   touchScroll  — single-finger scroll on/near an element
  //   touchTap     — tap an element (touchstart → pause → touchend → click synthesis)
  //   touchDrag    — drag from one point to another
  //   touchHold    — long press
  //
  // Coordinates: viewport percentages by default, or px if `{px: true}`
  // Curves: named presets or [x1,y1,x2,y2] cubic-bezier

  function gesturePlan(type, opts) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    function resolvePoint(spec) {
      if (typeof spec === 'string') {
        // Selector — use center of element
        const el = document.querySelector(spec);
        if (!el) return { error: 'No element: ' + spec };
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      if (spec.px) return { x: spec.x, y: spec.y };
      // Percentage of viewport
      return { x: Math.round(spec.x / 100 * vw), y: Math.round(spec.y / 100 * vh) };
    }

    const steps = [];
    const fps = opts?.fps || 60;
    const frameMs = Math.round(1000 / fps);

    if (type === 'touchScroll') {
      // opts: { target, deltaX?, deltaY, duration?, curve?, fps? }
      const o = Object.assign({ deltaX: 0, deltaY: -200, duration: 300, curve: 'scroll' }, opts);
      const start = resolvePoint(o.target || { x: 50, y: 50 });
      if (start.error) return { error: start.error };

      const easing = resolveEasing(o.curve);
      const frames = Math.max(2, Math.round(o.duration / frameMs));

      steps.push({ type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }], wait: frameMs });

      for (let i = 1; i <= frames; i++) {
        const t = i / frames;
        const progress = interpolate(t, easing);
        steps.push({
          type: 'touchMove',
          touchPoints: [{
            x: Math.round(start.x + o.deltaX * progress),
            y: Math.round(start.y + o.deltaY * progress),
          }],
          wait: frameMs,
        });
      }

      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else if (type === 'touchTap') {
      // opts: { target, holdMs? }
      const o = Object.assign({ holdMs: 50 }, opts);
      const pt = resolvePoint(o.target || { x: 50, y: 50 });
      if (pt.error) return { error: pt.error };

      steps.push({ type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }], wait: o.holdMs });
      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else if (type === 'touchDrag') {
      // opts: { from, to, duration?, curve?, fps? }
      const o = Object.assign({ duration: 400, curve: 'ease', fps: 60 }, opts);
      const from = resolvePoint(o.from);
      const to = resolvePoint(o.to);
      if (from.error) return { error: from.error };
      if (to.error) return { error: to.error };

      const easing = resolveEasing(o.curve);
      const frames = Math.max(2, Math.round(o.duration / frameMs));
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      steps.push({ type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }], wait: frameMs });

      for (let i = 1; i <= frames; i++) {
        const t = i / frames;
        const progress = interpolate(t, easing);
        steps.push({
          type: 'touchMove',
          touchPoints: [{
            x: Math.round(from.x + dx * progress),
            y: Math.round(from.y + dy * progress),
          }],
          wait: frameMs,
        });
      }

      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else if (type === 'touchHold') {
      // opts: { target, holdMs? }
      const o = Object.assign({ holdMs: 600 }, opts);
      const pt = resolvePoint(o.target || { x: 50, y: 50 });
      if (pt.error) return { error: pt.error };

      steps.push({ type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }], wait: o.holdMs });
      steps.push({ type: 'touchEnd', touchPoints: [], wait: 0 });

    } else {
      return { error: 'Unknown gesture type: ' + type };
    }

    return {
      gesture: type,
      steps,
      stepCount: steps.length,
      totalMs: steps.reduce((sum, s) => sum + (s.wait || 0), 0),
      viewport: { w: vw, h: vh },
    };
  }

  // === Tool: Gesture Capture — instrument touch/mouse/focus events for analysis ===

  let _captureLog = null;
  let _captureCleanup = null;
  let _captureScrollSnap = null; // snapshot of all scroller positions at capture start

  function gestureCapture(selector, opts) {
    const o = Object.assign({ events: ['touchstart','touchmove','touchend','mousedown','mouseup','click','focus','blur','scroll'] }, opts);

    // Clean up any previous capture
    if (_captureCleanup) _captureCleanup();

    _captureLog = [];
    const removers = [];
    const startTime = Date.now();

    // Snapshot scroll positions of ALL overflow containers + window at start
    _captureScrollSnap = { windowScrollY: window.scrollY, containers: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let wNode;
    while ((wNode = walker.nextNode())) {
      const s = getComputedStyle(wNode);
      if (['auto', 'scroll'].includes(s.overflowX) || ['auto', 'scroll'].includes(s.overflowY)) {
        if (wNode.scrollHeight > wNode.clientHeight || wNode.scrollWidth > wNode.clientWidth) {
          _captureScrollSnap.containers.push({
            el: wNode,
            path: elPath(wNode),
            scrollTop: wNode.scrollTop,
            scrollLeft: wNode.scrollLeft,
            deltaY: wNode.scrollHeight - wNode.clientHeight,
          });
        }
      }
    }

    // Element-level events
    const el = selector ? document.querySelector(selector) : null;
    const listenTarget = el || document;

    for (const eventName of o.events) {
      const handler = (e) => {
        const entry = {
          event: eventName,
          t: Date.now() - startTime,
          target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
        };
        if (e.touches) entry.touches = e.touches.length;
        if (e.touches && e.touches.length > 0) {
          entry.x = Math.round(e.touches[0].clientX); entry.y = Math.round(e.touches[0].clientY);
        } else if (e.clientX !== undefined) {
          entry.x = Math.round(e.clientX); entry.y = Math.round(e.clientY);
        }
        if (eventName === 'scroll') {
          entry.scrollTop = (e.target === document ? window.scrollY : e.target.scrollTop);
        }
        if (eventName === 'blur' || eventName === 'focus') {
          entry.activeElement = document.activeElement?.tagName + '#' + (document.activeElement?.id || '');
        }
        entry.defaultPrevented = e.defaultPrevented;
        _captureLog.push(entry);
      };
      listenTarget.addEventListener(eventName, handler, { capture: true, passive: true });
      removers.push(() => listenTarget.removeEventListener(eventName, handler, { capture: true }));
    }

    // Also capture on window for scroll
    if (o.events.includes('scroll')) {
      const scrollHandler = () => {
        _captureLog.push({ event: 'window-scroll', t: Date.now() - startTime, scrollY: window.scrollY });
      };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      removers.push(() => window.removeEventListener('scroll', scrollHandler));
    }

    _captureCleanup = () => { removers.forEach(r => r()); _captureCleanup = null; };

    return { capturing: true, target: selector || 'document', events: o.events };
  }

  function gestureResults() {
    const log = _captureLog || [];
    if (_captureCleanup) _captureCleanup();
    _captureLog = null;
    const snap = _captureScrollSnap;
    _captureScrollSnap = null;

    // Analyze the log
    const eventCounts = {};
    for (const entry of log) {
      eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
    }

    const blurEvents = log.filter(e => e.event === 'blur');
    const scrollEvents = log.filter(e => e.event === 'window-scroll');
    const touchEvents = log.filter(e => e.event.startsWith('touch'));
    const mouseEvents = log.filter(e => ['mousedown', 'mouseup', 'click'].includes(e.event));

    // --- Hit context: what element did the touch land on? ---
    let hitContext = null;
    const firstTouch = touchEvents.find(e => e.event === 'touchstart');
    if (firstTouch && firstTouch.x !== undefined) {
      const hitEl = document.elementFromPoint(firstTouch.x, firstTouch.y);
      if (hitEl) {
        // Walk up to find the nearest scroll container
        let scrollParent = null;
        let walk = hitEl;
        while (walk && walk !== document.documentElement) {
          const s = getComputedStyle(walk);
          if (['auto', 'scroll'].includes(s.overflowX) || ['auto', 'scroll'].includes(s.overflowY)) {
            const deltaY = walk.scrollHeight - walk.clientHeight;
            scrollParent = {
              path: elPath(walk),
              overflow: s.overflowY,
              scrollDelta: deltaY,
              isTrap: deltaY > 0 && deltaY <= 50,
            };
            break;
          }
          walk = walk.parentElement;
        }
        hitContext = {
          touchPoint: { x: firstTouch.x, y: firstTouch.y },
          element: elPath(hitEl),
          scrollParent,
        };
      }
    }

    // --- Scroll deltas: compare before/after for all containers ---
    let scrollDeltas = null;
    if (snap) {
      const windowDelta = window.scrollY - snap.windowScrollY;
      const containerDeltas = [];
      for (const c of snap.containers) {
        const now = c.el.scrollTop;
        const delta = now - c.scrollTop;
        if (delta !== 0) {
          containerDeltas.push({
            path: c.path,
            before: c.scrollTop,
            after: now,
            moved: delta,
            maxRange: c.deltaY,
            consumedAll: now >= c.deltaY || now <= 0,
          });
        }
      }
      scrollDeltas = {
        window: { before: snap.windowScrollY, after: window.scrollY, moved: windowDelta },
        containers: containerDeltas,
        trapped: containerDeltas.length > 0 && windowDelta === 0,
      };
    }

    return {
      entryCount: log.length,
      eventCounts,
      blurFired: blurEvents.length > 0,
      blurEvents,
      scrolled: scrollEvents.length > 0,
      finalScrollY: scrollEvents.length > 0 ? scrollEvents[scrollEvents.length - 1].scrollY : null,
      hitContext,
      scrollDeltas,
      touchSequence: touchEvents.map(e => ({ event: e.event, t: e.t, touches: e.touches })),
      mouseSequence: mouseEvents.map(e => ({ event: e.event, t: e.t, defaultPrevented: e.defaultPrevented })),
      log,
    };
  }

