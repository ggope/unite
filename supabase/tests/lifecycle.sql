\set ON_ERROR_STOP on
-- 0018: end dates, days without an answer, appeals
reset role;
update public.profiles set is_moderator = true where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set is_moderator = false where id = '22222222-2222-2222-2222-222222222222';
update public.petitions set created_by = '22222222-2222-2222-2222-222222222222', status = 'live', ends_on = null where title like 'Protected seas%';
update public.petitions set created_by = '22222222-2222-2222-2222-222222222222', status = 'live', ends_on = null where title like 'Ban live facial%';

-- 1. end dates: only in the future and within a year; only the organiser or a moderator sets them
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin perform public.set_end_date((select id from public.petitions where title like 'Protected seas%'), public.unier_today() + 5); raise exception 'stranger set an end date';
exception when others then if sqlerrm <> 'not_allowed' then raise; end if; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin perform public.set_end_date((select id from public.petitions where title like 'Protected seas%'), public.unier_today()); raise exception 'end date today accepted';
exception when others then if sqlerrm <> 'end_date_past' then raise; end if; end $$;
do $$ begin perform public.set_end_date((select id from public.petitions where title like 'Protected seas%'), public.unier_today() + 400); raise exception 'end date far away accepted';
exception when others then if sqlerrm <> 'end_date_far' then raise; end if; end $$;
select public.set_end_date((select id from public.petitions where title like 'Protected seas%'), public.unier_today() + 5);
do $$ begin if (select ends_on from public.petitions where title like 'Protected seas%') <> public.unier_today() + 5 then raise exception 'end date not saved'; end if; end $$;
do $$ begin perform public.run_lifecycle(); raise exception 'anyone ran the daily job';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.run_lifecycle_now(); raise exception 'non-moderator ran the daily job';
exception when others then if sqlerrm <> 'not_moderator' then raise; end if; end $$;

-- the end date passes: nobody can sign, even before the daily job runs
reset role;
alter table public.petitions disable trigger petition_lifecycle;
update public.petitions set ends_on = public.unier_today() - 1 where title like 'Protected seas%';
alter table public.petitions enable trigger petition_lifecycle;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
do $$ begin
  insert into public.signatures (user_id, petition_id) values ('44444444-4444-4444-4444-444444444444', (select id from public.petitions where title like 'Protected seas%'));
  raise exception 'signed after the end date';
exception when others then if sqlerrm <> 'petition_not_open' and sqlstate <> '42501' then raise; end if; end $$;

-- the daily job closes it, tells followers once and nudges the organiser to deliver
reset role;
select public.run_lifecycle();
do $$ declare p public.petitions; begin
  select * into p from public.petitions where title like 'Protected seas%';
  if p.status <> 'closed' or p.closed_at is null then raise exception 'not closed: %', p.status; end if;
  if (select count(*) from public.push_events where petition_id = p.id and kind = 'closed') <> 1 then raise exception 'followers not told'; end if;
  if (select count(*) from public.notices where petition_id = p.id and kind = 'deliver_nudge' and user_id = p.created_by) <> 1 then raise exception 'organiser not nudged'; end if;
  if (select status from public.petitions where title like 'Ban live facial%') <> 'live' then raise exception 'closed a petition without an end date'; end if;
end $$;
-- running it again changes nothing; a week later comes one more reminder, then none
select public.run_lifecycle();
do $$ begin if (select count(*) from public.notices where kind = 'deliver_nudge') <> 1 or (select count(*) from public.push_events where kind = 'closed') <> 1 then raise exception 'repeated'; end if; end $$;
update public.petitions set delivery_nudged_at = now() - interval '8 days' where title like 'Protected seas%';
select public.run_lifecycle();
do $$ begin if (select delivery_nudges from public.petitions where title like 'Protected seas%') <> 2 then raise exception 'no second reminder'; end if;
  if (select count(*) from public.notices where kind = 'deliver_nudge') <> 1 then raise exception 'old reminder kept'; end if; end $$;
update public.petitions set delivery_nudged_at = now() - interval '30 days' where title like 'Protected seas%';
select public.run_lifecycle();
do $$ begin if (select delivery_nudges from public.petitions where title like 'Protected seas%') <> 2 then raise exception 'reminded forever'; end if; end $$;
-- a moderator reopens it: the old end date is cleared, so it does not close again tonight
update public.petitions set status = 'live' where title like 'Protected seas%';
do $$ begin if (select ends_on from public.petitions where title like 'Protected seas%') is not null or (select closed_at from public.petitions where title like 'Protected seas%') is not null then raise exception 'reopen kept the old end'; end if; end $$;

-- 2. days without an answer: followers hear at 30 days, once
insert into public.petition_updates (petition_id, kind, title, created_by, created_at)
select id, 'delivered', 'Delivered to the minister', created_by, now() - interval '31 days' from public.petitions where title like 'Ban live facial%';
select public.run_lifecycle();
select public.run_lifecycle();
do $$ begin if (select count(*) from public.push_events e join public.petitions p on p.id = e.petition_id where p.title like 'Ban live facial%' and e.kind = 'silent' and e.title = '30') <> 1 then raise exception 'silence not told once'; end if; end $$;
-- the board counts the same days
do $$ begin if not exists (select 1 from public.accountability() where silent_days >= 31) then raise exception 'board missing silence'; end if; end $$;

-- 3. appeals
-- a moderator removes the organiser's petition with a reason; the decision is remembered
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
update public.petitions set status = 'removed', moderation_note = 'Names a private person' where title like 'Ban live facial%';
do $$ begin if (select moderated_by from public.petitions where title like 'Ban live facial%') <> '11111111-1111-1111-1111-111111111111' then raise exception 'decision maker not kept'; end if; end $$;

-- only the author appeals, with words, once
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin perform public.file_appeal('petition', (select id::text from public.petitions where title like 'Ban live facial%'), 'This is my appeal text'); raise exception 'stranger appealed';
exception when others then if sqlerrm <> 'not_found' then raise; end if; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin perform public.file_appeal('petition', (select id::text from public.petitions where title like 'Ban live facial%'), 'short'); raise exception 'empty appeal';
exception when others then if sqlerrm <> 'bad_body' then raise; end if; end $$;
do $$ begin perform public.file_appeal('petition', 'nonsense', 'This is my appeal text'); raise exception 'bad id accepted';
exception when others then if sqlerrm <> 'not_found' then raise; end if; end $$;
do $$ begin perform public.file_appeal('petition', (select id::text from public.petitions where title like 'Sick pay%'), 'This one was never removed'); raise exception 'appealed a live petition';
exception when others then if sqlerrm <> 'not_found' then raise; end if; end $$;
select public.file_appeal('petition', (select id::text from public.petitions where title like 'Ban live facial%'), 'The person named is a public minister, not a private person.');
do $$ begin perform public.file_appeal('petition', (select id::text from public.petitions where title like 'Ban live facial%'), 'And once more, please look again.'); raise exception 'appealed twice';
exception when others then if sqlerrm <> 'already_appealed' then raise; end if; end $$;
do $$ begin if (select decision from public.appeals where kind = 'petition') <> 'Names a private person' then raise exception 'decision not kept'; end if; end $$;
-- people cannot write appeals directly, decide their own, or read other people's
do $$ begin update public.appeals set status = 'reversed'; raise exception 'author changed an appeal';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.decide_appeal((select id from public.appeals limit 1), true, 'ok'); raise exception 'author decided';
exception when others then if sqlerrm <> 'not_moderator' then raise; end if; end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
do $$ begin if exists (select 1 from public.appeals) then raise exception 'saw someone else''s appeal'; end if; end $$;

-- a moderator reverses it with a reason: the petition is back and the author is told
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin perform public.decide_appeal((select id from public.appeals where kind = 'petition'), true, ' '); raise exception 'decided without a reason';
exception when others then if sqlerrm <> 'reason_required' then raise; end if; end $$;
select public.decide_appeal((select id from public.appeals where kind = 'petition'), true, 'You are right: the minister is a public figure.');
do $$ begin perform public.decide_appeal((select id from public.appeals where kind = 'petition'), false, 'Again'); raise exception 'decided twice';
exception when others then if sqlerrm <> 'not_open' then raise; end if; end $$;
reset role;
do $$ begin
  if (select status from public.petitions where title like 'Ban live facial%') <> 'live' then raise exception 'petition not restored'; end if;
  if (select status from public.appeals where kind = 'petition') <> 'reversed' then raise exception 'appeal not marked'; end if;
  if not exists (select 1 from public.notices where user_id = '22222222-2222-2222-2222-222222222222' and kind = 'appeal_reversed') then raise exception 'author not told'; end if;
end $$;

-- a hidden reason: appealed through the notice, kept hidden, author told
insert into public.signatures (user_id, petition_id, why, show_reason)
select '44444444-4444-4444-4444-444444444444', id, 'A reason someone reported', true from public.petitions where title like 'Sick pay%'
on conflict (user_id, petition_id) do update set why = excluded.why, show_reason = true;
select set_config('t.rk', (select reason_key::text from public.signatures where why = 'A reason someone reported'), false);
set role authenticated;
select public.hide_reason(current_setting('t.rk')::uuid, 'Insults a group');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
select public.file_appeal('reason', (select id::text from public.notices where kind = 'reason_hidden' and user_id = auth.uid() order by id desc limit 1), 'It does not insult anyone, please read it again.');
do $$ begin perform public.file_appeal('profile', (select id::text from public.notices where kind = 'reason_hidden' and user_id = auth.uid() order by id desc limit 1), 'Wrong kind of notice used here.'); raise exception 'wrong notice kind accepted';
exception when others then if sqlerrm <> 'not_found' then raise; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select public.decide_appeal((select id from public.appeals where kind = 'reason'), false, 'It names a group in a hurtful way.');
reset role;
do $$ begin
  if not (select reason_hidden from public.signatures where why = 'A reason someone reported') then raise exception 'reason shown after upheld'; end if;
  if not exists (select 1 from public.notices where user_id = '44444444-4444-4444-4444-444444444444' and kind = 'appeal_upheld') then raise exception 'not told'; end if;
end $$;
-- too late after 6 months
update public.notices set created_at = now() - interval '7 months' where kind = 'reason_hidden';
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
do $$ begin perform public.file_appeal('reason', (select id::text from public.notices where kind = 'reason_hidden' and user_id = auth.uid() order by id desc limit 1), 'Trying again much later on.'); raise exception 'late appeal accepted';
exception when others then if sqlerrm not in ('too_late', 'already_appealed') then raise; end if; end $$;
-- public numbers, no names
set role anon;
do $$ declare j json := public.appeal_stats(); begin
  if (j->>'filed_12m')::int <> 2 or (j->>'reversed_12m')::int <> 1 or (j->>'upheld_12m')::int <> 1 then raise exception 'stats wrong: %', j; end if; end $$;
reset role;
select 'lifecycle tests passed';
