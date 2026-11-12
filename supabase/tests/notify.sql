\set ON_ERROR_STOP on
-- 0014: notices, phone notifications and the bot check
reset role;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set is_moderator = false where id in ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
delete from public.blocks; delete from public.notices; delete from public.push_subscriptions; delete from public.push_events;
update public.profiles set display_name = 'Rude Name', bio = 'rude bio' where id = '33333333-3333-3333-3333-333333333333';

-- 1. clearing a profile needs a reason, and the person is told it; nobody else sees it
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin perform public.clear_profile('33333333-3333-3333-3333-333333333333', ' '); raise exception 'cleared without reason';
exception when others then if sqlerrm <> 'reason_required' then raise; end if; end $$;
select public.clear_profile('33333333-3333-3333-3333-333333333333', 'Insulting name');
do $$ begin if exists (select 1 from public.notices) then raise exception 'moderator sees the notice'; end if; end $$;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if (select body from public.notices) is distinct from 'Insulting name' then raise exception 'person not told'; end if;
  if (select display_name from public.profiles where id = auth.uid()) is not null then raise exception 'name not cleared'; end if;
end $$;
do $$ begin perform public.clear_profile('22222222-2222-2222-2222-222222222222', 'x'); raise exception 'non-moderator cleared';
exception when others then if sqlerrm <> 'not_moderator' then raise; end if; end $$;
delete from public.notices;
do $$ begin if exists (select 1 from public.notices) then raise exception 'could not dismiss'; end if; end $$;

-- 2. devices: saved through the function only, private to their owner
select public.save_push('https://push.example/abc', 'key', 'auth', 'hu');
do $$ begin insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/x', auth.uid(), 'k', 'a'); raise exception 'direct insert worked';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.save_push('http://not-https', 'k', 'a', 'en'); raise exception 'http endpoint saved';
exception when check_violation then null; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if exists (select 1 from public.push_subscriptions) then raise exception 'saw someone else''s device'; end if; end $$;
do $$ begin perform 1 from public.push_events; raise exception 'events readable';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.claim_push_events(10); raise exception 'claim open to users';
exception when insufficient_privilege then null; end $$;
set role anon;
do $$ begin perform public.save_push('https://push.example/anon', 'k', 'a', 'en'); raise exception 'anon saved a device';
exception when insufficient_privilege then null; end $$;

-- 3. an update reaches followers' devices, not the author's; the goal fires once
reset role;
insert into public.follows (user_id, petition_id) select '33333333-3333-3333-3333-333333333333', id from public.petitions where title like 'End bottom%' on conflict do nothing;
insert into public.follows (user_id, petition_id) select '11111111-1111-1111-1111-111111111111', id from public.petitions where title like 'End bottom%' on conflict do nothing;
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/mod', '11111111-1111-1111-1111-111111111111', 'k', 'a');
insert into public.petition_updates (petition_id, kind, title, created_by)
select id, 'response', 'The minister replied', '11111111-1111-1111-1111-111111111111' from public.petitions where title like 'End bottom%';
set role service_role;
do $$ declare e public.push_events; n int; begin
  select * into e from public.claim_push_events(10) limit 1;
  if e.kind is distinct from 'response' then raise exception 'no event for the update'; end if;
  select count(*) into n from public.push_targets(e.id);
  if n <> 1 or (select endpoint from public.push_targets(e.id)) <> 'https://push.example/abc' then raise exception 'wrong targets: %', n; end if;
  if exists (select 1 from public.claim_push_events(10)) then raise exception 'event claimed twice'; end if;
end $$;
reset role;
update public.petitions set goal = 1000, imported_count = 998 where title like 'Sick pay%';
delete from public.signatures where petition_id = (select id from public.petitions where title like 'Sick pay%');
insert into public.signatures (user_id, petition_id) select '11111111-1111-1111-1111-111111111111', id from public.petitions where title like 'Sick pay%';
do $$ begin if exists (select 1 from public.push_events where kind = 'goal') then raise exception 'goal fired early'; end if; end $$;
insert into public.signatures (user_id, petition_id) select '22222222-2222-2222-2222-222222222222', id from public.petitions where title like 'Sick pay%';
insert into public.signatures (user_id, petition_id) select '33333333-3333-3333-3333-333333333333', id from public.petitions where title like 'Sick pay%';
do $$ begin if (select count(*) from public.push_events where kind = 'goal') <> 1 then raise exception 'goal should fire once'; end if; end $$;

-- 4. the bot check: off by default; when on, signing needs a recent check
update public.site_settings set require_human_check = true;
update auth.users set email_confirmed_at = now() where id = '11111111-1111-1111-1111-111111111111';
delete from public.signatures where user_id = '11111111-1111-1111-1111-111111111111' and petition_id = (select id from public.petitions where title like 'End bottom%');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin perform public.give_signature_consent('v1'); exception when others then null; end $$;
do $$ begin perform public.sign_petition((select id from public.petitions where title like 'End bottom%')); raise exception 'signed without check';
exception when others then if sqlerrm <> 'human_check_required' then raise; end if; end $$;
do $$ begin insert into public.human_checks (user_id) values (auth.uid()); raise exception 'faked a check';
exception when insufficient_privilege then null; end $$;
reset role;
insert into public.human_checks (user_id) values ('11111111-1111-1111-1111-111111111111');
set role authenticated;
select public.sign_petition((select id from public.petitions where title like 'End bottom%')) as signed_after_check;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin update public.site_settings set require_human_check = false; if not (select require_human_check from public.site_settings) then raise exception 'non-moderator switched it off'; end if; end $$;
reset role;
update public.site_settings set require_human_check = false;
select 'notify tests passed';
