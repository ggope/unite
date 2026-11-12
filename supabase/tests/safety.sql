\set ON_ERROR_STOP on
-- 0017: reporting reasons and answers, wins, organiser dashboard
reset role;
update public.petitions set created_by = '11111111-1111-1111-1111-111111111111', status = 'live' where title like 'End bottom%';
insert into public.signatures (user_id, petition_id, why, show_reason)
select '22222222-2222-2222-2222-222222222222', id, 'Rude words here', true from public.petitions where title like 'End bottom%'
on conflict (user_id, petition_id) do update set why = excluded.why, show_reason = true;

-- 1. a reason is reported by its key; nobody learns who wrote it
set role anon;
do $$ declare k uuid; begin
  select rid into k from public.public_reasons((select id from public.petitions where title like 'End bottom%')) where why = 'Rude words here';
  if k is null then raise exception 'no key'; end if; perform set_config('t.k', k::text, false); end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
insert into public.reports (reporter_id, reason_key, reason) values ('33333333-3333-3333-3333-333333333333', current_setting('t.k')::uuid, 'hate: rude');
do $$ begin if public.reported_reason(current_setting('t.k')::uuid) is not null then raise exception 'non-moderator read a reported reason'; end if; end $$;
do $$ begin perform public.hide_reason(current_setting('t.k')::uuid, 'Rude'); raise exception 'non-moderator hid a reason';
exception when others then if sqlerrm <> 'not_moderator' then raise; end if; end $$;
do $$ begin update public.signatures set reason_hidden = false; raise exception 'changed reason_hidden';
exception when insufficient_privilege then null; end $$;
-- a moderator hides it with a reason; the signer is told, the report closes, and it leaves the page
reset role;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ declare j json := public.reported_reason(current_setting('t.k')::uuid); begin
  if j->>'why' <> 'Rude words here' or j::text like '%2222%' then raise exception 'moderator view wrong: %', j; end if; end $$;
do $$ begin perform public.hide_reason(current_setting('t.k')::uuid, ''); raise exception 'hid without a reason';
exception when others then if sqlerrm <> 'reason_required' then raise; end if; end $$;
select public.hide_reason(current_setting('t.k')::uuid, 'Insults are not allowed');
reset role;
do $$ begin
  if exists (select 1 from public.public_reasons((select id from public.petitions where title like 'End bottom%')) where why = 'Rude words here') then raise exception 'hidden reason still shown'; end if;
  if not exists (select 1 from public.notices where user_id = '22222222-2222-2222-2222-222222222222' and kind = 'reason_hidden') then raise exception 'signer not told'; end if;
  if exists (select 1 from public.reports where reason_key = current_setting('t.k')::uuid and status = 'open') then raise exception 'report still open'; end if; end $$;
-- an official answer can be reported; deleting it closes the report but keeps it in the public counts
insert into public.petition_updates (id, petition_id, kind, title, via_link)
select '77777777-7777-7777-7777-777777777777', id, 'response', 'Spam answer', true from public.petitions where title like 'End bottom%';
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
insert into public.reports (reporter_id, update_id, reason) values ('33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'spam');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
delete from public.petition_updates where id = '77777777-7777-7777-7777-777777777777';
reset role;
do $$ begin
  if exists (select 1 from public.petition_updates where id = '77777777-7777-7777-7777-777777777777') then raise exception 'answer not removed'; end if;
  if not exists (select 1 from public.reports where reason = 'spam' and status = 'resolved' and update_id is null) then raise exception 'answer report lost or still open'; end if; end $$;
update public.profiles set is_moderator = false where id = '11111111-1111-1111-1111-111111111111';

-- 2. wins are public, one row per petition
insert into public.petition_updates (petition_id, kind, title) select id, 'win', 'The ministry agreed' from public.petitions where title like 'End bottom%';
insert into public.petition_updates (petition_id, kind, title) select id, 'win', 'And it became law' from public.petitions where title like 'End bottom%';
set role anon;
do $$ begin
  if (select count(*) from public.recent_wins() where title like 'End bottom%') <> 1 then raise exception 'win listed twice or missing'; end if; end $$;

-- 3. only the organiser (or a moderator) sees the dashboard numbers
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if public.organiser_stats((select id from public.petitions where title like 'End bottom%')) is not null then raise exception 'stranger saw the dashboard'; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ declare j json := public.organiser_stats((select id from public.petitions where title like 'End bottom%')); begin
  if (j->>'signatures')::int < 1 or j->>'won_at' is null then raise exception 'dashboard wrong: %', j; end if; end $$;
reset role;
select 'safety tests passed';
