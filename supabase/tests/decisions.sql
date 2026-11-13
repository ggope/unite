\set ON_ERROR_STOP on
-- 0022: authors hear about moderation decisions
reset role;
insert into public.petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal, status)
values ('22222222-2222-2222-2222-222222222222', 'Bela', 'Decision test petition title', 'Someone in charge', 'EU', 'Please do the thing we ask for here.', 'Because it matters for everyone here.', 'health', 1000, 'pending');
update public.petitions set status = 'live' where title = 'Decision test petition title';
do $$ begin if not exists (select 1 from public.notices where user_id = '22222222-2222-2222-2222-222222222222' and kind = 'petition_live'
  and petition_id = (select id from public.petitions where title = 'Decision test petition title')) then raise exception 'organiser not told it is live'; end if; end $$;
-- a later edit that keeps the status says nothing new
update public.petitions set goal = 10000 where title = 'Decision test petition title';
do $$ begin if (select count(*) from public.notices where petition_id = (select id from public.petitions where title = 'Decision test petition title')) <> 1 then raise exception 'told twice'; end if; end $$;
update public.petitions set status = 'removed', moderation_note = 'Breaks rule 3' where title = 'Decision test petition title';
do $$ begin
  if not exists (select 1 from public.notices where user_id = '22222222-2222-2222-2222-222222222222' and kind = 'petition_removed' and body = 'Breaks rule 3') then raise exception 'organiser not told why it was removed'; end if;
  if exists (select 1 from public.notices where kind = 'petition_live' and petition_id = (select id from public.petitions where title = 'Decision test petition title')) then raise exception 'stale live note kept'; end if;
end $$;

-- videos
insert into public.videos (petition_id, uploader_id, storage_path, caption, trim_end)
values ((select id from public.petitions where title = 'Decision test petition title'), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/d.mp4', 'Decision test clip', 10);
update public.videos set status = 'rejected', moderation_note = 'Shows a face without consent' where caption = 'Decision test clip';
do $$ begin if not exists (select 1 from public.notices where kind = 'video_rejected' and body = 'Shows a face without consent'
  and ref_key = (select id from public.videos where caption = 'Decision test clip')) then raise exception 'uploader not told why'; end if; end $$;

-- only the author reads them
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin if exists (select 1 from public.notices where kind in ('petition_removed', 'video_rejected')) then raise exception 'someone else sees the notes'; end if; end $$;
reset role;
delete from public.videos where caption = 'Decision test clip';
delete from public.petitions where title = 'Decision test petition title';
select 'decision tests passed';
