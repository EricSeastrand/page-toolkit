  // === Bezier curve interpolation ===

  // Named easing presets: [x1, y1, x2, y2] control points
  const EASING = {
    linear:    [0, 0, 1, 1],
    ease:      [0.25, 0.1, 0.25, 1],
    easeIn:    [0.42, 0, 1, 1],
    easeOut:   [0, 0, 0.58, 1],
    easeInOut: [0.42, 0, 0.58, 1],
    // Gesture-specific: fast start, long deceleration (flick)
    flick:     [0.2, 0.8, 0.3, 1],
    // Deliberate scroll: even acceleration
    scroll:    [0.4, 0, 0.6, 1],
  };

  function cubicBezier(t, p1, p2) {
    // Attempt Newton-Raphson to solve for bezier parameter u at time t
    // Then evaluate the y-coordinate
    const [x1, y1, x2, y2] = [...p1, ...p2];
    // Bezier x(u) = 3(1-u)^2*u*x1 + 3(1-u)*u^2*x2 + u^3
    function bx(u) { return 3*(1-u)*(1-u)*u*x1 + 3*(1-u)*u*u*x2 + u*u*u; }
    function by(u) { return 3*(1-u)*(1-u)*u*y1 + 3*(1-u)*u*u*y2 + u*u*u; }
    function bxPrime(u) { return 3*(1-u)*(1-u)*x1 + 6*(1-u)*u*(x2-x1) + 3*u*u*(1-x2); }

    // Newton-Raphson to find u where bx(u) ≈ t
    let u = t;
    for (let i = 0; i < 8; i++) {
      const dx = bx(u) - t;
      if (Math.abs(dx) < 1e-6) break;
      const deriv = bxPrime(u);
      if (Math.abs(deriv) < 1e-6) break;
      u -= dx / deriv;
      u = Math.max(0, Math.min(1, u));
    }
    return by(u);
  }

  function resolveEasing(curve) {
    if (!curve || curve === 'linear') return null;
    if (typeof curve === 'string') {
      const preset = EASING[curve];
      if (!preset) return null;
      if (curve === 'linear') return null;
      return [[preset[0], preset[1]], [preset[2], preset[3]]];
    }
    // Array of 4 numbers: [x1, y1, x2, y2]
    if (Array.isArray(curve) && curve.length === 4) {
      return [[curve[0], curve[1]], [curve[2], curve[3]]];
    }
    return null;
  }

  function interpolate(t, easing) {
    if (!easing) return t; // linear
    return cubicBezier(t, easing[0], easing[1]);
  }

