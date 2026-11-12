-- Table access comes from supabase/migrations/0010_grants.sql, so the tests check that file too.
grant usage on schema auth to authenticated, service_role;
grant select on auth.users to service_role;
