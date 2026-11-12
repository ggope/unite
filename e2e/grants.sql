-- Supabase's default privileges: the API roles may touch every table, and row level security decides.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant usage on schema auth to authenticated, service_role;
grant select on auth.users to service_role;
