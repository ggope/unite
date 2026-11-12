-- 0009: backend fixes found by the end-to-end checks.

-- Accounts made before the signup trigger existed (or while it was missing) had no profile or
-- settings row, so saving a name, signing and admin rights silently did nothing. Backfill them,
-- and let the app repair a missing row on its own.
insert into public.profiles (id) select u.id from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);
insert into public.user_settings (user_id) select p.id from public.profiles p where not exists (select 1 from public.user_settings s where s.user_id = p.id);

create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into profiles (id) values (auth.uid()) on conflict do nothing;
  insert into user_settings (user_id) values (auth.uid()) on conflict do nothing;
end $$;
revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

-- The petition list, the welcome page, news cards and admin all ask for "petitions with their
-- totals" (petitions → petition_stats). A view has no foreign key, so the API could not join them
-- and those lists came back empty. This tells the API how they relate (a computed relationship).
create or replace function public.petition_stats(public.petitions) returns setof public.petition_stats
rows 1 language sql stable as $$ select * from public.petition_stats s where s.id = $1.id $$;

-- "Reset what the feed learned" silently did nothing: people could read their weights but not delete them.
drop policy if exists "reset own weights" on public.topic_weights;
create policy "reset own weights" on public.topic_weights for delete using (user_id = auth.uid());
