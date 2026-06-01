/**
 * FanVote hub — featured event, winner poll, match polls, archive.
 * Requires: VoteApi, optional vote.js for shared events.
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
    if (window.FlagVisual && window.FlagVisual.render) {
      return window.FlagVisual.render(teamId, size || 'hero');
    }
    return '<span class="flag-fallback">🏳</span>';
  }

  function isGroupMatchDetail(detail) {
    return detail && detail.match && detail.match.stage === 'group';
  }

  function FanHub() {
    this.cfg = api.getConfig();
    this.event = null;
    this.eventId = this.cfg.eventId;
    this.winnerPollId = this.cfg.winnerPollId || 'wc-2026-winner';
    this.winnerDetail = null;
    this.winnerExpanded = false;
    this.matchPolls = [];
    this.matchDetails = Object.create(null);
    this.stage = 'group';
    this.refreshTimer = null;
  }

  FanHub.prototype.init = function () {
    var self = this;
    this.bindChrome();

    if (!api.isConfigured()) {
      this.showError('#hub-winner-grid', 'Configure js/config.js with Supabase keys.');
      return;
    }

    api.fetchFeaturedEvent()
      .then(function (event) {
        self.event = event;
        if (event && event.id) self.eventId = event.id;
        self.renderHero(event);
        return Promise.all([
          self.loadWinner(),
          self.loadMatchPolls(),
          self.loadArchive(),
        ]);
      })
      .catch(function (err) {
        console.error('[hub] init failed', err);
        self.showError('#hub-winner-grid', 'Could not load event data.');
      })
      .then(function () {
        self.refreshTimer = setInterval(function () {
          self.loadWinner(true);
          self.refreshVisibleMatchDetails();
        }, self.cfg.refreshIntervalMs || 15000);
      });
  };

  FanHub.prototype.bindChrome = function () {
    var self = this;

    $all('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('[data-tab]').forEach(function (b) { b.classList.remove('is-active'); });
        $all('.tab-panel').forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var panel = document.getElementById('panel-' + btn.getAttribute('data-tab'));
        if (panel) panel.classList.add('is-active');
        if (btn.getAttribute('data-tab') === 'matches') {
          self.renderMatches();
        }
      });
    });

    $all('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (el.tagName === 'A') e.preventDefault();
        var target = el.getAttribute('data-nav');
        $all('.screen').forEach(function (s) { s.classList.remove('is-visible'); });
        $all('[data-nav]').forEach(function (n) { n.classList.remove('is-active'); });
        var screen = document.getElementById('screen-' + target);
        if (screen) screen.classList.add('is-visible');
        el.classList.add('is-active');
      });
    });

    $all('#stage-filter [data-stage]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#stage-filter [data-stage]').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        self.stage = btn.getAttribute('data-stage');
        self.renderMatches();
      });
    });
  };

  FanHub.prototype.renderHero = function (event) {
    if (!event) return;
    var title = $('#event-title');
    var meta = $('#event-meta');
    if (title) title.textContent = event.title || 'Fan voting';
    if (meta) meta.textContent = event.subtitle || '';
    document.title = (event.title || 'FanVote') + ' — Fan Poll Hub';
  };

  FanHub.prototype.loadWinner = function (silent) {
    var self = this;
    return api.fetchPollDetail(this.winnerPollId)
      .then(function (detail) {
        self.winnerDetail = detail;
        self.renderWinnerGrid();
        var totalEl = $('#winner-total');
        if (totalEl && detail) {
          totalEl.textContent = detail.total_votes
            ? formatCount(detail.total_votes) + ' votes · live'
            : 'Be the first to vote';
        }
      })
      .catch(function (err) {
        if (!silent) console.error('[hub] winner load failed', err);
      });
  };

  FanHub.prototype.renderWinnerGrid = function () {
    var grid = $('#hub-winner-grid');
    if (!grid || !this.winnerDetail) return;

    var detail = this.winnerDetail;
    var poll = detail.poll;
    var closed = api.isPollClosed(poll);
    var choices = (detail.choices || []).slice().sort(function (a, b) {
      return (b.pct || 0) - (a.pct || 0) || (a.sort_order || 0) - (b.sort_order || 0);
    });
    var userChoice = api.getStoredChoice(this.winnerPollId);
    var topN = this.winnerExpanded ? choices.length : Math.min(7, choices.length);
    var visible = choices.slice(0, topN);
    var leaderId = visible.length ? visible[0].id : null;

    var html = visible.map(function (c) {
      var pct = c.pct != null ? c.pct : 0;
      var cls = 'team-card';
      if (c.id === leaderId && detail.total_votes > 0) cls += ' is-leading';
      if (c.id === userChoice) cls += ' is-selected';
      if (closed || userChoice) cls += ' is-disabled';
      return (
        '<button type="button" class="' + cls + '" data-winner-choice="' + escapeHtml(c.id) + '"' +
        (closed || userChoice ? ' disabled' : '') + '>' +
          renderTeamFlag(c.id, 'hero') +
          '<span class="team-card__name">' + escapeHtml(c.label) + '</span>' +
          '<span class="team-card__pct">' + pct + '%</span>' +
          '<span class="team-card__bar"><span style="width:' + pct + '%"></span></span>' +
        '</button>'
      );
    }).join('');

    if (!this.winnerExpanded && choices.length > 7) {
      html += (
        '<button type="button" class="team-card team-card--expand" id="winner-expand">' +
          '<span class="team-card__flag">➕</span>' +
          '<span class="team-card__name">All ' + choices.length + ' teams</span>' +
          '<span class="team-card__pct" style="color:var(--muted);font-size:0.72rem">expand</span>' +
        '</button>'
      );
    } else if (this.winnerExpanded && choices.length > 7) {
      html += (
        '<button type="button" class="team-card team-card--expand" id="winner-expand">' +
          '<span class="team-card__flag">➖</span>' +
          '<span class="team-card__name">Show less</span>' +
        '</button>'
      );
    }

    grid.innerHTML = html;
    var msg = $('#winner-message');
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
    $all('[data-winner-choice]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (closed) return;
        self.castWinnerChoice(btn.getAttribute('data-winner-choice'));
      });
    });

    var expandBtn = $('#winner-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        self.winnerExpanded = !self.winnerExpanded;
        self.renderWinnerGrid();
      });
    }
  };

  FanHub.prototype.castWinnerChoice = function (choiceId) {
    var self = this;
    if (api.getStoredChoice(this.winnerPollId)) return;

    api.castVote(this.winnerPollId, choiceId)
      .then(function (res) {
        if (res.error) {
          if (res.error.code === '23505') {
            api.setStoredChoice(self.winnerPollId, choiceId);
            return self.loadWinner(true);
          }
          throw res.error;
        }
        api.setStoredChoice(self.winnerPollId, choiceId);
        document.dispatchEvent(new CustomEvent('fan-vote-cast', {
          detail: { pollId: self.winnerPollId, choice: choiceId },
        }));
        return self.loadWinner(true);
      })
      .catch(function (err) {
        console.error('[hub] winner vote failed', err);
        var msg = $('#winner-message');
        if (msg) {
          msg.textContent = 'Vote failed. Try again.';
          msg.hidden = false;
        }
      });
  };

  FanHub.prototype.loadMatchPolls = function () {
    var self = this;
    if (!this.eventId) return Promise.resolve();
    return api.fetchActivePolls(this.eventId, 'match_winner', 200, 0)
      .then(function (rows) {
        self.matchPolls = rows || [];
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
    var notice = '';
    if (this.stage !== 'group') {
      notice = '<p class="hub-notice">Knockout matches are view-only. Voting is open for <strong>group stage</strong> matches.</p>';
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

    var groupsHtml = GROUPS.filter(function (g) { return byGroup[g]; }).map(function (g, idx) {
      var list = byGroup[g];
      return (
        '<details class="group-block"' + (idx === 0 ? ' open' : '') + ' data-group="' + g + '">' +
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
      if (block.open) self.loadGroupDetails(g, byGroup[g]);
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
    var groupVoting = isGroupMatchDetail(detail);
    var votingOpen = groupVoting && !closed;
    var userChoice = api.getStoredChoice(poll.id);
    var cardCls = 'match-card';
    if (poll.status === 'open' && groupVoting) cardCls += ' is-live';
    if (closed || !groupVoting) cardCls += ' is-closed';

    var headMeta = formatKickoff(match.kickoff_at || poll.closes_at);
    if (match.venue) headMeta += ' · ' + venueShort(match.venue);

    var homeTeamId = match.home_team_id || '';
    var awayTeamId = match.away_team_id || '';

    var chips = '';
    if (!groupVoting) {
      chips = '<p class="hub-notice" style="margin:0;grid-column:1/-1">Stats only — group stage voting only.</p>';
    } else {
      if (home) {
        chips += this.matchChipHtml(poll.id, 'home', home.label, home.pct, !votingOpen, userChoice);
      }
      if (draw) {
        chips += this.matchChipHtml(poll.id, 'draw', 'Draw', draw.pct, !votingOpen, userChoice);
      }
      if (away) {
        var span = draw ? ' style="grid-column:span 2"' : '';
        chips += this.matchChipHtml(poll.id, 'away', away.label, away.pct, !votingOpen, userChoice, span);
      }
    }

    var voteCls = 'match-card__vote' + (groupVoting ? '' : ' match-card__vote--readonly');

    return (
      '<article class="' + cardCls + '" data-match-poll-id="' + escapeHtml(poll.id) + '">' +
        '<div class="match-card__head">' +
          '<span>' + escapeHtml(headMeta) + '</span>' +
          '<span class="match-card__badge ' + statusBadgeClass(groupVoting ? poll.status : 'closed') + '">' +
            escapeHtml(groupVoting ? statusLabel(poll.status) : 'View only') +
          '</span>' +
        '</div>' +
        '<div class="match-card__body">' +
          '<div class="match-team">' + renderTeamFlag(homeTeamId, 'sm') +
            escapeHtml(home ? home.label : '') + '</div>' +
          '<div class="match-vs">vs</div>' +
          '<div class="match-team">' + renderTeamFlag(awayTeamId, 'sm') +
            escapeHtml(away ? away.label : '') + '</div>' +
        '</div>' +
        '<div class="' + voteCls + '">' + chips + '</div>' +
      '</article>'
    );
  };

  FanHub.prototype.matchChipHtml = function (pollId, choiceId, label, pct, disabled, userChoice, extraAttr) {
    var cls = 'vote-chip';
    if (userChoice === choiceId) cls += ' is-selected';
    if (disabled || userChoice) disabled = true;
    var pctStr = pct != null && pct > 0 ? pct + '%' : '';
    return (
      '<button type="button" class="' + cls + '" data-match-vote="' + escapeHtml(choiceId) + '"' +
      ' data-poll-id="' + escapeHtml(pollId) + '"' +
      (disabled ? ' disabled' : '') +
      (extraAttr || '') + '>' +
        escapeHtml(label) +
        (pctStr ? '<small>' + pctStr + '</small>' : '') +
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
  };

  FanHub.prototype.castMatchChoice = function (pollId, choiceId) {
    var self = this;
    var detail = this.matchDetails[pollId];
    if (!isGroupMatchDetail(detail)) return;
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
    var link = row.event_slug === 'ucl-final-2026' ? 'vote.html' : '#';
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
