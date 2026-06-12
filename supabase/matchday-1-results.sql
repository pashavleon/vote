-- Matchday 1 (11–12 June 2026) — real results for finished group matches
-- Prerequisite: patch-match-scores.sql + patch-match-correct-votes.sql
-- Sources: FIFA / ESPN / Sky Sports (June 2026)
--
-- Run once, then verify with the SELECT at the bottom.

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
      -- wc26-m001 · Group A · Mexico 2–0 South Africa (11 Jun, Mexico City)
      (
        'wc26-m001'::text,
        2::smallint,
        0::smallint,
        'finished'::text,
        null::text,
        '[
          {"minute": 9, "team_id": "mex", "player": "Julian Quinones", "own_goal": false},
          {"minute": 67, "team_id": "mex", "player": "Raul Jimenez", "own_goal": false}
        ]'::jsonb,
        null::text
      ),
      -- wc26-m002 · Group A · South Korea 2–1 Czechia (12 Jun, Guadalajara) — kor home, cze away
      (
        'wc26-m002'::text,
        2::smallint,
        1::smallint,
        'finished'::text,
        null::text,
        '[
          {"minute": 59, "team_id": "cze", "player": "Ladislav Krejci", "own_goal": false},
          {"minute": 67, "team_id": "kor", "player": "Hwang In-beom", "own_goal": false},
          {"minute": 80, "team_id": "kor", "player": "Oh Hyeon-gyu", "own_goal": false}
        ]'::jsonb,
        null::text
      )
  ) as v(match_id, home_score, away_score, match_status, result_note, goals, result_choice_id)
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
  returning m.id
)
select count(*) as matches_updated from updated;

-- ---------------------------------------------------------------------------
-- Verify votes + correct predictions
-- ---------------------------------------------------------------------------

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
where m.id in ('wc26-m001', 'wc26-m002')
order by m.sort_order;
