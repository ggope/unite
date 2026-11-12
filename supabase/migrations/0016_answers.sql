-- 0016: answers, local petitions and open numbers.
--  1. A private answer link. The organiser hands it to the target (a minister, a company), who can post an
--     official answer without an account. Answers show as "official answer" and fill the "Who listens" board.
--  2. Petitions popular in a country, from the approximate country people sign from.
--  3. Platform totals per country for the open data download. Countries under 10 signatures are left out.

-- ---------- 1. answer links ----------
alter table public.petition_updates add column if not exists via_link boolean not null default false;
-- people may still post updates, but only the answer function can mark one as an official answer
revoke insert, update on public.petition_updates from anon, authenticated;
grant insert (petition_id, kind, title, body, created_by) on public.petition_updates to authenticated;

create table if not exists public.answer_links (
  petition_id uuid primary key references public.petitions on delete cascade,
  token_hash  text not null unique,          -- only a hash is kept, so the link cannot be read back
  created_by  uuid references public.profiles on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.answer_links enable row level security;
revoke all on public.answer_links from anon, authenticated;
grant all on public.answer_links to service_role;

-- A new link replaces the old one, so a leaked link can be switched off by making another.
create or replace function public.make_answer_link(p_petition uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.petitions where id = p_petition and status in ('live', 'closed')
      and (created_by = auth.uid() or public.is_moderator())) then
    raise exception 'not_allowed';
  end if;
  tok := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');
  insert into public.answer_links (petition_id, token_hash, created_by)
  values (p_petition, encode(digest(tok, 'sha256'), 'hex'), auth.uid())
  on conflict (petition_id) do update set token_hash = excluded.token_hash, created_by = excluded.created_by, created_at = now();
  return tok;
end $$;
revoke execute on function public.make_answer_link(uuid) from public, anon;
grant execute on function public.make_answer_link(uuid) to authenticated;

create or replace function public.answer_info(p_token text) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object('id', p.id, 'title', p.title, 'target', p.target, 'ask', p.ask, 'lang', p.lang, 'tr', p.tr,
    'answers', (select count(*) from public.petition_updates u where u.petition_id = p.id and u.via_link))
  from public.answer_links a join public.petitions p on p.id = a.petition_id
  where a.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and p.status in ('live', 'closed');
$$;
revoke execute on function public.answer_info(text) from public;
grant execute on function public.answer_info(text) to anon, authenticated;

create or replace function public.post_answer(p_token text, p_name text, p_role text, p_body text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; nid uuid;
begin
  select a.petition_id into pid from public.answer_links a join public.petitions p on p.id = a.petition_id
  where a.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and p.status in ('live', 'closed');
  if pid is null then raise exception 'bad_link'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 or char_length(trim(coalesce(p_role, ''))) not between 2 and 80 then
    raise exception 'bad_name';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 20 and 2000 then raise exception 'bad_body'; end if;
  if (select count(*) from public.petition_updates where petition_id = pid and via_link and created_at > now() - interval '1 day') >= 3 then
    raise exception 'slow_down';
  end if;
  insert into public.petition_updates (petition_id, kind, title, body, via_link)
  values (pid, 'response', left(trim(p_name) || ', ' || trim(p_role), 140), trim(p_body), true)
  returning id into nid;
  return nid;
end $$;
revoke execute on function public.post_answer(text, text, text, text) from public;
grant execute on function public.post_answer(text, text, text, text) to anon, authenticated;

-- ---------- 2. popular in a country ----------
-- Live petitions most signed from one country, plus petitions whose region names it.
-- Counts under 10 are not returned, only the order.
create or replace function public.popular_in(p_country text, p_names text[] default '{}', p_limit int default 60)
returns table (petition_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  with c as (
    select s.petition_id, count(*) n from public.signatures s
    where s.country = upper(p_country) group by 1),
  r as (
    select p.id from public.petitions p
    where p.status = 'live' and exists (select 1 from unnest(p_names) x where length(x) >= 3 and p.region ilike '%' || x || '%'))
  select p.id, case when coalesce(c.n, 0) >= 10 then c.n end
  from public.petitions p left join c on c.petition_id = p.id
  where p.status = 'live' and (coalesce(c.n, 0) >= 3 or p.id in (select id from r))
  order by coalesce(c.n, 0) desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
grant execute on function public.popular_in(text, text[], int) to anon, authenticated;

-- ---------- 3. open numbers ----------
create or replace function public.country_totals() returns table (country text, signatures bigint, petitions bigint)
language sql stable security definer set search_path = public as $$
  select s.country, count(*), count(distinct s.petition_id)
  from public.signatures s join public.petitions p on p.id = s.petition_id and p.status in ('live', 'closed')
  where s.country is not null group by 1 having count(*) >= 10 order by 2 desc;
$$;
grant execute on function public.country_totals() to anon, authenticated;

-- ---------- 4. reasons people chose to show ----------
-- "Show my reason on the petition": shown without names. Reasons with links are left out.
create or replace function public.public_reasons(p_petition uuid, p_limit int default 12)
returns table (why text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.why, s.created_at from public.signatures s
  join public.petitions p on p.id = s.petition_id and p.status in ('live', 'closed')
  where s.petition_id = p_petition and s.show_reason and s.why is not null and s.why !~* '(https?:|www\.|\.[a-z]{2,}/)'
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
grant execute on function public.public_reasons(uuid, int) to anon, authenticated;
