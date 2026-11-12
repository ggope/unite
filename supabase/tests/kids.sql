\set ON_ERROR_STOP on
-- 0019: easy-read text is public, only moderators write it, and the shape is checked
reset role;
update public.profiles set is_moderator = false where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set is_moderator = true  where id = '11111111-1111-1111-1111-111111111111';
create temp table kid_p as select id from public.petitions where status = 'live' order by created_at limit 1;
grant select on kid_p to authenticated, anon;

-- a moderator writes it
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
update public.petitions set easy = '{"en": {"title": "Clean seas", "text": "Fish need clean water."}}' where id = (select id from kid_p);
do $$ begin if (select easy->'en'->>'title' from public.petitions where id = (select id from kid_p)) <> 'Clean seas' then raise exception 'moderator could not write easy-read'; end if; end $$;

-- someone else cannot change it
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
update public.petitions set easy = '{"en": {"title": "Hacked", "text": "x"}}' where id = (select id from kid_p);

-- anyone can read it, and the kids corner finds it
set role anon;
select set_config('request.jwt.claim.sub','', false);
do $$ begin
  if (select easy->'en'->>'title' from public.petitions where id = (select id from kid_p)) <> 'Clean seas' then raise exception 'easy-read changed by a non-moderator or not public'; end if;
  if not exists (select 1 from public.petitions where status = 'live' and easy <> '{}'::jsonb) then raise exception 'kids corner query finds nothing'; end if;
end $$;

-- the shape is checked
reset role;
do $$ begin
  update public.petitions set easy = '[]' where id = (select id from kid_p);
  raise exception 'easy-read accepted an array';
exception when check_violation then null; end $$;
update public.petitions set easy = '{}' where id = (select id from kid_p);
