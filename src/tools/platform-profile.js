  // === platformProfile: CMS, libraries, meta tags, analytics ===

  function platformProfile() {
    const data = { cms: null, theme: null, generator: null, libraries: [], analytics: [], meta: {} };
    const lines = [];

    // Meta generator tag
    const gen = document.querySelector('meta[name="generator"]');
    if (gen) {
      data.generator = gen.content;
      lines.push('Generator: ' + gen.content);
    }

    // Shopify detection
    if (window.Shopify) {
      data.cms = 'Shopify';
      if (window.Shopify.theme) {
        data.theme = { name: window.Shopify.theme.name, id: window.Shopify.theme.id, role: window.Shopify.theme.role };
      }
      lines.push('CMS: Shopify' + (data.theme ? ' (' + data.theme.name + ', ' + data.theme.role + ')' : ''));
    }

    // WordPress detection
    if (document.querySelector('meta[name="generator"][content*="WordPress"]') ||
        document.querySelector('link[href*="wp-content"]') ||
        document.querySelector('script[src*="wp-includes"]')) {
      data.cms = data.cms || 'WordPress';
      const wpGen = document.querySelector('meta[name="generator"][content*="WordPress"]');
      if (wpGen) data.generator = wpGen.content;
      lines.push('CMS: WordPress' + (data.generator ? ' (' + data.generator + ')' : ''));
    }

    // Squarespace
    if (window.Static?.SQUARESPACE_CONTEXT || document.querySelector('meta[name="generator"][content*="Squarespace"]')) {
      data.cms = data.cms || 'Squarespace';
      lines.push('CMS: Squarespace');
    }

    // Wix
    if (document.querySelector('meta[name="generator"][content*="Wix"]') || window.wixBiSession) {
      data.cms = data.cms || 'Wix';
      lines.push('CMS: Wix');
    }

    if (!data.cms) lines.push('CMS: not detected');

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
    if (libs.length) lines.push('Libraries: ' + libs.join(', '));

    // Cookie consent / CMP
    const cmps = [];
    if (window.Termly) cmps.push('Termly');
    if (window.OneTrust) cmps.push('OneTrust');
    if (window.CookieConsent || window.cookieconsent) cmps.push('CookieConsent');
    if (window.__cmp) cmps.push('CMP (IAB)');
    if (document.querySelector('[class*="cookie-banner"], [id*="cookie-banner"], [class*="consent"]')) cmps.push('cookie banner (DOM)');
    if (cmps.length) {
      data.cookieConsent = cmps;
      lines.push('Cookie consent: ' + cmps.join(', '));
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
    if (data.analytics.length) {
      lines.push('');
      lines.push('Integrations (' + data.analytics.length + '):');
      for (const a of data.analytics) lines.push('  ' + a);
    }

    // Useful meta tags
    const metaTags = ['viewport', 'description', 'theme-color', 'robots', 'og:type', 'og:title'];
    for (const name of metaTags) {
      const el = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
      if (el) data.meta[name] = el.content;
    }
    if (Object.keys(data.meta).length) {
      lines.push('');
      lines.push('Meta:');
      for (const [k, v] of Object.entries(data.meta)) {
        lines.push('  ' + k + ': ' + v.substring(0, 80));
      }
    }

    return { text: lines.join('\n'), data };
  }


