-- UNIER 0002: moderators can post "what happened next", authors can remove their updates,
-- and friends join through a personal invite link. Run once in the Supabase SQL Editor.

-- ---------- updates ----------
create policy "moderators post updates" on public.petition_updates for insert
  with check (created_by = auth.uid() and public.is_moderator());
create policy "authors remove updates" on public.petition_updates for delete
  using (created_by = auth.uid() or public.is_moderator());

-- ---------- invites ----------
-- Codes live in their own private table: profiles are public, invite codes are not.
create table public.invites (
  user_id    uuid primary key references public.profiles on delete cascade,
  code       text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
create policy "own invite" on public.invites for select using (user_id = auth.uid());

-- Your code (made on first use). A new code makes old links stop working.
create function public.my_invite_code(p_new boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_new then delete from public.invites where user_id = auth.uid(); end if;
  insert into public.invites (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select code into c from public.invites where user_id = auth.uid();
  return c;
end $$;

-- Who sent this link (name only), for the invite page.
create function public.invite_owner(p_code text) returns table (handle text, display_name text)
language sql stable security definer set search_path = public as $$
  select pr.handle, pr.display_name from public.invites i join public.profiles pr on pr.id = i.user_id where i.code = p_code;
$$;

-- Opening someone's link and tapping Add makes you friends both ways: sharing the link was their yes.
create function public.accept_invite(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select user_id into owner from public.invites where code = p_code;
  if owner is null then raise exception 'invite_not_found'; end if;
  if owner = auth.uid() then raise exception 'own_invite'; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), owner), (owner, auth.uid()) on conflict do nothing;
end $$;

create function public.remove_friend(p_friend uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
$$;

revoke execute on function public.my_invite_code(boolean), public.accept_invite(text), public.remove_friend(uuid) from anon;
