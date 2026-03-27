  // === OKLCH color space (Ottosson 2020) ===

  function linearize(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function rgbToOklab(r, g, b) {
    const lr = linearize(r), lg = linearize(g), lb = linearize(b);
    // M1: linear sRGB → LMS
    const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
    // Cube root
    const lp = Math.cbrt(l), mp = Math.cbrt(m), sp = Math.cbrt(s);
    // M2: LMS' → OKLab
    return {
      L: 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp,
      a: 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp,
      b: 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp,
    };
  }

  function oklabToOklch(lab) {
    const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { L: lab.L, C, h };
  }

  function rgbToOklch(r, g, b) {
    return oklabToOklch(rgbToOklab(r, g, b));
  }

  function oklchToRgb(L, C, h) {
    const hRad = h * Math.PI / 180;
    const a = C * Math.cos(hRad), b = C * Math.sin(hRad);
    // Inverse M2: OKLab → LMS'
    const lp = L + 0.3963377774 * a + 0.2158037573 * b;
    const mp = L - 0.1055613458 * a - 0.0638541728 * b;
    const sp = L - 0.0894841775 * a - 1.2914855480 * b;
    // Cube: LMS' → LMS
    const l = lp * lp * lp, m = mp * mp * mp, s = sp * sp * sp;
    // Inverse M1: LMS → linear sRGB
    const lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    // Gamma encode
    const gamma = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return {
      r: Math.round(Math.min(255, Math.max(0, gamma(lr) * 255))),
      g: Math.round(Math.min(255, Math.max(0, gamma(lg) * 255))),
      b: Math.round(Math.min(255, Math.max(0, gamma(lb) * 255))),
    };
  }

  function deltaEOK(lch1, lch2) {
    const dL = lch1.L - lch2.L;
    const dC = lch1.C - lch2.C;
    const h1 = lch1.h * Math.PI / 180, h2 = lch2.h * Math.PI / 180;
    const dh = 2 * Math.sqrt(lch1.C * lch2.C) * Math.sin((h1 - h2) / 2);
    return Math.sqrt(dL * dL + dC * dC + dh * dh);
  }

  function chromaLabel(C) {
    if (C < 0.02) return 'neutral';
    if (C < 0.06) return 'tinted neutral';
    if (C < 0.15) return 'moderate';
    if (C < 0.25) return 'vivid';
    return 'intense';
  }

