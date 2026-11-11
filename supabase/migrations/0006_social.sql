-- 0006: people. Profiles you can visit, friend requests, blocking, and messages between friends.
-- Principles: signatures stay private unless the person chooses otherwise; 16-17 year olds are only
-- fully visible to friends; you can only message friends; anyone can block anyone, instantly.

-- ---------- profile ----------
alter table public.profiles
  add column bio       text check (char_length(bio) <= 160),
  add column interests text[] not null default '{}'
    check (interests <@ array['climate','housing','labour','digital','health','press','oceans']::text[]);

alter table public.user_settings
  add column signatures_public boolean not null default false,          -- show what I signed to everyone
  add column allow_messages    text not null default 'friends' check (allow_messages in ('friends','nobody'));

-- ---------- requests, blocks, messages ----------
create table public.friend_requests (
  from_id    uuid not null references public.profiles on delete cascade,
  to_id      uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to_idx on public.friend_requests (to_id);

create table public.blocks (
  user_id    uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);

create table public.messages (
  id           bigserial primary key,
  sender_id    uuid not null references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index messages_pair_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), id desc);
create index messages_unread_idx on public.messages (recipient_id) where read_at is null;

alter table public.friend_requests enable row level security;
alter table public.blocks          enable row level security;
alter table public.messages        enable row level security;
create policy "see own requests"     on public.friend_requests for select using (auth.uid() in (from_id, to_id));
create policy "cancel or decline"    on public.friend_requests for delete using (auth.uid() in (from_id, to_id));
create policy "see own blocks"       on public.blocks for select using (user_id = auth.uid());
create policy "unblock"              on public.blocks for delete using (user_id = auth.uid());
create policy "see own messages"     on public.messages for select using (auth.uid() in (sender_id, recipient_id));
create policy "unsend own messages"  on public.messages for delete using (sender_id = auth.uid());
-- every write besides these goes through the functions below

-- Reports can now be about a person (their profile or a message they sent).
alter table public.reports drop constraint reports_check;
alter table public.reports add column profile_id uuid references public.profiles on delete cascade;
alter table public.reports add constraint reports_target check (video_id is not null or petition_id is not null or profile_id is not null);

-- ---------- helpers ----------
create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;
create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_id = a and friend_id = b);
$$;
create function public.make_friends(a uuid, b uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.friendships (user_id, friend_id) values (a, b), (b, a) on conflict do nothing;
  delete from public.friend_requests where (from_id = a and to_id = b) or (from_id = b and to_id = a);
$$;
revoke execute on function public.make_friends(uuid, uuid) from public, anon, authenticated;

-- ---------- friends ----------
-- Ask someone to be friends. If they already asked you, you become friends right away.
create function public.request_friend(p_to uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_to = me or not exists (select 1 from public.profiles where id = p_to) then raise exception 'not_found'; end if;
  if public.is_blocked(me, p_to) then raise exception 'blocked'; end if;
  if public.are_friends(me, p_to) then return 'friends'; end if;
  if exists (select 1 from public.friend_requests where from_id = p_to and to_id = me) then
    perform public.make_friends(me, p_to); return 'friends';
  end if;
  if (select count(*) from public.friend_requests where from_id = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_requests';
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, p_to) on conflict do nothing;
  return 'requested';
end $$;

create function public.accept_friend(p_from uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.friend_requests where from_id = p_from and to_id = auth.uid()) then raise exception 'no_request'; end if;
  perform public.make_friends(auth.uid(), p_from);
end $$;

-- Blocking ends the friendship, removes requests, and hides each from the other.
create function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or p_user = me then raise exception 'not_allowed'; end if;
  insert into public.blocks (user_id, blocked_id) values (me, p_user) on conflict do nothing;
  delete from public.friendships where (user_id = me and friend_id = p_user) or (user_id = p_user and friend_id = me);
  delete from public.friend_requests where (from_id = me and to_id = p_user) or (from_id = p_user and to_id = me);
end $$;

-- ---------- messages ----------
create function public.send_message(p_to uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b text := trim(p_body); new_id bigint;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if b is null or b = '' then raise exception 'empty'; end if;
  if public.is_blocked(me, p_to) or not public.are_friends(me, p_to) then raise exception 'not_friends'; end if;
  if exists (select 1 from public.user_settings where user_id = p_to and allow_messages = 'nobody') then raise exception 'messages_off'; end if;
  if (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 hour') >= 200 then raise exception 'slow_down'; end if;
  insert into public.messages (sender_id, recipient_id, body) values (me, p_to, left(b, 2000)) returning id into new_id;
  return new_id;
end $$;

create function public.mark_read(p_from uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now() where recipient_id = auth.uid() and sender_id = p_from and read_at is null;
$$;

create function public.unread_messages() returns int
language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.messages where recipient_id = auth.uid() and read_at is null;
$$;

-- One row per person you have talked with, newest first.
create function public.conversations() returns table
  (partner uuid, handle text, display_name text, last_body text, last_at timestamptz, last_mine boolean, unread int)
language sql stable security invoker set search_path = public as $$
  with mine as (
    select m.*, case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as partner
    from public.messages m where auth.uid() in (m.sender_id, m.recipient_id)
  ), last as (
    select distinct on (partner) partner, body, created_at, sender_id = auth.uid() as mine from mine order by partner, id desc
  )
  select l.partner, p.handle, p.display_name, l.body, l.created_at, l.mine,
         (select count(*)::int from mine x where x.partner = l.partner and x.recipient_id = auth.uid() and x.read_at is null)
  from last l join public.profiles p on p.id = l.partner
  order by l.created_at desc
  limit 100;
$$;

-- Reporting a message shares that one message with the moderators (they cannot read messages otherwise).
create function public.report_message(p_message bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  select * into m from public.messages where id = p_message and recipient_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  insert into public.reports (reporter_id, profile_id, reason)
  values (auth.uid(), m.sender_id, left(coalesce(nullif(trim(p_reason), ''), 'other') || ' · message: "' || m.body || '"', 500));
end $$;

-- Moderators can wipe a profile's text after a report (name, bio), without touching the account.
create function public.clear_profile(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  update public.profiles set display_name = null, bio = null where id = p_user;
end $$;

-- ---------- visiting a profile ----------
-- Everything a visitor may see, decided in one place. Blocked people see nothing.
create function public.profile_view(p_key text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid(); o public.profiles; s public.user_settings;
  is_me boolean; friends boolean; limited boolean; rel text; show_sigs boolean;
begin
  select * into o from public.profiles
  where (p_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and id = p_key::uuid) or handle = lower(p_key)
  limit 1;
  if not found then return null; end if;
  if me is not null and exists (select 1 from public.blocks where user_id = o.id and blocked_id = me) then return null; end if;
  select * into s from public.user_settings where user_id = o.id;
  is_me   := me = o.id;
  friends := coalesce(me is not null and public.are_friends(me, o.id), false);
  limited := coalesce(s.is_minor, false) and not friends and not coalesce(is_me, false);
  rel := case
    when is_me then 'me'
    when me is null then 'guest'
    when exists (select 1 from public.blocks where user_id = me and blocked_id = o.id) then 'blocked'
    when friends then 'friends'
    when exists (select 1 from public.friend_requests where from_id = me and to_id = o.id) then 'requested'
    when exists (select 1 from public.friend_requests where from_id = o.id and to_id = me) then 'incoming'
    else 'none' end;
  show_sigs := coalesce(is_me, false)
    or (not coalesce(s.is_minor, false) and coalesce(s.signatures_public, false))
    or (friends and coalesce(s.share_signatures_with_friends, false));

  return json_build_object(
    'id', o.id, 'handle', o.handle, 'display_name', o.display_name,
    'bio', case when limited then null else o.bio end,
    'interests', case when limited then '{}'::text[] else o.interests end,
    'joined', o.created_at, 'relation', rel, 'limited', limited,
    'can_message', friends and coalesce(s.allow_messages, 'friends') = 'friends',
    'friends_count', (select count(*) from public.friendships where user_id = o.id),
    'petitions', case when limited then '[]'::json else coalesce((
      select json_agg(json_build_object('id', p.id, 'title', p.title, 'combined', st.combined) order by p.created_at desc)
      from public.petitions p join public.petition_stats st on st.id = p.id
      where p.created_by = o.id and p.status in ('live', 'closed')), '[]'::json) end,
    'videos', case when limited then '[]'::json else coalesce((
      select json_agg(json_build_object('id', v.id, 'caption', v.caption, 'petition_id', v.petition_id, 'petition_title', p.title, 'created_at', v.created_at) order by v.created_at desc)
      from public.videos v join public.petitions p on p.id = v.petition_id and p.status = 'live'
      where v.uploader_id = o.id and v.status = 'approved' and (v.audience = 'everyone' or friends or is_me)), '[]'::json) end,
    'signed', case when not show_sigs then null else coalesce((
      select json_agg(json_build_object('id', p.id, 'title', p.title) order by sg.created_at desc)
      from (select * from public.signatures where user_id = o.id order by created_at desc limit 50) sg
      join public.petitions p on p.id = sg.petition_id and p.status in ('live', 'closed')), '[]'::json) end
  );
end $$;

-- Find people by handle or name. 16-17 year olds only show up for their friends.
create function public.search_people(p_query text) returns table (id uuid, handle text, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle, p.display_name from public.profiles p
  left join public.user_settings s on s.user_id = p.id
  where auth.uid() is not null and p.id <> auth.uid()
    and char_length(trim(p_query)) >= 2
    and (p.handle ilike trim(p_query) || '%' or p.display_name ilike '%' || trim(p_query) || '%')
    and not public.is_blocked(auth.uid(), p.id)
    and (not coalesce(s.is_minor, false) or public.are_friends(auth.uid(), p.id))
  order by (p.handle = lower(trim(p_query))) desc, p.handle
  limit 20;
$$;

revoke execute on function public.request_friend(uuid), public.accept_friend(uuid), public.block_user(uuid), public.send_message(uuid, text),
  public.mark_read(uuid), public.report_message(bigint, text), public.clear_profile(uuid), public.search_people(text) from anon;
