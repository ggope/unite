\set ON_ERROR_STOP on
-- 0013: the security review's fixes stay fixed
reset role;
delete from public.friendships; delete from public.blocks;
insert into public.friendships (user_id, friend_id) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
update public.profiles set is_moderator = false where id in ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
-- user 2 is under 18 and has a friends-only video
update public.user_settings set is_minor = true where user_id = '22222222-2222-2222-2222-222222222222';
update public.profiles set bio = 'secret teen bio' where id = '22222222-2222-2222-2222-222222222222';
delete from public.videos where caption = 'friends only clip';
insert into public.videos (petition_id, uploader_id, storage_path, caption, trim_end, audience, status)
values ((select id from public.petitions where status = 'live' limit 1), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/f.mp4', 'friends only clip', 5, 'friends', 'approved');
-- user 3 has a signature
delete from public.signatures where user_id = '33333333-3333-3333-3333-333333333333';
insert into public.signatures (user_id, petition_id, country) values ('33333333-3333-3333-3333-333333333333', (select id from public.petitions where status = 'live' limit 1), 'HU');

set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
-- 1. a signature's date, country and petition cannot be changed; the reason can
do $$ begin update public.signatures set created_at = now() - interval '2 days'; raise exception 'date changed';
exception when insufficient_privilege then null; end $$;
do $$ begin update public.signatures set country = 'US'; raise exception 'country changed';
exception when insufficient_privilege then null; end $$;
update public.signatures set why = 'I care' where user_id = '33333333-3333-3333-3333-333333333333';
-- 2. only public profile fields can be edited
do $$ begin update public.profiles set created_at = now() where id = auth.uid(); raise exception 'created_at changed';
exception when insufficient_privilege then null; end $$;
-- 3. a stranger cannot read an under-18 profile or their friends-only video
do $$ begin
  if exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222') then raise exception 'minor profile visible to a stranger'; end if;
  if exists (select 1 from public.videos where caption = 'friends only clip') then raise exception 'friends-only video visible to a stranger'; end if;
  if not exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111') then raise exception 'adult profile hidden'; end if;
end $$;
-- 4. internal helpers are closed
do $$ begin perform public.are_friends('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'); raise exception 'are_friends open';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.has_signature_consent('11111111-1111-1111-1111-111111111111'); raise exception 'has_signature_consent open';
exception when insufficient_privilege then null; end $$;
-- 5. a new petition cannot pin itself; at most 3 new petitions a day
do $$ begin
  insert into public.petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal, featured)
  values (auth.uid(), 'Cili', 'Pin me please as a goal', 'Everyone', 'Here', 'Please pin this petition as a big goal.', 'Because I said so, which is not a reason.', 'climate', 1000, true);
  raise exception 'self-pinned petition accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  for i in 1..3 loop
    insert into public.petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal)
    values (auth.uid(), 'Cili', 'Spam petition number ' || i, 'Everyone', 'Here', 'This is a spam petition to test limits.', 'Testing the daily limit for new petitions here.', 'climate', 1000);
  end loop;
  begin
    insert into public.petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal)
    values (auth.uid(), 'Cili', 'Spam petition number 4', 'Everyone', 'Here', 'This is a spam petition to test limits.', 'Testing the daily limit for new petitions here.', 'climate', 1000);
    raise exception 'fourth petition accepted';
  exception when others then if sqlerrm <> 'slow_down' then raise; end if; end;
end $$;

-- the friend (user 1) and the uploader see the minor's profile and video
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin
  if not exists (select 1 from public.videos where caption = 'friends only clip') then raise exception 'friend cannot see friends-only video'; end if;
  if not exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222') then raise exception 'friend cannot see minor profile'; end if;
end $$;
set role anon;
select set_config('request.jwt.claim.sub','', false);
do $$ begin
  if exists (select 1 from public.videos where caption = 'friends only clip') then raise exception 'anon sees friends-only video'; end if;
end $$;
reset role;
delete from public.petitions where title like 'Spam petition number %';
update public.user_settings set is_minor = false where user_id = '22222222-2222-2222-2222-222222222222';
select 'security tests passed' as result;
