-- Fill results for finished matches — Supabase SQL Editor
-- Run the whole file at once (or at least the UPDATE block + VERIFY block together).
--
-- Prerequisites (run once, in order):
--   1. patch-match-scores.sql
--   2. patch-match-correct-votes.sql
--
-- Workflow after each match day:
--   1. Edit rows in the _match_results CTE below
--   2. Run this script
--   3. Run the VERIFY query at the bottom (same match_id list)
--
-- Columns per row:
--   match_id, home_score, away_score, match_status, result_note, goals, result_choice_id
--   result_choice_id — only for knockout FT draw (pens/AET): 'home' or 'away'

-- ===========================================================================
-- APPLY RESULTS — edit rows in VALUES, then run
-- ===========================================================================

with _match_results as (
  select
    v.match_id,
    v.home_score,
    v.away_score,
    v.match_status,
    v.result_note,
    v.goals,
    v.result_choice_id
  from (
    values
      -- Opening match — Mexico 2–1 South Africa
      (
        'wc26-m001'::text,
        2::smallint,
        1::smallint,
        'finished'::text,
        null::text,
        '[
          {"minute": 23, "team_id": "mex", "player": "Player A", "own_goal": false},
          {"minute": 67, "team_id": "rsa", "player": "Player B", "own_goal": false},
          {"minute": 89, "team_id": "mex", "player": "Player C", "own_goal": false}
        ]'::jsonb,
        null::text
      )
      -- ,('wc26-m002', 1, 1, 'finished', null, '[]'::jsonb, null)
      -- ,('wc26-m073', 1, 1, 'finished', '4–3 pens', '[]'::jsonb, 'home')
  ) as v(match_id, home_score, away_score, match_status, result_note, goals, result_choice_id)
  where v.match_status in ('scheduled', 'live', 'finished', 'postponed')
),
updated as (
  update public.matches m
  set
    home_score = r.home_score,
    away_score = r.away_score,
    match_status = r.match_status,
    result_note = r.result_note,
    goals = r.goals,
    result_choice_id = case
      when r.result_choice_id is not null then r.result_choice_id
      when r.home_score > r.away_score then 'home'
      when r.home_score < r.away_score then 'away'
      when m.stage = 'group' and r.home_score = r.away_score then 'draw'
      else null
    end
  from _match_results r
  where m.id = r.match_id
  returning m.id, m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
)
select
  u.id as match_id,
  u.home_score || '–' || u.away_score as score,
  u.match_status,
  public.match_result_choice(
    u.stage, u.home_score, u.away_score, u.match_status, u.result_choice_id
  ) as result_choice,
  case
    when u.stage <> 'group'
      and u.home_score = u.away_score
      and public.match_result_choice(
        u.stage, u.home_score, u.away_score, u.match_status, u.result_choice_id
      ) is null
    then 'WARNING: knockout draw — set result_choice_id to home or away'
    else 'ok'
  end as check_status
from updated u;

-- ===========================================================================
-- VERIFY — run separately; edit match_id list to match your batch
-- ===========================================================================

-- select
--   m.id as match_id,
--   m.home_team_id || ' vs ' || m.away_team_id as fixture,
--   m.home_score || '–' || m.away_score as score,
--   m.match_status,
--   m.result_note,
--   public.match_result_choice(
--     m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
--   ) as result_choice,
--   p.id as poll_id,
--   coalesce(vtot.n, 0) as total_votes,
--   coalesce(vok.n, 0) as correct_votes,
--   case
--     when coalesce(vtot.n, 0) = 0 then null
--     else round(coalesce(vok.n, 0)::numeric / vtot.n * 100, 1)
--   end as correct_pct
-- from public.matches m
-- join public.polls p on p.match_id = m.id and p.poll_type = 'match_winner'
-- left join lateral (
--   select count(*)::bigint as n from public.votes v where v.poll_id = p.id
-- ) vtot on true
-- left join lateral (
--   select count(*)::bigint as n
--   from public.votes v
--   where v.poll_id = p.id
--     and v.choice = public.match_result_choice(
--       m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
--     )
-- ) vok on true
-- where m.id in ('wc26-m001')
-- order by m.sort_order;

-- ===========================================================================
-- LOOKUP — find match_id by kickoff (run anytime)
-- ===========================================================================

-- select m.id, m.group_code, m.kickoff_at, m.home_team_id, m.away_team_id, p.id as poll_id
-- from public.matches m
-- join public.polls p on p.match_id = m.id
-- where m.event_id = 'wc-2026'
-- order by m.kickoff_at;
