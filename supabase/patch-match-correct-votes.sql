-- Match result outcome + correct prediction counts — run once in Supabase SQL Editor
-- Prerequisite: patch-match-scores.sql
--
-- Adds result_choice_id for knockout pens/AET ties, helper match_result_choice(),
-- and extends get_poll_detail with correct_vote_count.

begin;

alter table public.matches
  add column if not exists result_choice_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_result_choice_id_check'
  ) then
    alter table public.matches
      add constraint matches_result_choice_id_check
      check (result_choice_id is null or result_choice_id in ('home', 'draw', 'away'));
  end if;
end $$;

comment on column public.matches.result_choice_id is
  'Actual poll outcome when not derivable from 90-min scores alone (knockout FT draw → pens/AET winner).';

create or replace function public.match_result_choice(
  p_stage text,
  p_home_score smallint,
  p_away_score smallint,
  p_match_status text,
  p_result_choice_id text
)
returns text
language sql
immutable
as $$
  select case
    when p_match_status <> 'finished' or p_home_score is null or p_away_score is null then null
    when p_home_score > p_away_score then 'home'
    when p_home_score < p_away_score then 'away'
    when p_stage = 'group' then 'draw'
    else p_result_choice_id
  end;
$$;

grant execute on function public.match_result_choice(text, smallint, smallint, text, text) to anon, authenticated;

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
    'correct_vote_count', case
      when m.id is null then null
      when public.match_result_choice(
        m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
      ) is null then null
      else (
        select count(*)::bigint
        from public.votes v
        where v.poll_id = p.id
          and v.choice = public.match_result_choice(
            m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
          )
      )
    end,
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
        'goals', coalesce(m.goals, '[]'::jsonb),
        'result_choice_id', public.match_result_choice(
          m.stage, m.home_score, m.away_score, m.match_status, m.result_choice_id
        )
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
