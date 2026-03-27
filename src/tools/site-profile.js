  // === siteProfile: composite design system tool ===

  function siteProfile(opts) {
    const results = {};
    const sections = [];

    const tools = [
      ['palette', paletteProfile],
      ['typography', typographyProfile],
      ['spacing', spacingProfile],
      ['gradient', gradientProfile],
      ['motion', motionProfile],
      ['responsive', responsiveProfile],
      ['platform', platformProfile],
    ];

    for (const [name, fn] of tools) {
      try {
        const r = fn(opts);
        results[name] = r.data || r;
        sections.push('=== ' + name.toUpperCase() + ' ===');
        sections.push(r.text || JSON.stringify(r).substring(0, 500));
        sections.push('');
      } catch (e) {
        results[name] = { error: e.message };
        sections.push('=== ' + name.toUpperCase() + ' ===');
        sections.push('ERROR: ' + e.message);
        sections.push('');
      }
    }

    return {
      text: sections.join('\n'),
      data: results,
    };
  }


