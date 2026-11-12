-- Give the website's database roles access to the tables again.
-- Some Supabase projects no longer hand out table access automatically to tables made in the SQL editor,
-- which caused "permission denied for table profiles" when saving settings.
-- Every table has row level security switched on, so the rules in the earlier files still decide
-- who may read or change which rows. Functions are left alone on purpose.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- and for tables added later
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
