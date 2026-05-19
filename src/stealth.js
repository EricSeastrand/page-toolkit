/**
 * Stealth configuration for headless browser anti-detection.
 *
 * Patches JavaScript-visible signals that bot detectors check.
 * Used as an addInitScript — runs before any page code.
 *
 * Browserless v2 `stealth=true` handles some basics (webdriver, chrome obj).
 * This script covers the remaining gaps:
 *   - User-agent consistency (platform, appVersion)
 *   - WebGL renderer spoofing (SwiftShader → real GPU)
 *   - performance.memory stub
 *   - Media devices (speakers/mic/webcam)
 *   - Screen dimensions matching viewport
 */

// --- navigator.webdriver ---
// Belt-and-suspenders: Browserless stealth should handle this,
// but patch it anyway in case stealth param is missing.
Object.defineProperty(navigator, 'webdriver', {
  get: () => false,
  configurable: true,
});

// --- User-Agent consistency ---
// Platform and appVersion must match the UA string. The UA may be set by
// Playwright context options OR by Browserless stealth (which patches UA
// after init scripts run). Use lazy getters so they read the UA at call
// time, not at init time.
Object.defineProperty(navigator, 'platform', {
  get: () => {
    const ua = navigator.userAgent;
    if (ua.includes('Macintosh')) return 'MacIntel';
    if (ua.includes('Windows')) return 'Win32';
    if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux x86_64';
    return 'Win32'; // safe default
  },
  configurable: true,
});

Object.defineProperty(navigator, 'appVersion', {
  get: () => navigator.userAgent.replace(/^Mozilla\//, ''),
  configurable: true,
});

// --- WebGL renderer spoofing ---
// SwiftShader is a dead giveaway for headless. Spoof to a common GPU.
const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
const spoofedRenderer = 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
const spoofedVendor = 'Google Inc. (Apple)';

WebGLRenderingContext.prototype.getParameter = function(param) {
  const UNMASKED_VENDOR = 0x9245;   // UNMASKED_VENDOR_WEBGL
  const UNMASKED_RENDERER = 0x9246; // UNMASKED_RENDERER_WEBGL
  if (param === UNMASKED_VENDOR) return spoofedVendor;
  if (param === UNMASKED_RENDERER) return spoofedRenderer;
  return originalGetParameter.call(this, param);
};

// WebGL2 uses the same constants
if (typeof WebGL2RenderingContext !== 'undefined') {
  const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter = function(param) {
    const UNMASKED_VENDOR = 0x9245;
    const UNMASKED_RENDERER = 0x9246;
    if (param === UNMASKED_VENDOR) return spoofedVendor;
    if (param === UNMASKED_RENDERER) return spoofedRenderer;
    return originalGetParameter2.call(this, param);
  };
}

// --- performance.memory ---
// Chrome exposes this but headless returns an empty object with no properties.
// Real Chrome has jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize.
const memoryOk = (() => {
  try { return performance.memory && performance.memory.jsHeapSizeLimit > 0; }
  catch { return false; }
})();
if (!memoryOk) {
  Object.defineProperty(performance, 'memory', {
    get: () => ({
      jsHeapSizeLimit: 2172649472,
      totalJSHeapSize: 35839693,
      usedJSHeapSize: 24190976,
    }),
    configurable: true,
  });
}

// --- MediaDevices enumeration ---
// Real browsers report at least some devices. Headless reports 0.
if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
  const originalEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
  navigator.mediaDevices.enumerateDevices = async function() {
    const devices = await originalEnumerate();
    if (devices.length === 0) {
      // Return plausible device list when none exist
      return [
        { deviceId: 'default', kind: 'audioinput', label: '', groupId: 'default' },
        { deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'default' },
        { deviceId: 'default', kind: 'videoinput', label: '', groupId: 'default' },
      ];
    }
    return devices;
  };
}
