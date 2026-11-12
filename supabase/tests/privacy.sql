\set ON_ERROR_STOP on
-- 0011: people see the reports they sent (not others'), and the daily clean-up deletes only what the policy says
reset role;
delete from public.reports;
insert into public.reports (reporter_id, petition_id, reason, status, resolved_at, created_at) values
  ('11111111-1111-1111-1111-111111111111', (select id from public.petitions limit 1), 'old and resolved', 'resolved', now() - interval '13 months', now() - interval '14 months'),
  ('11111111-1111-1111-1111-111111111111', (select id from public.petitions limit 1), 'recently resolved', 'resolved', now() - interval '2 months', now() - interval '3 months'),
  ('22222222-2222-2222-2222-222222222222', (select id from public.petitions limit 1), 'old but still open', 'open', null, now() - interval '20 months'),
  ('33333333-3333-3333-3333-333333333333', (select id from public.petitions limit 1), 'mine, not a moderator', 'open', null, now());
delete from public.friend_requests;
insert into public.friend_requests (from_id, to_id, created_at) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', now() - interval '100 days'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', now() - interval '5 days');

set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if (select count(*) from public.reports) <> 1 then raise exception 'should see only my own report, saw %', (select count(*) from public.reports); end if;
end $$;
-- nobody but the scheduled job may run the clean-up
do $$ begin perform public.run_retention(); raise exception 'a user ran the clean-up';
exception when insufficient_privilege then null; end $$;
set role anon;
do $$ begin perform public.run_retention(); raise exception 'anon ran the clean-up';
exception when insufficient_privilege then null; end $$;

reset role;
do $$ declare r json := public.run_retention(); begin
  if (r->>'reports')::int <> 1 or (r->>'friend_requests')::int <> 1 then raise exception 'clean-up removed the wrong amount: %', r; end if;
  if exists (select 1 from public.reports where reason = 'old and resolved') then raise exception 'old resolved report kept'; end if;
  if not exists (select 1 from public.reports where reason = 'old but still open') then raise exception 'open report deleted'; end if;
  if (select count(*) from public.friend_requests) <> 1 then raise exception 'recent friend request deleted'; end if;
end $$;
select 'privacy tests passed' as result;
