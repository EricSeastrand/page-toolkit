  // === Layout utilities ===

  function boxModel(el) {
    const rect = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    const px = v => parseFloat(v) || 0;
    const margin = { top: px(s.marginTop), right: px(s.marginRight), bottom: px(s.marginBottom), left: px(s.marginLeft) };
    const border = { top: px(s.borderTopWidth), right: px(s.borderRightWidth), bottom: px(s.borderBottomWidth), left: px(s.borderLeftWidth) };
    const padding = { top: px(s.paddingTop), right: px(s.paddingRight), bottom: px(s.paddingBottom), left: px(s.paddingLeft) };
    const contentW = rect.width - padding.left - padding.right - border.left - border.right;
    const contentH = rect.height - padding.top - padding.bottom - border.top - border.bottom;
    return {
      content: { w: +contentW.toFixed(1), h: +contentH.toFixed(1) },
      padding, border, margin,
      inner: { w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
      outer: {
        w: +(rect.width + margin.left + margin.right).toFixed(1),
        h: +(rect.height + margin.top + margin.bottom).toFixed(1),
      },
      rect: { x: +rect.x.toFixed(1), y: +rect.y.toFixed(1), w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
    };
  }

  function pctOfParent(el) {
    const parent = el.offsetParent || el.parentElement;
    if (!parent) return null;
    const elRect = el.getBoundingClientRect();
    const pRect = parent.getBoundingClientRect();
    if (pRect.width === 0 || pRect.height === 0) return null;
    return {
      parent: elPath(parent),
      wPct: +(elRect.width / pRect.width * 100).toFixed(1),
      hPct: +(elRect.height / pRect.height * 100).toFixed(1),
    };
  }

