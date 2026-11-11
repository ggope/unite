\set ON_ERROR_STOP on
-- 0006: profiles, friend requests, blocks, messages
reset role;
delete from public.friendships;
update public.profiles set handle = 'anna', bio = 'Hi', interests = '{climate}' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set handle = 'bela' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set handle = 'cili' where id = '33333333-3333-3333-3333-333333333333';
set role authenticated;
-- B visits A: sees bio, not signatures (private by default)
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ declare v json := public.profile_view('anna'); begin
  if v->>'bio' <> 'Hi' or v->>'relation' <> 'none' then raise exception 'profile wrong: %', v; end if;
  if v->'signed' is not null and json_typeof(v->'signed') <> 'null' then raise exception 'signatures leaked: %', v; end if;
end $$;
-- messaging a stranger fails
do $$ begin perform public.send_message('11111111-1111-1111-1111-111111111111', 'hi'); raise exception 'should fail'; exception when others then if sqlerrm <> 'not_friends' then raise; end if; end $$;
-- B asks, A accepts -> friends both ways
select public.request_friend('11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if public.profile_view('bela')->>'relation' <> 'incoming' then raise exception 'expected incoming'; end if; end $$;
select public.accept_friend('22222222-2222-2222-2222-222222222222');
do $$ begin if public.profile_view('bela')->>'relation' <> 'friends' then raise exception 'expected friends'; end if; end $$;
-- A shares signatures with friends -> B sees them
reset role; update public.user_settings set share_signatures_with_friends = true where user_id = '11111111-1111-1111-1111-111111111111'; set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if json_typeof(public.profile_view('anna')->'signed') <> 'array' then raise exception 'friend should see shared signatures'; end if; end $$;
-- messages: B -> A, only the two of them can read it
select public.send_message('11111111-1111-1111-1111-111111111111', '  Hello Anna  ');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin if (select count(*) from public.messages) <> 0 then raise exception 'stranger reads messages'; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if public.unread_messages() <> 1 then raise exception 'expected 1 unread'; end if; end $$;
do $$ begin if (select last_body from public.conversations() limit 1) <> 'Hello Anna' then raise exception 'conversation wrong'; end if; end $$;
select public.mark_read('22222222-2222-2222-2222-222222222222');
do $$ begin if public.unread_messages() <> 0 then raise exception 'mark read failed'; end if; end $$;
-- A cannot forge a message row directly
do $$ begin insert into public.messages (sender_id, recipient_id, body) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'fake'); raise exception 'should fail'; exception when insufficient_privilege then null; end $$;
-- A reports the message: moderators get it as a report about B
select public.report_message((select id from public.messages limit 1), 'spam');
-- A blocks B: friendship gone, B cannot see A or message A
select public.block_user('22222222-2222-2222-2222-222222222222');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if public.profile_view('anna') is not null then raise exception 'blocked user sees profile'; end if; end $$;
do $$ begin perform public.send_message('11111111-1111-1111-1111-111111111111', 'hi'); raise exception 'should fail'; exception when others then if sqlerrm <> 'not_friends' then raise; end if; end $$;
do $$ begin perform public.request_friend('11111111-1111-1111-1111-111111111111'); raise exception 'should fail'; exception when others then if sqlerrm <> 'blocked' then raise; end if; end $$;
-- minors: strangers see a limited profile and cannot find them
reset role; update public.user_settings set is_minor = true where user_id = '33333333-3333-3333-3333-333333333333';
update public.profiles set bio = 'teen' where id = '33333333-3333-3333-3333-333333333333'; set role authenticated;
do $$ declare v json := public.profile_view('cili'); begin if v->>'bio' is not null or (v->>'limited')::boolean is not true then raise exception 'minor profile exposed: %', v; end if; end $$;
do $$ begin if exists (select 1 from public.search_people('cil')) then raise exception 'minor findable by stranger'; end if; end $$;
reset role;
do $$ begin if not exists (select 1 from public.reports where profile_id = '22222222-2222-2222-2222-222222222222' and reason like '%Hello Anna%') then raise exception 'message report missing'; end if; end $$;
select 'social tests passed' as result;
