-- =============================================================================
-- Migration: fan poll v1 → v2 (multi-event hub)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- DATA SAFETY
--   • Existing rows in public.votes are NOT deleted.
--   • Column public.votes.choice is kept (same name) — prod vote.js keeps working.
--   • Script aborts if any vote cannot be mapped to poll_choices.
--   • Pre/post counts are printed at the end — compare before closing the tab.
--
-- Optional: note vote count before run:
--   select count(*) from public.votes where poll_id = 'ucl-final-2026';
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Snapshot (for manual comparison in query results)
-- ---------------------------------------------------------------------------
do $$
declare
  n bigint;
begin
  select count(*) into n from public.votes;
  raise notice 'PRE-MIGRATION votes total: %', n;
end $$;

-- ---------------------------------------------------------------------------
-- 1. New tables: events, matches, poll_choices
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id text primary key,
  slug text not null unique,
  title text not null,
  subtitle text,
  kind text not null check (kind in ('club', 'national', 'other')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_featured boolean not null default false,
  hero_image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  stage text not null check (stage in ('group', 'r32', 'r16', 'qf', 'sf', 'third', 'final')),
  group_code text,
  round_label text,
  home_team_id text not null,
  away_team_id text not null,
  kickoff_at timestamptz not null,
  venue text,
  sort_order int not null default 0,
  home_score smallint,
  away_score smallint,
  match_status text not null default 'scheduled'
    check (match_status in ('scheduled', 'live', 'finished', 'postponed')),
  result_note text,
  goals jsonb not null default '[]'::jsonb,
  constraint matches_scores_non_negative check (
    (home_score is null and away_score is null)
    or (
      home_score is not null
      and away_score is not null
      and home_score >= 0
      and away_score >= 0
    )
  )
);

create index if not exists matches_event_kickoff_idx
  on public.matches (event_id, kickoff_at);

create table if not exists public.poll_choices (
  id text not null,
  poll_id text not null references public.polls (id) on delete cascade,
  label text not null,
  meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  primary key (poll_id, id)
);

-- ---------------------------------------------------------------------------
-- 2. Extend existing polls (ALTER, not recreate)
-- ---------------------------------------------------------------------------

alter table public.polls
  add column if not exists event_id text references public.events (id) on delete set null,
  add column if not exists match_id text,
  add column if not exists poll_type text,
  add column if not exists archived_at timestamptz,
  add column if not exists winner_choice_id text,
  add column if not exists created_at timestamptz not null default now();

-- FK match_id after matches exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'polls_match_id_fkey'
  ) then
    alter table public.polls
      add constraint polls_match_id_fkey
      foreign key (match_id) references public.matches (id) on delete set null;
  end if;
end $$;

-- poll_type default for legacy rows
update public.polls
set poll_type = 'custom'
where poll_type is null;

alter table public.polls
  alter column poll_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'polls_poll_type_check'
  ) then
    alter table public.polls
      add constraint polls_poll_type_check
      check (
        poll_type in ('event_winner', 'match_winner', 'custom', 'favorite')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'polls_type_match_consistency'
  ) then
    alter table public.polls
      add constraint polls_type_match_consistency
      check (
        (poll_type = 'event_winner' and match_id is null)
        or (poll_type = 'match_winner' and match_id is not null)
        or poll_type = 'custom'
        or (poll_type = 'favorite' and match_id is null)
      );
  end if;
end $$;

-- Composite FK: winner must be a valid choice for this poll
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'polls_winner_choice_fkey'
  ) then
    alter table public.polls
      add constraint polls_winner_choice_fkey
      foreign key (id, winner_choice_id)
      references public.poll_choices (poll_id, id)
      deferrable initially deferred;
  end if;
end $$;

create index if not exists polls_active_idx
  on public.polls (archived_at, closes_at);

create index if not exists polls_event_idx
  on public.polls (event_id);

-- ---------------------------------------------------------------------------
-- 3. Seed UCL event + final match + choices (before votes FK)
-- ---------------------------------------------------------------------------

insert into public.events (id, slug, title, subtitle, kind, starts_at, ends_at, is_featured)
values (
  'ucl-2025-26',
  'ucl-final-2026',
  'UEFA Champions League 2025/26',
  'Final — Munich',
  'club',
  timestamptz '2025-09-01 00:00:00+00',
  timestamptz '2026-05-31 23:59:59+00',
  false
)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  is_featured = excluded.is_featured;

insert into public.matches (
  id, event_id, stage, round_label,
  home_team_id, away_team_id, kickoff_at, venue, sort_order
)
values (
  'ucl-final-2026-match',
  'ucl-2025-26',
  'final',
  'Final',
  'arsenal',
  'psg',
  timestamptz '2026-05-30 19:00:00+00',
  'Allianz Arena, Munich',
  1
)
on conflict (id) do update set
  kickoff_at = excluded.kickoff_at,
  venue = excluded.venue;

-- Choices must exist before votes FK and before winner_choice_id on poll
insert into public.poll_choices (poll_id, id, label, meta, sort_order)
values
  (
    'ucl-final-2026',
    'arsenal',
    'Arsenal',
    '{"short": "ARS", "crest": "assets/arsenal-480.jpg"}'::jsonb,
    1
  ),
  (
    'ucl-final-2026',
    'psg',
    'Paris Saint-Germain',
    '{"short": "PSG", "crest": "assets/psg-480.jpg"}'::jsonb,
    2
)
on conflict (poll_id, id) do update set
  label = excluded.label,
  meta = excluded.meta,
  sort_order = excluded.sort_order;

-- Link existing poll to event; archive + set winner (PSG won)
update public.polls
set
  event_id = 'ucl-2025-26',
  match_id = 'ucl-final-2026-match',
  poll_type = 'match_winner',
  closes_at = coalesce(closes_at, timestamptz '2026-05-30 20:00:00+00'),
  archived_at = coalesce(archived_at, now()),
  winner_choice_id = coalesce(winner_choice_id, 'psg')
where id = 'ucl-final-2026';

-- ---------------------------------------------------------------------------
-- 4. Votes: drop hardcoded enum, add FK to poll_choices (keep column name)
-- ---------------------------------------------------------------------------

-- Remove old check constraint (arsenal/psg only)
alter table public.votes
  drop constraint if exists votes_choice_check;

-- Abort if unknown choices exist
do $$
declare
  bad bigint;
begin
  select count(*) into bad
  from public.votes v
  where v.poll_id = 'ucl-final-2026'
    and v.choice not in ('arsenal', 'psg');

  if bad > 0 then
    raise exception 'Migration aborted: % votes with unknown choice values', bad;
  end if;
end $$;

-- FK: every vote.choice must exist in poll_choices for that poll
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'votes_poll_choice_fkey'
  ) then
    alter table public.votes
      add constraint votes_poll_choice_fkey
      foreign key (poll_id, choice)
      references public.poll_choices (poll_id, id);
  end if;
end $$;

-- Orphan check (votes pointing to missing poll/choice)
do $$
declare
  orphans bigint;
begin
  select count(*) into orphans
  from public.votes v
  left join public.poll_choices c
    on c.poll_id = v.poll_id and c.id = v.choice
  where c.id is null;

  if orphans > 0 then
    raise exception 'Migration aborted: % votes without matching poll_choices row', orphans;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Helper: poll lifecycle status
-- ---------------------------------------------------------------------------

create or replace function public.poll_lifecycle_status(
  p_archived_at timestamptz,
  p_opens_at timestamptz,
  p_closes_at timestamptz
)
returns text
language sql
immutable
as $$
  select case
    when p_archived_at is not null then 'archived'
    when p_opens_at is not null and p_opens_at > now() then 'scheduled'
    when p_closes_at is not null and p_closes_at <= now() then 'closed'
    else 'open'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_poll_stats (backward compatible — still returns column "choice")
-- ---------------------------------------------------------------------------

create or replace function public.get_poll_stats(p_poll_id text)
returns table (
  choice text,
  vote_count bigint,
  pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select v.choice, count(*)::bigint as vote_count
    from public.votes v
    where v.poll_id = p_poll_id
    group by v.choice
  ),
  total as (
    select coalesce(sum(vote_count), 0)::bigint as n from counts
  )
  select
    pc.id as choice,
    coalesce(ct.vote_count, 0) as vote_count,
    case
      when (select n from total) = 0 then 0::numeric
      else round(coalesce(ct.vote_count, 0)::numeric / (select n from total) * 100, 1)
    end as pct
  from public.poll_choices pc
  left join counts ct on ct.choice = pc.id
  where pc.poll_id = p_poll_id
  order by pc.sort_order, pc.id;
$$;

grant execute on function public.get_poll_stats(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: hub / archive (v2 frontend)
-- ---------------------------------------------------------------------------

create or replace function public.get_featured_event()
returns public.events
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.events e
  where e.is_featured = true
  order by e.starts_at desc nulls last
  limit 1;
$$;

grant execute on function public.get_featured_event() to anon, authenticated;

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

create or replace function public.get_active_polls(
  p_event_id text,
  p_poll_type text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  poll_id text,
  poll_type text,
  title text,
  status text,
  opens_at timestamptz,
  closes_at timestamptz,
  match_id text,
  stage text,
  group_code text,
  kickoff_at timestamptz,
  total_votes bigint,
  leading_choice_id text
)
language sql
stable
security definer
set search_path = public
as $$
  with tallies as (
    select
      v.poll_id,
      v.choice,
      count(*)::bigint as vote_count
    from public.votes v
    group by v.poll_id, v.choice
  ),
  ranked as (
    select
      t.poll_id,
      t.choice as leading_choice_id,
      t.vote_count,
      row_number() over (
        partition by t.poll_id
        order by t.vote_count desc, t.choice
      ) as rn
    from tallies t
  ),
  totals as (
    select poll_id, sum(vote_count)::bigint as total_votes
    from tallies
    group by poll_id
  )
  select
    p.id as poll_id,
    p.poll_type,
    p.title,
    public.poll_lifecycle_status(p.archived_at, p.opens_at, p.closes_at) as status,
    p.opens_at,
    p.closes_at,
    p.match_id,
    m.stage,
    m.group_code,
    m.kickoff_at,
    coalesce(tot.total_votes, 0) as total_votes,
    r.leading_choice_id
  from public.polls p
  left join public.matches m on m.id = p.match_id
  left join totals tot on tot.poll_id = p.id
  left join ranked r on r.poll_id = p.id and r.rn = 1
  where p.event_id = p_event_id
    and p.archived_at is null
    and (p_poll_type is null or p.poll_type = p_poll_type)
  order by
    case p.poll_type when 'event_winner' then 0 else 1 end,
    m.kickoff_at nulls last,
    p.closes_at nulls last,
    p.id
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_active_polls(text, text, int, int) to anon, authenticated;

create or replace function public.get_archive_events(
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  event_id text,
  event_slug text,
  event_title text,
  archived_at timestamptz,
  highlight_poll_id text,
  highlight_poll_title text,
  winner_choice_id text,
  total_votes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with archived_polls as (
    select
      p.*,
      row_number() over (
        partition by p.event_id
        order by p.archived_at desc nulls last, p.closes_at desc nulls last
      ) as rn
    from public.polls p
    where p.archived_at is not null
      and p.event_id is not null
  ),
  event_archive as (
    select
      ap.event_id,
      max(ap.archived_at) as archived_at
    from archived_polls ap
    group by ap.event_id
  )
  select
    e.id as event_id,
    e.slug as event_slug,
    e.title as event_title,
    ea.archived_at,
    ap.id as highlight_poll_id,
    ap.title as highlight_poll_title,
    ap.winner_choice_id,
    coalesce(
      (select sum(s.vote_count)::bigint from public.get_poll_stats(ap.id) s),
      0
    ) as total_votes
  from event_archive ea
  join public.events e on e.id = ea.event_id
  join archived_polls ap on ap.event_id = ea.event_id and ap.rn = 1
  order by ea.archived_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_archive_events(int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS: new tables + updated vote insert rules
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.matches enable row level security;
alter table public.poll_choices enable row level security;

drop policy if exists events_select_anon on public.events;
create policy events_select_anon
  on public.events for select
  to anon, authenticated
  using (true);

drop policy if exists matches_select_anon on public.matches;
create policy matches_select_anon
  on public.matches for select
  to anon, authenticated
  using (true);

drop policy if exists poll_choices_select_anon on public.poll_choices;
create policy poll_choices_select_anon
  on public.poll_choices for select
  to anon, authenticated
  using (true);

grant select on public.events to anon, authenticated;
grant select on public.matches to anon, authenticated;
grant select on public.poll_choices to anon, authenticated;

-- Replace hardcoded ucl-final-2026 insert policy with lifecycle-aware rule
drop policy if exists votes_insert_anon on public.votes;
create policy votes_insert_anon
  on public.votes for insert
  to anon, authenticated
  with check (
    char_length(voter_token) >= 16
    and char_length(voter_token) <= 64
    and exists (
      select 1
      from public.polls po
      join public.poll_choices ch
        on ch.poll_id = po.id and ch.id = choice
      where po.id = poll_id
        and po.archived_at is null
        and po.opens_at <= now()
        and (po.closes_at is null or po.closes_at > now())
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Post-migration verification (must match pre-migration counts)
-- ---------------------------------------------------------------------------

do $$
declare
  n bigint;
  ucl bigint;
  orphans bigint;
begin
  select count(*) into n from public.votes;
  raise notice 'POST-MIGRATION votes total: %', n;

  select count(*) into ucl from public.votes where poll_id = 'ucl-final-2026';
  raise notice 'POST-MIGRATION ucl-final-2026 votes: %', ucl;

  select count(*) into orphans
  from public.votes v
  left join public.poll_choices c on c.poll_id = v.poll_id and c.id = v.choice
  where c.id is null;

  if orphans > 0 then
    raise exception 'Post-check failed: % orphan votes', orphans;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Run after COMMIT — compare with your pre-migration note
-- ---------------------------------------------------------------------------
select
  'votes_total' as metric,
  count(*)::text as value
from public.votes
union all
select
  'ucl_votes_by_choice',
  choice || ': ' || count(*)::text
from public.votes
where poll_id = 'ucl-final-2026'
group by choice
union all
select
  'get_poll_stats',
  choice || ' ' || vote_count::text || ' (' || pct::text || '%)'
from public.get_poll_stats('ucl-final-2026')
order by metric, value;
