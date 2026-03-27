(() => {
  'use strict';

  // Skip if already loaded
  if (window.__ps) return;

  // Force grayscale antialiasing — prevents subpixel color fringing in screenshots.
  // Without this, Chromium on Linux bakes RGB subpixel data into text edges,
  // which looks wrong on OLED, projectors, or any non-RGB-stripe display.
  function injectAA() {
    const aaStyle = document.createElement('style');
    aaStyle.textContent = '*, *::before, *::after { -webkit-font-smoothing: antialiased !important; -moz-osx-font-smoothing: grayscale !important; }';
    (document.head || document.documentElement).appendChild(aaStyle);
  }
  if (document.head || document.documentElement) injectAA();
  else document.addEventListener('DOMContentLoaded', injectAA);

