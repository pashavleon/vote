/**

 * Copy to config.js and fill in from Supabase:

 * Project Settings → API → Project URL + anon public key

 */

window.VOTE_CONFIG = {

  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',

  supabaseAnonKey: 'YOUR_ANON_KEY',

  /** Default poll when data-vote-poll-id is omitted */

  pollId: 'ucl-final-2026',

  eventId: 'wc-2026',
  winnerPollId: 'wc-2026-winner',
  refreshIntervalMs: 15000,

  /** Optional offline fallbacks only — live status comes from get_poll_detail */

  pollClosed: false,

  winner: null,

};

