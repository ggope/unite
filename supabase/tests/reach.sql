\set ON_ERROR_STOP on
-- 0015: share tracking, transparency, accountability, languages
reset role;
update auth.users set email_confirmed_at = now();
update public.site_settings set require_human_check = false;
delete from public.signatures where petition_id = (select id from public.petitions where title like 'Sick pay%');
update public.petitions set status = 'live' where title like 'Sick pay%';
insert into auth.users values ('44444444-4444-4444-4444-444444444444','d@x.io', now()) on conflict do nothing;
insert into public.profiles (id) values ('44444444-4444-4444-4444-444444444444') on conflict do nothing;

-- 1. a share code is personal; signing through it credits the sharer, never yourself
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ declare c text := public.my_share_code(); begin
  if c !~ '^[a-f0-9]{12}$' then raise exception 'bad code %', c; end if;
  if public.my_share_code() <> c then raise exception 'code changed'; end if;
  perform set_config('t.code', c, false);
end $$;
do $$ begin perform public.give_signature_consent('v1'); exception when others then null; end $$;
select public.sign_petition((select id from public.petitions where title like 'Sick pay%'), null, false, null, current_setting('t.code'));
reset role;
do $$ begin if (select ref_by from public.signatures where user_id = '11111111-1111-1111-1111-111111111111' and petition_id = (select id from public.petitions where title like 'Sick pay%')) is not null then raise exception 'credited yourself'; end if; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin perform public.give_signature_consent('v1'); exception when others then null; end $$;
select public.sign_petition((select id from public.petitions where title like 'Sick pay%'), null, false, null, upper(current_setting('t.code')));
-- 2 cannot read 1's code or the impact
do $$ begin if exists (select 1 from public.share_codes) and (select count(*) from public.share_codes) > 0 and (select user_id from public.share_codes limit 1) <> auth.uid() then raise exception 'saw another share code'; end if; end $$;
do $$ begin update public.signatures set ref_by = null; raise exception 'changed ref_by';
exception when insufficient_privilege then null; end $$;
-- one referral: the sharer sees "some", not a number
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ declare j json := public.my_impact(); begin
  if (j->>'any')::boolean is not true or j->>'total' is not null then raise exception 'impact leaked under 3: %', j; end if; end $$;
reset role;
insert into public.signatures (user_id, petition_id, ref_by) select '33333333-3333-3333-3333-333333333333', id, '11111111-1111-1111-1111-111111111111' from public.petitions where title like 'Sick pay%';
insert into public.signatures (user_id, petition_id, ref_by) select '44444444-4444-4444-4444-444444444444', id, '11111111-1111-1111-1111-111111111111' from public.petitions where title like 'Sick pay%';
set role authenticated;
do $$ declare j json := public.my_impact(); begin
  if (j->>'total')::int <> 3 or json_array_length(j->'petitions') <> 1 then raise exception 'impact wrong: %', j; end if; end $$;
set role anon;
do $$ begin perform public.my_share_code(); raise exception 'anon got a code';
exception when insufficient_privilege then null; end $$;

-- 2. transparency and accountability are public
do $$ declare j json := public.transparency_stats(); begin
  if (j->>'signatures')::int < 3 then raise exception 'stats wrong: %', j; end if; end $$;
reset role;
insert into public.petition_updates (petition_id, kind, title, created_by, created_at)
select id, 'delivered', 'Handed over to the ministry', '11111111-1111-1111-1111-111111111111', now() - interval '40 days' from public.petitions where title like 'Sick pay%';
set role anon;
do $$ declare r record; begin
  select * into r from public.accountability() where ids @> array[(select id from public.petitions where title like 'Sick pay%')];
  if r.silent_days < 39 or r.delivered <> 1 then raise exception 'silence not counted: %', r; end if; end $$;
reset role;
insert into public.petition_updates (petition_id, kind, title, created_by)
select id, 'response', 'The minister replied', '11111111-1111-1111-1111-111111111111' from public.petitions where title like 'Sick pay%';
do $$ declare r record; begin
  select * into r from public.accountability() where ids @> array[(select id from public.petitions where title like 'Sick pay%')];
  if r.silent_days is not null or r.answered <> 1 then raise exception 'answer not counted: %', r; end if; end $$;

-- 3. new languages are accepted
update public.petitions set lang = 'de' where title like 'Sick pay%';
update public.petitions set lang = 'en' where title like 'Sick pay%';
select 'reach tests passed';
