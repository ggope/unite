\set ON_ERROR_STOP on
-- runs after behaviour.sql (users A, B, C exist)
set role authenticated;
-- A makes an invite code; B cannot read it from the table
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
create temp table t_code as select public.my_invite_code() as code;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if (select count(*) from public.invites) <> 0 then raise exception 'B can read invite codes'; end if; end $$;
-- B opens A's link and accepts: friends both ways
select public.accept_invite((select code from t_code));
do $$ begin if (select count(*) from public.friendships) <> 1 then raise exception 'B should see one friendship'; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if (select count(*) from public.friendships) <> 1 then raise exception 'A should see one friendship'; end if; end $$;
-- A cannot accept own link; bad codes fail
do $$ begin perform public.accept_invite((select code from t_code)); raise exception 'should have failed'; exception when others then if sqlerrm <> 'own_invite' then raise; end if; end $$;
do $$ begin perform public.accept_invite('nope'); raise exception 'should have failed'; exception when others then if sqlerrm <> 'invite_not_found' then raise; end if; end $$;
-- a new code kills the old link
select public.my_invite_code(true) <> (select code from t_code) as new_code_differs;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin perform public.accept_invite((select code from t_code)); raise exception 'old link should be dead'; exception when others then if sqlerrm <> 'invite_not_found' then raise; end if; end $$;
-- remove friend removes both directions
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select public.remove_friend('11111111-1111-1111-1111-111111111111');
reset role;
do $$ begin if (select count(*) from public.friendships) <> 0 then raise exception 'friendship not removed both ways'; end if; end $$;
-- updates: a non-founder cannot post, a moderator can
update public.profiles set is_moderator = true where id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin insert into public.petition_updates (petition_id, kind, title, created_by) values ((select id from public.petitions where title like 'Sick pay%'), 'milestone', 'Not my petition', '11111111-1111-1111-1111-111111111111'); raise exception 'should have failed'; exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
insert into public.petition_updates (petition_id, kind, title, created_by) values ((select id from public.petitions where title like 'Sick pay%'), 'delivered', 'Delivered to the ministry', '22222222-2222-2222-2222-222222222222');
delete from public.petition_updates where title = 'Delivered to the ministry';
reset role;
select 'invite and update tests passed' as result;
-- news: public can read live items only; only moderators can hide
reset role;
insert into public.news_items (source_id, url, title, lang, topic, story_key, published_at) values
 ('bbc', 'https://ex.com/1', 'Heatwave hits workers', 'en', 'labour', '00000000-0000-0000-0000-0000000000a1', now()),
 ('guardian', 'https://ex.com/2', 'Workers hit by heatwave', 'en', 'labour', '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour'),
 ('telex', 'https://ex.com/3', 'Hidden story here', 'hu', 'health', '00000000-0000-0000-0000-0000000000a2', now());
update public.news_items set status = 'hidden' where url = 'https://ex.com/3';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if (select count(*) from public.news_items) <> 2 then raise exception 'hidden news visible'; end if; end $$;
do $$ begin if (select outlets from public.news_stories where story_key = '00000000-0000-0000-0000-0000000000a1') <> 2 then raise exception 'outlet count wrong'; end if; end $$;
update public.news_items set status = 'hidden' where url = 'https://ex.com/1';
do $$ begin if (select count(*) from public.news_items where status = 'live') <> 2 then raise exception 'non-moderator could hide news'; end if; end $$;
reset role;
select 'news tests passed' as result;
-- 0004: founders cannot set their own moderation note; unread updates; moderators unite petitions
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin insert into public.petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal, moderation_note) values ('11111111-1111-1111-1111-111111111111','Me','A petition with a note','Someone','Hungary','A specific ask that is long enough.','A reason that is long enough to pass.','health',1000,'approved!'); raise exception 'should have failed'; exception when insufficient_privilege then null; end $$;
update public.user_settings set updates_seen_at = now() - interval '1 day' where user_id = '11111111-1111-1111-1111-111111111111';
reset role;
insert into public.petition_updates (petition_id, kind, title) values ((select id from public.petitions where title like 'End bottom%'), 'milestone', 'Half way to the goal');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if public.unread_updates() <> 1 then raise exception 'expected 1 unread, got %', public.unread_updates(); end if; end $$;
update public.user_settings set updates_seen_at = now() where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin if public.unread_updates() <> 0 then raise exception 'expected 0 unread'; end if; end $$;
do $$ begin insert into public.clusters (label) values ('nope'); raise exception 'should have failed'; exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
insert into public.clusters (label) values ('Moderator made this');
reset role;
select 'trust tests passed' as result;
-- admin functions: moderators only, cannot remove the last moderator
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin perform public.admin_stats(); raise exception 'should have failed'; exception when others then if sqlerrm <> 'not_moderator' then raise; end if; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select (public.admin_stats()->>'people')::int >= 3 as stats_ok;
select count(*) >= 1 as found from public.admin_find_people('a@x');
do $$ begin perform public.set_moderator('22222222-2222-2222-2222-222222222222', false); raise exception 'should have failed'; exception when others then if sqlerrm <> 'last_moderator' then raise; end if; end $$;
select public.set_moderator('11111111-1111-1111-1111-111111111111', true);
reset role;
select 'admin tests passed' as result;
