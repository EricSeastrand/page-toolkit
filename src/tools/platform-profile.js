  // === platformProfile: CMS, libraries, meta tags, analytics ===

  function platformProfile(opts) {
    opts = opts || {};
    const wantText = opts.format === 'text';
    const data = { cms: null, theme: null, generator: null, libraries: [], analytics: [], meta: {} };
    const lines = wantText ? [] : null;

    // Meta generator tag
    const gen = document.querySelector('meta[name="generator"]');
    if (gen) {
      data.generator = gen.content;
      if (wantText) lines.push('Generator: ' + gen.content);
    }

    // Shopify detection
    if (window.Shopify) {
      data.cms = 'Shopify';
      if (window.Shopify.theme) {
        data.theme = { name: window.Shopify.theme.name, id: window.Shopify.theme.id, role: window.Shopify.theme.role };
      }
      if (wantText) lines.push('CMS: Shopify' + (data.theme ? ' (' + data.theme.name + ', ' + data.theme.role + ')' : ''));
    }

    // WordPress detection
    if (document.querySelector('meta[name="generator"][content*="WordPress"]') ||
        document.querySelector('link[href*="wp-content"]') ||
        document.querySelector('script[src*="wp-includes"]')) {
      data.cms = data.cms || 'WordPress';
      const wpGen = document.querySelector('meta[name="generator"][content*="WordPress"]');
      if (wpGen) data.generator = wpGen.content;
      if (wantText) lines.push('CMS: WordPress' + (data.generator ? ' (' + data.generator + ')' : ''));
    }

    // Squarespace
    if (window.Static?.SQUARESPACE_CONTEXT || document.querySelector('meta[name="generator"][content*="Squarespace"]')) {
      data.cms = data.cms || 'Squarespace';
      if (wantText) lines.push('CMS: Squarespace');
    }

    // Wix
    if (document.querySelector('meta[name="generator"][content*="Wix"]') || window.wixBiSession) {
      data.cms = data.cms || 'Wix';
      if (wantText) lines.push('CMS: Wix');
    }

    if (!data.cms && wantText) lines.push('CMS: not detected');

    // JS library detection
    const libs = [];
    if (window.jQuery) libs.push('jQuery ' + (window.jQuery.fn?.jquery || '?'));
    if (window.React || document.querySelector('[data-reactroot], [data-reactid]')) libs.push('React');
    if (window.Vue || document.querySelector('[data-v-]')) libs.push('Vue');
    if (window.angular || document.querySelector('[ng-app], [data-ng-app]')) libs.push('Angular');
    if (window.Swiper) libs.push('Swiper');
    if (window.Flickity) libs.push('Flickity');
    if (window.gsap || window.TweenMax) libs.push('GSAP');
    if (window.Lodash || window._?.VERSION) libs.push('Lodash ' + (window._?.VERSION || ''));
    if (window.Alpine) libs.push('Alpine.js');
    if (window.htmx) libs.push('htmx');
    if (window.Turbo || window.Turbolinks) libs.push('Turbo');
    if (window.bootstrap) libs.push('Bootstrap');
    if (window.tailwind || document.querySelector('link[href*="tailwind"], script[src*="tailwind"]')) libs.push('Tailwind CSS');
    data.libraries = libs;
    if (libs.length && wantText) lines.push('Libraries: ' + libs.join(', '));

    // Cookie consent / CMP
    const cmps = [];
    if (window.Termly) cmps.push('Termly');
    if (window.OneTrust) cmps.push('OneTrust');
    if (window.CookieConsent || window.cookieconsent) cmps.push('CookieConsent');
    if (window.__cmp) cmps.push('CMP (IAB)');
    if (document.querySelector('[class*="cookie-banner"], [id*="cookie-banner"], [class*="consent"]')) cmps.push('cookie banner (DOM)');
    if (cmps.length) {
      data.cookieConsent = cmps;
      if (wantText) lines.push('Cookie consent: ' + cmps.join(', '));
    }

    // Analytics / tracking pixels by script src and known globals
    const analyticsMap = new Map();
    const scriptSrcs = [...document.querySelectorAll('script[src]')].map(s => s.src);
    const patterns = [
      [/google-analytics\.com|googletagmanager\.com|gtag/, 'Google Analytics/GTM'],
      [/facebook\.net|fbevents|connect\.facebook/, 'Meta Pixel'],
      [/klaviyo\.com/, 'Klaviyo'],
      [/hotjar\.com/, 'Hotjar'],
      [/segment\.com|cdn\.segment/, 'Segment'],
      [/mixpanel\.com/, 'Mixpanel'],
      [/fullstory\.com/, 'FullStory'],
      [/intercom\.io/, 'Intercom'],
      [/drift\.com/, 'Drift'],
      [/tiktok\.com\/i18n/, 'TikTok Pixel'],
      [/snaptr|sc-static\.net/, 'Snap Pixel'],
      [/pinterest\.com\/ct/, 'Pinterest Tag'],
      [/bing\.com\/bat/, 'Microsoft Ads'],
      [/clarity\.ms/, 'Microsoft Clarity'],
      [/sentry\.io|browser\.sentry/, 'Sentry'],
      [/newrelic\.com|nr-data/, 'New Relic'],
      [/datadoghq\.com/, 'Datadog'],
      [/salesforce\.com|pardot\.com|sfdc/, 'Salesforce'],
      [/hubspot\.com|hs-scripts/, 'HubSpot'],
      [/mailchimp\.com/, 'Mailchimp'],
      [/zendesk\.com/, 'Zendesk'],
      [/freshdesk\.com|freshchat/, 'Freshdesk'],
      [/tawk\.to/, 'Tawk.to'],
      [/livechat|livechatinc/, 'LiveChat'],
    ];
    for (const src of scriptSrcs) {
      for (const [re, name] of patterns) {
        if (re.test(src)) analyticsMap.set(name, true);
      }
    }
    // Also check known globals
    if (window.ga || window.gtag) analyticsMap.set('Google Analytics/GTM', true);
    if (window.fbq) analyticsMap.set('Meta Pixel', true);
    if (window.klaviyo || window._klOnsite) analyticsMap.set('Klaviyo', true);
    if (window.hj) analyticsMap.set('Hotjar', true);

    data.analytics = [...analyticsMap.keys()];
    if (data.analytics.length && wantText) {
      lines.push('');
      lines.push('Integrations (' + data.analytics.length + '):');
      for (const a of data.analytics) lines.push('  ' + a);
    }

    // Modern CSS features census
    const cssFeatures = { has: 0, layer: 0, subgrid: 0, containerQuery: 0, colorMix: 0, lightDark: 0, logicalProps: 0, fontDisplay: {} };
    const logicalRe = /\b(margin-inline|margin-block|padding-inline|padding-block|inset-inline|inset-block|border-inline|border-block)\b/;
    try {
      for (const sheet of document.styleSheets) {
        try {
          const scanRules = (rules) => {
            for (const rule of rules) {
              const txt = rule.cssText || '';
              if (txt.includes(':has(')) cssFeatures.has++;
              if (rule.type === 7 || txt.startsWith('@layer')) cssFeatures.layer++;
              if (txt.includes('subgrid')) cssFeatures.subgrid++;
              if (txt.includes('container-type') || txt.startsWith('@container')) cssFeatures.containerQuery++;
              if (txt.includes('color-mix(')) cssFeatures.colorMix++;
              if (txt.includes('light-dark(')) cssFeatures.lightDark++;
              if (logicalRe.test(txt)) cssFeatures.logicalProps++;
              if (rule instanceof CSSFontFaceRule) {
                const fd = rule.style.getPropertyValue('font-display');
                if (fd) cssFeatures.fontDisplay[fd] = (cssFeatures.fontDisplay[fd] || 0) + 1;
              }
              if (rule.cssRules) scanRules(rule.cssRules);
            }
          };
          scanRules(sheet.cssRules);
        } catch (e) { /* cross-origin sheet */ }
      }
    } catch (e) {}
    // Only include features that are actually present
    const activeFeatures = {};
    if (cssFeatures.has) activeFeatures.has = cssFeatures.has;
    if (cssFeatures.layer) activeFeatures.layer = cssFeatures.layer;
    if (cssFeatures.subgrid) activeFeatures.subgrid = cssFeatures.subgrid;
    if (cssFeatures.containerQuery) activeFeatures.containerQuery = cssFeatures.containerQuery;
    if (cssFeatures.colorMix) activeFeatures.colorMix = cssFeatures.colorMix;
    if (cssFeatures.lightDark) activeFeatures.lightDark = cssFeatures.lightDark;
    if (cssFeatures.logicalProps) activeFeatures.logicalProps = cssFeatures.logicalProps;
    if (Object.keys(cssFeatures.fontDisplay).length) activeFeatures.fontDisplay = cssFeatures.fontDisplay;
    data.cssFeatures = activeFeatures;
    if (wantText && Object.keys(activeFeatures).length) {
      lines.push('');
      lines.push('CSS Features:');
      const labels = { has: ':has()', layer: '@layer', subgrid: 'subgrid', containerQuery: '@container', colorMix: 'color-mix()', lightDark: 'light-dark()', logicalProps: 'logical properties' };
      for (const [k, v] of Object.entries(activeFeatures)) {
        if (k === 'fontDisplay') {
          lines.push('  font-display: ' + Object.entries(v).map(([s, c]) => s + ' (' + c + ')').join(', '));
        } else {
          lines.push('  ' + (labels[k] || k) + ': ' + v + ' rules');
        }
      }
    }

    // Image dimension audit (CLS risk)
    const allImgs = document.querySelectorAll('img');
    let imgsMissingDims = 0;
    const clsSamples = [];
    for (const img of allImgs) {
      const hasW = img.getAttribute('width') || img.style.width;
      const hasH = img.getAttribute('height') || img.style.height;
      if (!hasW || !hasH) {
        imgsMissingDims++;
        if (clsSamples.length < 5) {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
          clsSamples.push(elPath(img) + (src ? ' (' + src.substring(0, 60) + ')' : ''));
        }
      }
    }
    if (allImgs.length > 0) {
      const pct = Math.round(imgsMissingDims / allImgs.length * 100);
      data.imageStats = {
        total: allImgs.length,
        missingDimensions: imgsMissingDims,
        pct,
        samples: clsSamples.length ? clsSamples : undefined,
      };
      if (wantText) {
        lines.push('');
        lines.push('Images: ' + allImgs.length + ' total, ' + imgsMissingDims + ' missing dimensions (' + pct + '% CLS risk)');
        if (clsSamples.length) {
          for (const s of clsSamples) lines.push('  ' + s);
        }
      }
    }

    // Z-index stacking complexity
    const zLayers = new Set();
    let zMax = 0;
    for (const el of document.querySelectorAll('*')) {
      const z = parseInt(getComputedStyle(el).zIndex);
      if (!isNaN(z) && z !== 0) { zLayers.add(z); if (z > zMax) zMax = z; }
    }
    if (zLayers.size > 0) {
      const sorted = [...zLayers].sort((a, b) => a - b);
      data.zIndexStats = { layers: zLayers.size, max: zMax, values: sorted };
      if (zMax > 10000) data.zIndexStats.antiPattern = true;
      if (wantText) {
        lines.push('');
        lines.push('Z-index: ' + zLayers.size + ' layers, max ' + zMax.toLocaleString() + (zMax > 10000 ? ' ⚠ anti-pattern' : ''));
        lines.push('  values: ' + sorted.join(', '));
      }
    }

    // Useful meta tags
    const metaTags = ['viewport', 'description', 'theme-color', 'robots', 'og:type', 'og:title'];
    for (const name of metaTags) {
      const el = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
      if (el) data.meta[name] = el.content;
    }
    if (Object.keys(data.meta).length && wantText) {
      lines.push('');
      lines.push('Meta:');
      for (const [k, v] of Object.entries(data.meta)) {
        lines.push('  ' + k + ': ' + v.substring(0, 80));
      }
    }

    if (wantText) return { text: lines.join('\n'), data };
    return data;
  }


