-- Clear match scores after a UI / RPC test (Supabase SQL Editor)
-- Safe to re-run. Does not touch polls or votes.

begin;

-- ---------------------------------------------------------------------------
-- 1. One match — default: opening game used in docs (Mexico vs South Africa)
-- ---------------------------------------------------------------------------

update public.matches
set
  home_score = null,
  away_score = null,
  match_status = 'scheduled',
  result_note = null,
  goals = '[]'::jsonb,
  result_choice_id = null
where id = 'wc26-m001';

-- ---------------------------------------------------------------------------
-- 2. All matches that have any score or non-default status (uncomment if needed)
-- ---------------------------------------------------------------------------

-- update public.matches
-- set
--   home_score = null,
--   away_score = null,
--   match_status = 'scheduled',
--   result_note = null,
--   goals = '[]'::jsonb,
--   result_choice_id = null
-- where event_id = 'wc-2026'
--   and (
--     home_score is not null
--     or away_score is not null
--     or match_status <> 'scheduled'
--     or result_note is not null
--     or goals <> '[]'::jsonb
--   );

commit;

-- ---------------------------------------------------------------------------
-- Verify (optional — run after commit)
-- ---------------------------------------------------------------------------

-- select id, home_score, away_score, match_status, result_note, goals
-- from public.matches
-- where id = 'wc26-m001';
