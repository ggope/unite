\set ON_ERROR_STOP on
-- 0020: quality check (totals from the counter, updates follow petition visibility)
reset role;

-- 1. the counter gives exactly the totals the old view counted, including united groups
create temp view old_stats as
select p.id, p.imported_count + coalesce(s.n, 0) as signatures, coalesce(s.last_hour, 0) as last_hour,
       sum(p.imported_count + coalesce(s.n, 0)) over (partition by coalesce(p.cluster_id, p.id)) as combined,
       count(*) over (partition by coalesce(p.cluster_id, p.id)) as united_count
from public.petitions p
left join (select petition_id, count(*) n, count(*) filter (where created_at > now() - interval '1 hour') last_hour
           from public.signatures group by 1) s on s.petition_id = p.id
where p.status in ('live', 'closed');
grant select on old_stats to authenticated, anon;
create or replace function pg_temp.same() returns void language plpgsql as $$
begin
  if exists (select id, signatures, last_hour, combined, united_count from old_stats
             except select id, signatures, last_hour, combined, united_count from public.petition_stats)
  or (select count(*) from old_stats) <> (select count(*) from public.petition_stats) then
    raise exception 'petition_stats differs from a full count';
  end if;
end $$;
select pg_temp.same();

-- unite two live petitions, then sign and withdraw through the normal paths
do $$ declare c uuid; begin
  insert into public.clusters (label) values ('quality test') returning id into c;
  update public.petitions set cluster_id = c where id in (select id from public.petitions where status = 'live' order by created_at limit 2);
end $$;
insert into public.signatures (user_id, petition_id)
select '22222222-2222-2222-2222-222222222222', id from public.petitions where status = 'live'
on conflict do nothing;
select pg_temp.same();
delete from public.signatures where user_id = '22222222-2222-2222-2222-222222222222'
  and petition_id = (select id from public.petitions where status = 'live' order by created_at limit 1);
select pg_temp.same();
-- the counter itself is private
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin perform sum(signatures + last_hour + combined + united_count) from public.petition_stats; end $$;   -- every column readable by guests
do $$ begin perform 1 from public.petition_counts; raise exception 'counter readable';
exception when insufficient_privilege then null; end $$;
reset role;

-- 2. updates of a petition still waiting for review are visible only to its organiser and moderators
update public.petitions set status = 'pending', created_by = '11111111-1111-1111-1111-111111111111'
  where id = (select id from public.petitions where status = 'live' order by created_at desc limit 1)
  returning set_config('t.pend', id::text, false);
insert into public.petition_updates (petition_id, kind, title) values (current_setting('t.pend')::uuid, 'milestone', 'Not public yet');
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin if exists (select 1 from public.petition_updates where petition_id = current_setting('t.pend')::uuid) then raise exception 'anon reads pending updates'; end if; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin if exists (select 1 from public.petition_updates where petition_id = current_setting('t.pend')::uuid) and not public.is_moderator() then raise exception 'stranger reads pending updates'; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if not exists (select 1 from public.petition_updates where petition_id = current_setting('t.pend')::uuid) then raise exception 'organiser lost their updates'; end if; end $$;
reset role;
update public.petitions set status = 'live' where id = current_setting('t.pend')::uuid;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin if not exists (select 1 from public.petition_updates where petition_id = current_setting('t.pend')::uuid) then raise exception 'live updates hidden'; end if; end $$;
reset role;
select 'quality tests passed';
