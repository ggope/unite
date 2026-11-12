-- 0007: an organiser's own link, shown as a bar under the petition and its videos ("Visit website →").
-- Set when the petition is started (so moderators see it in review) or by a moderator later.
alter table public.petitions
  add column link_url text check (link_url is null or (link_url ~ '^https://[^\s]+$' and char_length(link_url) <= 300)),
  add column link_cta text not null default 'learn' check (link_cta in ('learn','visit','donate','join','event'));

create or replace view public.video_feed as
select v.id, v.petition_id, v.storage_path, v.cover_path, v.caption, v.trim_start, v.trim_end, v.blur_faces, v.created_at,
       pr.handle as uploader_handle,
       case when p.created_by = v.uploader_id then 'founder' else 'supporter' end as role,
       p.title as petition_title, p.topic, p.goal,
       st.combined, st.last_hour, st.united_count,
       p.link_url, p.link_cta
from public.videos v
join public.petitions p on p.id = v.petition_id and p.status = 'live'
join public.profiles pr on pr.id = v.uploader_id
join public.petition_stats st on st.id = p.id
where v.status = 'approved' and v.audience = 'everyone';
