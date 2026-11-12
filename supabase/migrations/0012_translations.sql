-- 0012: petitions in two languages. `lang` is the language the petition was written in;
-- `tr` holds the other language's text: {"hu": {"title": …, "target": …, "ask": …, "why": …}}.
-- Moderators fill it in Admin → Petitions. Missing fields fall back to the original.
alter table public.petitions add column if not exists lang text not null default 'en' check (lang in ('en','hu'));
alter table public.petitions add column if not exists tr jsonb not null default '{}'::jsonb
  check (jsonb_typeof(tr) = 'object' and octet_length(tr::text) <= 20000);

-- the feed needs the translations too (new columns go at the end of the view)
create or replace view public.video_feed as
select v.id, v.petition_id, v.storage_path, v.cover_path, v.caption, v.trim_start, v.trim_end, v.blur_faces, v.created_at,
       pr.handle as uploader_handle,
       case when p.created_by = v.uploader_id then 'founder' else 'supporter' end as role,
       p.title as petition_title, p.topic, p.goal,
       st.combined, st.last_hour, st.united_count,
       p.link_url, p.link_cta,
       p.lang as petition_lang, p.tr as petition_tr
from public.videos v
join public.petitions p on p.id = v.petition_id and p.status = 'live'
join public.profiles pr on pr.id = v.uploader_id
join public.petition_stats st on st.id = p.id
where v.status = 'approved' and v.audience = 'everyone';
