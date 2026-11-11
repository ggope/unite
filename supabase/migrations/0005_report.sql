-- 0005: make every tap count.
--   * a public delivery report per petition (totals only, never names)
--   * an approximate country per signature, from the connection, for the report
--   * an optional official channel ("go further") for people who want to do more

alter table public.signatures add column country text check (country ~ '^[A-Z]{2}$');
alter table public.petitions  add column official_url text check (official_url is null or official_url ~ '^https://');

-- Same rules as before; it now also keeps the approximate country.
drop function public.sign_petition(uuid, text, boolean);
create function public.sign_petition(p_petition uuid, p_why text default null, p_show_reason boolean default false, p_country text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today_count int; result bigint;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then raise exception 'email_not_confirmed'; end if;
  if not public.has_signature_consent(uid) then raise exception 'consent_required'; end if;
  if not exists (select 1 from public.petitions where id = p_petition and status = 'live') then raise exception 'petition_not_open'; end if;
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
revoke execute on function public.sign_petition(uuid, text, boolean, text) from anon;

-- The delivery report. Countries with fewer than 10 signers are grouped as "other" so nobody can be singled out.
create function public.petition_report(p_petition uuid) returns json
language sql stable security definer set search_path = public as $$
  with p as (select * from public.petitions where id = p_petition and status in ('live', 'closed')),
  s as (select s.* from public.signatures s join p on p.id = s.petition_id),
  c as (select country, count(*) n from s group by country),
  d as (select date_trunc('day', created_at)::date as day, count(*) n from s where created_at > now() - interval '30 days' group by 1)
  select case when not exists (select 1 from p) then null else json_build_object(
    'verified',  (select count(*) from s),
    'imported',  (select imported_count from p),
    'first_at',  (select min(created_at) from s),
    'last_at',   (select max(created_at) from s),
    'last_7d',   (select count(*) from s where created_at > now() - interval '7 days'),
    'reasons',   (select count(*) from s where why is not null),
    'countries', coalesce((select json_agg(json_build_object('c', country, 'n', n) order by n desc) from c where country is not null and n >= 10), '[]'),
    'other',     (select coalesce(sum(n), 0) from c where country is null or n < 10),
    'days',      coalesce((select json_agg(json_build_object('d', day, 'n', n) order by day) from d), '[]'),
    'generated', now()
  ) end;
$$;
