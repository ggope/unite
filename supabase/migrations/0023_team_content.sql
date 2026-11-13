-- UNIER 0023: petitions drafted by the UNIER team's AI helper from trusted sources, and one switch for all team content.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- How it works: every morning, after the news import, the helper looks at the biggest stories (covered by two or
-- more outlets, or published by a trusted organisation such as the UN or WHO). For each one it either drafts a
-- petition, says it is already covered by an existing petition, or skips it with a reason. Drafts go into the normal
-- review queue as PENDING: nothing is public until a moderator approves it.

-- ---------- 1. the switch: how much UNIER team content to make and show ----------
-- auto: full while people make few petitions, then less once they make 30 or more a month
-- full: up to 3 new drafts a day, shown like any other petition
-- less: 1 draft a day, and team content ranks lower in the feed
-- off:  no new drafts, and team content leaves the feed (it stays reachable by link, and its signatures count)
alter table public.site_settings add column if not exists team_content text not null default 'auto';
do $$ begin
  alter table public.site_settings add constraint site_settings_team_content_check check (team_content in ('auto','full','less','off'));
exception when duplicate_object then null; end $$;
grant update (team_content) on public.site_settings to authenticated;   -- the 0014 policy limits updates to moderators

create or replace function public.team_content_level() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case s.team_content
      when 'auto' then case when (select count(*) from public.petitions p
                                   where p.origin <> 'team' and p.status in ('live','closed')
                                     and p.created_at > now() - interval '30 days') >= 30 then 'less' else 'full' end
      else s.team_content end
    from public.site_settings s limit 1), 'full');
$$;
revoke execute on function public.team_content_level() from public;
grant execute on function public.team_content_level() to anon, authenticated, service_role;

-- ---------- 2. team petitions ----------
alter table public.petitions drop constraint if exists petitions_origin_check;
alter table public.petitions add constraint petitions_origin_check check (origin in ('unite','imported','team'));
-- the starter petitions were written by the team, so they count as team content too
update public.petitions set origin = 'team' where organiser_name = 'UNIER team' and origin = 'unite';

-- Every source a team petition is based on, shown on the petition page.
create table if not exists public.petition_sources (
  id           bigserial primary key,
  petition_id  uuid not null references public.petitions on delete cascade,
  url          text not null check (url ~ '^https?://' and char_length(url) <= 1000),
  outlet       text not null check (char_length(outlet) between 1 and 80),
  title        text check (char_length(title) <= 300),
  published_at timestamptz,
  unique (petition_id, url)
);
create index if not exists petition_sources_petition_idx on public.petition_sources (petition_id);
alter table public.petition_sources enable row level security;
drop policy if exists "sources of visible petitions are public" on public.petition_sources;
create policy "sources of visible petitions are public" on public.petition_sources for select using (
  exists (select 1 from public.petitions p where p.id = petition_id and (p.status in ('live','closed') or public.is_moderator())));
revoke all on public.petition_sources from anon, authenticated;
grant select on public.petition_sources to anon, authenticated;
grant all on public.petition_sources to service_role;
grant usage on sequence public.petition_sources_id_seq to service_role;

-- What the helper decided about each story, so it never looks at the same story twice
-- and moderators can see why something was skipped. Moderators only.
create table if not exists public.team_drafts (
  id          bigserial primary key,
  story_key   uuid not null unique,
  headline    text check (char_length(headline) <= 300),
  decision    text not null check (decision in ('drafted','skipped','duplicate','failed')),
  reason      text check (char_length(reason) <= 1000),
  note        text check (char_length(note) <= 1000),          -- the helper's advice to the moderator ("check the figure in…")
  petition_id uuid references public.petitions on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists team_drafts_recent_idx on public.team_drafts (created_at desc);
create index if not exists team_drafts_petition_idx on public.team_drafts (petition_id);
alter table public.team_drafts enable row level security;
drop policy if exists "moderators read team drafts" on public.team_drafts;
create policy "moderators read team drafts" on public.team_drafts for select using (public.is_moderator());
revoke all on public.team_drafts from anon, authenticated;
grant select on public.team_drafts to authenticated;
grant all on public.team_drafts to service_role;
grant usage on sequence public.team_drafts_id_seq to service_role;

-- ---------- 3. trusted organisations as sources ----------
-- press: a news outlet. ngo / official: a trusted organisation; one report from them is enough to consider a story,
-- where a press story needs two outlets.
alter table public.news_sources add column if not exists kind text not null default 'press';
do $$ begin
  alter table public.news_sources add constraint news_sources_kind_check check (kind in ('press','ngo','official'));
exception when duplicate_object then null; end $$;

insert into public.news_sources (id, name, feed_url, lang, kind) values
 ('un-news',    'UN News',                 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', 'en', 'official'),
 ('who',        'World Health Organization','https://www.who.int/rss-feeds/news-english.xml', 'en', 'official'),
 ('europarl',   'European Parliament',     'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml', 'en', 'official'),
 ('hrw',        'Human Rights Watch',      'https://www.hrw.org/rss/news', 'en', 'ngo'),
 ('amnesty',    'Amnesty International',   'https://www.amnesty.org/en/feed/', 'en', 'ngo'),
 ('tasz',       'TASZ',                    'https://tasz.hu/feed/', 'hu', 'ngo'),
 ('helsinki',   'Magyar Helsinki Bizottság','https://helsinki.hu/feed/', 'hu', 'ngo')
on conflict (id) do nothing;
