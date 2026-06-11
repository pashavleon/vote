/**
 * TOP FAN VOTE hub — home, winner, matches, archive pages.
 * Set data-page on body: home | winner | favorite | matches | arch
 */
(function () {
  'use strict';

  var api = window.VoteApi;

  var STAGES = [
    { key: 'group', label: 'Groups' },
    { key: 'r32', label: 'Round of 32' },
    { key: 'r16', label: 'Round of 16' },
    { key: 'qf', label: 'Quarter-finals' },
    { key: 'sf', label: 'Semi-finals' },
    { key: 'final', label: 'Final' },
  ];

  var GROUPS = 'ABCDEFGHIJKL'.split('');

  /** Visible team grid height before "expand all". */
  var TEAM_GRID_ROWS = 5;

  var TEAM_GRID = {
    winner: {
      pollIdKey: 'winnerPollId',
      fallbackPollId: 'wc-2026-winner',
      gridSel: '#hub-winner-grid',
      totalSel: '#winner-total',
      messageSel: '#winner-message',
      expandId: 'winner-expand',
      loadError: 'Could not load tournament poll.',
    },
    favorite: {
      pollIdKey: 'favoritePollId',
      fallbackPollId: 'wc-2026-favorite',
      gridSel: '#hub-favorite-grid',
      totalSel: '#favorite-total',
      messageSel: '#favorite-message',
      expandId: 'favorite-expand',
      loadError: 'Could not load favorite team poll.',
    },
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  var MATCH_WATCH_LINKS = {
    fifaSchedule:
      'https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures',
    fifaWatch:
      'https://www.fifa.com/fifaplus/en/articles/where-to-watch-fifa-world-cup-2026',
    liveSoccerTv: 'https://www.livesoccertv.com/competitions/fifa-world-cup/',
  };

  var matchInfoModalEl = null;
  var matchInfoLastFocus = null;

  function formatKickoff(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return iso;
    }
  }

  function formatKickoffInZone(iso, timeZone) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timeZone,
        timeZoneName: 'short',
      });
    } catch (e) {
      return iso;
    }
  }

  function ensureMatchInfoModal() {
    if (matchInfoModalEl) return matchInfoModalEl;
    var el = document.createElement('div');
    el.className = 'match-info-modal';
    el.id = 'match-info-modal';
    el.hidden = true;
    el.innerHTML =
      '<div class="match-info-modal__backdrop" data-match-info-close></div>' +
      '<div class="match-info-modal__panel" role="dialog" aria-modal="true" aria-labelledby="match-info-title">' +
        '<button type="button" class="match-info-modal__close" data-match-info-close aria-label="Close">&times;</button>' +
        '<h2 class="match-info-modal__title" id="match-info-title"></h2>' +
        '<p class="match-info-modal__stage" id="match-info-stage"></p>' +
        '<p class="match-info-modal__votes" id="match-info-votes"></p>' +
        '<dl class="match-info-modal__times" id="match-info-times"></dl>' +
        '<p class="match-info-modal__venue" id="match-info-venue"></p>' +
        '<section class="match-info-modal__watch" aria-labelledby="match-info-watch-title">' +
          '<h3 class="match-info-modal__watch-title" id="match-info-watch-title">Where to watch</h3>' +
          '<p class="match-info-modal__watch-note">TV channels vary by country. Use these third-party guides — not affiliated with TOP FAN VOTE or FIFA.</p>' +
          '<ul class="match-info-modal__links">' +
            '<li><a href="' + MATCH_WATCH_LINKS.fifaWatch + '" target="_blank" rel="noopener noreferrer">FIFA — where to watch</a></li>' +
            '<li><a href="' + MATCH_WATCH_LINKS.liveSoccerTv + '" target="_blank" rel="noopener noreferrer">Live Soccer TV — broadcast listings</a></li>' +
            '<li><a href="' + MATCH_WATCH_LINKS.fifaSchedule + '" target="_blank" rel="noopener noreferrer">FIFA — official schedule</a></li>' +
          '</ul>' +
        '</section>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-match-info-close')) closeMatchInfoModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && matchInfoModalEl && !matchInfoModalEl.hidden) closeMatchInfoModal();
    });
    matchInfoModalEl = el;
    return el;
  }

  function openMatchInfoModal(opts) {
    var modal = ensureMatchInfoModal();
    matchInfoLastFocus = document.activeElement;
    $('#match-info-title', modal).textContent = opts.home + ' vs ' + opts.away;
    $('#match-info-stage', modal).textContent = opts.stage || '';
    var votesEl = $('#match-info-votes', modal);
    var voteCount = Number(opts.votes || 0);
    if (voteCount > 0) {
      votesEl.innerHTML =
        '<strong>Fan poll:</strong> ' + escapeHtml(formatCount(voteCount)) +
        ' vote' + (voteCount === 1 ? '' : 's') + ' so far';
      votesEl.hidden = false;
    } else {
      votesEl.textContent = 'Fan poll: no votes yet — be the first to predict this match';
      votesEl.hidden = false;
    }
    var timesEl = $('#match-info-times', modal);
    if (opts.kickoff) {
      timesEl.innerHTML =
        '<div><dt>Your time</dt><dd>' + escapeHtml(formatKickoffInZone(opts.kickoff, undefined)) + '</dd></div>' +
        '<div><dt>US Eastern</dt><dd>' + escapeHtml(formatKickoffInZone(opts.kickoff, 'America/New_York')) + '</dd></div>' +
        '<div><dt>UTC</dt><dd>' + escapeHtml(formatKickoffInZone(opts.kickoff, 'UTC')) + '</dd></div>';
      timesEl.hidden = false;
    } else {
      timesEl.innerHTML = '';
      timesEl.hidden = true;
    }
    var venueEl = $('#match-info-venue', modal);
    if (opts.venue) {
      venueEl.innerHTML = '<strong>Venue:</strong> ' + escapeHtml(opts.venue);
      venueEl.hidden = false;
    } else {
      venueEl.textContent = '';
      venueEl.hidden = true;
    }
    modal.hidden = false;
    document.body.classList.add('match-info-modal-open');
    var closeBtn = $('.match-info-modal__close', modal);
    if (closeBtn) closeBtn.focus();
  }

  function closeMatchInfoModal() {
    if (!matchInfoModalEl || matchInfoModalEl.hidden) return;
    matchInfoModalEl.hidden = true;
    document.body.classList.remove('match-info-modal-open');
    if (matchInfoLastFocus && matchInfoLastFocus.focus) matchInfoLastFocus.focus();
  }

  function formatCount(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  function venueShort(venue) {
    if (!venue) return '';
    var parts = venue.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : venue;
  }

  function statusBadgeClass(status) {
    if (status === 'open') return 'match-card__badge--open';
    if (status === 'scheduled') return 'match-card__badge--soon';
    return 'match-card__badge--closed';
  }

  function statusLabel(status) {
    if (status === 'open') return 'Open';
    if (status === 'scheduled') return 'Upcoming';
    if (status === 'closed') return 'Closed';
    return status || '';
  }

  function choiceById(choices, id) {
    for (var i = 0; i < choices.length; i++) {
      if (choices[i].id === id) return choices[i];
    }
    return null;
  }

  function renderTeamFlag(teamId, size) {
    if (size === 'sm' && window.FlagVisual && window.FlagVisual.chipThumb) {
      return window.FlagVisual.chipThumb(teamId);
    }
    if (window.FlagVisual && window.FlagVisual.render) {
      return window.FlagVisual.render(teamId, size || 'hero');
    }
    return '<span class="flag-fallback">🏳</span>';
  }

  function renderPickFlag(teamId) {
    if (window.FlagVisual && window.FlagVisual.chipFlagImg) {
      return window.FlagVisual.chipFlagImg(teamId);
    }
    return '';
  }

  function stageIndex(key) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].key === key) return i;
    }
    return -1;
  }

  function stageLabel(key) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].key === key) return STAGES[i].label;
    }
    return key || '';
  }

  function getPage() {
    return (document.body && document.body.getAttribute('data-page')) || 'home';
  }

  function FanHub() {
    this.page = getPage();
    this.cfg = api.getConfig();
    this.event = null;
    this.eventId = this.cfg.eventId;
    this.winnerPollId = this.cfg.winnerPollId || 'wc-2026-winner';
    this.favoritePollId = this.cfg.favoritePollId || 'wc-2026-favorite';
    this.activeVotingStage = this.cfg.activeMatchStage || 'group';
    this.winnerDetail = null;
    this.matchPolls = [];
    this.matchDetails = Object.create(null);
    this.stage = this.activeVotingStage;
    this.refreshTimer = null;
  }

  FanHub.prototype.getStagePhase = function (stageKey) {
    var activeIdx = stageIndex(this.activeVotingStage);
    var idx = stageIndex(stageKey);
    if (idx < 0 || activeIdx < 0) return 'future';
    if (idx < activeIdx) return 'past';
    if (idx === activeIdx) return 'active';
    return 'future';
  };

  FanHub.prototype.canVoteOnMatch = function (detail) {
    return Boolean(
      detail && detail.match && detail.match.stage === this.activeVotingStage
    );
  };

  FanHub.prototype.init = function () {
    var self = this;

    if (this.page === 'matches') {
      this.bindStageDropdown();
    }

    if (!api.isConfigured()) {
      var errSel = {
        home: null,
        winner: '#hub-winner-grid',
        favorite: '#hub-favorite-grid',
        matches: '#matches-container',
        arch: '#archive-list',
      }[this.page];
      if (errSel) this.showError(errSel, 'Configure js/config.js with Supabase keys.');
      return;
    }

    if (this.page === 'home') {
      this.initHome();
      return;
    }
    if (this.page === 'winner') {
      this.initTeamGridPoll('winner');
      return;
    }
    if (this.page === 'favorite') {
      this.initTeamGridPoll('favorite');
      return;
    }
    if (this.page === 'matches') {
      this.initMatches();
      return;
    }
    if (this.page === 'arch') {
      this.initArch();
    }
  };

  FanHub.prototype.initHome = function () {
    var self = this;
    this.initHomeFooterPanels();
    api.fetchFeaturedEvent()
      .then(function (event) {
        self.event = event;
        self.renderHomeHero(event);
      })
      .catch(function (err) {
        console.error('[hub] home failed', err);
      });
  };

  FanHub.prototype.initHomeFooterPanels = function () {
    var mq = window.matchMedia('(min-width: 720px)');
    function sync() {
      $all('.home-footer__panel:not(.home-footer__panel--teams)').forEach(function (panel) {
        if (mq.matches) panel.setAttribute('open', '');
        else panel.removeAttribute('open');
      });
    }
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(sync);
    }
  };

  FanHub.prototype.renderHomeHero = function (event) {
    var meta = $('#home-event-meta');
    if (meta) {
      meta.textContent = 'Three ways to vote · winner · favorite · matches';
    }
    document.title = 'World Cup 2026 Fan Vote — Three Polls | TOP FAN VOTE';
  };

  FanHub.prototype.getTeamGridPollId = function (kind) {
    var meta = TEAM_GRID[kind];
    if (!meta) return '';
    return this.cfg[meta.pollIdKey] || meta.fallbackPollId;
  };

  FanHub.prototype.teamGridBucket = function (kind) {
    if (!this._teamGridBuckets) this._teamGridBuckets = Object.create(null);
    if (!this._teamGridBuckets[kind]) {
      this._teamGridBuckets[kind] = { detail: null, expanded: false };
    }
    return this._teamGridBuckets[kind];
  };

  FanHub.prototype.initTeamGridPoll = function (kind) {
    var self = this;
    var meta = TEAM_GRID[kind];
    if (!meta) return;

    api.fetchFeaturedEvent()
      .then(function (event) {
        if (event && event.id) self.eventId = event.id;
        return self.loadTeamGridPoll(kind);
      })
      .catch(function (err) {
        console.error('[hub] ' + kind + ' init failed', err);
        self.showError(meta.gridSel, meta.loadError);
      })
      .then(function () {
        self.refreshTimer = setInterval(function () {
          self.loadTeamGridPoll(kind, true);
        }, self.cfg.refreshIntervalMs || 15000);

        var resizeTimer;
        window.addEventListener('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            var bucket = self.teamGridBucket(kind);
            if (bucket.detail && !bucket.expanded) {
              self.renderTeamGridPoll(kind);
            }
          }, 150);
        });
      });
  };

  FanHub.prototype.initWinner = function () {
    this.initTeamGridPoll('winner');
  };

  FanHub.prototype.initMatches = function () {
    var self = this;
    this.renderStageMenu();
    api.fetchFeaturedEvent()
      .then(function (event) {
        if (event && event.id) self.eventId = event.id;
        return self.loadMatchPolls();
      })
      .then(function () {
        self.renderMatches();
      })
      .catch(function (err) {
        console.error('[hub] matches init failed', err);
        var c = $('#matches-container');
        if (c) c.innerHTML = '<p class="hub-empty">Could not load matches.</p>';
      })
      .then(function () {
        self.refreshTimer = setInterval(function () {
          self.refreshVisibleMatchDetails();
        }, self.cfg.refreshIntervalMs || 15000);
      });
  };

  FanHub.prototype.initArch = function () {
    this.loadArchive();
  };

  FanHub.prototype.bindStageDropdown = function () {
    var self = this;
    var trigger = $('#stage-dropdown-trigger');
    var root = $('#stage-dropdown');

    if (trigger && !trigger._stageDropdownBound) {
      trigger._stageDropdownBound = true;
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        self.toggleStageDropdown();
      });
    }

    if (root && !root._stageMenuBound) {
      root._stageMenuBound = true;
      var menu = $('#stage-filter');
      if (menu) {
        menu.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-stage]');
          if (!btn || btn.disabled) return;
          self.stage = btn.getAttribute('data-stage');
          self.closeStageDropdown();
          self.renderStageMenu();
          self.renderMatches();
        });
      }
    }

    if (!document._fanHubStageOutsideClose) {
      document._fanHubStageOutsideClose = true;
      document.addEventListener('click', function () {
        self.closeStageDropdown();
      });
    }
  };

  FanHub.prototype.toggleStageDropdown = function () {
    var root = $('#stage-dropdown');
    var trigger = $('#stage-dropdown-trigger');
    var menu = $('#stage-filter');
    if (!root || !trigger || !menu) return;

    var open = root.classList.toggle('is-open');
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  FanHub.prototype.closeStageDropdown = function () {
    var root = $('#stage-dropdown');
    var trigger = $('#stage-dropdown-trigger');
    var menu = $('#stage-filter');
    if (!root || !trigger || !menu) return;

    root.classList.remove('is-open');
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  FanHub.prototype.renderStageMenu = function () {
    var self = this;
    var menu = $('#stage-filter');
    if (!menu) return;

    var activeLabel = stageLabel(this.activeVotingStage);
    var currentLabel = stageLabel(this.stage);
    var phaseEl = $('#voting-phase-label');
    if (phaseEl) {
      phaseEl.innerHTML =
        '<span class="voting-phase__indicator" aria-hidden="true"></span>' +
        '<span class="voting-phase__text">Active voting: <strong>' +
        escapeHtml(activeLabel) + '</strong></span>';
    }

    var labelEl = $('#stage-dropdown-label');
    if (labelEl) labelEl.textContent = currentLabel;

    menu.innerHTML = STAGES.map(function (s) {
      var phase = self.getStagePhase(s.key);
      var isSelected = self.stage === s.key;
      var cls = ['stage-dropdown__item'];
      if (isSelected) cls.push('is-selected');
      if (phase === 'active') cls.push('is-voting-phase');
      if (phase === 'past') cls.push('is-past');
      if (phase === 'future') cls.push('is-future');

      var disabled = phase === 'future' ? ' disabled aria-disabled="true"' : '';
      var badge = '';
      if (phase === 'active') {
        badge = '<span class="stage-dropdown__badge stage-dropdown__badge--live">Vote</span>';
      } else if (phase === 'future') {
        badge = '<span class="stage-dropdown__badge stage-dropdown__badge--soon">Soon</span>';
      }

      return (
        '<button type="button" role="option" class="' + cls.join(' ') + '" data-stage="' + s.key + '"' +
        (isSelected ? ' aria-selected="true"' : ' aria-selected="false"') +
        disabled + '>' +
          '<span>' + escapeHtml(s.label) + '</span>' + badge +
        '</button>'
      );
    }).join('');
  };


  FanHub.prototype.loadTeamGridPoll = function (kind, silent) {
    var self = this;
    var meta = TEAM_GRID[kind];
    var bucket = this.teamGridBucket(kind);
    var pollId = this.getTeamGridPollId(kind);
    if (!meta || !pollId) return Promise.resolve();

    return api.fetchPollDetail(pollId)
      .then(function (detail) {
        bucket.detail = detail;
        if (kind === 'winner') self.winnerDetail = detail;
        self.renderTeamGridPoll(kind);
        var totalEl = $(meta.totalSel);
        if (totalEl && detail) {
          totalEl.textContent = detail.total_votes
            ? formatCount(detail.total_votes) + ' votes · live'
            : 'Be the first to vote';
        }
      })
      .catch(function (err) {
        if (!silent) console.error('[hub] ' + kind + ' load failed', err);
      });
  };

  FanHub.prototype.loadWinner = function (silent) {
    return this.loadTeamGridPoll('winner', silent);
  };

  FanHub.prototype.teamGridPageSize = function () {
    var cols = window.matchMedia('(min-width: 900px)').matches ? 5 : 2;
    return TEAM_GRID_ROWS * cols;
  };

  FanHub.prototype.renderTeamGridPoll = function (kind) {
    var meta = TEAM_GRID[kind];
    var bucket = this.teamGridBucket(kind);
    var grid = meta ? $(meta.gridSel) : null;
    if (!grid || !bucket.detail) return;

    var detail = bucket.detail;
    var pollId = this.getTeamGridPollId(kind);
    var poll = detail.poll;
    var closed = api.isPollClosed(poll);
    var choices = (detail.choices || []).slice().sort(function (a, b) {
      return (b.pct || 0) - (a.pct || 0) || (a.sort_order || 0) - (b.sort_order || 0);
    });
    var userChoice = api.getStoredChoice(pollId);
    var pageSize = this.teamGridPageSize();
    var topN = bucket.expanded ? choices.length : Math.min(pageSize, choices.length);
    var visible = choices.slice(0, topN);
    var leaderId = visible.length ? visible[0].id : null;

    var html = visible.map(function (c) {
      var pct = c.pct != null ? c.pct : 0;
      var cls = 'team-card';
      if (c.id === leaderId && detail.total_votes > 0) cls += ' is-leading';
      if (c.id === userChoice) cls += ' is-selected';
      if (closed || userChoice) cls += ' is-disabled';
      return (
        '<button type="button" class="' + cls + ' team-card--pick" data-team-choice="' + escapeHtml(c.id) + '"' +
        (closed || userChoice ? ' disabled' : '') + '>' +
          renderPickFlag(c.id) +
          '<span class="vote-chip__meta">' +
            '<span class="vote-chip__name">' + escapeHtml(c.label) + '</span>' +
            '<span class="vote-chip__pct">' + pct + '%</span>' +
          '</span>' +
        '</button>'
      );
    }).join('');

    if (!bucket.expanded && choices.length > pageSize) {
      html += (
        '<button type="button" class="team-card team-card--expand" id="' + meta.expandId + '">' +
          '<span class="team-card__flag">➕</span>' +
          '<span class="team-card__name">All ' + choices.length + ' teams</span>' +
          '<span class="team-card__pct" style="color:var(--muted);font-size:0.72rem">expand</span>' +
        '</button>'
      );
    } else if (bucket.expanded && choices.length > pageSize) {
      html += (
        '<button type="button" class="team-card team-card--expand" id="' + meta.expandId + '">' +
          '<span class="team-card__flag">➖</span>' +
          '<span class="team-card__name">Show less</span>' +
        '</button>'
      );
    }

    grid.innerHTML = html;
    var msg = meta.messageSel ? $(meta.messageSel) : null;
    if (msg) {
      if (closed) {
        msg.textContent = 'Voting closed.';
        msg.hidden = false;
      } else if (userChoice) {
        msg.textContent = 'Your pick is saved.';
        msg.hidden = false;
      } else {
        msg.hidden = true;
      }
    }

    var self = this;
    $all('[data-team-choice]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (closed) return;
        self.castTeamGridChoice(kind, btn.getAttribute('data-team-choice'));
      });
    });

    var expandBtn = $('#' + meta.expandId);
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        bucket.expanded = !bucket.expanded;
        self.renderTeamGridPoll(kind);
      });
    }
  };

  FanHub.prototype.renderWinnerGrid = function () {
    this.renderTeamGridPoll('winner');
  };

  FanHub.prototype.castTeamGridChoice = function (kind, choiceId) {
    var self = this;
    var meta = TEAM_GRID[kind];
    var pollId = this.getTeamGridPollId(kind);
    if (!pollId || api.getStoredChoice(pollId)) return;

    api.castVote(pollId, choiceId)
      .then(function (res) {
        if (res.error) {
          if (res.error.code === '23505') {
            api.setStoredChoice(pollId, choiceId);
            return self.loadTeamGridPoll(kind, true);
          }
          throw res.error;
        }
        api.setStoredChoice(pollId, choiceId);
        var label = choiceId;
        var nameEl = document.querySelector('[data-team-choice="' + choiceId + '"] .vote-chip__name');
        if (nameEl) label = nameEl.textContent.trim();
        document.dispatchEvent(new CustomEvent('fan-vote-cast', {
          detail: { pollId: pollId, choice: choiceId, label: label, pollKind: kind },
        }));
        return self.loadTeamGridPoll(kind, true);
      })
      .catch(function (err) {
        console.error('[hub] ' + kind + ' vote failed', err);
        var msg = meta && meta.messageSel ? $(meta.messageSel) : null;
        if (msg) {
          msg.textContent = 'Vote failed. Try again.';
          msg.hidden = false;
        }
      });
  };

  FanHub.prototype.castWinnerChoice = function (choiceId) {
    this.castTeamGridChoice('winner', choiceId);
  };

  FanHub.prototype.loadMatchPolls = function () {
    var self = this;
    if (!this.eventId) return Promise.resolve();
    return api.fetchActivePolls(this.eventId, 'match_winner', 200, 0)
      .then(function (rows) {
        self.matchPolls = rows || [];
        self.renderStageMenu();
        var panel = $('#panel-matches');
        if (panel && panel.classList.contains('is-active')) {
          self.renderMatches();
        }
      });
  };

  FanHub.prototype.pollsForStage = function () {
    var stage = this.stage;
    return this.matchPolls.filter(function (p) {
      if (stage === 'final') return p.stage === 'final' || p.stage === 'third';
      return p.stage === stage;
    });
  };

  FanHub.prototype.renderMatches = function () {
    var container = $('#matches-container');
    if (!container) return;

    var polls = this.pollsForStage();
    var viewPhase = this.getStagePhase(this.stage);
    var activeLabel = stageLabel(this.activeVotingStage);
    var notice = '';
    if (viewPhase === 'active') {
      notice = '<p class="hub-notice hub-notice--live">Pick a winner for each match in <strong>' +
        escapeHtml(activeLabel) + '</strong>.</p>';
    } else if (viewPhase === 'past') {
      notice = '<p class="hub-notice hub-notice--past">Past stage — results only. Voting is open for <strong>' +
        escapeHtml(activeLabel) + '</strong>.</p>';
    }

    if (!polls.length) {
      container.innerHTML = notice + '<p class="hub-empty">No matches in this stage yet.</p>';
      return;
    }

    if (this.stage === 'group') {
      container.innerHTML = notice;
      this.renderGroupMatches(container, polls);
    } else {
      container.innerHTML = notice + '<div id="knockout-match-list"><p class="hub-loading">Loading…</p></div>';
      this.loadAndRenderPollCards(polls, $('#knockout-match-list'));
    }
  };

  FanHub.prototype.renderGroupMatches = function (container, polls) {
    var self = this;
    var byGroup = Object.create(null);
    polls.forEach(function (p) {
      var g = p.group_code || '?';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(p);
    });

    var groupsHtml = GROUPS.filter(function (g) { return byGroup[g]; }).map(function (g) {
      var list = byGroup[g];
      return (
        '<details class="group-block" data-group="' + g + '">' +
          '<summary>Group ' + g +
            ' <span style="color:var(--muted);font-weight:400">' + list.length + ' matches</span>' +
          '</summary>' +
          '<div class="group-block__inner match-list" data-group-list="' + g + '">' +
            '<p class="hub-loading">Loading…</p>' +
          '</div>' +
        '</details>'
      );
    }).join('');

    container.insertAdjacentHTML('beforeend', groupsHtml);

    $all('.group-block', container).forEach(function (block) {
      var g = block.getAttribute('data-group');
      block.addEventListener('toggle', function () {
        if (block.open) self.loadGroupDetails(g, byGroup[g]);
      });
    });
  };

  FanHub.prototype.renderFlatMatches = function (container, polls) {
    this.loadAndRenderPollCards(polls, container);
  };

  FanHub.prototype.loadGroupDetails = function (groupCode, polls) {
    var listEl = $('[data-group-list="' + groupCode + '"]');
    if (!listEl || listEl.getAttribute('data-loaded') === '1') return;
    this.loadAndRenderPollCards(polls, listEl);
  };

  FanHub.prototype.loadAndRenderPollCards = function (pollRows, container) {
    var self = this;
    var ids = pollRows.map(function (p) { return p.poll_id; });

    Promise.all(ids.map(function (id) {
      if (self.matchDetails[id]) return Promise.resolve(self.matchDetails[id]);
      return api.fetchPollDetail(id).then(function (d) {
        self.matchDetails[id] = d;
        return d;
      });
    }))
      .then(function (details) {
        container.innerHTML = details.map(function (d) {
          return self.renderMatchCardHtml(d);
        }).join('');
        container.setAttribute('data-loaded', '1');
        self.bindMatchCards(container);
      })
      .catch(function (err) {
        console.error('[hub] match details failed', err);
        container.innerHTML = '<p class="hub-empty">Could not load matches.</p>';
      });
  };

  FanHub.prototype.refreshVisibleMatchDetails = function () {
    var self = this;
    $all('[data-match-poll-id]').forEach(function (card) {
      var pollId = card.getAttribute('data-match-poll-id');
      api.fetchPollDetail(pollId).then(function (d) {
        self.matchDetails[pollId] = d;
        var fresh = document.createElement('div');
        fresh.innerHTML = self.renderMatchCardHtml(d);
        var newCard = fresh.firstElementChild;
        if (newCard && card.parentNode) {
          card.parentNode.replaceChild(newCard, card);
          self.bindMatchCards(newCard.parentNode);
        }
      }).catch(function () { /* ignore */ });
    });
  };

  FanHub.prototype.renderMatchCardHtml = function (detail) {
    if (!detail || !detail.poll) return '';
    var poll = detail.poll;
    var match = detail.match || {};
    var choices = detail.choices || [];
    var home = choiceById(choices, 'home');
    var draw = choiceById(choices, 'draw');
    var away = choiceById(choices, 'away');
    var closed = api.isPollClosed(poll);
    var canVote = this.canVoteOnMatch(detail);
    var votingOpen = canVote && !closed;
    var userChoice = api.getStoredChoice(poll.id);
    var cardCls = 'match-card';
    if (poll.status === 'open' && canVote) cardCls += ' is-live';
    if (closed || !canVote) cardCls += ' is-closed';

    var kickoffIso = match.kickoff_at || poll.closes_at || '';
    var headMeta = formatKickoff(kickoffIso);
    if (match.venue) headMeta += ' · ' + venueShort(match.venue);

    var homeTeamId = match.home_team_id || '';
    var awayTeamId = match.away_team_id || '';
    var homeLabel = home ? home.label : 'Home';
    var awayLabel = away ? away.label : 'Away';
    var stageLabel = match.group_code
      ? 'Group ' + match.group_code
      : (match.stage_label || match.stage || '');

    var chips = '';
    var chipsDisabled = !votingOpen || Boolean(userChoice);
    if (!canVote) {
      chipsDisabled = true;
    }
    if (home) {
      chips += this.matchChipHtml(
        poll.id, 'home', home.label, home.pct, chipsDisabled, userChoice, homeTeamId
      );
    }
    if (draw) {
      chips += this.matchChipHtml(
        poll.id, 'draw', 'Draw', draw.pct, chipsDisabled, userChoice, null
      );
    }
    if (away) {
      chips += this.matchChipHtml(
        poll.id, 'away', away.label, away.pct, chipsDisabled, userChoice, awayTeamId
      );
    }

    var voteCls = 'match-card__vote';
    if (canVote && !draw) voteCls += ' match-card__vote--two';
    if (!canVote) voteCls += ' match-card__vote--readonly';

    return (
      '<article class="' + cardCls + '" data-match-poll-id="' + escapeHtml(poll.id) + '">' +
        '<div class="match-card__head">' +
          '<span class="match-card__meta">' + escapeHtml(headMeta) + '</span>' +
          '<div class="match-card__actions">' +
            '<button type="button" class="match-card__info" aria-label="Match info: kick-off, venue, votes, TV"' +
              ' data-info-poll-id="' + escapeHtml(poll.id) + '"' +
              ' data-info-home="' + escapeHtml(homeLabel) + '"' +
              ' data-info-away="' + escapeHtml(awayLabel) + '"' +
              ' data-info-kickoff="' + escapeHtml(kickoffIso) + '"' +
              ' data-info-venue="' + escapeHtml(match.venue || '') + '"' +
              ' data-info-stage="' + escapeHtml(stageLabel) + '"' +
              ' data-info-votes="' + escapeHtml(String(detail.total_votes || 0)) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="10"/>' +
                '<path d="M12 16v-4M12 8h.01"/>' +
              '</svg>' +
            '</button>' +
            '<span class="match-card__badge ' + statusBadgeClass(canVote ? poll.status : 'closed') + '">' +
              escapeHtml(canVote ? statusLabel(poll.status) : 'View only') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="' + voteCls + '">' + chips + '</div>' +
      '</article>'
    );
  };

  FanHub.prototype.matchChipHtml = function (pollId, choiceId, label, pct, disabled, userChoice, teamId) {
    var isDraw = choiceId === 'draw';
    var cls = 'vote-chip' + (isDraw ? ' vote-chip--draw' : ' vote-chip--pick');
    if (userChoice === choiceId) cls += ' is-selected';
    if (disabled || userChoice) disabled = true;
    var pctStr = pct != null ? pct + '%' : '';

    if (isDraw) {
      return (
        '<button type="button" class="' + cls + '" data-match-vote="' + escapeHtml(choiceId) + '"' +
        ' data-poll-id="' + escapeHtml(pollId) + '"' +
        (disabled ? ' disabled' : '') + '>' +
          '<span class="vote-chip__icon" aria-hidden="true">⚖</span>' +
          '<span class="vote-chip__meta">' +
            '<span class="vote-chip__name">' + escapeHtml(label) + '</span>' +
            (pctStr ? '<span class="vote-chip__pct">' + pctStr + '</span>' : '') +
          '</span>' +
        '</button>'
      );
    }

    return (
      '<button type="button" class="' + cls + '" data-match-vote="' + escapeHtml(choiceId) + '"' +
      ' data-poll-id="' + escapeHtml(pollId) + '"' +
      (disabled ? ' disabled' : '') + '>' +
        renderPickFlag(teamId) +
        '<span class="vote-chip__meta">' +
          '<span class="vote-chip__name">' + escapeHtml(label) + '</span>' +
          (pctStr ? '<span class="vote-chip__pct">' + pctStr + '</span>' : '') +
        '</span>' +
      '</button>'
    );
  };

  FanHub.prototype.bindMatchCards = function (root) {
    var self = this;
    $all('[data-match-vote]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var pollId = btn.getAttribute('data-poll-id');
        var choiceId = btn.getAttribute('data-match-vote');
        self.castMatchChoice(pollId, choiceId);
      });
    });
    $all('.match-card__info', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var pollId = btn.getAttribute('data-info-poll-id') || '';
        var detail = pollId ? self.matchDetails[pollId] : null;
        var votes = detail && detail.total_votes != null
          ? detail.total_votes
          : btn.getAttribute('data-info-votes');
        openMatchInfoModal({
          home: btn.getAttribute('data-info-home') || 'Home',
          away: btn.getAttribute('data-info-away') || 'Away',
          kickoff: btn.getAttribute('data-info-kickoff') || '',
          venue: btn.getAttribute('data-info-venue') || '',
          stage: btn.getAttribute('data-info-stage') || '',
          votes: votes,
        });
      });
    });
  };

  FanHub.prototype.castMatchChoice = function (pollId, choiceId) {
    var self = this;
    var detail = this.matchDetails[pollId];
    if (!this.canVoteOnMatch(detail)) return;
    if (api.getStoredChoice(pollId)) return;

    api.castVote(pollId, choiceId)
      .then(function (res) {
        if (res.error) {
          if (res.error.code === '23505') {
            api.setStoredChoice(pollId, choiceId);
          } else {
            throw res.error;
          }
        } else {
          api.setStoredChoice(pollId, choiceId);
        }
        var snap = self.matchDetails[pollId];
        var choiceLabel = choiceId;
        var matchTitle = '';
        if (snap && snap.choices) {
          var picked = choiceById(snap.choices, choiceId);
          if (picked) choiceLabel = picked.label;
          var h = choiceById(snap.choices, 'home');
          var a = choiceById(snap.choices, 'away');
          if (h && a) matchTitle = h.label + ' vs ' + a.label;
        }
        document.dispatchEvent(new CustomEvent('fan-vote-cast', {
          detail: { pollId: pollId, choice: choiceId, label: choiceLabel, matchTitle: matchTitle },
        }));
        return api.fetchPollDetail(pollId);
      })
      .then(function (detail) {
        self.matchDetails[pollId] = detail;
        var card = $('[data-match-poll-id="' + pollId + '"]');
        if (card && card.parentNode) {
          var parent = card.parentNode;
          var wrap = document.createElement('div');
          wrap.innerHTML = self.renderMatchCardHtml(detail);
          parent.replaceChild(wrap.firstElementChild, card);
          self.bindMatchCards(parent);
        }
      })
      .catch(function (err) {
        console.error('[hub] match vote failed', err);
      });
  };

  FanHub.prototype.loadArchive = function () {
    var self = this;
    var list = $('#archive-list');
    if (!list) return Promise.resolve();

    return api.fetchArchiveEvents(20, 0)
      .then(function (rows) {
        if (!rows || !rows.length) {
          list.innerHTML = '<p class="hub-empty">No archived events yet.</p>';
          return;
        }
        return Promise.all(rows.map(function (row) {
          return api.fetchPollDetail(row.highlight_poll_id).then(function (detail) {
            return { row: row, detail: detail };
          }).catch(function () {
            return { row: row, detail: null };
          });
        })).then(function (items) {
          list.innerHTML = items.map(function (item) {
            return self.renderArchiveCard(item.row, item.detail);
          }).join('');
        });
      })
      .catch(function (err) {
        console.error('[hub] archive failed', err);
        list.innerHTML = '<p class="hub-empty">Could not load archive.</p>';
      });
  };

  FanHub.prototype.renderArchiveCard = function (row, detail) {
    var link = row.event_slug === 'ucl-final-2026' ? 'ucl.html' : '#';
    var result = '';
    if (detail && detail.poll && detail.poll.winner_choice_id) {
      var winner = choiceById(detail.choices || [], detail.poll.winner_choice_id);
      var wPct = winner ? winner.pct : 0;
      result = 'Fan vote winner: ' + (winner ? winner.label : detail.poll.winner_choice_id) +
        ' ' + wPct + '%';
    }
    var statsHtml = '';
    if (detail && detail.choices && detail.choices.length === 2) {
      statsHtml = detail.choices.map(function (c) {
        return '<span>' + escapeHtml(c.label) + ' ' + c.pct + '%</span>';
      }).join('');
      statsHtml += '<span>' + formatCount(detail.total_votes) + ' votes</span>';
    } else if (row.total_votes) {
      statsHtml = '<span>' + formatCount(row.total_votes) + ' votes</span>';
    }

    return (
      '<article class="archive-card">' +
        '<div class="archive-card__banner">🏆</div>' +
        '<div class="archive-card__body">' +
          '<h2 class="archive-card__title">' + escapeHtml(row.highlight_poll_title || row.event_title) + '</h2>' +
          (result ? '<p class="archive-card__result">' + escapeHtml(result) + '</p>' : '') +
          (statsHtml ? '<div class="archive-card__stats">' + statsHtml + '</div>' : '') +
        '</div>' +
        '<a class="archive-card__link" href="' + escapeHtml(link) + '">Open archive page →</a>' +
      '</article>'
    );
  };

  FanHub.prototype.showError = function (sel, text) {
    var el = $(sel);
    if (el) el.innerHTML = '<p class="hub-empty">' + escapeHtml(text) + '</p>';
  };

  var self = new FanHub();

  function boot() {
    if (!window.VoteApi) {
      console.error('[hub] VoteApi missing — load js/api.js first');
      return;
    }
    self.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.FanHub = self;
})();
