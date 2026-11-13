-- UNIER 0025: team videos. Run once in the Supabase SQL Editor (safe to run again).
-- Until people post their own videos, the feed borrows short clips from trusted public channels
-- (the UN, UNICEF, WHO, Amnesty, Human Rights Watch, DW News) and puts the matching petition under each one.
-- Copyright: we store only the video id, title and date from each channel's public feed. The clip itself
-- plays in YouTube's own embedded player, the way YouTube allows any site to embed, and only after a tap,
-- so nobody's browser talks to YouTube unless they choose to watch.
-- How many of these show is decided by the shared "team content" switch (0023_team_content.sql).

create table if not exists public.video_sources (
  id              text primary key,
  name            text not null,
  feed_url        text not null check (feed_url ~ '^https://www\.youtube\.com/feeds/videos\.xml\?(channel_id|user)=[A-Za-z0-9_-]+$'),
  lang            text not null default 'en' check (lang in ('en','hu','de','es','fr')),
  active          boolean not null default true,
  last_fetched_at timestamptz,
  last_status     text,
  last_count      int
);

create table if not exists public.team_videos (
  id           uuid primary key default gen_random_uuid(),
  source_id    text not null references public.video_sources on delete cascade,
  youtube_id   text not null unique check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title        text not null check (char_length(title) between 3 and 300),
  lang         text not null check (lang in ('en','hu','de','es','fr')),
  topic        text not null check (topic in ('climate','housing','labour','digital','health','press','oceans')),
  petition_id  uuid not null references public.petitions on delete cascade,
  published_at timestamptz not null,
  status       text not null default 'live' check (status in ('live','hidden')),
  created_at   timestamptz not null default now()
);
create index if not exists team_videos_recent_idx on public.team_videos (published_at desc) where status = 'live';

alter table public.video_sources enable row level security;
alter table public.team_videos   enable row level security;
drop policy if exists "video sources are public" on public.video_sources;
create policy "video sources are public" on public.video_sources for select using (true);
drop policy if exists "moderators manage video sources" on public.video_sources;
create policy "moderators manage video sources" on public.video_sources for update using (public.is_moderator()) with check (public.is_moderator());
drop policy if exists "live team videos are public" on public.team_videos;
create policy "live team videos are public" on public.team_videos for select using (status = 'live' or public.is_moderator());
drop policy if exists "moderators manage team videos" on public.team_videos;
create policy "moderators manage team videos" on public.team_videos for update using (public.is_moderator()) with check (public.is_moderator());

-- Reading is open; moderators may only pause a source, hide a clip or move it to another petition.
-- New rows come only from the daily importer, which uses the service role key.
revoke all on public.video_sources, public.team_videos from anon, authenticated;
grant select on public.video_sources, public.team_videos to anon, authenticated;
grant update (active) on public.video_sources to authenticated;
grant update (status, petition_id) on public.team_videos to authenticated;
grant all on public.video_sources, public.team_videos to service_role;

-- Trusted channels with public feeds. Pause any of them in Admin → Team videos.
insert into public.video_sources (id, name, feed_url, lang) values
 ('un',       'United Nations',      'https://www.youtube.com/feeds/videos.xml?channel_id=UC5O114-PQNYkurlTg6hekZw', 'en'),
 ('unicef',   'UNICEF',              'https://www.youtube.com/feeds/videos.xml?user=unicef', 'en'),
 ('who',      'World Health Organization', 'https://www.youtube.com/feeds/videos.xml?user=who', 'en'),
 ('amnesty',  'Amnesty International', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCREPamP892LJnJfJNWYKfPQ', 'en'),
 ('hrw',      'Human Rights Watch',  'https://www.youtube.com/feeds/videos.xml?user=HumanRightsWatch', 'en'),
 ('dw',       'DW News',             'https://www.youtube.com/feeds/videos.xml?channel_id=UCknLrEdhRCp1aegoMqRaCZg', 'en')
on conflict (id) do nothing;
