/**
 * Fan poll widget for GitHub Pages + Supabase.
 * Markup: [data-vote-root] with optional data-vote-poll-id
 */
(function () {
  'use strict';

  var CHOICES = ['arsenal', 'psg'];
  var STORAGE_PREFIX = 'ucl_fan_vote_';

  function getConfig() {
    var c = window.VOTE_CONFIG || {};
    return {
      supabaseUrl: (c.supabaseUrl || '').replace(/\/$/, ''),
      supabaseAnonKey: c.supabaseAnonKey || '',
      pollId: c.pollId || 'ucl-final-2026',
      refreshIntervalMs: c.refreshIntervalMs || 15000,
      pollClosed: Boolean(c.pollClosed),
      winner: c.winner || null,
    };
  }

  function isConfigured(cfg) {
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  function getVoterToken(pollId) {
    var key = STORAGE_PREFIX + 'token_' + pollId;
    var token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID ? crypto.randomUUID() : randomTokenFallback();
      localStorage.setItem(key, token);
    }
    return token;
  }

  function getStoredChoice(pollId) {
    return localStorage.getItem(STORAGE_PREFIX + 'choice_' + pollId);
  }

  function setStoredChoice(pollId, choice) {
    localStorage.setItem(STORAGE_PREFIX + 'choice_' + pollId, choice);
  }

  function randomTokenFallback() {
    return 'vt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
  }

  function formatCount(n) {
    if (window.I18n && window.I18n.formatNumber) return window.I18n.formatNumber(n);
    return Number(n).toLocaleString('en-US');
  }

  function msg(key, params) {
    return window.I18n ? window.I18n.t(key, params) : key;
  }

  function createClient(cfg) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase JS not loaded');
    }
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  function normalizeStats(rows) {
    var out = {
      arsenal: { vote_count: 0, pct: 0 },
      psg: { vote_count: 0, pct: 0 },
      total: 0,
    };
    (rows || []).forEach(function (row) {
      var choice = row.choice;
      if (CHOICES.indexOf(choice) === -1) return;
      out[choice] = {
        vote_count: Number(row.vote_count) || 0,
        pct: Number(row.pct) || 0,
      };
    });
    out.total = out.arsenal.vote_count + out.psg.vote_count;
    if (out.total > 0) {
      var aPct = Math.round((out.arsenal.vote_count / out.total) * 1000) / 10;
      out.arsenal.pct = aPct;
      out.psg.pct = Math.round((100 - aPct) * 10) / 10;
    }
    return out;
  }

  function ClVoteWidget(root) {
    this.root = root;
    this.cfg = getConfig();
    this.pollId = root.getAttribute('data-vote-poll-id') || this.cfg.pollId;
    this.closed = this.cfg.pollClosed;
    this.winner = this.cfg.winner;
    this.client = null;
    this.demo = !isConfigured(this.cfg);
    this.refreshTimer = null;
    this.lastStats = null;

    this.barFill = root.querySelector('[data-vote-bar-fill]');
    this.statArsenal = root.querySelector('[data-vote-stat-arsenal]');
    this.statPsg = root.querySelector('[data-vote-stat-psg]');
    this.totalEl = root.querySelector('[data-vote-total]');
    this.messageEl = root.querySelector('[data-vote-message]');
    this.buttons = root.querySelectorAll('[data-vote-choice]');
    this.pctEls = root.querySelectorAll('[data-vote-pct]');

    if (!this.demo) {
      try {
        this.client = createClient(this.cfg);
      } catch (e) {
        this.demo = true;
        if (!this.closed) this.showMessage('msg.demoNoSdk', 'warn');
      }
    }

    this.bind();
    this.bindLocale();

    if (this.closed) {
      this.applyClosedState();
    } else {
      this.updateVoteLabels();
      this.applyStoredChoice();
    }

    this.refresh();

    if (!this.demo && !this.closed) {
      var self = this;
      this.refreshTimer = setInterval(function () {
        self.refresh();
      }, this.cfg.refreshIntervalMs);
    } else if (this.demo && !this.closed) {
      this.showMessage('msg.demoConfig', 'warn');
    }
  }

  ClVoteWidget.prototype.applyClosedState = function () {
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

    if (this.winner === 'psg') {
      var psgBtn = this.root.querySelector('[data-vote-choice="psg"]');
      var arsenalBtn = this.root.querySelector('[data-vote-choice="arsenal"]');
      if (psgBtn) {
        psgBtn.classList.add('is-winner');
        psgBtn.setAttribute('aria-pressed', 'true');
      }
      if (arsenalBtn) {
        arsenalBtn.classList.add('is-runner-up');
        arsenalBtn.setAttribute('aria-pressed', 'false');
      }
      if (window.Fireworks && window.Fireworks.start) window.Fireworks.start();
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
        if (self.messageEl && self.messageEl.textContent) {
          self.showMessage('msg.pollClosed', 'info');
        }
      }
    });
  };

  ClVoteWidget.prototype.updateVoteLabels = function () {
    if (!window.I18n) return;
    this.buttons.forEach(function (el) {
      var choice = el.getAttribute('data-vote-choice');
      if (choice === 'arsenal') el.setAttribute('aria-label', msg('vote.arsenalAria'));
      if (choice === 'psg') el.setAttribute('aria-label', msg('vote.psgAria'));
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
    var choice = getStoredChoice(this.pollId);
    if (!choice) return;
    this.highlightChoice(choice);
    this.setButtonsDisabled(true);
  };

  ClVoteWidget.prototype.highlightChoice = function (choice) {
    this.root.classList.add('has-voted');
    this.root.setAttribute('data-user-choice', choice);
    document.dispatchEvent(
      new CustomEvent('ucl-vote-cast', { detail: { choice: choice, pollId: this.pollId } })
    );
    this.buttons.forEach(function (el) {
      var c = el.getAttribute('data-vote-choice');
      var isPick = c === choice;
      el.classList.toggle('is-selected', isPick);
      el.classList.toggle('is-dimmed', !isPick);
      el.classList.remove('is-animating-vote');
      if (isPick) el.setAttribute('aria-pressed', 'true');
      else el.setAttribute('aria-pressed', 'false');
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
    if (!el) return;
    el.classList.add('is-animating-vote');
  };

  ClVoteWidget.prototype.showMessage = function (key, type) {
    if (!this.messageEl) return;
    this.messageEl.textContent = msg(key);
    this.messageEl.hidden = !key;
    this.messageEl.className = 'vote-message' + (type ? ' vote-message--' + type : '');
  };

  ClVoteWidget.prototype.renderStats = function (stats) {
    this.lastStats = stats;
    var aPct = stats.arsenal.pct;
    var pPct = stats.psg.pct;
    if (this.barFill) {
      this.barFill.style.width = stats.total ? aPct + '%' : '50%';
    }
    if (this.statArsenal) {
      this.statArsenal.textContent = msg('stats.arsenal', { pct: aPct });
    }
    if (this.statPsg) {
      this.statPsg.textContent = msg('stats.psg', { pct: pPct });
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
    return this.client
      .rpc('get_poll_stats', { p_poll_id: this.pollId })
      .then(function (res) {
        if (res.error) throw res.error;
        self.renderStats(normalizeStats(res.data));
      })
      .catch(function (err) {
        console.error('[vote] refresh failed', err);
        if (!self.closed) self.showMessage('msg.statsError', 'error');
      });
  };

  ClVoteWidget.prototype.castVote = function (choice) {
    if (this.closed) return;
    if (CHOICES.indexOf(choice) === -1) return;

    var existing = getStoredChoice(this.pollId);
    if (existing) {
      this.showMessage('msg.alreadyVoted', 'info');
      return;
    }

    var self = this;
    this.setButtonsDisabled(true);
    this.playVoteAnimation(choice);
    this.showMessage('msg.sending', 'info');

    if (this.demo) {
      demoAddVote(this.pollId, choice);
      setStoredChoice(this.pollId, choice);
      this.highlightChoice(choice);
      this.renderStats(demoStats(this.pollId));
      this.showMessage('msg.demoVote', 'success');
      return;
    }

    var token = getVoterToken(this.pollId);
    this.client
      .from('votes')
      .insert({
        poll_id: this.pollId,
        choice: choice,
        voter_token: token,
      })
      .then(function (res) {
        if (res.error) {
          if (res.error.code === '23505') {
            setStoredChoice(self.pollId, choice);
            self.highlightChoice(choice);
            self.showMessage('msg.alreadyVoted', 'info');
            return self.refresh();
          }
          throw res.error;
        }
        setStoredChoice(self.pollId, choice);
        self.highlightChoice(choice);
        self.showMessage('msg.thanks', 'success');
        return self.refresh();
      })
      .catch(function (err) {
        console.error('[vote] cast failed', err);
        self.setButtonsDisabled(false);
        self.showMessage('msg.sendError', 'error');
      });
  };

  function demoStats(pollId) {
    var key = STORAGE_PREFIX + 'demo_stats_' + pollId;
    try {
      var raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (raw && typeof raw.total === 'number') return raw;
    } catch (e) {
      /* ignore */
    }
    return normalizeStats([]);
  }

  function init() {
    document.querySelectorAll('[data-vote-root]').forEach(function (root) {
      new ClVoteWidget(root);
    });
  }

  function boot() {
    if (window.I18n && window.I18n.init) window.I18n.init();
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
