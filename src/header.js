(() => {
  'use strict';

  // Skip if already loaded
  if (window.__ps) return;

  // Force grayscale antialiasing — prevents subpixel color fringing in screenshots.
  // Without this, Chromium on Linux bakes RGB subpixel data into text edges,
  // which looks wrong on OLED, projectors, or any non-RGB-stripe display.
  const aaStyle = document.createElement('style');
  aaStyle.textContent = '*, *::before, *::after { -webkit-font-smoothing: antialiased !important; -moz-osx-font-smoothing: grayscale !important; }';
  (document.head || document.documentElement).appendChild(aaStyle);

