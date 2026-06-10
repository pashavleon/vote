/**
 * TOP FAN VOTE — registry of the three WC 2026 poll types (prep for hub refactor).
 * Load before hub.js when wiring favorite page.
 */
(function (global) {
  'use strict';

  global.TFV_POLL_TYPES = {
    winner: {
      id: 'winner',
      page: 'winner',
      path: 'winner.html',
      configKey: 'winnerPollId',
      defaultPollId: 'wc-2026-winner',
      title: 'Tournament winner',
      question: 'Who will win World Cup 2026?',
      subtitle: 'One pick from 48 teams · live vote share',
      shareVerb: 'to win World Cup 2026',
    },
    favorite: {
      id: 'favorite',
      page: 'favorite',
      path: 'favorite.html',
      configKey: 'favoritePollId',
      defaultPollId: 'wc-2026-favorite',
      title: 'Favorite team',
      question: 'Who do you support at World Cup 2026?',
      subtitle: 'Your favorite team · live fan support',
      shareVerb: 'at World Cup 2026',
    },
    matches: {
      id: 'matches',
      page: 'matches',
      path: 'matches.html',
      configKey: null,
      defaultPollId: null,
      title: 'Match polls',
      question: 'Who wins each match?',
      subtitle: 'Group stage · live fan predictions',
      shareVerb: 'match predictions',
    },
  };
})(window);
