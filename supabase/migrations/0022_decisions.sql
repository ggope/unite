-- 0022: organisers hear about moderation decisions.
-- When a petition or video goes live, or a moderator takes it down, its author gets a note under You
-- (the app also emails them when an email sender is set up). A takedown note carries the written reason
-- and a link to ask for a second look (EU Digital Services Act, articles 17 and 20).
-- Run once in the Supabase SQL Editor, after 0018. Safe to run again.

alter table public.notices drop constraint if exists notices_kind_check;
alter table public.notices add constraint notices_kind_check
  check (kind in ('profile_cleared', 'reason_hidden', 'deliver_nudge', 'appeal_upheld', 'appeal_reversed',
                  'petition_live', 'petition_removed', 'video_live', 'video_rejected'));

create or replace function public.notice_petition_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null or new.status is not distinct from old.status then return null; end if;
  if new.status = 'live' and old.status = 'pending' then
    insert into public.notices (user_id, kind, petition_id) values (new.created_by, 'petition_live', new.id);
  elsif new.status = 'removed' then
    delete from public.notices where user_id = new.created_by and petition_id = new.id and kind = 'petition_live';
    insert into public.notices (user_id, kind, body, petition_id) values (new.created_by, 'petition_removed', left(coalesce(new.moderation_note, ''), 500), new.id);
  end if;
  return null;
end $$;
revoke execute on function public.notice_petition_decision() from public, anon, authenticated;
drop trigger if exists notice_petition_decision on public.petitions;
create trigger notice_petition_decision after update of status on public.petitions
  for each row execute function public.notice_petition_decision();

-- ref_key holds the video's id, so the appeal link can name it.
create or replace function public.notice_video_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return null; end if;
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.notices (user_id, kind, petition_id, ref_key) values (new.uploader_id, 'video_live', new.petition_id, new.id);
  elsif new.status = 'rejected' then
    delete from public.notices where user_id = new.uploader_id and ref_key = new.id and kind = 'video_live';
    insert into public.notices (user_id, kind, body, petition_id, ref_key) values (new.uploader_id, 'video_rejected', left(coalesce(new.moderation_note, ''), 500), new.petition_id, new.id);
  end if;
  return null;
end $$;
revoke execute on function public.notice_video_decision() from public, anon, authenticated;
drop trigger if exists notice_video_decision on public.videos;
create trigger notice_video_decision after update of status on public.videos
  for each row execute function public.notice_video_decision();
