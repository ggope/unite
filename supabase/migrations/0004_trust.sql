-- UNIER 0004: reasons when something is not approved, report handling, unread updates, uniting petitions.
-- Run once in the Supabase SQL Editor.

-- Founders see why a petition was not approved (EU Digital Services Act: statement of reasons).
alter table public.petitions add column moderation_note text check (char_length(moderation_note) <= 500);
drop policy "start a petition" on public.petitions;
create policy "start a petition" on public.petitions for insert with check (
  created_by = auth.uid() and status = 'pending' and origin = 'unite' and imported_count = 0 and cluster_id is null and moderation_note is null);

-- Reports get a status so the queue only shows what is still open.
alter table public.reports add column status text not null default 'open' check (status in ('open','resolved'));
alter table public.reports add column resolved_at timestamptz;
create policy "moderators resolve reports" on public.reports for update using (public.is_moderator());

-- Unread "what happened next".
alter table public.user_settings add column updates_seen_at timestamptz not null default now();
create function public.unread_updates() returns int
language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.petition_updates u
  where u.created_at > coalesce((select updates_seen_at from public.user_settings where user_id = auth.uid()), now() - interval '30 days')
    and u.created_by is distinct from auth.uid()
    and (exists (select 1 from public.signatures s where s.user_id = auth.uid() and s.petition_id = u.petition_id)
      or exists (select 1 from public.follows f where f.user_id = auth.uid() and f.petition_id = u.petition_id));
$$;

-- Moderators unite petitions that ask for the same thing (each keeps its own count).
create policy "moderators manage clusters" on public.clusters for all using (public.is_moderator()) with check (public.is_moderator());

-- ---------- admin ----------
create function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  return json_build_object(
    'people',            (select count(*) from public.profiles),
    'people_7d',         (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'signatures',        (select count(*) from public.signatures),
    'signatures_24h',    (select count(*) from public.signatures where created_at > now() - interval '24 hours'),
    'petitions_live',    (select count(*) from public.petitions where status = 'live'),
    'petitions_pending', (select count(*) from public.petitions where status = 'pending'),
    'videos_live',       (select count(*) from public.videos where status = 'approved'),
    'videos_pending',    (select count(*) from public.videos where status = 'pending'),
    'reports_open',      (select count(*) from public.reports where status = 'open'),
    'updates_7d',        (select count(*) from public.petition_updates where created_at > now() - interval '7 days'),
    'news_24h',          (select count(*) from public.news_items where created_at > now() - interval '24 hours')
  );
end $$;

-- Find people by email or handle (moderators only).
create function public.admin_find_people(p_query text)
returns table (id uuid, email text, handle text, display_name text, is_moderator boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  return query
    select p.id, u.email::text, p.handle, p.display_name, p.is_moderator, p.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where p_query = '' and p.is_moderator
       or (p_query <> '' and (u.email ilike '%' || p_query || '%' or p.handle ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%'))
    order by p.created_at desc limit 30;
end $$;

create function public.set_moderator(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  if not p_on and (select count(*) from public.profiles where is_moderator) <= 1 then raise exception 'last_moderator'; end if;
  update public.profiles set is_moderator = p_on where id = p_user;
end $$;

revoke execute on function public.admin_stats(), public.admin_find_people(text), public.set_moderator(uuid, boolean) from anon;
