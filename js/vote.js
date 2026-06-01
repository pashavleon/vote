/**
 * Fan poll widget v2 — GitHub Pages + Supabase (VoteApi).
 * Markup: [data-vote-root] + optional data-vote-poll-id, data-vote-mode="generic"
 */
(function () {
  'use strict';

  var api = window.VoteApi;

  function msg(key, params) {
    return window.I18n ? window.I18n.t(key, params) : key;
  }

  function formatCount(n) {
    if (window.I18n && window.I18n.formatNumber) return window.I18n.formatNumber(n);
    return Number(n).toLocaleString('en-US');
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function dispatchVoteCast(detail) {
    document.dispatchEvent(new CustomEvent('ucl-vote-cast', { detail: detail }));
    document.dispatchEvent(new CustomEvent('fan-vote-cast', { detail: detail }));
  }

  function demoStatsKey(pollId) {
    return api.STORAGE_PREFIX + 'demo_stats_' + pollId;
  }

  function demoStats(pollId) {
    try {
      var raw = JSON.parse(localStorage.getItem(demoStatsKey(pollId)) || 'null');
      if (raw && typeof raw.total === 'number') return raw;
    } catch (e) {
      /* ignore */
    }
    return api.normalizeStatsRows([]);
  }

  function demoAddVote(pollId, choiceId) {
    var stats = demoStats(pollId);
    if (!stats.choices[choiceId]) {
      stats.choices[choiceId] = { vote_count: 0, pct: 0 };
    }
    stats.choices[choiceId].vote_count += 1;
    stats.total += 1;
    Object.keys(stats.choices).forEach(function (id) {
      var c = stats.choices[id];
      c.pct = stats.total
        ? Math.round((c.vote_count / stats.total) * 1000) / 10
        : 0;
    });
    stats.ordered = Object.keys(stats.choices).map(function (id) {
      return {
        id: id,
        vote_count: stats.choices[id].vote_count,
        pct: stats.choices[id].pct,
      };
    });
    localStorage.setItem(demoStatsKey(pollId), JSON.stringify(stats));
    return stats;
  }

  function ClVoteWidget(root) {
    this.root = root;
    this.cfg = api.getConfig();
    this.pollId = root.getAttribute('data-vote-poll-id') || this.cfg.pollId;
    this.mode = root.getAttribute('data-vote-mode') || 'legacy';
    this.demo = !api.isConfigured(this.cfg);
    this.refreshTimer = null;
    this.lastStats = null;
    this.choices = [];
    this.closed = false;
    this.winner = null;
    this.bound = false;

    this.barFill = root.querySelector('[data-vote-bar-fill]');
    this.totalEl = root.querySelector('[data-vote-total]');
    this.messageEl = root.querySelector('[data-vote-message]');
    this.choicesContainer = root.querySelector('[data-vote-choices]');
    this.buttons = root.querySelectorAll('[data-vote-choice]');
    this.pctEls = root.querySelectorAll('[data-vote-pct]');
  }

  ClVoteWidget.prototype.bootstrap = function () {
    var self = this;

    this.bindLocale();

    if (this.demo) {
      return this.finishBootstrap(this.fallbackFromDom());
    }

    return api.fetchPollDetail(this.pollId)
      .then(function (detail) {
        self.applyPollDetail(detail);
        return detail;
      })
      .catch(function (err) {
        console.warn('[vote] poll detail unavailable, using config/DOM fallback', err);
        return self.fallbackFromDom();
      })
      .then(function () {
        self.finishBootstrap();
      });
  };

  ClVoteWidget.prototype.fallbackFromDom = function () {
    this.closed = this.cfg.pollClosed;
    this.winner = this.cfg.winner;
    this.choices = this.readChoicesFromDom();
    return null;
  };

  ClVoteWidget.prototype.readChoicesFromDom = function () {
    var list = [];
    this.root.querySelectorAll('[data-vote-choice]').forEach(function (el, idx) {
      var id = el.getAttribute('data-vote-choice');
      if (!id) return;
      list.push({
        id: id,
        label: id,
        meta: {},
        sort_order: idx + 1,
        vote_count: 0,
        pct: 0,
      });
    });
    return list;
  };

  ClVoteWidget.prototype.applyPollDetail = function (detail) {
    if (!detail || !detail.poll) {
      this.fallbackFromDom();
      return;
    }

    var poll = detail.poll;
    this.closed = api.isPollClosed(poll);
    this.winner = poll.winner_choice_id || null;
    this.choices = (detail.choices || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0) || String(a.id).localeCompare(String(b.id));
    });

    if (this.mode === 'generic' && detail.total_votes != null) {
      this.lastStats = api.statsFromDetail(detail);
    }
  };

  ClVoteWidget.prototype.finishBootstrap = function () {
    if (this.mode === 'generic') {
      this.renderGenericChoices();
    } else {
      if (!this.choices.length) this.choices = this.readChoicesFromDom();
      this.syncLegacyChoiceIds();
    }

    if (!this.bound) {
      this.bind();
      this.bound = true;
    }

    if (!this.closed) {
      this.updateVoteLabels();
      this.applyStoredChoice();
    } else {
      this.applyClosedState();
    }

    var self = this;
    this.refresh().then(function () {
      if (!self.demo && !self.closed) {
        self.refreshTimer = setInterval(function () {
          self.refresh();
        }, self.cfg.refreshIntervalMs);
      } else if (self.demo && !self.closed) {
        self.showMessage('msg.demoConfig', 'warn');
      }
    });
  };

  ClVoteWidget.prototype.syncLegacyChoiceIds = function () {
    var self = this;
    this.buttons = this.root.querySelectorAll('[data-vote-choice]');
    this.choices.forEach(function (choice) {
      var btn = self.root.querySelector('[data-vote-choice="' + choice.id + '"]');
      if (!btn || !choice.label) return;
      var sideLabel = btn.querySelector('.side-label');
      if (sideLabel && !sideLabel.hasAttribute('data-i18n')) {
        sideLabel.textContent = choice.label;
      }
    });
  };

  ClVoteWidget.prototype.renderGenericChoices = function () {
    if (!this.choicesContainer) return;

    var self = this;
    var html = this.choices.map(function (choice) {
      var flag = choice.meta && choice.meta.flag ? choice.meta.flag : '';
      var pct = choice.pct != null ? choice.pct : 0;
      return (
        '<button type="button" class="vote-choice-btn" data-vote-choice="' + escapeHtml(choice.id) + '">' +
          '<span class="vote-choice-btn__flag">' + flag + '</span>' +
          '<span class="vote-choice-btn__name">' + escapeHtml(choice.label) + '</span>' +
          '<span class="vote-choice-btn__pct" data-vote-pct>' + pct + '%</span>' +
          '<span class="vote-choice-btn__bar"><span data-vote-bar-fill style="width:' + pct + '%"></span></span>' +
        '</button>'
      );
    }).join('');

    this.choicesContainer.innerHTML = html;
    this.buttons = this.choicesContainer.querySelectorAll('[data-vote-choice]');
    this.pctEls = this.choicesContainer.querySelectorAll('[data-vote-pct]');
  };

  ClVoteWidget.prototype.applyClosedState = function () {
    var self = this;
    this.root.classList.add('poll-closed');
    if (this.winner) this.root.classList.add('poll-winner--' + this.winner);

    this.setButtonsDisabled(true);
    this.buttons.forEach(function (el) {
      el.setAttribute('tabindex', '-1');
    });

    this.root.querySelectorAll('[data-i18n-result]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-result');
      if (key) el.setAttribute('data-i18n', key);
    });

    if (window.I18n && window.I18n.apply) window.I18n.apply(this.root);

    var vsBadge = this.root.querySelector('.vs-badge');
    if (vsBadge) vsBadge.textContent = '🏆';

    if (this.winner) {
      var winnerBtn = this.root.querySelector('[data-vote-choice="' + this.winner + '"]');
      if (winnerBtn) {
        winnerBtn.classList.add('is-winner');
        winnerBtn.setAttribute('aria-pressed', 'true');
      }
      this.buttons.forEach(function (el) {
        if (el.getAttribute('data-vote-choice') !== self.winner) {
          el.classList.add('is-dimmed');
        }
      });
      if (this.pollId === 'ucl-final-2026' && this.winner === 'psg' && window.Fireworks && window.Fireworks.start) {
        window.Fireworks.start();
      }
    }

    this.showMessage('msg.pollClosed', 'info');
  };

  ClVoteWidget.prototype.bindLocale = function () {
    var self = this;
    document.addEventListener('ucl-locale-change', function () {
      if (!self.closed) self.updateVoteLabels();
      if (self.lastStats) self.renderStats(self.lastStats);
      if (self.closed) {
        self.root.querySelectorAll('[data-i18n-result]').forEach(function (el) {
          var key = el.getAttribute('data-i18n-result');
          if (key) el.setAttribute('data-i18n', key);
        });
        if (window.I18n && window.I18n.apply) window.I18n.apply(self.root);
        if (self.messageEl) self.showMessage('msg.pollClosed', 'info');
      }
    });
  };

  ClVoteWidget.prototype.updateVoteLabels = function () {
    if (!window.I18n) return;
    var self = this;
    this.buttons.forEach(function (el) {
      var choice = el.getAttribute('data-vote-choice');
      if (choice === 'arsenal') el.setAttribute('aria-label', msg('vote.arsenalAria'));
      if (choice === 'psg') el.setAttribute('aria-label', msg('vote.psgAria'));
      var meta = null;
      for (var i = 0; i < self.choices.length; i++) {
        if (self.choices[i].id === choice) { meta = self.choices[i]; break; }
      }
      if (meta && meta.label && choice !== 'arsenal' && choice !== 'psg') {
        el.setAttribute('aria-label', meta.label);
      }
    });
  };

  ClVoteWidget.prototype.bind = function () {
    var self = this;
    this.buttons.forEach(function (el) {
      el.addEventListener('click', function () {
        if (self.closed) return;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
        var choice = el.getAttribute('data-vote-choice');
        if (choice) self.castVote(choice);
      });
      el.addEventListener('keydown', function (e) {
        if (self.closed) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        el.click();
      });
    });
  };

  ClVoteWidget.prototype.applyStoredChoice = function () {
    if (this.closed) return;
    var choice = api.getStoredChoice(this.pollId);
    if (!choice) return;
    this.highlightChoice(choice);
    this.setButtonsDisabled(true);
  };

  ClVoteWidget.prototype.highlightChoice = function (choice) {
    this.root.classList.add('has-voted');
    this.root.setAttribute('data-user-choice', choice);
    dispatchVoteCast({ choice: choice, pollId: this.pollId });

    this.buttons.forEach(function (el) {
      var c = el.getAttribute('data-vote-choice');
      var isPick = c === choice;
      el.classList.toggle('is-selected', isPick);
      el.classList.toggle('is-dimmed', !isPick);
      el.classList.remove('is-animating-vote');
      el.setAttribute('aria-pressed', isPick ? 'true' : 'false');
    });
  };

  ClVoteWidget.prototype.setButtonsDisabled = function (disabled) {
    this.buttons.forEach(function (el) {
      el.disabled = disabled;
      if (disabled) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });
  };

  ClVoteWidget.prototype.playVoteAnimation = function (choice) {
    var el = this.root.querySelector('[data-vote-choice="' + choice + '"]');
    if (el) el.classList.add('is-animating-vote');
  };

  ClVoteWidget.prototype.showMessage = function (key, type) {
    if (!this.messageEl) return;
    this.messageEl.textContent = msg(key);
    this.messageEl.hidden = !key;
    this.messageEl.className = 'vote-message' + (type ? ' vote-message--' + type : '');
  };

  ClVoteWidget.prototype.renderStats = function (stats) {
    this.lastStats = stats;
    var self = this;

    if (this.mode === 'generic') {
      this.choices.forEach(function (choice) {
        var row = stats.choices[choice.id] || { pct: 0 };
        var btn = self.root.querySelector('[data-vote-choice="' + choice.id + '"]');
        if (!btn) return;
        var pctEl = btn.querySelector('[data-vote-pct]');
        if (pctEl) pctEl.textContent = row.pct + '%';
        var bar = btn.querySelector('[data-vote-bar-fill]');
        if (bar) bar.style.width = row.pct + '%';
      });
    } else if (this.choices.length === 2) {
      var a = stats.choices[this.choices[0].id] || { pct: 0 };
      var b = stats.choices[this.choices[1].id] || { pct: 0 };
      if (this.barFill) {
        this.barFill.style.width = stats.total ? a.pct + '%' : '50%';
      }
      var statA = this.root.querySelector('[data-vote-stat-' + this.choices[0].id + ']');
      var statB = this.root.querySelector('[data-vote-stat-' + this.choices[1].id + ']');
      if (statA) {
        statA.textContent = this.choices[0].id === 'arsenal'
          ? msg('stats.arsenal', { pct: a.pct })
          : this.choices[0].label + ' — ' + a.pct + '%';
      }
      if (statB) {
        statB.textContent = this.choices[1].id === 'psg'
          ? msg('stats.psg', { pct: b.pct })
          : this.choices[1].label + ' — ' + b.pct + '%';
      }
    }

    if (this.totalEl) {
      var totalKey = this.closed ? 'vote.totalFinal' : 'vote.totalLive';
      var emptyKey = this.closed ? 'vote.totalFinalEmpty' : 'vote.totalLiveEmpty';
      this.totalEl.textContent = stats.total
        ? msg(totalKey, { count: formatCount(stats.total) })
        : msg(emptyKey);
    }
  };

  ClVoteWidget.prototype.refresh = function () {
    var self = this;

    if (this.demo) {
      this.renderStats(demoStats(this.pollId));
      return Promise.resolve();
    }

    return api.fetchPollStats(this.pollId)
      .then(function (rows) {
        self.renderStats(api.normalizeStatsRows(rows));
      })
      .catch(function (err) {
        console.error('[vote] refresh failed', err);
        if (!self.closed) self.showMessage('msg.statsError', 'error');
      });
  };

  ClVoteWidget.prototype.castVote = function (choiceId) {
    if (this.closed) return;

    var valid = false;
    for (var i = 0; i < this.choices.length; i++) {
      if (this.choices[i].id === choiceId) { valid = true; break; }
    }
    if (!valid && this.choices.length) return;

    var existing = api.getStoredChoice(this.pollId);
    if (existing) {
      this.showMessage('msg.alreadyVoted', 'info');
      return;
    }

    var self = this;
    this.setButtonsDisabled(true);
    this.playVoteAnimation(choiceId);
    this.showMessage('msg.sending', 'info');

    if (this.demo) {
      demoAddVote(this.pollId, choiceId);
      api.setStoredChoice(this.pollId, choiceId);
      this.highlightChoice(choiceId);
      this.renderStats(demoStats(this.pollId));
      this.showMessage('msg.demoVote', 'success');
      return;
    }

    api.castVote(this.pollId, choiceId)
      .then(function (res) {
        if (res.error) {
          if (res.error.code === '23505') {
            api.setStoredChoice(self.pollId, choiceId);
            self.highlightChoice(choiceId);
            self.showMessage('msg.alreadyVoted', 'info');
            return self.refresh();
          }
          throw res.error;
        }
        api.setStoredChoice(self.pollId, choiceId);
        self.highlightChoice(choiceId);
        self.showMessage('msg.thanks', 'success');
        return self.refresh();
      })
      .catch(function (err) {
        console.error('[vote] cast failed', err);
        self.setButtonsDisabled(false);
        self.showMessage('msg.sendError', 'error');
      });
  };

  function init() {
    var widgets = [];
    document.querySelectorAll('[data-vote-root]').forEach(function (root) {
      widgets.push(new ClVoteWidget(root).bootstrap());
    });
    return Promise.all(widgets);
  }

  function boot() {
    if (!window.VoteApi) {
      console.error('[vote] VoteApi not loaded — include js/api.js before js/vote.js');
      return;
    }
    if (window.I18n && window.I18n.init) window.I18n.init();
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
