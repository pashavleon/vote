-- Open R32 match voting + block winner/favorite votes for eliminated teams.
-- Run once after: resolve-r32-teams.sql + eliminated-teams.sql (from gen_knockout_stage.py)

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
      left join public.matches m on m.id = po.match_id
      where po.id = poll_id
        and po.archived_at is null
        and po.opens_at <= now()
        and (po.closes_at is null or po.closes_at > now())
        and (
          po.poll_type <> 'match_winner'
          or (m.id is not null and m.stage = 'r32')
        )
        and (
          po.poll_type not in ('event_winner', 'favorite')
          or coalesce((ch.meta->>'eliminated')::boolean, false) = false
        )
    )
  );
