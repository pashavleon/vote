/**
 * Supabase RPC + vote persistence for FanVote (GitHub Pages).
 * Requires: @supabase/supabase-js, window.VOTE_CONFIG
 */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'fan_vote_';
  var LEGACY_PREFIX = 'ucl_fan_vote_';
  var client = null;

  function getConfig() {
    var c = global.VOTE_CONFIG || {};
    return {
      supabaseUrl: (c.supabaseUrl || '').replace(/\/$/, ''),
      supabaseAnonKey: c.supabaseAnonKey || '',
      pollId: c.pollId || 'ucl-final-2026',
      eventId: c.eventId || null,
      winnerPollId: c.winnerPollId || 'wc-2026-winner',
      /** Only this match stage accepts votes; advance manually when the tournament moves on. */
      activeMatchStage: c.activeMatchStage || 'group',
      refreshIntervalMs: c.refreshIntervalMs || 15000,
      pollClosed: Boolean(c.pollClosed),
      winner: c.winner || null,
    };
  }

  function isConfigured(cfg) {
    cfg = cfg || getConfig();
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  function getClient(cfg) {
    if (client) return client;
    cfg = cfg || getConfig();
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error('Supabase JS not loaded');
    }
    client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return client;
  }

  function storageGet(key) {
    return global.localStorage.getItem(STORAGE_PREFIX + key)
      || global.localStorage.getItem(LEGACY_PREFIX + key);
  }

  function storageSet(key, value) {
    global.localStorage.setItem(STORAGE_PREFIX + key, value);
  }

  function randomTokenFallback() {
    return 'vt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
  }

  function getVoterToken(pollId) {
    var key = 'token_' + pollId;
    var token = storageGet(key);
    if (!token) {
      token = global.crypto && global.crypto.randomUUID
        ? global.crypto.randomUUID()
        : randomTokenFallback();
      storageSet(key, token);
    }
    return token;
  }

  function getStoredChoice(pollId) {
    return storageGet('choice_' + pollId);
  }

  function setStoredChoice(pollId, choiceId) {
    storageSet('choice_' + pollId, choiceId);
  }

  function unwrapRpcData(data) {
    if (data == null) return null;
    if (Array.isArray(data)) return data.length ? data[0] : null;
    return data;
  }

  function rpc(name, params) {
    return getClient()
      .rpc(name, params || {})
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data;
      });
  }

  function fetchPollStats(pollId) {
    return rpc('get_poll_stats', { p_poll_id: pollId });
  }

  function fetchPollDetail(pollId) {
    return rpc('get_poll_detail', { p_poll_id: pollId }).then(unwrapRpcData);
  }

  function fetchFeaturedEvent() {
    return rpc('get_featured_event').then(unwrapRpcData);
  }

  function fetchActivePolls(eventId, pollType, limit, offset) {
    return rpc('get_active_polls', {
      p_event_id: eventId,
      p_poll_type: pollType || null,
      p_limit: limit == null ? 50 : limit,
      p_offset: offset == null ? 0 : offset,
    });
  }

  function fetchArchiveEvents(limit, offset) {
    return rpc('get_archive_events', {
      p_limit: limit == null ? 20 : limit,
      p_offset: offset == null ? 0 : offset,
    });
  }

  function castVote(pollId, choiceId) {
    return getClient()
      .from('votes')
      .insert({
        poll_id: pollId,
        choice: choiceId,
        voter_token: getVoterToken(pollId),
      });
  }

  /** @returns {{ choices: Object.<string,{vote_count:number,pct:number}>, total: number, ordered: Array }} */
  function normalizeStatsRows(rows) {
    var choices = {};
    var ordered = [];
    var total = 0;

    (rows || []).forEach(function (row) {
      var id = row.choice;
      if (!id) return;
      var voteCount = Number(row.vote_count) || 0;
      var pct = Number(row.pct) || 0;
      choices[id] = { vote_count: voteCount, pct: pct };
      ordered.push({ id: id, vote_count: voteCount, pct: pct });
      total += voteCount;
    });

    return { choices: choices, total: total, ordered: ordered };
  }

  function statsFromDetail(detail) {
    if (!detail || !detail.choices) {
      return normalizeStatsRows([]);
    }
    var rows = detail.choices.map(function (c) {
      return {
        choice: c.id,
        vote_count: c.vote_count,
        pct: c.pct,
      };
    });
    return normalizeStatsRows(rows);
  }

  function isPollClosed(poll) {
    if (!poll) return false;
    return poll.status === 'closed' || poll.status === 'archived';
  }

  global.VoteApi = {
    getConfig: getConfig,
    isConfigured: isConfigured,
    getClient: getClient,
    getVoterToken: getVoterToken,
    getStoredChoice: getStoredChoice,
    setStoredChoice: setStoredChoice,
    fetchPollStats: fetchPollStats,
    fetchPollDetail: fetchPollDetail,
    fetchFeaturedEvent: fetchFeaturedEvent,
    fetchActivePolls: fetchActivePolls,
    fetchArchiveEvents: fetchArchiveEvents,
    castVote: castVote,
    normalizeStatsRows: normalizeStatsRows,
    statsFromDetail: statsFromDetail,
    isPollClosed: isPollClosed,
    STORAGE_PREFIX: STORAGE_PREFIX,
  };
})(window);
