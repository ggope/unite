-- 0024 AI moderation: Claude reads new petitions, video captions and reports, and says what it thinks.
-- Clear cases can be handled automatically (only when a moderator switches that on); everything unclear waits for a person.
-- Re-runnable.

-- ---------- 1. the switch ----------
-- off: no AI. suggest: the AI only labels, people decide everything. auto: the AI also approves clearly fine
-- petitions and takes down clear spam or scams; everything else still waits for a person.
alter table public.site_settings add column if not exists ai_moderation text not null default 'suggest';
alter table public.site_settings drop constraint if exists site_settings_ai_moderation_check;
alter table public.site_settings add constraint site_settings_ai_moderation_check check (ai_moderation in ('off', 'suggest', 'auto'));
grant update (ai_moderation) on public.site_settings to authenticated;   -- the row policy already limits updates to moderators

-- ---------- 2. what the AI said ----------
-- One row per check. Only moderators read it; only the server (service role) writes it.
create table if not exists public.ai_reviews (
  id          bigserial primary key,
  kind        text not null check (kind in ('petition', 'video', 'report')),
  petition_id uuid references public.petitions on delete cascade,
  video_id    uuid references public.videos on delete cascade,
  report_id   bigint references public.reports on delete cascade,
  verdict     text not null check (verdict in ('ok', 'unsure', 'breaks_rules')),
  risk        text not null default 'low' check (risk in ('low', 'medium', 'high', 'urgent')),
  confidence  real not null default 0 check (confidence between 0 and 1),
  rules       text[] not null default '{}',
  summary     text not null default '' check (char_length(summary) <= 1000),       -- for moderators
  author_note text check (char_length(author_note) <= 500),                         -- suggested reason the author would see
  action      text not null default 'none' check (action in ('none', 'approved', 'removed')),
  model       text,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(petition_id, video_id, report_id) = 1),
  check ((kind = 'petition') = (petition_id is not null) and (kind = 'video') = (video_id is not null) and (kind = 'report') = (report_id is not null))
);
create index if not exists ai_reviews_petition_idx on public.ai_reviews (petition_id) where petition_id is not null;
create index if not exists ai_reviews_video_idx on public.ai_reviews (video_id) where video_id is not null;
create index if not exists ai_reviews_report_idx on public.ai_reviews (report_id) where report_id is not null;
create index if not exists ai_reviews_created_idx on public.ai_reviews (created_at desc);

alter table public.ai_reviews enable row level security;
drop policy if exists "moderators read ai reviews" on public.ai_reviews;
create policy "moderators read ai reviews" on public.ai_reviews for select using (public.is_moderator());
revoke all on public.ai_reviews from anon, authenticated;
grant select on public.ai_reviews to authenticated;
grant all on public.ai_reviews to service_role;
grant usage, select on sequence public.ai_reviews_id_seq to service_role;

-- ---------- 3. in public ----------
-- The EU Digital Services Act asks platforms to say how they use automated moderation. Totals only.
create or replace function public.ai_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'mode',            (select ai_moderation from public.site_settings limit 1),
    'checked_30d',     count(*) filter (where created_at > now() - interval '30 days'),
    'approved_30d',    count(*) filter (where action = 'approved' and created_at > now() - interval '30 days'),
    'removed_30d',     count(*) filter (where action = 'removed' and created_at > now() - interval '30 days'),
    'to_people_30d',   count(*) filter (where action = 'none' and created_at > now() - interval '30 days'))
  from public.ai_reviews;
$$;
revoke execute on function public.ai_stats() from public;
grant execute on function public.ai_stats() to anon, authenticated, service_role;
