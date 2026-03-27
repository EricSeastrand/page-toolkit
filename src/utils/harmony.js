  function hueDistance(h1, h2) {
    const d = Math.abs(h1 - h2) % 360;
    return d > 180 ? 360 - d : d;
  }

  function harmonyClass(hues) {
    if (hues.length < 2) return 'monochromatic';
    // Sort hues, compute gaps
    const sorted = [...hues].sort((a, b) => a - b);
    if (sorted.length === 2) {
      const d = hueDistance(sorted[0], sorted[1]);
      if (d <= 30) return 'analogous';
      if (d >= 150 && d <= 210) return 'complementary';
      if (d >= 120 && d < 150) return 'split-complementary';
      if (d >= 210 && d <= 240) return 'split-complementary';
      return 'contrast';
    }
    // 3+ hues: check triadic (roughly 120° apart) or other
    const gaps = [];
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      gaps.push(hueDistance(sorted[i], next));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const maxDev = Math.max(...gaps.map(g => Math.abs(g - avgGap)));
    if (sorted.length === 3 && avgGap > 100 && maxDev < 30) return 'triadic';
    if (sorted.length === 4 && avgGap > 70 && maxDev < 25) return 'tetradic';
    // Compute occupied arc: the smallest arc that contains all hues
    // = 360 minus the largest gap between consecutive sorted hues
    const wrappedGaps = [];
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const gap = ((next - sorted[i]) % 360 + 360) % 360;
      wrappedGaps.push(gap || 360); // 0 means same hue, treat as full circle
    }
    const occupiedArc = 360 - Math.max(...wrappedGaps);
    if (occupiedArc < 90) return 'analogous';
    return 'multi-hue';
  }

