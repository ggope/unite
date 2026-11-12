-- 0017: safety for public text, wins, and the organiser dashboard.
--  1. Shown reasons and official answers can be reported; moderators can hide a reason (the signer is told why)
--     or remove an answer. Reasons get a random key, so reporting one never reveals who wrote it.
--  2. Wins: every petition that won, for the public wins page.
--  3. Organiser dashboard: private numbers for the person who started a petition.

-- ---------- 1. reporting reasons and answers ----------
alter table public.signatures add column if not exists reason_key uuid not null default gen_random_uuid();
alter table public.signatures add column if not exists reason_hidden boolean not null default false;
create unique index if not exists signatures_reason_key_idx on public.signatures (reason_key);

alter table public.reports add column if not exists reason_key uuid;
alter table public.reports add column if not exists update_id uuid references public.petition_updates on delete set null;
-- A report keeps its place in the public counts after the answer it was about is deleted (it is resolved first).
alter table public.reports drop constraint if exists reports_target;
alter table public.reports add constraint reports_target
  check (video_id is not null or petition_id is not null or profile_id is not null or reason_key is not null or update_id is not null
         or status = 'resolved');
create or replace function public.resolve_update_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.reports set status = 'resolved', resolved_at = now() where update_id = old.id and status = 'open';
  return old;
end $$;
revoke execute on function public.resolve_update_reports() from public, anon, authenticated;
drop trigger if exists resolve_update_reports on public.petition_updates;
create trigger resolve_update_reports before delete on public.petition_updates for each row execute function public.resolve_update_reports();

alter table public.notices drop constraint if exists notices_kind_check;
alter table public.notices add constraint notices_kind_check check (kind in ('profile_cleared', 'reason_hidden'));

drop function if exists public.public_reasons(uuid, int);
create or replace function public.public_reasons(p_petition uuid, p_limit int default 12)
returns table (why text, created_at timestamptz, rid uuid)
language sql stable security definer set search_path = public as $$
  select s.why, s.created_at, s.reason_key from public.signatures s
  join public.petitions p on p.id = s.petition_id and p.status in ('live', 'closed')
  where s.petition_id = p_petition and s.show_reason and not s.reason_hidden and s.why is not null
    and s.why !~* '(https?:|www\.|\.[a-z]{2,}/)'
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
grant execute on function public.public_reasons(uuid, int) to anon, authenticated;

-- What a reported reason says, for moderators only. Never who wrote it.
create or replace function public.reported_reason(p_key uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when public.is_moderator() then (
    select json_build_object('why', s.why, 'hidden', s.reason_hidden, 'petition_id', p.id, 'title', p.title)
    from public.signatures s join public.petitions p on p.id = s.petition_id where s.reason_key = p_key) end;
$$;
revoke execute on function public.reported_reason(uuid) from public, anon;
grant execute on function public.reported_reason(uuid) to authenticated;

create or replace function public.hide_reason(p_key uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'reason_required'; end if;
  update public.signatures set reason_hidden = true where reason_key = p_key returning user_id into uid;
  if uid is not null then
    insert into public.notices (user_id, kind, body) values (uid, 'reason_hidden', left(trim(p_note), 500));
  end if;
  update public.reports set status = 'resolved', resolved_at = now() where reason_key = p_key and status = 'open';
end $$;
revoke execute on function public.hide_reason(uuid, text) from public, anon;
grant execute on function public.hide_reason(uuid, text) to authenticated;

-- ---------- 2. wins ----------
-- One row per petition that won: the first "win" update, newest wins first.
create or replace function public.recent_wins(p_limit int default 60)
returns table (petition_id uuid, title text, target text, topic text, lang text, tr jsonb, signatures bigint,
               won_at timestamptz, headline text, body text)
language sql stable security definer set search_path = public as $$
  select * from (
    select distinct on (p.id) p.id, p.title, p.target, p.topic, p.lang, p.tr, st.combined::bigint, u.created_at, u.title, u.body
    from public.petition_updates u
    join public.petitions p on p.id = u.petition_id and p.status in ('live', 'closed')
    join public.petition_stats st on st.id = p.id
    where u.kind = 'win'
    order by p.id, u.created_at) w
  order by 8 desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
grant execute on function public.recent_wins(int) to anon, authenticated;

-- ---------- 3. organiser dashboard ----------
-- Totals only. "Through shares" counts signatures that came in through anyone's share link.
create or replace function public.organiser_stats(p_petition uuid) returns json
language sql stable security definer set search_path = public as $$
  with p as (select * from public.petitions where id = p_petition and (created_by = auth.uid() or public.is_moderator())),
  s as (select s.* from public.signatures s join p on p.id = s.petition_id),
  d as (select date_trunc('day', created_at)::date as day, count(*) n from s where created_at > now() - interval '30 days' group by 1)
  select case when not exists (select 1 from p) then null else json_build_object(
    'signatures', (select count(*) from s),
    'today', (select count(*) from s where created_at >= date_trunc('day', now())),
    'week', (select count(*) from s where created_at > now() - interval '7 days'),
    'via_share', (select count(*) from s where ref_by is not null),
    'reasons', (select count(*) from s where why is not null),
    'followers', (select count(*) from public.follows f join p on p.id = f.petition_id),
    'videos', (select count(*) from public.videos v join p on p.id = v.petition_id where v.status = 'approved'),
    'delivered_at', (select min(u.created_at) from public.petition_updates u join p on p.id = u.petition_id where u.kind = 'delivered'),
    'answered_at', (select min(u.created_at) from public.petition_updates u join p on p.id = u.petition_id where u.kind = 'response'),
    'won_at', (select min(u.created_at) from public.petition_updates u join p on p.id = u.petition_id where u.kind = 'win'),
    'answer_link', exists (select 1 from public.answer_links a join p on p.id = a.petition_id),
    'days', coalesce((select json_agg(json_build_object('d', day, 'n', n) order by day) from d), '[]')
  ) end;
$$;
revoke execute on function public.organiser_stats(uuid) from public, anon;
grant execute on function public.organiser_stats(uuid) to authenticated;
