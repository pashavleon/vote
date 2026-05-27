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
    return Number(n).toLocaleString('ru-RU');
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
    this.client = null;
    this.demo = !isConfigured(this.cfg);
    this.refreshTimer = null;

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
        this.showMessage('Supabase SDK не загружен — демо-режим', 'warn');
      }
    }

    this.bind();
    this.applyStoredChoice();
    this.refresh();
    if (!this.demo) {
      var self = this;
      this.refreshTimer = setInterval(function () {
        self.refresh();
      }, this.cfg.refreshIntervalMs);
    } else {
      this.showMessage('Демо: укажите URL и anon key в js/config.js', 'warn');
    }
  }

  ClVoteWidget.prototype.bind = function () {
    var self = this;
    this.buttons.forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
        var choice = el.getAttribute('data-vote-choice');
        if (choice) self.castVote(choice);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        el.click();
      });
    });
  };

  ClVoteWidget.prototype.applyStoredChoice = function () {
    var choice = getStoredChoice(this.pollId);
    if (!choice) return;
    this.highlightChoice(choice);
    this.setButtonsDisabled(true);
  };

  ClVoteWidget.prototype.highlightChoice = function (choice) {
    this.root.classList.add('has-voted');
    this.root.setAttribute('data-user-choice', choice);
    this.buttons.forEach(function (el) {
      var c = el.getAttribute('data-vote-choice');
      var isPick = c === choice;
      el.classList.toggle('is-selected', isPick);
      el.classList.toggle('is-dimmed', !isPick);
      el.classList.remove('is-animating-vote');
      if (isPick) el.setAttribute('aria-pressed', 'true');
      else el.setAttribute('aria-pressed', 'false');
    });
    this.root.querySelectorAll('[data-vote-row]').forEach(function (row) {
      row.classList.remove('selected-arsenal', 'selected-psg');
      if (row.getAttribute('data-vote-row') === choice) {
        row.classList.add(choice === 'arsenal' ? 'selected-arsenal' : 'selected-psg');
      }
    });
    this.root.querySelectorAll('[data-vote-pick]').forEach(function (card) {
      card.classList.remove('winner-pick');
      if (card.getAttribute('data-vote-pick') === choice) {
        card.classList.add('winner-pick');
      }
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

  ClVoteWidget.prototype.showMessage = function (text, type) {
    if (!this.messageEl) return;
    this.messageEl.textContent = text;
    this.messageEl.hidden = !text;
    this.messageEl.className = 'vote-message' + (type ? ' vote-message--' + type : '');
  };

  ClVoteWidget.prototype.renderStats = function (stats) {
    var aPct = stats.arsenal.pct;
    var pPct = stats.psg.pct;
    if (this.barFill) {
      this.barFill.style.width = stats.total ? aPct + '%' : '50%';
    }
    if (this.statArsenal) {
      this.statArsenal.textContent = 'Arsenal ' + aPct + '%';
    }
    if (this.statPsg) {
      this.statPsg.textContent = 'PSG ' + pPct + '%';
    }
    if (this.totalEl) {
      this.totalEl.textContent = formatCount(stats.total) + ' голосов · обновляется live';
    }
    this.pctEls.forEach(function (el) {
      var forChoice = el.getAttribute('data-vote-pct');
      if (forChoice === 'arsenal') el.textContent = aPct + '%';
      if (forChoice === 'psg') el.textContent = pPct + '%';
    });
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
        self.showMessage('Не удалось загрузить статистику', 'error');
      });
  };

  ClVoteWidget.prototype.castVote = function (choice) {
    if (CHOICES.indexOf(choice) === -1) return;

    var existing = getStoredChoice(this.pollId);
    if (existing) {
      this.showMessage('Вы уже голосовали', 'info');
      return;
    }

    var self = this;
    this.setButtonsDisabled(true);
    this.playVoteAnimation(choice);
    this.showMessage('Отправляем голос…', 'info');

    if (this.demo) {
      demoAddVote(this.pollId, choice);
      setStoredChoice(this.pollId, choice);
      this.highlightChoice(choice);
      this.renderStats(demoStats(this.pollId));
      this.showMessage('Демо-голос учтён локально', 'success');
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
            self.showMessage('Вы уже голосовали', 'info');
            return self.refresh();
          }
          throw res.error;
        }
        setStoredChoice(self.pollId, choice);
        self.highlightChoice(choice);
        self.showMessage('Спасибо! Ваш голос учтён', 'success');
        return self.refresh();
      })
      .catch(function (err) {
        console.error('[vote] cast failed', err);
        self.setButtonsDisabled(false);
        self.showMessage('Ошибка при отправке. Попробуйте ещё раз', 'error');
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

  function demoSaveStats(pollId, stats) {
    localStorage.setItem(STORAGE_PREFIX + 'demo_stats_' + pollId, JSON.stringify(stats));
  }

  function demoAddVote(pollId, choice) {
    var stats = demoStats(pollId);
    stats[choice].vote_count += 1;
    stats.total += 1;
    if (stats.total > 0) {
      var aPct = Math.round((stats.arsenal.vote_count / stats.total) * 1000) / 10;
      stats.arsenal.pct = aPct;
      stats.psg.pct = Math.round((100 - aPct) * 10) / 10;
    }
    demoSaveStats(pollId, stats);
    return stats;
  }

  function init() {
    document.querySelectorAll('[data-vote-root]').forEach(function (root) {
      new ClVoteWidget(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
