\set ON_ERROR_STOP on
-- 0023: UNIER team petitions from trusted sources, and the team content switch
reset role;
update public.site_settings set team_content = 'auto';
delete from public.petitions where origin = 'team';

-- 1. automatic is full while people start few petitions
do $$ begin if public.team_content_level() <> 'full' then raise exception 'auto should start full, got %', public.team_content_level(); end if; end $$;

-- 2. people cannot pretend to be the UNIER team
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin
  insert into public.petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal, origin)
  values ('22222222-2222-2222-2222-222222222222', 'UNIER team', 'A fake team petition here', 'Someone', 'Worldwide', 'Do something useful for everyone please', 'Because it matters to a lot of people', 'health', 1000, 'team');
  raise exception 'a person created a team petition';
exception when insufficient_privilege then null; end $$;
-- nor change the switch
update public.site_settings set team_content = 'off';
reset role;
do $$ begin if (select team_content from public.site_settings) <> 'auto' then raise exception 'non-moderator changed the switch'; end if; end $$;

-- 3. the drafting job (service role) adds a pending team petition with its sources
insert into public.petitions (id, created_by, organiser_name, title, target, region, ask, why, topic, goal, origin, status)
values ('99999999-0000-0000-0000-000000000023', null, 'UNIER team', 'Protect the high seas treaty now', 'Governments at the UN', 'Worldwide',
        'Ratify the high seas treaty this year.', 'According to UN News, too few countries have ratified it so far.', 'oceans', 1000000, 'team', 'pending');
insert into public.petition_sources (petition_id, url, outlet, title) values ('99999999-0000-0000-0000-000000000023', 'https://news.example/high-seas', 'UN News', 'High seas treaty stalls');
insert into public.team_drafts (story_key, headline, decision, note, petition_id) values (gen_random_uuid(), 'High seas treaty stalls', 'drafted', 'Check the ratification count', '99999999-0000-0000-0000-000000000023');
do $$ begin if exists (select 1 from public.signatures where petition_id = '99999999-0000-0000-0000-000000000023') then raise exception 'team petition got a founder signature'; end if; end $$;

-- sources of a pending petition stay hidden; the helper's notes are for moderators only
set role anon;
do $$ begin if exists (select 1 from public.petition_sources where petition_id = '99999999-0000-0000-0000-000000000023') then raise exception 'pending sources visible'; end if; end $$;
do $$ begin perform 1 from public.team_drafts; raise exception 'guest read team drafts';
exception when insufficient_privilege then null; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if exists (select 1 from public.team_drafts) then raise exception 'non-moderator read team drafts'; end if; end $$;

-- 4. a moderator approves it and switches team content off
reset role;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if (select count(*) from public.team_drafts) < 1 then raise exception 'moderator cannot read team drafts'; end if; end $$;
update public.petitions set status = 'live' where id = '99999999-0000-0000-0000-000000000023';
update public.site_settings set team_content = 'off';
do $$ begin if public.team_content_level() <> 'off' then raise exception 'switch did not turn off'; end if; end $$;
set role anon;
do $$ begin if (select count(*) from public.petition_sources where petition_id = '99999999-0000-0000-0000-000000000023') <> 1 then raise exception 'live sources not public'; end if; end $$;

-- 5. automatic turns to less once people start 30 petitions in a month
reset role;
update public.site_settings set team_content = 'auto';
insert into public.petitions (organiser_name, title, target, region, ask, why, topic, goal, status)
select 'Person ' || g, 'People made petition number ' || g, 'Council', 'Somewhere', 'Fix the thing that is broken here', 'It has been broken for a long time now', 'housing', 1000, 'live'
from generate_series(1, 30) g;
do $$ begin if public.team_content_level() <> 'less' then raise exception 'auto did not switch to less'; end if; end $$;
delete from public.petitions where title like 'People made petition number %';
update public.site_settings set team_content = 'auto';
update public.profiles set is_moderator = false where id = '11111111-1111-1111-1111-111111111111';
