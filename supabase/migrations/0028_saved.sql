-- 0028: Saved petitions ("sign or share later").
-- A private bookmark list: only the person who saved a petition can see it. Nobody else, not even the organiser,
-- learns who saved what, and saves are never counted in public numbers. Re-runnable.

create table if not exists public.saved_petitions (
  user_id     uuid not null references public.profiles on delete cascade,
  petition_id uuid not null references public.petitions on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, petition_id)
);
create index if not exists saved_petitions_user_idx on public.saved_petitions (user_id, created_at desc);

alter table public.saved_petitions enable row level security;
drop policy if exists "own saved" on public.saved_petitions;
create policy "own saved" on public.saved_petitions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Guests have no list; signed-in people read, add and remove only their own rows.
revoke all on public.saved_petitions from public, anon;
grant select, insert, delete on public.saved_petitions to authenticated;
grant all on public.saved_petitions to service_role;

-- At most 500 saved petitions per person, so the list stays a list.
create or replace function public.saved_petitions_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_petitions where user_id = new.user_id) >= 500 then raise exception 'saved_limit'; end if;
  return new;
end $$;
revoke execute on function public.saved_petitions_cap() from public, anon, authenticated;
drop trigger if exists saved_petitions_cap on public.saved_petitions;
create trigger saved_petitions_cap before insert on public.saved_petitions for each row execute function public.saved_petitions_cap();
