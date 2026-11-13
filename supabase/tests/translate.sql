\set ON_ERROR_STOP on
-- 0026: automatic translations. Only the server claims and saves them; a moderator's translation always wins;
-- changed text drops the old machine translations; the daily limit holds.
reset role;
update public.site_settings set auto_translate = true;
create temp table t_p as select id from public.petitions where status = 'live' and lang = 'en' order by created_at limit 1;
grant select on t_p to anon, authenticated, service_role;
update public.petitions set tr = '{"hu": {"title": "Kézzel fordított cím"}}'::jsonb, mt_tried_at = null where id = (select id from t_p);

-- the constraint allows four full translations now
do $$ begin
  if exists (select 1 from pg_constraint where conrelid = 'public.petitions'::regclass and conname <> 'petitions_tr_check' and pg_get_constraintdef(oid) like '%octet_length(tr%') then raise exception 'old tr size check still there'; end if;
end $$;

-- nobody but the server may claim or save
set role anon;
do $$ begin perform public.mt_claim((select id from t_p)); raise exception 'anon claimed';
exception when insufficient_privilege then null; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin perform public.mt_save((select id from t_p), '{}'::jsonb); raise exception 'user saved a translation';
exception when insufficient_privilege then null; end $$;

set role service_role;
-- first claim wins, a second within 6 hours does not
do $$ begin
  if not public.mt_claim((select id from t_p)) then raise exception 'first claim refused'; end if;
  if public.mt_claim((select id from t_p)) then raise exception 'second claim accepted'; end if;
end $$;
-- pending petitions are not translated
do $$ begin if public.mt_claim((select id from public.petitions where status = 'pending' limit 1)) then raise exception 'pending claimed'; end if; end $$;
-- the daily limit
do $$ begin if public.mt_claim((select id from public.petitions where status = 'live' and id <> (select id from t_p) limit 1), 1) then raise exception 'daily limit ignored'; end if; end $$;

-- saving: own language, unknown languages, empty text and the moderator's Hungarian are skipped
do $$ declare n int; tr jsonb; begin
  n := public.mt_save((select id from t_p), '{
    "en": {"title": "Same language", "ask": "skip me please now"},
    "xx": {"title": "Unknown", "ask": "skip me please now"},
    "es": {"title": "", "ask": "no title"},
    "hu": {"title": "Gépi cím", "ask": "Gépi kérés"},
    "de": {"title": "Deutscher Titel", "target": "Minister", "ask": "Bitte tut das", "why": "Weil es wichtig ist", "evil": "x"},
    "fr": {"title": "Titre", "target": "", "ask": "Faites-le"}}'::jsonb);
  select p.tr into tr from public.petitions p where id = (select id from t_p);
  if n <> 2 then raise exception 'saved % languages, expected 2: %', n, tr; end if;
  if tr->'hu'->>'title' <> 'Kézzel fordított cím' or tr->'hu' ? 'auto' then raise exception 'moderator translation overwritten: %', tr; end if;
  if tr->'de'->>'auto' <> 'true' or tr->'de'->>'why' <> 'Weil es wichtig ist' or tr->'de' ? 'evil' then raise exception 'de wrong: %', tr; end if;
  if tr->'fr' ? 'target' or tr ? 'en' or tr ? 'xx' or tr ? 'es' then raise exception 'saved what it should skip: %', tr; end if;
end $$;

-- a machine translation can be refreshed
do $$ begin perform public.mt_save((select id from t_p), '{"de": {"title": "Neuer Titel", "ask": "Neu"}}'::jsonb);
  if (select tr->'de'->>'title' from public.petitions where id = (select id from t_p)) <> 'Neuer Titel' then raise exception 'machine translation not refreshed'; end if; end $$;

-- changed text drops machine translations (and allows a new try), but keeps the moderator's
reset role;
update public.petitions set ask = ask || ' Now with more detail.' where id = (select id from t_p);
do $$ declare r record; begin
  select tr, mt_tried_at into r from public.petitions where id = (select id from t_p);
  if r.tr ? 'de' or r.tr ? 'fr' or not r.tr ? 'hu' or r.mt_tried_at is not null then raise exception 'reset wrong: %', r.tr; end if;
end $$;
-- other changes (like the signature count or status) keep them
set role service_role;
do $$ begin perform public.mt_save((select id from t_p), $j${"de": {"title": "Deutscher Titel", "ask": "Bitte"}}$j$::jsonb); end $$;
reset role;
update public.petitions set region = region where id = (select id from t_p);
do $$ begin if not (select tr ? 'de' from public.petitions where id = (select id from t_p)) then raise exception 'unrelated update dropped translations'; end if; end $$;

-- the switch: off means no claims; only moderators flip it
update public.petitions set mt_tried_at = null;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
update public.site_settings set auto_translate = false;
reset role;
do $$ begin if not (select auto_translate from public.site_settings) then raise exception 'non-moderator switched translations off'; end if; end $$;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
update public.site_settings set auto_translate = false;
set role service_role;
do $$ begin if public.mt_claim((select id from t_p)) then raise exception 'claimed while switched off'; end if; end $$;

reset role;
update public.site_settings set auto_translate = true;
update public.petitions set tr = '{}'::jsonb, mt_tried_at = null where id = (select id from t_p);
drop table t_p;
