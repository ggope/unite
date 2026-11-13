\set ON_ERROR_STOP on
-- 0025: team videos from trusted channels
reset role;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set is_moderator = false where id = '22222222-2222-2222-2222-222222222222';
insert into public.team_videos (source_id, youtube_id, title, lang, topic, petition_id, published_at)
  select 'un', 'abcDEF_12-3', 'Oceans are running out of fish', 'en', 'oceans', id, now() from public.petitions where title like 'Protected seas%';
insert into public.team_videos (source_id, youtube_id, title, lang, topic, petition_id, published_at, status)
  select 'dw', 'zzzDEF_12-3', 'A hidden clip', 'en', 'oceans', id, now(), 'hidden' from public.petitions where title like 'Protected seas%';

-- 1. guests see live clips and the sources, never hidden clips
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin if (select count(*) from public.team_videos) <> 1 then raise exception 'guest sees hidden clips'; end if; end $$;
do $$ begin if (select count(*) from public.video_sources) < 6 then raise exception 'sources not seeded'; end if; end $$;
do $$ begin insert into public.team_videos (source_id, youtube_id, title, lang, topic, petition_id, published_at)
  values ('un', 'qqqDEF_12-3', 'Sneaky', 'en', 'oceans', (select id from public.petitions limit 1), now()); raise exception 'guest added a clip';
exception when insufficient_privilege then null; end $$;

-- 2. a normal account cannot hide a clip or pause a source
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
update public.team_videos set status = 'hidden' where youtube_id = 'abcDEF_12-3';
update public.video_sources set active = false where id = 'un';
reset role;
do $$ begin if (select status from public.team_videos where youtube_id = 'abcDEF_12-3') <> 'live' then raise exception 'non-moderator hid a clip'; end if;
  if not (select active from public.video_sources where id = 'un') then raise exception 'non-moderator paused a source'; end if; end $$;

-- 3. a moderator can, but cannot change the title (only status and petition are open)
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
update public.team_videos set status = 'hidden' where youtube_id = 'abcDEF_12-3';
update public.video_sources set active = false where id = 'un';
do $$ begin update public.team_videos set title = 'Changed' where youtube_id = 'abcDEF_12-3'; raise exception 'title changed';
exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin if (select status from public.team_videos where youtube_id = 'abcDEF_12-3') <> 'hidden' then raise exception 'moderator could not hide'; end if;
  if (select active from public.video_sources where id = 'un') then raise exception 'moderator could not pause'; end if; end $$;

-- 4. only YouTube feed links and real video ids are accepted
do $$ begin insert into public.video_sources (id, name, feed_url) values ('bad', 'Bad', 'https://evil.example/feed'); raise exception 'odd feed accepted';
exception when check_violation then null; end $$;
do $$ begin insert into public.team_videos (source_id, youtube_id, title, lang, topic, petition_id, published_at)
  values ('un', 'x"><script>', 'Bad id', 'en', 'oceans', (select id from public.petitions limit 1), now()); raise exception 'odd id accepted';
exception when check_violation then null; end $$;
update public.video_sources set active = true where id = 'un';
delete from public.team_videos where youtube_id in ('abcDEF_12-3','zzzDEF_12-3');
