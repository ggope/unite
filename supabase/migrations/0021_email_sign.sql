-- Signing with only an email (no account), and a log of errors on the live site.
-- Re-runnable. Needs 0017_safety_wins.sql first.

create extension if not exists pgcrypto;

-- ---------- 1. a private secret for hashing email addresses ----------
-- Email addresses of people who sign without an account are never stored, only a keyed hash,
-- so the same person counts once and can withdraw, but the list cannot be read back as emails.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.secrets (name text primary key, value bytea not null);
insert into private.secrets (name, value) values ('email_pepper', gen_random_bytes(32)) on conflict (name) do nothing;

create or replace function private.email_hash(p_email text) returns text
language sql stable security definer set search_path = public, extensions, private as $$
  select encode(hmac(convert_to(lower(trim(p_email)), 'utf8'), (select value from private.secrets where name = 'email_pepper'), 'sha256'), 'hex')
$$;
revoke execute on function private.email_hash(text) from public, anon, authenticated;

-- ---------- 2. email signatures ----------
create table if not exists public.email_signatures (
  id            bigserial primary key,
  petition_id   uuid not null references public.petitions on delete cascade,
  email_hash    text not null,
  token_hash    text not null unique,            -- sha256 of the secret in the email link
  lang          text not null default 'en',
  text_version  text not null,                   -- which consent text the person agreed to
  country       text check (country ~ '^[A-Z]{2}$'),
  ref_by        uuid references public.profiles on delete set null,
  ip_hash       text,                            -- only while waiting, for the hourly limit; cleared on confirm
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  unique (petition_id, email_hash)
);
create index if not exists email_signatures_petition_idx on public.email_signatures (petition_id) where confirmed_at is not null;
create index if not exists email_signatures_email_idx on public.email_signatures (email_hash, created_at);
create index if not exists email_signatures_ip_idx on public.email_signatures (ip_hash, created_at) where ip_hash is not null;
create index if not exists email_signatures_waiting_idx on public.email_signatures (created_at) where confirmed_at is null;
alter table public.email_signatures enable row level security;   -- no policies: only the functions below touch it
revoke all on public.email_signatures from anon, authenticated;
revoke all on sequence public.email_signatures_id_seq from anon, authenticated;

-- Public totals include confirmed email signatures.
-- With 0020_quality.sql (a counter per petition): confirming adds one, withdrawing takes one away.
-- Without it: the totals view adds them up. Same columns either way.
create or replace function public.count_email_signature() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.petition_counts') is null then return null; end if;
  if tg_op = 'UPDATE' and old.confirmed_at is null and new.confirmed_at is not null then
    insert into public.petition_counts (petition_id, n) values (new.petition_id, 1)
    on conflict (petition_id) do update set n = petition_counts.n + 1;
  elsif tg_op = 'DELETE' and old.confirmed_at is not null then
    update public.petition_counts set n = greatest(n - 1, 0) where petition_id = old.petition_id;
  end if;
  return null;
end $$;
revoke execute on function public.count_email_signature() from public, anon, authenticated;
drop trigger if exists count_email_signature on public.email_signatures;
create trigger count_email_signature after update of confirmed_at or delete on public.email_signatures
  for each row execute function public.count_email_signature();

do $$ begin
  if to_regclass('public.petition_counts') is not null then
    -- recount, so running this file again never counts anything twice
    lock table public.signatures, public.email_signatures in share row exclusive mode;
    update public.petition_counts c set n = (select count(*) from public.signatures s where s.petition_id = c.petition_id)
      + (select count(*) from public.email_signatures e where e.petition_id = c.petition_id and e.confirmed_at is not null);
    insert into public.petition_counts (petition_id, n)
    select petition_id, count(*) from public.email_signatures where confirmed_at is not null group by 1
    on conflict (petition_id) do nothing;
  else
    execute $v$
create or replace view public.petition_stats as
select p.id,
       p.cluster_id,
       p.imported_count + coalesce(s.n, 0) + coalesce(e.n, 0)     as signatures,
       coalesce(s.last_hour, 0) + coalesce(e.last_hour, 0)          as last_hour,
       sum(p.imported_count + coalesce(s.n, 0) + coalesce(e.n, 0)) over (partition by coalesce(p.cluster_id, p.id)) as combined,
       count(*) over (partition by coalesce(p.cluster_id, p.id))   as united_count
from public.petitions p
left join (
  select petition_id, count(*) as n,
         count(*) filter (where created_at > now() - interval '1 hour') as last_hour
  from public.signatures group by petition_id
) s on s.petition_id = p.id
left join (
  select petition_id, count(*) as n,
         count(*) filter (where confirmed_at > now() - interval '1 hour') as last_hour
  from public.email_signatures where confirmed_at is not null group by petition_id
) e on e.petition_id = p.id
where p.status in ('live','closed');
    $v$;
  end if;
end $$;

-- Step 1 (server only): someone typed their email. Limits: 10 petitions a day per email, 20 links an hour
-- per connection, one new link per petition every 2 minutes, and a site-wide daily cap that protects the mail account.
create or replace function public.email_sign_request(
  p_petition uuid, p_email text, p_token_hash text, p_lang text, p_text_version text,
  p_country text default null, p_ref text default null, p_ip text default null, p_daily_cap int default 400)
returns text
language plpgsql security definer set search_path = public, extensions, private as $$
declare h text; ih text; cur public.email_signatures; referrer uuid;
begin
  p_email := lower(trim(p_email));
  if p_email is null or p_email !~ '^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$' or length(p_email) > 254 then return 'bad_email'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then return 'bad_token'; end if;
  if not exists (select 1 from public.petitions where id = p_petition and status = 'live') then return 'petition_not_open'; end if;
  delete from public.email_signatures where confirmed_at is null and created_at < now() - interval '3 days';
  h := private.email_hash(p_email);
  ih := case when p_ip is not null then encode(digest(p_ip || (select value from private.secrets where name = 'email_pepper'), 'sha256'), 'hex') end;

  -- already signed with an account that uses this email
  if exists (select 1 from public.signatures s join auth.users u on u.id = s.user_id
             where s.petition_id = p_petition and lower(u.email) = lower(trim(p_email))) then return 'already'; end if;
  select * into cur from public.email_signatures where petition_id = p_petition and email_hash = h;
  if cur.confirmed_at is not null then return 'already'; end if;
  if cur.id is not null and cur.created_at > now() - interval '2 minutes' then return 'wait'; end if;

  if (select count(*) from public.email_signatures where email_hash = h and created_at > now() - interval '1 day') >= 10 then return 'daily_limit_reached'; end if;
  if ih is not null and (select count(*) from public.email_signatures where ip_hash = ih and created_at > now() - interval '1 hour') >= 20 then return 'busy'; end if;
  if (select count(*) from public.email_signatures where created_at > now() - interval '1 day') >= greatest(p_daily_cap, 1) then return 'busy'; end if;

  select user_id into referrer from public.share_codes where code = lower(trim(p_ref));
  insert into public.email_signatures (petition_id, email_hash, token_hash, lang, text_version, country, ref_by, ip_hash)
  values (p_petition, h, p_token_hash, left(coalesce(p_lang, 'en'), 5), left(p_text_version, 40),
          case when upper(p_country) ~ '^[A-Z]{2}$' and upper(p_country) not in ('XX','T1') then upper(p_country) end, referrer, ih)
  on conflict (petition_id, email_hash) do update
    set token_hash = excluded.token_hash, lang = excluded.lang, text_version = excluded.text_version,
        country = excluded.country, ref_by = excluded.ref_by, ip_hash = excluded.ip_hash, created_at = now();
  return 'sent';
end $$;
revoke execute on function public.email_sign_request(uuid, text, text, text, text, text, text, text, int) from public, anon, authenticated;
grant execute on function public.email_sign_request(uuid, text, text, text, text, text, text, text, int) to service_role;

-- What the link page shows before anything is pressed (link scanners only ever see this).
create or replace function public.email_sign_lookup(p_token_hash text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('petition_id', p.id, 'title', p.title, 'status', p.status,
                           'confirmed', e.confirmed_at is not null, 'expired', e.confirmed_at is null and e.created_at < now() - interval '3 days')
  from public.email_signatures e join public.petitions p on p.id = e.petition_id
  where e.token_hash = p_token_hash
$$;
revoke execute on function public.email_sign_lookup(text) from public, anon, authenticated;
grant execute on function public.email_sign_lookup(text) to service_role;

-- Step 2: the person pressed "Confirm" on the page the email link opened.
create or replace function public.email_sign_confirm(p_token_hash text) returns json
language plpgsql security definer set search_path = public as $$
declare e public.email_signatures; total bigint;
begin
  select * into e from public.email_signatures where token_hash = p_token_hash for update;
  if e.id is null then return json_build_object('status', 'unknown'); end if;
  if e.confirmed_at is null and e.created_at < now() - interval '3 days' then return json_build_object('status', 'expired', 'petition_id', e.petition_id); end if;
  if e.confirmed_at is null then
    if not exists (select 1 from public.petitions where id = e.petition_id and status = 'live') then
      return json_build_object('status', 'petition_not_open', 'petition_id', e.petition_id);
    end if;
    update public.email_signatures set confirmed_at = now(), ip_hash = null where id = e.id;
  end if;
  select combined into total from public.petition_stats where id = e.petition_id;
  return json_build_object('status', 'confirmed', 'petition_id', e.petition_id, 'combined', total);
end $$;
revoke execute on function public.email_sign_confirm(text) from public, anon, authenticated;
grant execute on function public.email_sign_confirm(text) to service_role;

-- The same link withdraws the signature later.
create or replace function public.email_sign_withdraw(p_token_hash text) returns uuid
language sql security definer set search_path = public as $$
  delete from public.email_signatures where token_hash = p_token_hash returning petition_id
$$;
revoke execute on function public.email_sign_withdraw(text) from public, anon, authenticated;
grant execute on function public.email_sign_withdraw(text) to service_role;

-- Someone who signed by email and later signs in with that email gets those signatures in their account.
create or replace function public.claim_email_signatures() returns int
language plpgsql security definer set search_path = public, extensions, private as $$
declare uid uuid := auth.uid(); em text; h text; moved int := 0; e record;
begin
  if uid is null then return 0; end if;
  select email into em from auth.users where id = uid and email_confirmed_at is not null;
  if em is null or not exists (select 1 from public.profiles where id = uid) then return 0; end if;
  h := private.email_hash(em);
  for e in select * from public.email_signatures where email_hash = h and confirmed_at is not null loop
    if not public.has_signature_consent(uid) then
      insert into public.consents (user_id, kind, text_version) values (uid, 'signatures', e.text_version);
    end if;
    insert into public.signatures (user_id, petition_id, country, ref_by, created_at)
    values (uid, e.petition_id, e.country, case when e.ref_by <> uid then e.ref_by end, e.confirmed_at) on conflict do nothing;
    insert into public.follows (user_id, petition_id) values (uid, e.petition_id) on conflict do nothing;
    delete from public.email_signatures where id = e.id;
    moved := moved + 1;
  end loop;
  return moved;
end $$;
revoke execute on function public.claim_email_signatures() from public, anon;
grant execute on function public.claim_email_signatures() to authenticated;

-- A person with an account who signs a petition they already signed by email counts once.
create or replace function public.email_sign_dedupe() returns trigger
language plpgsql security definer set search_path = public, extensions, private as $$
declare em text;
begin
  select email into em from auth.users where id = new.user_id;
  if em is not null then delete from public.email_signatures where petition_id = new.petition_id and email_hash = private.email_hash(em); end if;
  return new;
end $$;
revoke execute on function public.email_sign_dedupe() from public, anon, authenticated;
drop trigger if exists email_sign_dedupe on public.signatures;
create trigger email_sign_dedupe after insert on public.signatures for each row execute function public.email_sign_dedupe();

-- Reaching the goal through an email signature also tells the followers.
create or replace function public.push_on_email_goal() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.petitions; n bigint;
begin
  select * into p from public.petitions where id = new.petition_id;
  select signatures into n from public.petition_stats where id = new.petition_id;
  if n = p.goal and to_regclass('public.push_events') is not null
     and not exists (select 1 from public.push_events where petition_id = p.id and kind = 'goal') then
    insert into public.push_events (petition_id, kind) values (p.id, 'goal');
  end if;
  return new;
end $$;
revoke execute on function public.push_on_email_goal() from public, anon, authenticated;
drop trigger if exists push_on_email_goal on public.email_signatures;
create trigger push_on_email_goal after update of confirmed_at on public.email_signatures
  for each row when (old.confirmed_at is null and new.confirmed_at is not null) execute function public.push_on_email_goal();

-- The delivery report and the organiser dashboard count email signatures too (totals only, as before).
create or replace function public.petition_report(p_petition uuid) returns json
language sql stable security definer set search_path = public as $$
  with p as (select * from public.petitions where id = p_petition and status in ('live', 'closed')),
  s as (select s.created_at, s.country, s.why from public.signatures s join p on p.id = s.petition_id
        union all
        select e.confirmed_at, e.country, null from public.email_signatures e join p on p.id = e.petition_id where e.confirmed_at is not null),
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

create or replace function public.organiser_stats(p_petition uuid) returns json
language sql stable security definer set search_path = public as $$
  with p as (select * from public.petitions where id = p_petition and (created_by = auth.uid() or public.is_moderator())),
  s as (select s.created_at, s.ref_by, s.why from public.signatures s join p on p.id = s.petition_id
        union all
        select e.confirmed_at, e.ref_by, null from public.email_signatures e join p on p.id = e.petition_id where e.confirmed_at is not null),
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

-- ---------- 3. errors on the live site ----------
-- One row per kind of error. The site emails the owner the first time it sees one, and again
-- at most every 6 hours while it keeps happening. Moderators see the list in Admin → Errors.
create table if not exists public.error_events (
  fingerprint   text primary key check (char_length(fingerprint) <= 64),
  source        text not null check (source in ('server', 'browser', 'email', 'job', 'health')),
  message       text not null check (char_length(message) <= 500),
  path          text check (char_length(path) <= 300),
  detail        text check (char_length(detail) <= 4000),
  count         int not null default 1,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  alerted_at    timestamptz,
  resolved_at   timestamptz
);
create index if not exists error_events_last_idx on public.error_events (last_seen desc);
alter table public.error_events enable row level security;
revoke all on public.error_events from anon, authenticated;
grant select on public.error_events to authenticated;
drop policy if exists "moderators read errors" on public.error_events;
create policy "moderators read errors" on public.error_events for select to authenticated using (public.is_moderator());

-- Records an error; returns true when the owner should get an email now.
create or replace function public.log_error(p_fingerprint text, p_source text, p_message text, p_path text default null, p_detail text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.error_events;
begin
  delete from public.error_events where last_seen < now() - interval '90 days';
  insert into public.error_events as x (fingerprint, source, message, path, detail)
  values (left(p_fingerprint, 64), p_source, left(coalesce(nullif(p_message, ''), 'Unknown error'), 500), left(p_path, 300), left(p_detail, 4000))
  on conflict (fingerprint) do update
    set count = x.count + 1, last_seen = now(), message = excluded.message, path = coalesce(excluded.path, x.path),
        detail = coalesce(excluded.detail, x.detail), resolved_at = null
  returning * into r;
  -- At most 30 alert emails a day in total, so a broken page cannot flood the inbox.
  if (r.alerted_at is null or r.alerted_at < now() - interval '6 hours')
     and (select count(*) from public.error_events where alerted_at > now() - interval '1 day') < 30 then
    update public.error_events set alerted_at = now() where fingerprint = r.fingerprint;
    return true;
  end if;
  return false;
end $$;
revoke execute on function public.log_error(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.log_error(text, text, text, text, text) to service_role;

create or replace function public.resolve_error(p_fingerprint text) returns void
language sql security definer set search_path = public as $$
  update public.error_events set resolved_at = now() where fingerprint = p_fingerprint and public.is_moderator()
$$;
revoke execute on function public.resolve_error(text) from public, anon;
grant execute on function public.resolve_error(text) to authenticated;

grant all on public.email_signatures, public.error_events to service_role;
grant usage, select on sequence public.email_signatures_id_seq to service_role;
