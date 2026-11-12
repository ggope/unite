\set ON_ERROR_STOP on
-- 0016: answer links, popular in a country, open numbers
reset role;
update public.petitions set created_by = '11111111-1111-1111-1111-111111111111', status = 'live' where title like 'Sick pay%';

-- 1. only the organiser (or a moderator) can make an answer link
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin perform public.make_answer_link((select id from public.petitions where title like 'Sick pay%')); raise exception 'stranger made a link';
exception when others then if sqlerrm <> 'not_allowed' then raise; end if; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ declare a text := public.make_answer_link((select id from public.petitions where title like 'Sick pay%'));
  b text := public.make_answer_link((select id from public.petitions where title like 'Sick pay%'));
begin
  if a = b or length(b) < 20 then raise exception 'links not fresh'; end if;
  perform set_config('t.old', a, false); perform set_config('t.tok', b, false);
end $$;
-- people cannot fake an official answer or read the links
do $$ begin insert into public.petition_updates (petition_id, kind, title, created_by, via_link)
  values ((select id from public.petitions where title like 'Sick pay%'), 'response', 'Fake official answer', auth.uid(), true);
  raise exception 'faked via_link';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.answer_links; raise exception 'read answer links';
exception when insufficient_privilege then null; end $$;

-- 2. the target answers without an account; the old link no longer works
set role anon;
do $$ begin if public.answer_info(current_setting('t.old')) is not null then raise exception 'old link still works'; end if;
  if public.answer_info('nonsense') is not null then raise exception 'any link works'; end if;
  if public.answer_info(current_setting('t.tok'))->>'title' not like 'Sick pay%' then raise exception 'info wrong'; end if; end $$;
do $$ begin perform public.post_answer(current_setting('t.tok'), 'A', 'Minister', 'We will look at this very carefully.'); raise exception 'short name accepted';
exception when others then if sqlerrm <> 'bad_name' then raise; end if; end $$;
do $$ begin perform public.post_answer(current_setting('t.tok'), 'Anna Kovacs', 'Minister', 'No.'); raise exception 'short answer accepted';
exception when others then if sqlerrm <> 'bad_body' then raise; end if; end $$;
select public.post_answer(current_setting('t.tok'), 'Anna Kovacs', 'Minister of Labour', 'We will bring a sick pay rule to parliament in spring.');
do $$ begin if not exists (select 1 from public.petition_updates where via_link and kind = 'response' and title = 'Anna Kovacs, Minister of Labour') then raise exception 'answer missing'; end if;
  if (public.answer_info(current_setting('t.tok'))->>'answers')::int <> 1 then raise exception 'answer not counted'; end if; end $$;
select public.post_answer(current_setting('t.tok'), 'Anna Kovacs', 'Minister of Labour', 'A second note with more detail for everyone.');
select public.post_answer(current_setting('t.tok'), 'Anna Kovacs', 'Minister of Labour', 'A third note with more detail for everyone.');
do $$ begin perform public.post_answer(current_setting('t.tok'), 'Anna Kovacs', 'Minister of Labour', 'A fourth note with more detail for everyone.'); raise exception 'no daily limit';
exception when others then if sqlerrm <> 'slow_down' then raise; end if; end $$;
do $$ begin perform public.make_answer_link((select id from public.petitions where title like 'Sick pay%')); raise exception 'anon made a link';
exception when insufficient_privilege then null; end $$;

-- 3. popular in a country: by region name, and only from 3 signers; counts under 10 stay hidden
reset role;
update public.petitions set region = 'Hungary' where title like 'Sick pay%';
set role anon;
do $$ declare r record; begin
  select * into r from public.popular_in('HU', array['Hungary', 'Magyarország']) where petition_id = (select id from public.petitions where title like 'Sick pay%');
  if r.petition_id is null then raise exception 'region match missing'; end if;
  if r.n is not null then raise exception 'small count leaked'; end if;
  if not exists (select 1 from public.popular_in('HU', array['xx']) where n >= 10) then raise exception 'big count missing'; end if; end $$;
reset role;
do $$ begin if exists (select 1 from public.popular_in('HU', array['xx']) x where (select count(*) from public.signatures s where s.petition_id = x.petition_id and s.country = 'HU') < 3) then raise exception 'matched without signers'; end if; end $$;
update public.petitions set region = 'Worldwide' where title like 'Sick pay%';

-- 4. open numbers leave out small countries
do $$ begin if exists (select 1 from public.country_totals() where signatures < 10) then raise exception 'small country listed'; end if; end $$;

-- 5. shown reasons: only those people chose to show, never with links, and no names
insert into public.signatures (user_id, petition_id, why, show_reason)
select '44444444-4444-4444-4444-444444444444', id, 'My mum is a courier', true from public.petitions where title like 'End bottom%' on conflict do nothing;
update public.signatures set why = 'Private reason', show_reason = false where user_id = '33333333-3333-3333-3333-333333333333' and petition_id = (select id from public.petitions where title like 'End bottom%');
set role anon;
do $$ declare w text[]; begin
  select array_agg(why) into w from public.public_reasons((select id from public.petitions where title like 'End bottom%'));
  if not 'My mum is a courier' = any(w) then raise exception 'shown reason missing: %', w; end if;
  if 'Private reason' = any(coalesce(w, '{}')) then raise exception 'private reason shown'; end if; end $$;
reset role;
select 'answers tests passed';
