-- =============================================================================
-- SET MATCH RESULTS — Supabase SQL Editor
-- =============================================================================
--
-- Prerequisites (once):
--   1. patch-match-scores.sql
--   2. patch-match-correct-votes.sql
--
-- After each match day:
--   1. Run LOOKUP below (optional) to find match_id
--   2. Add rows in VALUES (section APPLY)
--   3. Run APPLY + CHECK (one query)
--   4. Run VERIFY VOTES (second query)
--
-- Row format:
--   match_id, home_score, away_score, match_status, result_note, goals, result_choice_id
--
--   match_status: 'scheduled' | 'live' | 'finished' | 'postponed'
--   goals: JSON array — {"minute": 9, "team_id": "mex", "player": "Name", "own_goal": false}
--   result_choice_id: only knockout FT draw (pens/AET) — 'home' or 'away'
--   Group draw: leave result_choice_id null (auto → 'draw')
--
-- Tip (manual row): python scripts/gen_match_results_sql.py wc26-m007 2 1 -g 23 can "Player A"
-- Auto fetch:      python scripts/fetch_match_results.py --days 3 --out supabase/generated/match-results.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- LOOKUP — find match_id by date / team (run separately)
-- -----------------------------------------------------------------------------

-- select
--   m.id,
--   m.group_code,
--   m.kickoff_at::date as day,
--   m.home_team_id || ' vs ' || m.away_team_id as fixture,
--   m.home_score,
--   m.away_score,
--   m.match_status,
--   p.id as poll_id
-- from public.matches m
-- join public.polls p on p.match_id = m.id and p.poll_type = 'match_winner'
-- where m.event_id = 'wc-2026'
--   and m.kickoff_at::date between '2026-06-12' and '2026-06-13'
-- order by m.kickoff_at;

-- -----------------------------------------------------------------------------
-- APPLY + CHECK — edit VALUES, then run this whole block
-- -----------------------------------------------------------------------------

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
      -- --- paste rows below (comma before each new row) ---
      -- Group match example:
      -- (
      --   'wc26-m007'::text,
      --   2::smallint,
      --   1::smallint,
      --   'finished'::text,
      --   null::text,
      --   '[
      --     {"minute": 23, "team_id": "can", "player": "Player A", "own_goal": false},
      --     {"minute": 67, "team_id": "bih", "player": "Player B", "own_goal": false}
      --   ]'::jsonb,
      --   null::text
      -- )
      -- Knockout draw (pens) example:
      -- (
      --   'wc26-m073'::text,
      --   1::smallint,
      --   1::smallint,
      --   'finished'::text,
      --   '4–3 pens'::text,
      --   '[]'::jsonb,
      --   'home'::text
      -- )
      -- Live score (no result_choice yet):
      -- (
      --   'wc26-m007'::text,
      --   1::smallint,
      --   0::smallint,
      --   'live'::text,
      --   null::text,
      --   '[]'::jsonb,
      --   null::text
      -- )
      (null::text, null::smallint, null::smallint, null::text, null::text, null::jsonb, null::text)
  ) as v(match_id, home_score, away_score, match_status, result_note, goals, result_choice_id)
  where v.match_id is not null
    and v.match_status in ('scheduled', 'live', 'finished', 'postponed')
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
  returning
    m.id,
    m.stage,
    m.home_team_id,
    m.away_team_id,
    m.home_score,
    m.away_score,
    m.match_status,
    m.result_note,
    m.result_choice_id
)
select
  u.id as match_id,
  u.home_team_id || ' vs ' || u.away_team_id as fixture,
  u.home_score || '–' || u.away_score as score,
  u.match_status,
  u.result_note,
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
from updated u
order by u.id;

-- -----------------------------------------------------------------------------
-- VERIFY VOTES — run after APPLY (auto: recently finished matches)
-- -----------------------------------------------------------------------------

select
  m.id as match_id,
  m.home_team_id || ' vs ' || m.away_team_id as fixture,
  m.home_score || '–' || m.away_score as score,
  public.match_result_choice(
    m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
  ) as result_choice,
  p.id as poll_id,
  coalesce(vtot.n, 0) as total_votes,
  coalesce(vok.n, 0) as correct_votes,
  case
    when coalesce(vtot.n, 0) = 0 then null
    else round(coalesce(vok.n, 0)::numeric / vtot.n * 100, 1)
  end as correct_pct
from public.matches m
join public.polls p on p.match_id = m.id and p.poll_type = 'match_winner'
left join lateral (
  select count(*)::bigint as n from public.votes v where v.poll_id = p.id
) vtot on true
left join lateral (
  select count(*)::bigint as n
  from public.votes v
  where v.poll_id = p.id
    and v.choice = public.match_result_choice(
      m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
    )
) vok on true
where m.event_id = 'wc-2026'
  and m.match_status = 'finished'
  and m.kickoff_at >= now() - interval '21 days'
order by m.kickoff_at desc;
