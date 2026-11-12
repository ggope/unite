-- 0018: the petition life cycle.
--  1. End dates: a petition closes by itself after its end date, and its organiser is reminded to deliver it.
--  2. Days without an answer: after delivery, followers hear when the target has stayed silent 30 and 90 days.
--  3. Appeals: anyone whose petition, video, reason or profile text a moderator took down can ask for a
--     second look, free, for 6 months (EU Digital Services Act, article 20). A person decides, and the
--     author is told the outcome and why.
-- Run once in the Supabase SQL Editor, after 0017. Safe to run again.

-- ---------- 1. end dates ----------
alter table public.petitions add column if not exists closed_at timestamptz;
alter table public.petitions add column if not exists delivery_nudges smallint not null default 0;
alter table public.petitions add column if not exists delivery_nudged_at timestamptz;
alter table public.petitions add column if not exists moderated_at timestamptz;
alter table public.petitions add column if not exists moderated_by uuid references public.profiles on delete set null;
alter table public.videos add column if not exists moderated_at timestamptz;
alter table public.videos add column if not exists moderated_by uuid references public.profiles on delete set null;

-- UNIER's calendar day. A petition can be signed until the end of its end date, Central European time.
create or replace function public.unier_today() returns date
language sql stable set search_path = public as $$ select (now() at time zone 'Europe/Budapest')::date $$;
grant execute on function public.unier_today() to anon, authenticated;

-- End dates are from tomorrow up to a year after the petition started. Also remembers when a petition
-- closed and who removed it, so an appeal can name the decision.
create or replace function public.petition_lifecycle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status = 'live' and old.status <> 'live' then
    new.closed_at := null; new.delivery_nudges := 0; new.delivery_nudged_at := null;
    if new.ends_on is not null and new.ends_on < public.unier_today() then new.ends_on := null; end if;   -- reopened after its end
  end if;
  if new.ends_on is not null and (tg_op = 'INSERT' or new.ends_on is distinct from old.ends_on) then
    if new.ends_on <= public.unier_today() then raise exception 'end_date_past'; end if;
    if new.ends_on > (coalesce(new.created_at, now()) at time zone 'Europe/Budapest')::date + 366 then raise exception 'end_date_far'; end if;
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then new.closed_at := coalesce(new.closed_at, now()); end if;
  if new.status = 'removed' and (tg_op = 'INSERT' or old.status <> 'removed') then
    new.moderated_at := now(); new.moderated_by := auth.uid();
  end if;
  return new;
end $$;
revoke execute on function public.petition_lifecycle() from public, anon, authenticated;
drop trigger if exists petition_lifecycle on public.petitions;
create trigger petition_lifecycle before insert or update on public.petitions for each row execute function public.petition_lifecycle();

create or replace function public.video_moderated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'rejected' and old.status <> 'rejected' then new.moderated_at := now(); new.moderated_by := auth.uid(); end if;
  return new;
end $$;
revoke execute on function public.video_moderated() from public, anon, authenticated;
drop trigger if exists video_moderated on public.videos;
create trigger video_moderated before update on public.videos for each row execute function public.video_moderated();

-- Nobody signs after the end date, even before the daily job has closed the petition.
create or replace function public.no_late_signatures() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.petitions where id = new.petition_id and ends_on < public.unier_today()) then
    raise exception 'petition_not_open';
  end if;
  return new;
end $$;
revoke execute on function public.no_late_signatures() from public, anon, authenticated;
drop trigger if exists no_late_signatures on public.signatures;
create trigger no_late_signatures before insert on public.signatures for each row execute function public.no_late_signatures();

-- The organiser can set, move or clear the end date while the petition is in review or live.
create or replace function public.set_end_date(p_petition uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.petitions where id = p_petition and status in ('pending', 'live')
      and (created_by = auth.uid() or public.is_moderator())) then
    raise exception 'not_allowed';
  end if;
  update public.petitions set ends_on = p_date where id = p_petition;
end $$;
revoke execute on function public.set_end_date(uuid, date) from public, anon;
grant execute on function public.set_end_date(uuid, date) to authenticated;

-- Notices can now point at a petition (and at a hidden reason, so it can be put back after an appeal).
alter table public.notices add column if not exists petition_id uuid references public.petitions on delete cascade;
alter table public.notices add column if not exists ref_key uuid;
alter table public.notices drop constraint if exists notices_kind_check;
alter table public.notices add constraint notices_kind_check
  check (kind in ('profile_cleared', 'reason_hidden', 'deliver_nudge', 'appeal_upheld', 'appeal_reversed'));

create or replace function public.hide_reason(p_key uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; pid uuid;
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'reason_required'; end if;
  update public.signatures set reason_hidden = true where reason_key = p_key returning user_id, petition_id into uid, pid;
  if uid is not null then
    insert into public.notices (user_id, kind, body, petition_id, ref_key) values (uid, 'reason_hidden', left(trim(p_note), 500), pid, p_key);
  end if;
  update public.reports set status = 'resolved', resolved_at = now() where reason_key = p_key and status = 'open';
end $$;
revoke execute on function public.hide_reason(uuid, text) from public, anon;
grant execute on function public.hide_reason(uuid, text) to authenticated;

-- Phone notifications learn two new things: signing closed, and the target has stayed silent.
alter table public.push_events drop constraint if exists push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check
  check (kind in ('milestone', 'response', 'delivered', 'win', 'goal', 'closed', 'silent'));

-- ---------- the daily job ----------
-- Closes ended petitions, reminds organisers to deliver (when it closes, and once more a week later),
-- and tells followers when a target has been silent 30 or 90 days. Called every night by the app.
create or replace function public.run_lifecycle() returns json
language plpgsql security definer set search_path = public as $$
declare n_closed int := 0; n_nudged int := 0; n_silent int := 0; r record;
begin
  for r in update public.petitions set status = 'closed'
           where status = 'live' and ends_on < public.unier_today() returning id loop
    insert into public.push_events (petition_id, kind) values (r.id, 'closed');
    n_closed := n_closed + 1;
  end loop;

  for r in select p.id, p.created_by, p.delivery_nudges from public.petitions p
           where p.status = 'closed' and p.created_by is not null
             and (p.delivery_nudges = 0 or (p.delivery_nudges = 1 and p.delivery_nudged_at < now() - interval '7 days'))
             and not exists (select 1 from public.petition_updates u where u.petition_id = p.id and u.kind in ('delivered', 'win')) loop
    delete from public.notices where user_id = r.created_by and petition_id = r.id and kind = 'deliver_nudge';
    insert into public.notices (user_id, kind, petition_id) values (r.created_by, 'deliver_nudge', r.id);
    update public.petitions set delivery_nudges = r.delivery_nudges + 1, delivery_nudged_at = now() where id = r.id;
    n_nudged := n_nudged + 1;
  end loop;

  -- a week's window, so a missed night does not skip the message; the title holds the number of days
  for r in select x.id, d.days from (
             select p.id, (select min(u.created_at) from public.petition_updates u where u.petition_id = p.id and u.kind = 'delivered') as delivered_at
             from public.petitions p where p.status in ('live', 'closed')
               and not exists (select 1 from public.petition_updates u where u.petition_id = p.id and u.kind in ('response', 'win'))) x
           cross join lateral (values (30), (90)) d(days)
           where x.delivered_at is not null
             and now() - x.delivered_at >= make_interval(days => d.days)
             and now() - x.delivered_at < make_interval(days => d.days + 7)
             and not exists (select 1 from public.push_events e where e.petition_id = x.id and e.kind = 'silent' and e.title = d.days::text) loop
    insert into public.push_events (petition_id, kind, title) values (r.id, 'silent', r.days::text);
    n_silent := n_silent + 1;
  end loop;

  -- decided appeals are kept 12 months, like reports
  delete from public.appeals where status <> 'open' and decided_at < now() - interval '12 months';
  return json_build_object('closed', n_closed, 'nudged', n_nudged, 'silent', n_silent);
end $$;

-- ---------- 3. appeals ----------
create table if not exists public.appeals (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles on delete cascade,
  kind          text not null check (kind in ('petition', 'video', 'reason', 'profile')),
  subject       text not null unique,            -- one appeal per decision
  petition_id   uuid references public.petitions on delete cascade,
  video_id      uuid references public.videos on delete cascade,
  reason_key    uuid,
  decision      text,                            -- the moderator's reason, as the author saw it
  decided_first uuid references public.profiles on delete set null,   -- who made that decision
  body          text not null check (char_length(body) between 10 and 2000),
  status        text not null default 'open' check (status in ('open', 'upheld', 'reversed')),
  reply         text check (char_length(reply) <= 1000),
  reviewer      uuid references public.profiles on delete set null,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index if not exists appeals_open_idx on public.appeals (created_at) where status = 'open';
create index if not exists appeals_user_idx on public.appeals (user_id, created_at desc);
alter table public.appeals enable row level security;
drop policy if exists "own appeals" on public.appeals;
create policy "own appeals" on public.appeals for select using (user_id = auth.uid() or public.is_moderator());
revoke all on public.appeals from anon, authenticated;
grant select on public.appeals to authenticated;
grant all on public.appeals to service_role;

-- p_kind: petition or video (p_ref is its id), reason or profile (p_ref is the notice the person received).
create or replace function public.file_appeal(p_kind text, p_ref text, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); subj text; pid uuid; vid uuid; rkey uuid; why text; first uuid; at timestamptz; nid bigint;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 10 and 2000 then raise exception 'bad_body'; end if;
  if (select count(*) from public.appeals where user_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'slow_down'; end if;
  if p_kind in ('petition', 'video') and coalesce(p_ref, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'not_found'; end if;
  if p_kind in ('reason', 'profile') and coalesce(p_ref, '') !~ '^[0-9]{1,18}$' then raise exception 'not_found'; end if;

  if p_kind = 'petition' then
    select id, moderation_note, moderated_by, moderated_at into pid, why, first, at from public.petitions
    where id = p_ref::uuid and created_by = uid and status = 'removed';
    if pid is null then raise exception 'not_found'; end if;
    subj := 'petition:' || pid || ':' || coalesce(extract(epoch from at)::bigint, 0);
  elsif p_kind = 'video' then
    select id, petition_id, moderation_note, moderated_by, moderated_at into vid, pid, why, first, at from public.videos
    where id = p_ref::uuid and uploader_id = uid and status = 'rejected';
    if vid is null then raise exception 'not_found'; end if;
    subj := 'video:' || vid || ':' || coalesce(extract(epoch from at)::bigint, 0);
  elsif p_kind in ('reason', 'profile') then
    select id, petition_id, ref_key, body, created_at into nid, pid, rkey, why, at from public.notices
    where id = p_ref::bigint and user_id = uid and kind = case p_kind when 'reason' then 'reason_hidden' else 'profile_cleared' end;
    if nid is null then raise exception 'not_found'; end if;
    subj := p_kind || ':' || nid;
  else
    raise exception 'not_found';
  end if;
  if at is not null and at < now() - interval '6 months' then raise exception 'too_late'; end if;
  if exists (select 1 from public.appeals where subject = subj) then raise exception 'already_appealed'; end if;

  insert into public.appeals (user_id, kind, subject, petition_id, video_id, reason_key, decision, decided_first, body)
  values (uid, p_kind, subj, pid, vid, rkey, why, first, trim(p_body))
  returning id into nid;
  return nid;
end $$;
revoke execute on function public.file_appeal(text, text, text) from public, anon;
grant execute on function public.file_appeal(text, text, text) to authenticated;

-- A moderator looks again. Reversing puts the content back; either way the author is told why.
create or replace function public.decide_appeal(p_id bigint, p_reverse boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appeals;
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'reason_required'; end if;
  select * into a from public.appeals where id = p_id and status = 'open' for update;
  if a.id is null then raise exception 'not_open'; end if;
  if p_reverse then
    if a.kind = 'petition' then update public.petitions set status = 'live', moderation_note = null where id = a.petition_id and status = 'removed';
    elsif a.kind = 'video' then update public.videos set status = 'approved', moderation_note = null where id = a.video_id and status = 'rejected';
    elsif a.kind = 'reason' and a.reason_key is not null then update public.signatures set reason_hidden = false where reason_key = a.reason_key;
    end if;   -- a cleared profile: the person can simply write their name and bio again
  end if;
  update public.appeals set status = case when p_reverse then 'reversed' else 'upheld' end, reply = left(trim(p_note), 1000),
    reviewer = auth.uid(), decided_at = now() where id = p_id;
  insert into public.notices (user_id, kind, body, petition_id)
  values (a.user_id, case when p_reverse then 'appeal_reversed' else 'appeal_upheld' end, left(trim(p_note), 500), a.petition_id);
end $$;
revoke execute on function public.decide_appeal(bigint, boolean, text) from public, anon;
grant execute on function public.decide_appeal(bigint, boolean, text) to authenticated;

-- Public numbers for the transparency page.
create or replace function public.appeal_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'filed_12m',    (select count(*) from public.appeals where created_at > now() - interval '12 months'),
    'reversed_12m', (select count(*) from public.appeals where status = 'reversed' and decided_at > now() - interval '12 months'),
    'upheld_12m',   (select count(*) from public.appeals where status = 'upheld' and decided_at > now() - interval '12 months'),
    'open',         (select count(*) from public.appeals where status = 'open'),
    'median_days',  (select round((percentile_cont(0.5) within group (order by extract(epoch from decided_at - created_at)) / 86400)::numeric, 1)
                     from public.appeals where decided_at > now() - interval '12 months'));
$$;
grant execute on function public.appeal_stats() to anon, authenticated;

-- The nightly job runs with the server key; moderators can also start it from Admin.
revoke execute on function public.run_lifecycle() from public, anon, authenticated;
grant execute on function public.run_lifecycle() to service_role;
create or replace function public.run_lifecycle_now() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  return public.run_lifecycle();
end $$;
revoke execute on function public.run_lifecycle_now() from public, anon;
grant execute on function public.run_lifecycle_now() to authenticated;
