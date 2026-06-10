-- Optional: "favorite team" poll for home quick ballot (run once in Supabase SQL Editor)
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
