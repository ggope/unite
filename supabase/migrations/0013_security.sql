-- 0013: security review fixes (November 2026).

-- 1. Signatures: people may change only their reason. Before, they could also change the date
--    (to get round the 10-a-day limit), the country (to fake report totals) or even the petition.
revoke update on public.signatures from anon, authenticated;
grant update (why, show_reason) on public.signatures to authenticated;

-- 2. Profiles: only the public profile fields can be edited.
revoke update on public.profiles from anon, authenticated;
grant update (handle, display_name, bio, interests) on public.profiles to authenticated;

-- 3. Under-18 profiles were readable by anyone through the API (bio, topics), although the app
--    showed them to friends only. Now the database enforces it too.
create or replace function public.profile_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p = auth.uid()
      or public.is_moderator()
      or not coalesce((select is_minor from user_settings where user_id = p), false)
      or exists (select 1 from friendships where user_id = auth.uid() and friend_id = p)
$$;
grant execute on function public.profile_visible(uuid) to anon, authenticated;
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (public.profile_visible(id));

-- 4. Friends-only videos were readable by anyone through the API and storage. Now only friends,
--    the uploader and moderators can see them.
drop policy if exists "approved videos are public" on public.videos;
create policy "approved videos are public" on public.videos for select using (
  (status = 'approved' and (audience = 'everyone'
     or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = videos.uploader_id)))
  or uploader_id = auth.uid() or public.is_moderator());
drop policy if exists "read approved or own videos" on storage.objects;
create policy "read approved or own videos" on storage.objects for select
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_moderator()
    or exists (select 1 from public.videos v where v.status = 'approved' and (v.storage_path = name or v.cover_path = name)
               and (v.audience = 'everyone' or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = v.uploader_id)))));

-- 5. A new petition cannot pin itself as a big goal; a new report starts open.
drop policy if exists "start a petition" on public.petitions;
create policy "start a petition" on public.petitions for insert with check (
  created_by = auth.uid() and status = 'pending' and origin = 'unite' and imported_count = 0 and cluster_id is null
  and moderation_note is null and not featured);
drop policy if exists "report anything" on public.reports;
create policy "report anything" on public.reports for insert with check (reporter_id = auth.uid() and status = 'open' and resolved_at is null);

-- 6. Internal helpers revealed private facts to anyone: whether two people are friends, who blocked whom,
--    and whether someone has ever agreed to sign petitions. Only other database functions use them now.
revoke execute on function public.are_friends(uuid, uuid), public.is_blocked(uuid, uuid), public.has_signature_consent(uuid) from public, anon, authenticated;

-- Functions meant for signed-in people: earlier files removed them from anon, but everyone ("public")
-- could still run them. They check who is calling anyway; this closes the door twice.
do $$ declare f text; begin
  foreach f in array array['request_friend(uuid)','accept_friend(uuid)','block_user(uuid)','send_message(uuid, text)','mark_read(uuid)',
    'report_message(bigint, text)','clear_profile(uuid)','search_people(text)','my_invite_code(boolean)','accept_invite(text)','remove_friend(uuid)',
    'admin_stats()','admin_find_people(text)','set_moderator(uuid, boolean)','sign_petition(uuid, text, boolean, text)',
    'give_signature_consent(text)','revoke_signature_consent()','record_signal(text, real)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 7. Spam limits (signatures: 10 a day, messages: 200 an hour and friend requests: 30 a day already exist).
--    Not applied to work done directly in the SQL editor (no signed-in user).
create or replace function public.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare col text := tg_argv[0]; win interval := tg_argv[1]::interval; most int := tg_argv[2]::int; n int;
begin
  if auth.uid() is null then return new; end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, col)
    into n using (to_jsonb(new) ->> col)::uuid, win;
  if n >= most then raise exception 'slow_down' using hint = format('At most %s per %s.', most, win); end if;
  return new;
end $$;
revoke execute on function public.rate_limit() from public, anon, authenticated;

drop trigger if exists limit_petitions on public.petitions;
create trigger limit_petitions before insert on public.petitions for each row execute function public.rate_limit('created_by', '1 day', '3');
drop trigger if exists limit_videos on public.videos;
create trigger limit_videos before insert on public.videos for each row execute function public.rate_limit('uploader_id', '1 day', '10');
drop trigger if exists limit_reports on public.reports;
create trigger limit_reports before insert on public.reports for each row execute function public.rate_limit('reporter_id', '1 hour', '20');
drop trigger if exists limit_updates on public.petition_updates;
create trigger limit_updates before insert on public.petition_updates for each row execute function public.rate_limit('petition_id', '1 day', '10');
