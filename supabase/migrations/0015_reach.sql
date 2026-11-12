-- 0015: reach and openness.
--  1. Share tracking: each person gets a share code; signatures remember whose link brought them.
--     People only ever see totals, and only from 3 signatures, so no friend can be singled out.
--  2. Transparency: public totals on moderation and the platform.
--  3. Accountability: what each target (minister, company) received and whether they answered.
--  4. More languages: German, Spanish and French.

-- ---------- 1. share tracking ----------
create table if not exists public.share_codes (
  user_id    uuid primary key references public.profiles on delete cascade,
  code       text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.share_codes enable row level security;
drop policy if exists "own share code" on public.share_codes;
create policy "own share code" on public.share_codes for select using (user_id = auth.uid());
revoke all on public.share_codes from anon, authenticated;
grant select on public.share_codes to authenticated;
grant all on public.share_codes to service_role;

create or replace function public.my_share_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then return null; end if;
  insert into public.share_codes (user_id) values (auth.uid()) on conflict do nothing;
  select code into c from public.share_codes where user_id = auth.uid();
  return c;
end $$;
revoke execute on function public.my_share_code() from public, anon;
grant execute on function public.my_share_code() to authenticated;

alter table public.signatures add column if not exists ref_by uuid references public.profiles on delete set null;
create index if not exists signatures_ref_idx on public.signatures (ref_by) where ref_by is not null;

-- Your impact: how many people signed through your links. Under 3 shows as "fewer than 3".
create or replace function public.my_impact() returns json
language sql stable security definer set search_path = public as $$
  with s as (select petition_id from public.signatures where ref_by = auth.uid()),
  per as (select s.petition_id, count(*) n from s group by 1 having count(*) >= 3)
  select json_build_object(
    'total', case when (select count(*) from s) >= 3 then (select count(*) from s) else null end,
    'any', exists (select 1 from s),
    'petitions', coalesce((select json_agg(json_build_object('id', p.id, 'title', p.title, 'lang', p.lang, 'tr', p.tr, 'n', per.n) order by per.n desc)
                           from per join public.petitions p on p.id = per.petition_id), '[]'));
$$;
revoke execute on function public.my_impact() from public, anon;
grant execute on function public.my_impact() to authenticated;

-- Signing now also takes the share code from the link that brought the person here.
drop function if exists public.sign_petition(uuid, text, boolean, text);
create or replace function public.sign_petition(p_petition uuid, p_why text default null, p_show_reason boolean default false, p_country text default null, p_ref text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today_count int; result bigint; referrer uuid;
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
  select user_id into referrer from public.share_codes where code = lower(trim(p_ref)) and user_id <> uid;

  insert into public.signatures (user_id, petition_id, why, show_reason, country, ref_by)
  values (uid, p_petition, nullif(trim(p_why), ''), coalesce(p_show_reason, false) and nullif(trim(p_why), '') is not null,
          case when upper(p_country) ~ '^[A-Z]{2}$' and upper(p_country) not in ('XX','T1') then upper(p_country) end, referrer)
  on conflict do nothing;
  insert into public.follows (user_id, petition_id) values (uid, p_petition) on conflict do nothing;

  select combined into result from public.petition_stats where id = p_petition;
  return result;
end $$;
revoke execute on function public.sign_petition(uuid, text, boolean, text, text) from public, anon;
grant execute on function public.sign_petition(uuid, text, boolean, text, text) to authenticated;

-- ---------- 2. transparency ----------
create or replace function public.transparency_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'petitions_live',     (select count(*) from public.petitions where status = 'live'),
    'petitions_closed',   (select count(*) from public.petitions where status = 'closed'),
    'petitions_removed',  (select count(*) from public.petitions where status = 'removed'),
    'petitions_pending',  (select count(*) from public.petitions where status = 'pending'),
    'videos_approved',    (select count(*) from public.videos where status = 'approved'),
    'videos_rejected',    (select count(*) from public.videos where status = 'rejected'),
    'videos_pending',     (select count(*) from public.videos where status = 'pending'),
    'signatures',         (select count(*) from public.signatures),
    'people',             (select count(*) from public.profiles),
    'moderators',         (select count(*) from public.profiles where is_moderator),
    'reports_30d',        (select count(*) from public.reports where created_at > now() - interval '30 days'),
    'reports_open',       (select count(*) from public.reports where status = 'open'),
    'reports_resolved_30d', (select count(*) from public.reports where resolved_at > now() - interval '30 days'),
    'median_hours_to_resolve', (select round((percentile_cont(0.5) within group (order by extract(epoch from resolved_at - created_at)) / 3600)::numeric, 1)
                                from public.reports where resolved_at > now() - interval '90 days'),
    'updates_posted',     (select count(*) from public.petition_updates),
    'wins',               (select count(distinct petition_id) from public.petition_updates where kind = 'win'),
    'generated',          now());
$$;
grant execute on function public.transparency_stats() to anon, authenticated;

-- ---------- 3. accountability ----------
-- One row per target: their live or closed petitions, signatures, and how long they have been silent since delivery.
create or replace function public.accountability() returns table (
  target text, petitions int, signatures bigint, delivered int, answered int, wins int,
  silent_days int, ids uuid[])
language sql stable security definer set search_path = public as $$
  with p as (
    select p.id, p.target, lower(regexp_replace(trim(p.target), '\s+', ' ', 'g')) as k, st.combined,
      (select min(created_at) from public.petition_updates u where u.petition_id = p.id and u.kind = 'delivered') as delivered_at,
      (select min(created_at) from public.petition_updates u where u.petition_id = p.id and u.kind = 'response') as answered_at,
      exists (select 1 from public.petition_updates u where u.petition_id = p.id and u.kind = 'win') as won
    from public.petitions p join public.petition_stats st on st.id = p.id
    where p.status in ('live', 'closed'))
  select (array_agg(target order by combined desc))[1], count(*)::int, sum(combined)::bigint,
    count(delivered_at)::int, count(answered_at)::int, count(*) filter (where won)::int,
    max(case when delivered_at is not null and answered_at is null and not won then extract(day from now() - delivered_at)::int end),
    array_agg(id order by combined desc)
  from p group by k
  order by 7 desc nulls last, 3 desc
  limit 200;
$$;
grant execute on function public.accountability() to anon, authenticated;

-- ---------- 4. more languages ----------
alter table public.petitions drop constraint if exists petitions_lang_check;
alter table public.petitions add constraint petitions_lang_check check (lang in ('en','hu','de','es','fr'));
alter table public.push_subscriptions drop constraint if exists push_subscriptions_lang_check;
alter table public.push_subscriptions add constraint push_subscriptions_lang_check check (lang in ('en','hu','de','es','fr'));
create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from public.push_subscriptions where user_id = auth.uid()) >= 10 then
    delete from public.push_subscriptions where endpoint = (select endpoint from public.push_subscriptions where user_id = auth.uid() order by created_at limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lang in ('hu','de','es','fr') then p_lang else 'en' end)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, created_at = now();
end $$;
