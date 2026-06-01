/**
 * Copy to config.js and fill in from Supabase:
 * Project Settings → API → Project URL + anon public key
 */
window.VOTE_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  pollId: 'ucl-final-2026',
  refreshIntervalMs: 15000,
  /** Set true after the final — disables voting */
  pollClosed: true,
  /** 'psg' | 'arsenal' — highlights the winner */
  winner: 'psg',
};
