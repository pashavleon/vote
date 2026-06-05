-- =============================================================================
-- Audit: WC 2026 group stage — 3 matches per team (official 48-team format)
-- Run in Supabase SQL Editor (read-only checks). No data changes.
-- =============================================================================

-- Expected: 72 group matches, 6 per group, each team exactly 3 appearances in its group
select
  'group_match_count' as check_name,
  count(*)::int as actual,
  72 as expected,
  count(*) = 72 as ok
from public.matches
where event_id = 'wc-2026' and stage = 'group';

select
  group_code,
  count(*)::int as matches_in_group,
  count(*) = 6 as ok_six_per_group
from public.matches
where event_id = 'wc-2026' and stage = 'group'
group by group_code
order by group_code;

-- Per team: games in own group (home + away) — should be 3 for each of 48 teams
with group_apps as (
  select m.group_code, m.home_team_id as team_id
  from public.matches m
  where m.event_id = 'wc-2026' and m.stage = 'group'
  union all
  select m.group_code, m.away_team_id
  from public.matches m
  where m.event_id = 'wc-2026' and m.stage = 'group'
)
select
  group_code,
  team_id,
  count(*)::int as group_games,
  count(*) = 3 as ok_three_games
from group_apps
group by group_code, team_id
having count(*) <> 3
order by group_code, team_id;
-- (no rows = all teams have exactly 3 group matches)

-- Duplicate fixtures within a group?
select
  group_code,
  least(home_team_id, away_team_id) as t1,
  greatest(home_team_id, away_team_id) as t2,
  count(*)::int as n
from public.matches
where event_id = 'wc-2026' and stage = 'group'
group by 1, 2, 3
having count(*) > 1;

-- Total tournament matches
select
  'all_matches' as check_name,
  count(*)::int as actual,
  104 as expected,
  count(*) = 104 as ok
from public.matches
where event_id = 'wc-2026';

-- One poll per group match?
select
  count(distinct m.id)::int as group_matches,
  count(distinct p.id)::int as group_polls,
  count(distinct m.id) = count(distinct p.id) as ok
from public.matches m
left join public.polls p on p.match_id = m.id and p.poll_type = 'match_winner'
where m.event_id = 'wc-2026' and m.stage = 'group';
