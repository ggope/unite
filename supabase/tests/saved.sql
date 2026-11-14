\set ON_ERROR_STOP on
-- 0028: saved petitions are private to the person who saved them
reset role;
delete from public.saved_petitions;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
insert into public.saved_petitions (user_id, petition_id) select '11111111-1111-1111-1111-111111111111', id from public.petitions where status = 'live' limit 2;
do $$ begin if (select count(*) from public.saved_petitions) <> 2 then raise exception 'own saves not visible'; end if; end $$;
-- nobody saves for someone else
do $$ begin insert into public.saved_petitions (user_id, petition_id) select '22222222-2222-2222-2222-222222222222', id from public.petitions limit 1; raise exception 'saved for another person';
exception when insufficient_privilege then null; end $$;
-- B sees none of A's saves and cannot remove them
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if (select count(*) from public.saved_petitions) <> 0 then raise exception 'saves leak to other people'; end if; end $$;
delete from public.saved_petitions;
-- guests cannot read the table at all
set role anon;
do $$ begin perform 1 from public.saved_petitions; raise exception 'guest read saves'; exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin if (select count(*) from public.saved_petitions) <> 2 then raise exception 'another person removed saves'; end if; end $$;
-- A can remove their own
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
delete from public.saved_petitions;
reset role;
do $$ begin if (select count(*) from public.saved_petitions) <> 0 then raise exception 'own saves not removable'; end if; end $$;
