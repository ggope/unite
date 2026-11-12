-- 0014: telling people things.
--  1. Notices: private messages from UNIER to one person, e.g. why a moderator cleared their profile text.
--  2. Phone notifications: followers (signers follow automatically) hear about updates, milestones and wins.
--  3. Bot check: an optional "are you human" check before signing, switched on in Admin.

-- ---------- 1. notices ----------
create table if not exists public.notices (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  kind       text not null check (kind in ('profile_cleared')),
  body       text check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists notices_user_idx on public.notices (user_id, created_at desc);
alter table public.notices enable row level security;
drop policy if exists "own notices" on public.notices;
create policy "own notices" on public.notices for select using (user_id = auth.uid());
drop policy if exists "dismiss own notices" on public.notices;
create policy "dismiss own notices" on public.notices for delete using (user_id = auth.uid());
revoke all on public.notices from anon, authenticated;
grant select, delete on public.notices to authenticated;
grant all on public.notices to service_role;
grant usage, select on sequence public.notices_id_seq to service_role;

-- Clearing a profile now needs a reason, and the person is told it.
drop function if exists public.clear_profile(uuid);
create or replace function public.clear_profile(p_user uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'reason_required'; end if;
  update public.profiles set display_name = null, bio = null where id = p_user;
  insert into public.notices (user_id, kind, body) values (p_user, 'profile_cleared', left(trim(p_note), 500));
end $$;
revoke execute on function public.clear_profile(uuid, text) from public, anon;
grant execute on function public.clear_profile(uuid, text) to authenticated;

-- ---------- 2. phone notifications ----------
create table if not exists public.push_subscriptions (
  endpoint   text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id    uuid not null references public.profiles on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  lang       text not null default 'en' check (lang in ('en', 'hu')),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own devices" on public.push_subscriptions;
create policy "own devices" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "remove own devices" on public.push_subscriptions;
create policy "remove own devices" on public.push_subscriptions for delete using (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Saving a device. A phone that changes hands moves to the new account.
create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from public.push_subscriptions where user_id = auth.uid()) >= 10 then
    delete from public.push_subscriptions where endpoint = (select endpoint from public.push_subscriptions where user_id = auth.uid() order by created_at limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lang = 'hu' then 'hu' else 'en' end)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, created_at = now();
end $$;
revoke execute on function public.save_push(text, text, text, text) from public, anon;
grant execute on function public.save_push(text, text, text, text) to authenticated;

-- What happened. Filled by triggers, sent by the app (service role only), kept 30 days.
create table if not exists public.push_events (
  id          bigserial primary key,
  petition_id uuid not null references public.petitions on delete cascade,
  kind        text not null check (kind in ('milestone', 'response', 'delivered', 'win', 'goal')),
  title       text,
  actor       uuid,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists push_events_pending_idx on public.push_events (id) where sent_at is null;
alter table public.push_events enable row level security;
revoke all on public.push_events from anon, authenticated;
grant all on public.push_events to service_role;
grant usage, select on sequence public.push_events_id_seq to service_role;

create or replace function public.push_on_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_events (petition_id, kind, title, actor) values (new.petition_id, new.kind, new.title, new.created_by);
  return new;
end $$;
drop trigger if exists push_on_update on public.petition_updates;
create trigger push_on_update after insert on public.petition_updates for each row execute function public.push_on_update();

-- The goal is reached: fires once per petition, on the signature that reaches it.
create or replace function public.push_on_goal() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.petitions; n bigint;
begin
  select * into p from public.petitions where id = new.petition_id;
  select count(*) + p.imported_count into n from public.signatures where petition_id = new.petition_id;
  if n = p.goal and not exists (select 1 from public.push_events where petition_id = p.id and kind = 'goal') then
    insert into public.push_events (petition_id, kind, actor) values (p.id, 'goal', new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists push_on_goal on public.signatures;
create trigger push_on_goal after insert on public.signatures for each row execute function public.push_on_goal();

-- The sender claims a batch, so two senders never send the same event twice.
create or replace function public.claim_push_events(p_limit int default 10) returns setof public.push_events
language sql security definer set search_path = public as $$
  delete from public.push_events where created_at < now() - interval '30 days';
  update public.push_events set sent_at = now()
  where id in (select id from public.push_events where sent_at is null order by id limit greatest(1, least(p_limit, 50)) for update skip locked)
  returning *;
$$;
-- Every device of every follower, except whoever caused it.
create or replace function public.push_targets(p_event bigint)
returns table (endpoint text, p256dh text, auth text, lang text)
language sql stable security definer set search_path = public as $$
  select s.endpoint, s.p256dh, s.auth, s.lang
  from public.push_events e
  join public.follows f on f.petition_id = e.petition_id
  join public.push_subscriptions s on s.user_id = f.user_id
  where e.id = p_event and f.user_id is distinct from e.actor
    and not exists (select 1 from public.blocks b where b.user_id = f.user_id and b.blocked_id = e.actor);
$$;
revoke execute on function public.claim_push_events(int), public.push_targets(bigint), public.push_on_update(), public.push_on_goal() from public, anon, authenticated;
grant execute on function public.claim_push_events(int), public.push_targets(bigint) to service_role;

-- ---------- 3. bot check ----------
create table if not exists public.site_settings (
  id                  boolean primary key default true check (id),
  require_human_check boolean not null default false
);
insert into public.site_settings (id) values (true) on conflict do nothing;
alter table public.site_settings enable row level security;
drop policy if exists "anyone reads site settings" on public.site_settings;
create policy "anyone reads site settings" on public.site_settings for select using (true);
drop policy if exists "moderators change site settings" on public.site_settings;
create policy "moderators change site settings" on public.site_settings for update using (public.is_moderator()) with check (public.is_moderator());
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update (require_human_check) on public.site_settings to authenticated;
grant all on public.site_settings to service_role;

-- Who passed the check recently. Written only by the app after Cloudflare confirms it.
create table if not exists public.human_checks (
  user_id    uuid primary key references public.profiles on delete cascade,
  checked_at timestamptz not null default now()
);
alter table public.human_checks enable row level security;
revoke all on public.human_checks from anon, authenticated;
grant all on public.human_checks to service_role;

-- Signing: the same as before, plus the check when it is switched on (valid for 30 days).
create or replace function public.sign_petition(p_petition uuid, p_why text default null, p_show_reason boolean default false, p_country text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today_count int; result bigint;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then raise exception 'email_not_confirmed'; end if;
  if not public.has_signature_consent(uid) then raise exception 'consent_required'; end if;
  if not exists (select 1 from public.petitions where id = p_petition and status = 'live') then raise exception 'petition_not_open'; end if;
  if (select require_human_check from public.site_settings) and not exists (
    select 1 from public.human_checks where user_id = uid and checked_at > now() - interval '30 days') then
    raise exception 'human_check_required';
  end if;
  select count(*) into today_count from public.signatures where user_id = uid and created_at >= date_trunc('day', now());
  if today_count >= 10 then raise exception 'daily_limit_reached'; end if;

  insert into public.signatures (user_id, petition_id, why, show_reason, country)
  values (uid, p_petition, nullif(trim(p_why), ''), coalesce(p_show_reason, false) and nullif(trim(p_why), '') is not null,
          case when upper(p_country) ~ '^[A-Z]{2}$' and upper(p_country) not in ('XX','T1') then upper(p_country) end)
  on conflict do nothing;
  insert into public.follows (user_id, petition_id) values (uid, p_petition) on conflict do nothing;

  select combined into result from public.petition_stats where id = p_petition;
  return result;
end $$;
revoke execute on function public.sign_petition(uuid, text, boolean, text) from public, anon;
grant execute on function public.sign_petition(uuid, text, boolean, text) to authenticated;
