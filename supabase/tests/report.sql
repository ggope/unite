\set ON_ERROR_STOP on
-- 0005: delivery report keeps small countries anonymous; sign_petition stores a clean country
reset role;
insert into public.petitions (organiser_name, title, target, region, ask, why, topic, goal, status)
values ('Test org', 'Report test petition here', 'Someone', 'Europe', 'Ask ask ask ask ask ask ask', 'Why why why why why why why why', 'health', 1000, 'live');
insert into auth.users select gen_random_uuid(), 'r' || g || '@x.io', now() from generate_series(1, 16) g;
insert into public.signatures (user_id, petition_id, country)
select u.id, (select id from public.petitions where title = 'Report test petition here'),
       case when row_number() over () <= 12 then 'HU' when row_number() over () <= 15 then 'DE' end
from auth.users u where u.email like 'r%@x.io';
do $$ declare r json := public.petition_report((select id from public.petitions where title = 'Report test petition here')); begin
  if (r->>'verified')::int <> 16 then raise exception 'verified wrong: %', r; end if;
  if json_array_length(r->'countries') <> 1 or r->'countries'->0->>'c' <> 'HU' then raise exception 'small countries must be grouped: %', r; end if;
  if (r->>'other')::int <> 4 then raise exception 'other wrong: %', r; end if;
end $$;
-- pending petitions have no report
do $$ begin if public.petition_report((select id from public.petitions where status = 'pending' limit 1)) is not null then raise exception 'pending petition has a report'; end if; end $$;
-- country is cleaned
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select public.sign_petition((select id from public.petitions where title = 'Report test petition here'), null, false, 'hu');
reset role;
do $$ begin if (select country from public.signatures where user_id = '11111111-1111-1111-1111-111111111111' and petition_id = (select id from public.petitions where title = 'Report test petition here')) <> 'HU' then raise exception 'country not stored'; end if; end $$;
select 'report tests passed' as result;
-- 0007: organiser links must be https and show in the feed view
do $$ begin update public.petitions set link_url = 'http://bad.example' where title = 'Report test petition here'; raise exception 'http link accepted'; exception when check_violation then null; end $$;
update public.petitions set link_url = 'https://good.example/campaign', link_cta = 'donate' where title = 'Report test petition here';
select 'link tests passed' as result;
