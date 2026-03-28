  // === siteProfile: composite design system tool ===

  function siteProfile(opts) {
    var o = Object.assign({ format: 'data' }, opts);
    var results = {};
    var wantText = o.format === 'text';
    var sections = wantText ? [] : null;

    var tools = [
      ['palette', paletteProfile],
      ['typography', typographyProfile],
      ['spacing', spacingProfile],
      ['gradient', gradientProfile],
      ['motion', motionProfile],
      ['responsive', responsiveProfile],
      ['platform', platformProfile],
    ];

    for (var i = 0; i < tools.length; i++) {
      var name = tools[i][0], fn = tools[i][1];
      try {
        var r = fn(wantText ? Object.assign({}, opts, { format: 'text' }) : opts);
        results[name] = r.data || r;
        if (wantText) {
          sections.push('=== ' + name.toUpperCase() + ' ===');
          sections.push(r.text || JSON.stringify(r).substring(0, 500));
          sections.push('');
        }
      } catch (e) {
        results[name] = { error: e.message };
        if (wantText) {
          sections.push('=== ' + name.toUpperCase() + ' ===');
          sections.push('ERROR: ' + e.message);
          sections.push('');
        }
      }
    }

    if (wantText) return { text: sections.join('\n'), data: results };
    return results;
  }


