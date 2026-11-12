-- 0008: Mylo, the baby orange. His mood each day comes from real, public totals:
-- how many people signed in the last 24 hours compared with the usual day, wins and near-wins,
-- and how grim today's big news stories are. Only totals are used; no signature is ever exposed.
-- Moderators can also pin petitions as "big community goals" (featured), shown on the Mylo page.

alter table public.petitions add column featured boolean not null default false;
create index signatures_created_idx on public.signatures (created_at);

-- Words that make a headline grim or hopeful (English and Hungarian). Simple on purpose: Mylo
-- reads the room, he does not judge single stories.
create or replace function public.news_tone(p_title text) returns int
language sql immutable as $$
  select case
    when p_title ~* '\m(war|wars|killed|kills|killing|dead|death|deaths|dies|died|attack|attacks|bomb|bombing|shooting|massacre|famine|flood|floods|flooding|wildfire|wildfires|earthquake|hurricane|crisis|collapse|drought|heatwave|invasion|hostage|hostages|genocide|refugees|layoffs|recession|pollution|toxic|outbreak|epidemic|pandemic|crackdown|censorship|violence|abuse|starvation|casualties|missile|missiles|airstrike|airstrikes)\M'
      or p_title ~* '(háború|halott|meghalt|halál|támadás|bomba|lövöldözés|árvíz|erdőtűz|földrengés|válság|aszály|hőhullám|menekült|leépítés|szennyez|járvány|letartóztat|erőszak|cenzúra|éhínség|rakéta|légicsapás)'
      then -1
    when p_title ~* '\m(win|wins|won|victory|agreement|deal|protected|saved|rescued|breakthrough|cure|approved|peace|ceasefire|recovery|restored|record low|reunited|freed|released)\M'
      or p_title ~* '(győz|megállapodás|béke|tűzszünet|megment|védett|áttörés|jóváhagy|kiszabadul|helyreáll)'
      then 1
    else 0 end
$$;

create or replace function public.mylo_today() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  signed_24h int; usual numeric; activity numeric;
  wins_24h int; wins_7d int; near_goal int; new_7d int;
  stories int; grim int; hopeful int; grim_share numeric;
  mood text; future int;
begin
  select count(*) into signed_24h from signatures where created_at > now() - interval '24 hours';
  select count(*) / 14.0 into usual from signatures where created_at > now() - interval '15 days' and created_at <= now() - interval '24 hours';
  -- smoothed so a quiet young site is "calm", not "sad"
  activity := (signed_24h + 10) / (usual + 10);

  select count(*) filter (where u.created_at > now() - interval '24 hours'), count(*)
    into wins_24h, wins_7d
    from petition_updates u join petitions p on p.id = u.petition_id and p.status in ('live','closed')
    where u.kind = 'win' and u.created_at > now() - interval '7 days';
  select count(*) into near_goal from petitions p join petition_stats s on s.id = p.id
    where p.status = 'live' and s.combined >= p.goal * 0.8 and s.combined < p.goal;
  select count(*) into new_7d from petitions where status = 'live' and created_at > now() - interval '7 days';

  select count(*), count(*) filter (where news_tone(title) < 0), count(*) filter (where news_tone(title) > 0)
    into stories, grim, hopeful
    from news_stories where published_at > now() - interval '36 hours';
  grim_share := case when stories >= 4 then grim::numeric / stories else 0 end;

  mood := case
    when wins_24h > 0 then 'cheering'
    when grim_share >= 0.5 then 'sick'
    when grim_share >= 0.35 and activity >= 1.2 then 'fired'
    when grim_share >= 0.35 then 'scared'
    when near_goal > 0 and activity >= 1 then 'fired'
    when wins_7d > 0 and activity >= 1 then 'growing'
    when activity >= 1.4 then 'happy'
    when activity < 0.6 then 'sad'
    when activity < 0.85 then 'worried'
    else 'calm' end;

  -- "Mylo's future", 0 to 100: people showing up lifts it, bad news weighs on it, wins lift it most.
  future := greatest(5, least(100, round(55 + 30 * (least(activity, 2) - 1) - 40 * (grim_share - 0.25) + 8 * least(wins_7d, 4) + 3 * least(near_goal, 5))::int));

  return json_build_object(
    'mood', mood, 'future', future,
    'signed_24h', signed_24h, 'usual', round(usual), 'wins_7d', wins_7d, 'wins_24h', wins_24h,
    'near_goal', near_goal, 'new_7d', new_7d,
    'stories', stories, 'grim', grim, 'hopeful', hopeful,
    'grim_headlines', coalesce((select json_agg(x) from (
        select title, url, source_name from news_stories
        where published_at > now() - interval '36 hours' and news_tone(title) < 0
        order by outlets desc, published_at desc limit 3) x), '[]'::json),
    'wins', coalesce((select json_agg(x) from (
        select p.id, p.title from petition_updates u join petitions p on p.id = u.petition_id and p.status in ('live','closed')
        where u.kind = 'win' and u.created_at > now() - interval '7 days' order by u.created_at desc limit 3) x), '[]'::json),
    'goals', coalesce((select json_agg(x) from (
        select p.id, p.title, p.topic, p.goal, p.target, s.combined, p.featured from petitions p join petition_stats s on s.id = p.id
        where p.status = 'live' order by p.featured desc, s.combined desc, p.created_at desc limit 5) x), '[]'::json),
    'at', now());
end $$;
grant execute on function public.mylo_today() to anon, authenticated;

-- moderators pin or unpin a big community goal
create or replace function public.set_featured(p_petition uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  update petitions set featured = p_on where id = p_petition;
end $$;
revoke execute on function public.set_featured(uuid, boolean) from public, anon;
grant execute on function public.set_featured(uuid, boolean) to authenticated;
