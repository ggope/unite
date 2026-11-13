-- Email updates for people who sign with only an email (no account).
-- Re-runnable. Needs 0014_notify.sql, 0018_lifecycle.sql and 0021_email_sign.sql first.
--
-- Until now the email address of an email signer was never kept, only a keyed hash.
-- With this file a signer can tick "Email me when something happens". Only then is the address kept:
--   * encrypted (pgcrypto, with a key that never leaves the database's private schema),
--   * on the signature itself, so withdrawing, moving it into an account or the petition being deleted removes it too,
--   * only after the person pressed Confirm in the first email (double opt-in: the address is proven theirs),
--   * until they press "Stop these emails" (one click, in every email), or a year after the petition closed.

create extension if not exists pgcrypto;
create schema if not exists private;
insert into private.secrets (name, value) values ('mail_list_key', gen_random_bytes(32)) on conflict (name) do nothing;

alter table public.email_signatures add column if not exists notify_email bytea;        -- encrypted address, only with opt-in
alter table public.email_signatures add column if not exists notify_key text;           -- secret in the "stop these emails" link
alter table public.email_signatures add column if not exists notify_since timestamptz;  -- when the person opted in
alter table public.email_signatures add column if not exists mailed_event bigint;       -- the last event this person was handled for
alter table public.email_signatures add column if not exists mailed_at timestamptz;     -- the last update email they got
create unique index if not exists email_signatures_notify_key_idx on public.email_signatures (notify_key) where notify_key is not null;
create index if not exists email_signatures_notify_idx on public.email_signatures (petition_id) where notify_email is not null and confirmed_at is not null;
-- the hash of a removed address must not stay readable through any old grant
revoke all on public.email_signatures from anon, authenticated;

-- Which events still need emails (separate from phone notifications, which mark sent_at).
-- Nothing that happened before this file first ran is emailed.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'push_events' and column_name = 'mailed_at') then
    alter table public.push_events add column mailed_at timestamptz;
    update public.push_events set mailed_at = now();
  end if;
end $$;
create index if not exists push_events_unmailed_idx on public.push_events (id) where mailed_at is null;

-- How many update emails went out per day, for the daily limit of the mail account.
create table if not exists public.mail_sent (day date primary key, n int not null default 0);
alter table public.mail_sent enable row level security;
revoke all on public.mail_sent from anon, authenticated;
grant all on public.mail_sent to service_role;

create or replace function private.mail_key() returns text
language sql stable security definer set search_path = public, extensions, private as $$
  select encode(value, 'hex') from private.secrets where name = 'mail_list_key'
$$;
revoke execute on function private.mail_key() from public, anon, authenticated;

-- Step 1 (server only, right after email_sign_request): the person ticked the box.
-- Only for a waiting signature whose link matches and whose address hashes to the same value.
create or replace function public.email_sign_notify(p_token_hash text, p_email text, p_key text) returns boolean
language plpgsql security definer set search_path = public, extensions, private as $$
declare n int;
begin
  if p_key !~ '^[A-Za-z0-9_-]{32,64}$' then return false; end if;
  update public.email_signatures
     set notify_email = pgp_sym_encrypt(lower(trim(p_email)), private.mail_key()), notify_key = p_key, notify_since = now()
   where token_hash = p_token_hash and confirmed_at is null and email_hash = private.email_hash(p_email);
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke execute on function public.email_sign_notify(text, text, text) from public, anon, authenticated;
grant execute on function public.email_sign_notify(text, text, text) to service_role;

-- "Stop these emails": forgets the address at once. The signature itself stays.
create or replace function public.email_unsubscribe(p_key text) returns uuid
language sql security definer set search_path = public as $$
  update public.email_signatures set notify_email = null, notify_key = null, notify_since = null
   where notify_key = p_key and p_key is not null
  returning petition_id
$$;
revoke execute on function public.email_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.email_unsubscribe(text) to service_role;

-- What the "stop" page shows before anything is pressed.
create or replace function public.email_unsubscribe_lookup(p_key text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('petition_id', p.id, 'title', p.title)
  from public.email_signatures e join public.petitions p on p.id = e.petition_id
  where e.notify_key = p_key and p_key is not null
$$;
revoke execute on function public.email_unsubscribe_lookup(text) from public, anon, authenticated;
grant execute on function public.email_unsubscribe_lookup(text) to service_role;

-- The sender claims events that still need emails. Old addresses are cleaned up here too:
-- a year after a petition closed, or when it was taken down, nothing more is sent, so nothing is kept.
create or replace function public.claim_mail_events(p_limit int default 5) returns setof public.push_events
language plpgsql security definer set search_path = public as $$
begin
  update public.email_signatures e set notify_email = null, notify_key = null, notify_since = null
    from public.petitions p
   where p.id = e.petition_id and e.notify_email is not null
     and (p.status not in ('live', 'closed') or (p.status = 'closed' and p.closed_at < now() - interval '1 year'));
  update public.email_signatures set notify_email = null, notify_key = null, notify_since = null
   where notify_email is not null and confirmed_at is null and created_at < now() - interval '3 days';
  return query
  select * from public.push_events
   where mailed_at is null
   order by id limit greatest(1, least(p_limit, 20));
end $$;
revoke execute on function public.claim_mail_events(int) from public, anon, authenticated;
grant execute on function public.claim_mail_events(int) to service_role;

-- The next people to email about one event (decrypted only here, only for the server).
-- Each person is marked as handled, so two senders never send twice and a stopped run carries on later.
-- Small news (an organiser's note, "days without an answer") goes to the same person at most every 3 days;
-- big news (goal, delivered, answered, win, closed) always goes.
create or replace function public.mail_batch(p_event bigint, p_limit int default 50)
returns table (email text, lang text, notify_key text)
language plpgsql security definer set search_path = public, extensions, private as $$
declare ev public.push_events; small boolean;
begin
  select * into ev from public.push_events where id = p_event;
  if ev.id is null then return; end if;
  small := ev.kind in ('milestone', 'silent');
  if small then
    update public.email_signatures set mailed_event = ev.id
     where petition_id = ev.petition_id and confirmed_at is not null and notify_email is not null
       and coalesce(mailed_event, 0) < ev.id and mailed_at > now() - interval '3 days';
  end if;
  return query
  with next as (
    select e.id from public.email_signatures e
     where e.petition_id = ev.petition_id and e.confirmed_at is not null and e.notify_email is not null
       and coalesce(e.mailed_event, 0) < ev.id
     order by e.id limit greatest(1, least(p_limit, 200))
     for update skip locked
  ), done as (
    update public.email_signatures e set mailed_event = ev.id, mailed_at = now()
      from next where e.id = next.id
    returning e.notify_email, e.lang, e.notify_key
  )
  select pgp_sym_decrypt(done.notify_email, private.mail_key()), done.lang, done.notify_key from done;
end $$;
revoke execute on function public.mail_batch(bigint, int) from public, anon, authenticated;
grant execute on function public.mail_batch(bigint, int) to service_role;

create or replace function public.finish_mail_event(p_event bigint) returns void
language sql security definer set search_path = public as $$
  update public.push_events set mailed_at = now() where id = p_event and mailed_at is null
$$;
revoke execute on function public.finish_mail_event(bigint) from public, anon, authenticated;
grant execute on function public.finish_mail_event(bigint) to service_role;

-- Counts sent emails; returns how many more may go out today.
create or replace function public.mail_quota(p_cap int, p_used int default 0) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.mail_sent (day, n) values (current_date, greatest(p_used, 0))
  on conflict (day) do update set n = mail_sent.n + greatest(p_used, 0)
  returning mail_sent.n into n;
  delete from public.mail_sent where day < current_date - 60;
  return greatest(p_cap - n, 0);
end $$;
revoke execute on function public.mail_quota(int, int) from public, anon, authenticated;
grant execute on function public.mail_quota(int, int) to service_role;
