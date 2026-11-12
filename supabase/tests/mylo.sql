\set ON_ERROR_STOP on
-- 0008: Mylo's mood comes from public totals only, and anyone can read it
reset role;
do $$ begin
  if public.news_tone('War spreads as missiles hit the capital') <> -1 then raise exception 'grim headline not grim'; end if;
  if public.news_tone('Árvíz sújtja a falut') <> -1 then raise exception 'hungarian grim headline not grim'; end if;
  if public.news_tone('Activists win as forest is protected') <> 1 then raise exception 'hopeful headline not hopeful'; end if;
  if public.news_tone('Parliament meets on Tuesday') <> 0 then raise exception 'neutral headline not neutral'; end if;
  if public.news_tone('Award for the Swedish film') <> 0 then raise exception 'word boundary missed (sword/award)'; end if;
end $$;

set role anon;
do $$ declare r json := public.mylo_today(); begin
  if r->>'mood' not in ('worried','cheering','happy','fired','calm','scared','sad','sick','sleepy','growing') then raise exception 'bad mood: %', r; end if;
  if (r->>'future')::int not between 5 and 100 then raise exception 'future out of range: %', r; end if;
  if r::text ~ 'user_id|email' then raise exception 'mylo leaks people: %', r; end if;
end $$;
-- anon cannot pin goals
do $$ begin perform public.set_featured((select id from public.petitions limit 1), true); raise exception 'anon pinned a goal';
exception when insufficient_privilege then null; end $$;
reset role;

-- a win in the last day makes him cheer, and pinned petitions come first among goals
insert into public.petition_updates (petition_id, kind, title)
values ((select id from public.petitions where status = 'live' order by created_at limit 1), 'win', 'We won the vote today');
update public.petitions set featured = true where id = (select id from public.petitions where status = 'live' order by created_at desc limit 1);
do $$ declare r json := public.mylo_today(); begin
  if r->>'mood' <> 'cheering' then raise exception 'win should cheer: %', r->>'mood'; end if;
  if (r->'goals'->0->>'featured')::boolean is not true then raise exception 'featured goal not first: %', r->'goals'; end if;
end $$;

-- grim news (most stories) makes him sick once the win is older than a day
update public.petition_updates set created_at = now() - interval '3 days' where title = 'We won the vote today';
insert into public.news_sources (id, name, feed_url, lang) values ('t', 'Test', 'https://t.example/rss', 'en') on conflict do nothing;
insert into public.news_items (source_id, url, title, lang, topic, story_key, published_at)
select 't', 'https://t.example/' || g, (array['Floods kill dozens','War escalates overnight','Wildfire forces evacuations','Recession fears grow','Local bakery opens'])[g], 'en', 'climate', gen_random_uuid(), now()
from generate_series(1, 5) g;
do $$ declare r json := public.mylo_today(); begin
  if r->>'mood' <> 'sick' then raise exception 'grim news should make him sick: % %', r->>'mood', r; end if;
  if json_array_length(r->'grim_headlines') <> 3 then raise exception 'expected 3 grim headlines: %', r->'grim_headlines'; end if;
end $$;
select 'mylo tests passed' as result;
