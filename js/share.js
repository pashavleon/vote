/**
 * Share: Web Share API, copy link, social intent URLs.
 */
(function () {
  'use strict';

  var SITE_URL = (window.TFV_SITE && window.TFV_SITE.url) || 'https://topfan.vote/';

  function t(key, params) {
    return window.I18n ? window.I18n.t(key, params) : key;
  }

  function getUserChoice(root) {
    return root.closest('[data-vote-root]') &&
      root.closest('[data-vote-root]').getAttribute('data-user-choice');
  }

  function getShareText(root) {
    var choice = getUserChoice(root);
    if (choice === 'arsenal' || choice === 'psg') {
      return t('share.textVoted', { team: t('team.' + choice) });
    }
    return t('share.text');
  }

  function buildSharePayload(root) {
    var text = getShareText(root);
    var url = SITE_URL;
    return {
      text: text,
      url: url,
      full: text + '\n' + url,
      encUrl: encodeURIComponent(url),
      encText: encodeURIComponent(text),
      encFull: encodeURIComponent(text + ' ' + url),
    };
  }

  function networkUrl(network, p) {
    switch (network) {
      case 'x':
        return 'https://twitter.com/intent/tweet?text=' + p.encText + '&url=' + p.encUrl;
      case 'facebook':
        return 'https://www.facebook.com/sharer/sharer.php?u=' + p.encUrl;
      case 'whatsapp':
        return 'https://wa.me/?text=' + p.encFull;
      case 'telegram':
        return 'https://t.me/share/url?url=' + p.encUrl + '&text=' + p.encText;
      case 'vk':
        return 'https://vk.com/share.php?url=' + p.encUrl + '&title=' + p.encText;
      case 'reddit':
        return 'https://www.reddit.com/submit?url=' + p.encUrl + '&title=' + p.encText;
      case 'linkedin':
        return 'https://www.linkedin.com/sharing/share-offsite/?url=' + p.encUrl;
      case 'threads':
        return 'https://www.threads.net/intent/post?text=' + p.encFull;
      case 'bluesky':
        return 'https://bsky.app/intent/compose?text=' + p.encFull;
      case 'pinterest':
        return 'https://pinterest.com/pin/create/button/?url=' + p.encUrl + '&description=' + p.encText;
      case 'line':
        return 'https://social-plugins.line.me/lineit/share?url=' + p.encUrl;
      case 'email':
        return 'mailto:?subject=' + encodeURIComponent(t('page.title')) + '&body=' + p.encFull;
      default:
        return '#';
    }
  }

  function updateShareLinks(root) {
    var p = buildSharePayload(root);
    root.querySelectorAll('[data-share-network]').forEach(function (el) {
      var network = el.getAttribute('data-share-network');
      el.href = networkUrl(network, p);
    });
    var nativeBtn = root.querySelector('[data-share-native]');
    if (nativeBtn) {
      nativeBtn.dataset.shareText = p.full;
    }
  }

  function showFeedback(root, key) {
    var el = root.querySelector('[data-share-feedback]');
    if (!el) return;
    el.textContent = t(key);
    el.hidden = false;
    clearTimeout(root._shareFeedbackTimer);
    root._shareFeedbackTimer = setTimeout(function () {
      el.hidden = true;
    }, 2500);
  }

  function copyLink(root) {
    var p = buildSharePayload(root);
    var done = function () {
      showFeedback(root, 'share.copied');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(p.full).then(done).catch(function () {
        fallbackCopy(p.full, done);
      });
    } else {
      fallbackCopy(p.full, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (done) done();
    } catch (e) {
      /* ignore */
    }
    document.body.removeChild(ta);
  }

  function nativeShare(root) {
    var p = buildSharePayload(root);
    if (!navigator.share) return;
    navigator.share({ title: t('page.title'), text: p.text, url: p.url }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      copyLink(root);
    });
  }

  function bindShareRoot(root) {
    updateShareLinks(root);

    var nativeBtn = root.querySelector('[data-share-native]');
    if (nativeBtn) {
      if (navigator.share) nativeBtn.hidden = false;
      nativeBtn.addEventListener('click', function () {
        nativeShare(root);
      });
    }

    var copyBtn = root.querySelector('[data-share-copy]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyLink(root);
      });
    }

    root.querySelectorAll('[data-share-copy-paste]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = buildSharePayload(root);
        var done = function () {
          var key = btn.getAttribute('data-share-feedback-key') || 'share.copied';
          showFeedback(root, key);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(p.full).then(done).catch(function () {
            fallbackCopy(p.full, done);
          });
        } else {
          fallbackCopy(p.full, done);
        }
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-share-root]').forEach(bindShareRoot);
    document.addEventListener('ucl-locale-change', function () {
      document.querySelectorAll('[data-share-root]').forEach(updateShareLinks);
    });
    document.addEventListener('ucl-vote-cast', function () {
      document.querySelectorAll('[data-share-root]').forEach(updateShareLinks);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
