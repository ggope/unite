-- UNITE: initial schema
-- Signatures reveal political opinions (GDPR Art. 9), so they are private by default:
-- nobody can read another person's signatures, only totals.

create extension if not exists pgcrypto;

-- ---------- people ----------
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        text unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name  text check (char_length(display_name) <= 40),
  is_moderator  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.user_settings (          -- private to the user
  user_id                        uuid primary key references public.profiles on delete cascade,
  one_tap                        boolean not null default true,
  share_signatures_with_friends  boolean not null default false,
  is_minor                       boolean not null default false,
  autoplay                       boolean not null default true,
  chronological_feed             boolean not null default false,
  break_reminder_minutes         int not null default 20 check (break_reminder_minutes in (10,20,30,60))
);

create table public.friendships (            -- one row per direction, both rows exist once accepted
  user_id    uuid not null references public.profiles on delete cascade,
  friend_id  uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- new auth user -> profile + settings
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- petitions ----------
create table public.clusters (               -- petitions asking for the same thing ("united")
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  created_at timestamptz not null default now()
);

create table public.petitions (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid references public.profiles on delete set null,
  organiser_name text not null check (char_length(organiser_name) between 2 and 80),
  title          text not null check (char_length(title) between 10 and 90),
  target         text not null check (char_length(target) between 2 and 120),
  region         text not null check (char_length(region) between 2 and 80),
  ask            text not null check (char_length(ask) between 20 and 2000),
  why            text not null check (char_length(why) between 20 and 5000),
  source_url     text check (source_url is null or source_url ~ '^https://'),
  topic          text not null check (topic in ('climate','housing','labour','digital','health','press','oceans')),
  goal           int  not null check (goal in (1000,10000,50000,100000,250000,500000,1000000)),
  ends_on        date,
  cluster_id     uuid references public.clusters on delete set null,
  origin         text not null default 'unite' check (origin in ('unite','imported')),
  imported_count int  not null default 0 check (imported_count >= 0),   -- signatures collected elsewhere
  status         text not null default 'pending' check (status in ('pending','live','closed','removed')),
  search         tsvector generated always as (to_tsvector('simple', title || ' ' || target || ' ' || ask)) stored,
  created_at     timestamptz not null default now()
);
create index petitions_search_idx on public.petitions using gin (search);
create index petitions_cluster_idx on public.petitions (cluster_id);

create table public.petition_updates (       -- "what happened next"
  id          uuid primary key default gen_random_uuid(),
  petition_id uuid not null references public.petitions on delete cascade,
  kind        text not null check (kind in ('milestone','response','delivered','win')),
  title       text not null check (char_length(title) between 5 and 140),
  body        text check (char_length(body) <= 2000),
  created_by  uuid references public.profiles on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- consent and signatures ----------
create table public.consents (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles on delete cascade,
  kind         text not null check (kind in ('signatures')),
  text_version text not null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index consents_user_idx on public.consents (user_id) where revoked_at is null;

create table public.signatures (
  user_id     uuid not null references public.profiles on delete cascade,
  petition_id uuid not null references public.petitions on delete cascade,
  why         text check (char_length(why) <= 90),
  show_reason boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (user_id, petition_id)
);
create index signatures_petition_idx on public.signatures (petition_id, created_at);

create table public.follows (
  user_id     uuid not null references public.profiles on delete cascade,
  petition_id uuid not null references public.petitions on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, petition_id)
);

-- ---------- videos ----------
create table public.videos (
  id              uuid primary key default gen_random_uuid(),
  petition_id     uuid not null references public.petitions on delete cascade,
  uploader_id     uuid not null references public.profiles on delete cascade,
  storage_path    text not null,
  cover_path      text,
  caption         text not null check (char_length(caption) between 5 and 150),
  trim_start      numeric(7,2) not null default 0,
  trim_end        numeric(7,2) not null,
  blur_faces      boolean not null default true,
  audience        text not null default 'everyone' check (audience in ('everyone','friends')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  moderation_note text,
  created_at      timestamptz not null default now(),
  check (trim_end > trim_start and trim_end - trim_start <= 180)
);
create index videos_status_idx on public.videos (status, created_at desc);

create table public.reports (
  id          bigserial primary key,
  reporter_id uuid references public.profiles on delete set null,
  video_id    uuid references public.videos on delete cascade,
  petition_id uuid references public.petitions on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 500),
  created_at  timestamptz not null default now(),
  check (video_id is not null or petition_id is not null)
);

-- ---------- feed learning ----------
create table public.topic_weights (
  user_id uuid not null references public.profiles on delete cascade,
  topic   text not null,
  weight  real not null default 0,
  primary key (user_id, topic)
);

-- ---------- helpers ----------
create function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false)
$$;

create function public.has_signature_consent(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.consents where user_id = uid and kind = 'signatures' and revoked_at is null)
$$;

-- public totals; signatures themselves stay private
create view public.petition_stats as
select p.id,
       p.cluster_id,
       p.imported_count + coalesce(s.n, 0)                         as signatures,
       coalesce(s.last_hour, 0)                                     as last_hour,
       sum(p.imported_count + coalesce(s.n, 0)) over (partition by coalesce(p.cluster_id, p.id)) as combined,
       count(*) over (partition by coalesce(p.cluster_id, p.id))   as united_count
from public.petitions p
left join (
  select petition_id, count(*) as n,
         count(*) filter (where created_at > now() - interval '1 hour') as last_hour
  from public.signatures group by petition_id
) s on s.petition_id = p.id
where p.status in ('live','closed');

-- approved videos with the uploader's role on the petition
create view public.video_feed as
select v.id, v.petition_id, v.storage_path, v.cover_path, v.caption, v.trim_start, v.trim_end, v.blur_faces, v.created_at,
       pr.handle as uploader_handle,
       case when p.created_by = v.uploader_id then 'founder' else 'supporter' end as role,
       p.title as petition_title, p.topic, p.goal,
       st.combined, st.last_hour, st.united_count
from public.videos v
join public.petitions p on p.id = v.petition_id and p.status = 'live'
join public.profiles pr on pr.id = v.uploader_id
join public.petition_stats st on st.id = p.id
where v.status = 'approved' and v.audience = 'everyone';

-- ---------- actions (RPC) ----------
-- Sign: needs a confirmed email, active consent, a live petition and a free daily slot (10 per day).
create function public.sign_petition(p_petition uuid, p_why text default null, p_show_reason boolean default false)
returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today_count int; result bigint;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then raise exception 'email_not_confirmed'; end if;
  if not public.has_signature_consent(uid) then raise exception 'consent_required'; end if;
  if not exists (select 1 from public.petitions where id = p_petition and status = 'live') then raise exception 'petition_not_open'; end if;
  select count(*) into today_count from public.signatures where user_id = uid and created_at >= date_trunc('day', now());
  if today_count >= 10 then raise exception 'daily_limit_reached'; end if;

  insert into public.signatures (user_id, petition_id, why, show_reason)
  values (uid, p_petition, nullif(trim(p_why), ''), coalesce(p_show_reason, false) and nullif(trim(p_why), '') is not null)
  on conflict do nothing;
  insert into public.follows (user_id, petition_id) values (uid, p_petition) on conflict do nothing;

  select combined into result from public.petition_stats where id = p_petition;
  return result;
end $$;

create function public.give_signature_consent(p_text_version text) returns void
language sql security definer set search_path = public as $$
  insert into public.consents (user_id, kind, text_version)
  select auth.uid(), 'signatures', p_text_version
  where auth.uid() is not null and not public.has_signature_consent(auth.uid());
$$;

-- Withdrawing consent stops processing, so it also deletes every signature.
create function public.revoke_signature_consent() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.consents set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
  delete from public.signatures where user_id = auth.uid();
end $$;

create function public.friends_who_signed(p_petition uuid)
returns table (handle text, display_name text)
language sql stable security definer set search_path = public as $$
  select pr.handle, pr.display_name
  from public.friendships f
  join public.user_settings us on us.user_id = f.friend_id and us.share_signatures_with_friends
  join public.signatures s on s.user_id = f.friend_id
  join public.petitions p on p.id = s.petition_id and coalesce(p.cluster_id, p.id) = (select coalesce(cluster_id, id) from public.petitions where id = p_petition)
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  group by pr.handle, pr.display_name
  limit 20;
$$;

-- Feed learning: nudge one topic, fade the rest slightly.
create function public.record_signal(p_topic text, p_delta real) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.user_settings where user_id = auth.uid() and chronological_feed) then return; end if;
  update public.topic_weights set weight = weight * 0.985 where user_id = auth.uid();
  insert into public.topic_weights (user_id, topic, weight) values (auth.uid(), p_topic, greatest(-6, least(14, p_delta)))
  on conflict (user_id, topic) do update set weight = greatest(-6, least(14, public.topic_weights.weight + p_delta));
end $$;

-- founders are counted as the first signature and follow their own petition
create function public.founder_signs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.signatures (user_id, petition_id) values (new.created_by, new.id) on conflict do nothing;
    insert into public.follows (user_id, petition_id) values (new.created_by, new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger petitions_founder_signs after insert on public.petitions for each row execute function public.founder_signs();

-- ---------- row level security ----------
alter table public.profiles         enable row level security;
alter table public.user_settings    enable row level security;
alter table public.friendships      enable row level security;
alter table public.clusters         enable row level security;
alter table public.petitions        enable row level security;
alter table public.petition_updates enable row level security;
alter table public.consents         enable row level security;
alter table public.signatures       enable row level security;
alter table public.follows          enable row level security;
alter table public.videos           enable row level security;
alter table public.reports          enable row level security;
alter table public.topic_weights    enable row level security;

create policy "profiles are public"        on public.profiles for select using (true);
create policy "edit own profile"           on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_moderator = (select is_moderator from public.profiles where id = auth.uid()));

create policy "own settings"               on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own friendships"            on public.friendships for select using (user_id = auth.uid());

create policy "clusters are public"        on public.clusters for select using (true);

create policy "live petitions are public"  on public.petitions for select using (status in ('live','closed') or created_by = auth.uid() or public.is_moderator());
create policy "start a petition"           on public.petitions for insert with check (created_by = auth.uid() and status = 'pending' and origin = 'unite' and imported_count = 0 and cluster_id is null);
create policy "moderators manage petitions" on public.petitions for update using (public.is_moderator());

create policy "updates are public"         on public.petition_updates for select using (true);
create policy "founders post updates"      on public.petition_updates for insert with check (
  created_by = auth.uid() and exists (select 1 from public.petitions p where p.id = petition_id and p.created_by = auth.uid()));

create policy "own consents"               on public.consents for select using (user_id = auth.uid());

create policy "own signatures"             on public.signatures for select using (user_id = auth.uid());
create policy "withdraw own signature"     on public.signatures for delete using (user_id = auth.uid());
create policy "edit own reason"            on public.signatures for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own follows"                on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "approved videos are public" on public.videos for select using (status = 'approved' or uploader_id = auth.uid() or public.is_moderator());
-- founders post for their petition; everyone else must have signed it first
create policy "post a video"               on public.videos for insert with check (
  uploader_id = auth.uid() and status = 'pending' and moderation_note is null
  and (exists (select 1 from public.petitions p where p.id = petition_id and p.created_by = auth.uid())
    or exists (select 1 from public.signatures s where s.petition_id = videos.petition_id and s.user_id = auth.uid())));
create policy "delete own video"           on public.videos for delete using (uploader_id = auth.uid());
create policy "moderators review videos"   on public.videos for update using (public.is_moderator());

create policy "report anything"            on public.reports for insert with check (reporter_id = auth.uid());
create policy "moderators read reports"    on public.reports for select using (public.is_moderator());

create policy "own weights"                on public.topic_weights for select using (user_id = auth.uid());

-- ---------- storage: private video bucket ----------
-- Files live at videos/<user id>/<file>. Readable by the owner, moderators, or anyone once approved.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 524288000, array['video/mp4','video/quicktime','video/webm','image/jpeg'])
on conflict (id) do nothing;

create policy "upload own videos" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read approved or own videos" on storage.objects for select
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_moderator()
    or exists (select 1 from public.videos v where v.status = 'approved' and (v.storage_path = name or v.cover_path = name))));
