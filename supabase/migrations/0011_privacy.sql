-- Make the backend keep the promises in the privacy policy.

-- 1. You can see the reports you sent (for "Download my data"). Moderators already see all reports.
drop policy if exists "own reports" on public.reports;
create policy "own reports" on public.reports for select using (reporter_id = auth.uid());

-- 2. Automatic clean-up, run once a day by the scheduled job (service role only).
--    The privacy policy states these periods; change both together.
create or replace function public.run_retention() returns json
language plpgsql security definer set search_path = public as $$
declare r int; f int; n int;
begin
  -- moderation records: 12 months after they were resolved
  delete from reports where status = 'resolved' and resolved_at < now() - interval '12 months';
  get diagnostics r = row_count;
  -- friend requests nobody answered: 90 days
  delete from friend_requests where created_at < now() - interval '90 days';
  get diagnostics f = row_count;
  -- old headlines that no petition uses (not personal data, keeps the table small): 180 days
  delete from news_items where petition_id is null and published_at < now() - interval '180 days';
  get diagnostics n = row_count;
  return json_build_object('reports', r, 'friend_requests', f, 'news_items', n);
end $$;
revoke execute on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;
