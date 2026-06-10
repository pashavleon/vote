-- Favorite team poll for TOP FAN VOTE (run once in Supabase SQL Editor)
-- Prerequisite: migrate-v1-to-v2.sql + seed-wc-2026.sql (wc-2026-winner choices exist)

begin;

-- Extend poll_type enum (check constraints, not a PG enum type)
alter table public.polls drop constraint if exists polls_poll_type_check;
alter table public.polls
  add constraint polls_poll_type_check
  check (
    poll_type in ('event_winner', 'match_winner', 'custom', 'favorite')
  );

alter table public.polls drop constraint if exists polls_type_match_consistency;
alter table public.polls
  add constraint polls_type_match_consistency
  check (
    (poll_type = 'event_winner' and match_id is null)
    or (poll_type = 'match_winner' and match_id is not null)
    or poll_type = 'custom'
    or (poll_type = 'favorite' and match_id is null)
  );

insert into public.polls (
  id, event_id, match_id, poll_type, title, opens_at, closes_at, archived_at, winner_choice_id
) values (
  'wc-2026-favorite',
  'wc-2026',
  null,
  'favorite',
  'World Cup 2026 — your favorite team',
  timestamptz '2026-05-01 00:00:00+00',
  timestamptz '2026-07-19 23:59:59+00',
  null,
  null
)
on conflict (id) do update set
  event_id = excluded.event_id,
  poll_type = excluded.poll_type,
  title = excluded.title,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at;

insert into public.poll_choices (poll_id, id, label, meta, sort_order)
select 'wc-2026-favorite', id, label, meta, sort_order
from public.poll_choices
where poll_id = 'wc-2026-winner'
on conflict (poll_id, id) do update set
  label = excluded.label,
  meta = excluded.meta,
  sort_order = excluded.sort_order;

commit;

-- Verify:
-- select id, poll_type, title from public.polls where id = 'wc-2026-favorite';
-- select count(*) from public.poll_choices where poll_id = 'wc-2026-favorite';  -- expect 48
