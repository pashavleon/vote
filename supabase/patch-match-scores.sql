-- Match scores (phase 1) — run once in Supabase SQL Editor
-- Prerequisite: migrate-v1-to-v2.sql + seed-wc-2026.sql
--
-- Manual workflow after each match day:
--   1. Set home_score, away_score, match_status = 'finished'
--   2. Optionally fill goals (jsonb) and result_note (AET / pens)
--   3. See examples at the bottom of this file

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns on matches
-- ---------------------------------------------------------------------------

alter table public.matches
  add column if not exists home_score smallint,
  add column if not exists away_score smallint,
  add column if not exists match_status text not null default 'scheduled',
  add column if not exists result_note text,
  add column if not exists goals jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_match_status_check'
  ) then
    alter table public.matches
      add constraint matches_match_status_check
      check (match_status in ('scheduled', 'live', 'finished', 'postponed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_scores_non_negative'
  ) then
    alter table public.matches
      add constraint matches_scores_non_negative
      check (
        (home_score is null and away_score is null)
        or (
          home_score is not null
          and away_score is not null
          and home_score >= 0
          and away_score >= 0
        )
      );
  end if;
end $$;

comment on column public.matches.home_score is 'Goals for home team at display time (90 min for group; see result_note for AET/pens).';
comment on column public.matches.away_score is 'Goals for away team at display time.';
comment on column public.matches.match_status is 'scheduled | live | finished | postponed — independent of poll voting status.';
comment on column public.matches.result_note is 'Optional, e.g. AET or 4–3 pens';
comment on column public.matches.goals is 'Array of {minute, team_id, player, own_goal} sorted by minute in UI.';

-- ---------------------------------------------------------------------------
-- 2. Extend get_poll_detail — expose score fields on match object
-- ---------------------------------------------------------------------------

create or replace function public.get_poll_detail(p_poll_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'poll', jsonb_build_object(
      'id', p.id,
      'event_id', p.event_id,
      'match_id', p.match_id,
      'poll_type', p.poll_type,
      'title', p.title,
      'status', public.poll_lifecycle_status(p.archived_at, p.opens_at, p.closes_at),
      'opens_at', p.opens_at,
      'closes_at', p.closes_at,
      'archived_at', p.archived_at,
      'winner_choice_id', p.winner_choice_id
    ),
    'choices', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pc.id,
            'label', pc.label,
            'meta', pc.meta,
            'sort_order', pc.sort_order,
            'vote_count', coalesce(st.vote_count, 0),
            'pct', coalesce(st.pct, 0)
          )
          order by pc.sort_order, pc.id
        )
        from public.poll_choices pc
        left join lateral (
          select s.choice, s.vote_count, s.pct
          from public.get_poll_stats(p.id) s
          where s.choice = pc.id
        ) st on true
        where pc.poll_id = p.id
      ),
      '[]'::jsonb
    ),
    'total_votes', coalesce(
      (select sum(s.vote_count)::bigint from public.get_poll_stats(p.id) s),
      0
    ),
    'match', case
      when m.id is null then null
      else jsonb_build_object(
        'id', m.id,
        'stage', m.stage,
        'group_code', m.group_code,
        'round_label', m.round_label,
        'kickoff_at', m.kickoff_at,
        'venue', m.venue,
        'home_team_id', m.home_team_id,
        'away_team_id', m.away_team_id,
        'home_score', m.home_score,
        'away_score', m.away_score,
        'match_status', m.match_status,
        'result_note', m.result_note,
        'goals', coalesce(m.goals, '[]'::jsonb)
      )
    end,
    'event', case
      when e.id is null then null
      else jsonb_build_object(
        'id', e.id,
        'slug', e.slug,
        'title', e.title,
        'subtitle', e.subtitle
      )
    end
  )
  from public.polls p
  left join public.matches m on m.id = p.match_id
  left join public.events e on e.id = p.event_id
  where p.id = p_poll_id;
$$;

grant execute on function public.get_poll_detail(text) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- EXAMPLES (run separately after matches — not part of migration)
-- ---------------------------------------------------------------------------
--
-- Group stage — Mexico 2–1 South Africa, two goals:
--
-- update public.matches
-- set
--   home_score = 2,
--   away_score = 1,
--   match_status = 'finished',
--   result_note = null,
--   goals = '[
--     {"minute": 23, "team_id": "mex", "player": "Player A", "own_goal": false},
--     {"minute": 67, "team_id": "rsa", "player": "Player B", "own_goal": false},
--     {"minute": 89, "team_id": "mex", "player": "Player C", "own_goal": false}
--   ]'::jsonb
-- where id = 'wc26-m001';
--
-- Knockout — 1–1 after 90 min, decided on pens (show regulation score + note):
--
-- update public.matches
-- set
--   home_score = 1,
--   away_score = 1,
--   match_status = 'finished',
--   result_note = '4–3 pens',
--   goals = '[
--     {"minute": 12, "team_id": "bra", "player": "Striker", "own_goal": false},
--     {"minute": 78, "team_id": "ger", "player": "Midfielder", "own_goal": false}
--   ]'::jsonb
-- where id = 'wc26-m073';
--
-- Mark live (optional, before FT):
--
-- update public.matches
-- set match_status = 'live', home_score = 1, away_score = 0
-- where id = 'wc26-m002';
--
-- Clear / reset a match:
--
-- update public.matches
-- set home_score = null, away_score = null, match_status = 'scheduled',
--     result_note = null, goals = '[]'::jsonb
-- where id = 'wc26-m001';
