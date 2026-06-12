-- Fill results for finished matches — Supabase SQL Editor
--
-- Prerequisites (run once, in order):
--   1. patch-match-scores.sql
--   2. patch-match-correct-votes.sql
--
-- Workflow after each match day:
--   1. Add rows to INSERT below (one row per finished match)
--   2. Run this script
--   3. Check the verification SELECT at the bottom
--
-- Columns:
--   match_id       — e.g. wc26-m001 (poll id = wc26-poll-wc26-m001)
--   home_score     — goals at display time (usually 90 min)
--   away_score
--   match_status   — 'finished' (or 'live' while playing)
--   result_note    — optional: 'AET', '4–3 pens', etc.
--   goals          — jsonb array of {minute, team_id, player, own_goal}
--   result_choice_id — ONLY when knockout ends level after 90 min: 'home' or 'away'
--                      (group draws auto-resolve to 'draw'; clear wins auto-resolve too)

begin;

create temp table _match_results (
  match_id text primary key,
  home_score smallint not null,
  away_score smallint not null,
  match_status text not null default 'finished',
  result_note text default null,
  goals jsonb not null default '[]'::jsonb,
  result_choice_id text default null,
  constraint _match_results_status_check
    check (match_status in ('scheduled', 'live', 'finished', 'postponed')),
  constraint _match_results_choice_check
    check (result_choice_id is null or result_choice_id in ('home', 'draw', 'away'))
) on commit drop;

-- ===========================================================================
-- MATCH DAY — edit this block (examples commented out)
-- ===========================================================================

insert into _match_results (
  match_id, home_score, away_score, match_status, result_note, goals, result_choice_id
) values
  -- Opening match — Mexico 2–1 South Africa
  (
    'wc26-m001',
    2,
    1,
    'finished',
    null,
    '[
      {"minute": 23, "team_id": "mex", "player": "Player A", "own_goal": false},
      {"minute": 67, "team_id": "rsa", "player": "Player B", "own_goal": false},
      {"minute": 89, "team_id": "mex", "player": "Player C", "own_goal": false}
    ]'::jsonb,
    null
  )
  -- Group A — South Korea 1–1 Czechia (draw)
  -- ,('wc26-m002', 1, 1, 'finished', null, '[]'::jsonb, null)
  -- Knockout — 1–1 after 90, home wins on pens (set result_choice_id)
  -- ,('wc26-m073', 1, 1, 'finished', '4–3 pens', '[]'::jsonb, 'home')
on conflict (match_id) do update set
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  match_status = excluded.match_status,
  result_note = excluded.result_note,
  goals = excluded.goals,
  result_choice_id = excluded.result_choice_id;

-- ---------------------------------------------------------------------------
-- Apply to matches (auto-fills result_choice_id when score decides outcome)
-- ---------------------------------------------------------------------------

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
where m.id = r.match_id;

-- Warn if knockout tie has no result_choice_id
do $$
declare
  bad text;
begin
  select string_agg(m.id, ', ')
  into bad
  from public.matches m
  join _match_results r on r.match_id = m.id
  where m.stage <> 'group'
    and r.home_score = r.away_score
    and public.match_result_choice(
      m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
    ) is null;

  if bad is not null then
    raise warning 'Knockout FT draw without result_choice_id: % — set home or away in INSERT', bad;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify — run after commit
-- ---------------------------------------------------------------------------

select
  m.id as match_id,
  m.home_team_id || ' vs ' || m.away_team_id as fixture,
  m.home_score || '–' || m.away_score as score,
  m.match_status,
  m.result_note,
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
where m.id in (
  select match_id from (
    values ('wc26-m001')
    -- add same ids you inserted above for filtered verify
  ) as t(match_id)
)
order by m.sort_order;

-- ---------------------------------------------------------------------------
-- Lookup — find match_id by teams / kickoff (run anytime)
-- ---------------------------------------------------------------------------

-- select m.id, m.group_code, m.kickoff_at, m.home_team_id, m.away_team_id, p.id as poll_id
-- from public.matches m
-- join public.polls p on p.match_id = m.id
-- where m.event_id = 'wc-2026'
--   and m.stage = 'group'
-- order by m.kickoff_at;
