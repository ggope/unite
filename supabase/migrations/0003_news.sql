-- UNIER 0003: automatic news. Run once in the Supabase SQL Editor.
-- We store only a headline, a short teaser and the link from each publisher's own public feed.
-- Full articles and photos stay on the publisher's site (copyright), and every card links there.

create table public.news_sources (
  id              text primary key,
  name            text not null,
  feed_url        text not null check (feed_url ~ '^https://'),
  lang            text not null check (lang in ('en','hu')),
  active          boolean not null default true,
  last_fetched_at timestamptz,
  last_status     text,
  last_count      int
);

create table public.news_items (
  id           uuid primary key default gen_random_uuid(),
  source_id    text not null references public.news_sources on delete cascade,
  url          text not null unique check (url ~ '^https?://'),
  title        text not null check (char_length(title) between 5 and 300),
  teaser       text check (char_length(teaser) <= 300),
  lang         text not null check (lang in ('en','hu')),
  topic        text not null check (topic in ('climate','housing','labour','digital','health','press','oceans')),
  story_key    uuid not null,                       -- the same story from several outlets shares one key
  published_at timestamptz not null,
  status       text not null default 'live' check (status in ('live','hidden')),
  petition_id  uuid references public.petitions on delete set null,
  created_at   timestamptz not null default now()
);
create index news_items_recent_idx on public.news_items (published_at desc) where status = 'live';
create index news_items_story_idx on public.news_items (story_key);

-- One row per story: its newest headline, and how many outlets covered it (the "biggest" stories rise).
create view public.news_stories with (security_invoker = true) as
select distinct on (n.story_key)
  n.story_key, n.id, n.url, n.title, n.teaser, n.lang, n.topic, n.published_at, n.source_id, s.name as source_name,
  coalesce(n.petition_id, (select n2.petition_id from public.news_items n2 where n2.story_key = n.story_key and n2.petition_id is not null limit 1)) as petition_id,
  (select count(distinct n3.source_id) from public.news_items n3 where n3.story_key = n.story_key and n3.status = 'live') as outlets
from public.news_items n join public.news_sources s on s.id = n.source_id
where n.status = 'live'
order by n.story_key, n.published_at desc;

alter table public.news_sources enable row level security;
alter table public.news_items   enable row level security;
create policy "sources are public"            on public.news_sources for select using (true);
create policy "moderators manage sources"     on public.news_sources for update using (public.is_moderator());
create policy "live news is public"           on public.news_items for select using (status = 'live' or public.is_moderator());
create policy "moderators manage news"        on public.news_items for update using (public.is_moderator());
-- inserts come only from the importer, which uses the service role key

-- Quality outlets with public feeds. Edit, add or switch off sources here or in the moderation page.
insert into public.news_sources (id, name, feed_url, lang) values
 ('bbc',        'BBC News',        'https://feeds.bbci.co.uk/news/world/rss.xml', 'en'),
 ('guardian',   'The Guardian',    'https://www.theguardian.com/world/rss', 'en'),
 ('guardian-env','The Guardian',   'https://www.theguardian.com/environment/rss', 'en'),
 ('guardian-tech','The Guardian',  'https://www.theguardian.com/technology/rss', 'en'),
 ('aljazeera',  'Al Jazeera',      'https://www.aljazeera.com/xml/rss/all.xml', 'en'),
 ('dw',         'DW',              'https://rss.dw.com/rdf/rss-en-all', 'en'),
 ('france24',   'France 24',       'https://www.france24.com/en/rss', 'en'),
 ('npr',        'NPR',             'https://feeds.npr.org/1004/rss.xml', 'en'),
 ('telex',      'Telex',           'https://telex.hu/rss', 'hu'),
 ('444',        '444',             'https://444.hu/feed', 'hu'),
 ('hvg',        'HVG',             'https://hvg.hu/rss', 'hu'),
 ('atlatszo',   'Átlátszó',        'https://atlatszo.hu/feed/', 'hu')
on conflict (id) do nothing;
