/**
 * Flag visuals for WC teams (flagcdn.com — free for commercial use).
 * Maps poll choice ids (3-letter) to ISO codes for CDN URLs.
 */
(function (global) {
  'use strict';

  var TEAM_ISO = {
    mex: 'mx', rsa: 'za', kor: 'kr', cze: 'cz',
    can: 'ca', bih: 'ba', qat: 'qa', sui: 'ch',
    bra: 'br', mar: 'ma', hti: 'ht', sco: 'gb-sct',
    usa: 'us', par: 'py', aus: 'au', tur: 'tr',
    ger: 'de', cuw: 'cw', civ: 'ci', ecu: 'ec',
    ned: 'nl', jpn: 'jp', swe: 'se', tun: 'tn',
    bel: 'be', egy: 'eg', irn: 'ir', nzl: 'nz',
    esp: 'es', cpv: 'cv', ksa: 'sa', uru: 'uy',
    fra: 'fr', sen: 'sn', irq: 'iq', nor: 'no',
    arg: 'ar', alg: 'dz', aut: 'at', jor: 'jo',
    por: 'pt', cod: 'cd', uzb: 'uz', col: 'co',
    eng: 'gb-eng', cro: 'hr', gha: 'gh', pan: 'pa',
  };

  function teamIso(teamId) {
    if (!teamId) return null;
    var id = String(teamId).toLowerCase();
    if (TEAM_ISO[id]) return TEAM_ISO[id];
    if (id.length === 2) return id;
    return null;
  }

  function flagUrl(iso, width) {
    width = width || 160;
    return 'https://flagcdn.com/w' + width + '/' + iso + '.png';
  }

  var ASSETS_BASE = 'assets/flags/';

  function chipFlagSrc(teamId) {
    var id = String(teamId || '').toLowerCase();
    if (!id) return '';
    return ASSETS_BASE + id + '.png';
  }

  function chipFlagFallbackSrc(teamId) {
    var iso = teamIso(teamId);
    if (!iso) return '';
    return 'https://flagcdn.com/256x192/' + iso + '.png';
  }

  function chipFlagImgHtml(teamId, className) {
    var src = chipFlagSrc(teamId);
    var fb = chipFlagFallbackSrc(teamId);
    if (!src && !fb) {
      return '<span class="flag-fallback" aria-hidden="true">🏳</span>';
    }
    className = className || 'vote-chip__flag';
    var onerr = fb
      ? ' onerror="this.onerror=null;this.src=\'' + fb + '\'"'
      : '';
    return (
      '<img class="' + className + '" src="' + src + '" alt="" loading="lazy" decoding="async"' +
      onerr + ' />'
    );
  }

  function chipThumbHtml(teamId) {
    return chipFlagImgHtml(teamId, 'match-team__flag-img');
  }

  /**
   * @param {string} teamId — choice id e.g. "bra"
   * @param {"hero"|"sm"} size
   */
  function renderFlag(teamId, size) {
    var iso = teamIso(teamId);
    if (!iso) {
      return '<span class="flag-fallback" aria-hidden="true">🏳</span>';
    }
    var cls = 'flag-visual flag-visual--' + (size === 'sm' ? 'sm' : 'hero');
    var w = size === 'sm' ? 80 : 160;
    var alt = teamId.toUpperCase() + ' flag';
    return (
      '<span class="' + cls + '" aria-hidden="true">' +
        '<span class="flag-visual__glow"></span>' +
        '<span class="flag-visual__pole"></span>' +
        '<span class="flag-visual__cloth">' +
          '<img class="flag-visual__img" src="' + flagUrl(iso, w) + '" alt="' + alt + '" width="' + w + '" height="' + Math.round(w * 0.67) + '" loading="lazy" decoding="async" />' +
          '<span class="flag-visual__sheen"></span>' +
          '<span class="flag-visual__edge-blur"></span>' +
        '</span>' +
      '</span>'
    );
  }

  global.FlagVisual = {
    teamIso: teamIso,
    flagUrl: flagUrl,
    chipFlagSrc: chipFlagSrc,
    chipFlagFallbackSrc: chipFlagFallbackSrc,
    chipFlagImg: chipFlagImgHtml,
    chipThumb: chipThumbHtml,
    render: renderFlag,
  };
})(window);
