\set ON_ERROR_STOP on
-- 0024: AI moderation. Only moderators read what the AI said; only the server writes it; the public sees totals.
reset role;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set is_moderator = false where id = '22222222-2222-2222-2222-222222222222';
insert into public.ai_reviews (kind, petition_id, verdict, risk, confidence, rules, summary, action)
select 'petition', id, 'ok', 'low', 0.9, '{}', 'Looks fine.', 'approved' from public.petitions limit 1;
insert into public.ai_reviews (kind, petition_id, verdict, risk, confidence, rules, summary, author_note)
select 'petition', id, 'breaks_rules', 'high', 0.7, '{hate}', 'Attacks a group.', 'This attacks a group of people.' from public.petitions offset 1 limit 1;

-- a review points at exactly one thing, of its own kind
do $$ begin insert into public.ai_reviews (kind, video_id, verdict) values ('petition', null, 'ok'); raise exception 'review without a target';
exception when check_violation then null; end $$;
do $$ begin insert into public.ai_reviews (kind, petition_id, verdict, confidence) select 'petition', id, 'ok', 1.5 from public.petitions limit 1; raise exception 'confidence above 1';
exception when check_violation then null; end $$;

-- the mode: default 'suggest', only known values
do $$ begin if (select ai_moderation from public.site_settings) <> 'suggest' then raise exception 'default mode is not suggest'; end if; end $$;
do $$ begin update public.site_settings set ai_moderation = 'yolo'; raise exception 'unknown mode accepted';
exception when check_violation then null; end $$;

-- people who are not moderators see nothing and change nothing
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if (select count(*) from public.ai_reviews) <> 0 then raise exception 'non-moderator reads ai reviews'; end if; end $$;
do $$ begin insert into public.ai_reviews (kind, petition_id, verdict) select 'petition', id, 'ok' from public.petitions limit 1; raise exception 'user wrote an ai review';
exception when insufficient_privilege then null; end $$;
update public.site_settings set ai_moderation = 'off';
reset role;
do $$ begin if (select ai_moderation from public.site_settings) <> 'suggest' then raise exception 'non-moderator changed the mode'; end if; end $$;

-- moderators read the reviews and switch the mode
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin if (select count(*) from public.ai_reviews) <> 2 then raise exception 'moderator cannot read ai reviews'; end if; end $$;
update public.site_settings set ai_moderation = 'auto';
do $$ begin if (select ai_moderation from public.site_settings) <> 'auto' then raise exception 'moderator could not change the mode'; end if; end $$;

-- the public sees totals only
set role anon;
do $$ declare s json := public.ai_stats(); begin
  if (s->>'checked_30d')::int <> 2 or (s->>'approved_30d')::int <> 1 or (s->>'to_people_30d')::int <> 1 or s->>'mode' <> 'auto' then raise exception 'ai_stats wrong: %', s; end if;
end $$;
do $$ begin perform 1 from public.ai_reviews; raise exception 'anon reads ai reviews';
exception when insufficient_privilege then null; end $$;

reset role;
update public.site_settings set ai_moderation = 'suggest';
delete from public.ai_reviews;
