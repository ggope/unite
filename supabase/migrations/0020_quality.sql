-- 0020: quality check (security, speed). Safe to run more than once.
--  1. Petition totals no longer count every signature on the site each time a page asks for one number.
--     A small counter per petition is kept up to date as people sign or withdraw. Same numbers, same columns.
--     Works before or after 0021 (signing with only an email): either way, email signatures are counted.
--  2. Missing indexes for the pages added lately (updates, wins, followers, videos, "popular in your country").
--  3. Updates of a petition that is still waiting for review, or was removed, are no longer readable by anyone
--     through the API. The organiser and moderators still see them.

-- ---------- 1. signature counter ----------
create table if not exists public.petition_counts (
  petition_id uuid primary key references public.petitions on delete cascade,
  n           bigint not null default 0
);
alter table public.petition_counts enable row level security;
revoke all on public.petition_counts from anon, authenticated;   -- read only through petition_stats
grant all on public.petition_counts to service_role;

create or replace function public.count_signature() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.petition_counts (petition_id, n) values (new.petition_id, 1)
    on conflict (petition_id) do update set n = petition_counts.n + 1;
  elsif tg_op = 'DELETE' then
    update public.petition_counts set n = greatest(n - 1, 0) where petition_id = old.petition_id;
  end if;
  return null;
end $$;
revoke execute on function public.count_signature() from public, anon, authenticated;

-- People who signed with only an email (0021, if it has run already) count too; 0021 keeps them counted after that.
create or replace function public.email_signed(p_petition uuid, p_since timestamptz default null) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare n bigint;
begin
  if to_regclass('public.email_signatures') is null then return 0; end if;
  execute 'select count(*) from public.email_signatures where petition_id = $1 and confirmed_at is not null and ($2 is null or confirmed_at > $2)'
    into n using p_petition, p_since;
  return n;
end $$;
-- The totals view calls it for whoever reads the totals; it only returns a count that is public anyway.
revoke execute on function public.email_signed(uuid, timestamptz) from public;
grant execute on function public.email_signed(uuid, timestamptz) to anon, authenticated;

-- Nobody can sign while the counter is filled, so it starts exactly right.
do $$ begin
  lock table public.signatures in share row exclusive mode;
  if to_regclass('public.email_signatures') is not null then execute 'lock table public.email_signatures in share row exclusive mode'; end if;
  drop trigger if exists count_signature on public.signatures;
  create trigger count_signature after insert or delete on public.signatures for each row execute function public.count_signature();
  insert into public.petition_counts (petition_id, n)
  select p.id, (select count(*) from public.signatures s where s.petition_id = p.id) + public.email_signed(p.id)
  from public.petitions p
  on conflict (petition_id) do update set n = excluded.n;
end $$;

-- Same columns and types as before, but asking for one petition now reads only that petition (and its united group).
create or replace view public.petition_stats as
select p.id,
       p.cluster_id,
       p.imported_count + coalesce(c.n, 0) as signatures,
       (select count(*) from public.signatures s where s.petition_id = p.id and s.created_at > now() - interval '1 hour')
         + public.email_signed(p.id, now() - interval '1 hour') as last_hour,
       case when p.cluster_id is null then (p.imported_count + coalesce(c.n, 0))::numeric
            else (select sum(q.imported_count + coalesce(qc.n, 0)) from public.petitions q
                  left join public.petition_counts qc on qc.petition_id = q.id
                  where q.cluster_id = p.cluster_id and q.status in ('live', 'closed')) end as combined,
       case when p.cluster_id is null then 1::bigint
            else (select count(*) from public.petitions q where q.cluster_id = p.cluster_id and q.status in ('live', 'closed')) end as united_count
from public.petitions p
left join public.petition_counts c on c.petition_id = p.id
where p.status in ('live', 'closed');

-- ---------- 2. indexes ----------
create index if not exists petition_updates_petition_idx on public.petition_updates (petition_id, created_at desc);
create index if not exists petition_updates_kind_idx on public.petition_updates (kind, petition_id);
create index if not exists follows_petition_idx on public.follows (petition_id);
create index if not exists videos_petition_idx on public.videos (petition_id);
create index if not exists signatures_country_idx on public.signatures (country, petition_id) where country is not null;
create index if not exists petitions_status_idx on public.petitions (status, created_at desc);
create index if not exists reports_open_idx on public.reports (created_at) where status = 'open';

-- ---------- 3. updates follow the petition's visibility ----------
-- The check reads petitions under their own rules: public once live or closed, otherwise the organiser and moderators.
drop policy if exists "updates are public" on public.petition_updates;
create policy "updates are public" on public.petition_updates for select
  using (exists (select 1 from public.petitions p where p.id = petition_id));
