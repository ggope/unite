-- 0026 automatic translations: petitions show in each visitor's language.
-- Claude translates a published petition into the other site languages the first time someone opens it.
-- Machine translations live in the same `tr` column as moderators' own (0012), marked {"auto": true}.
-- A moderator's translation always wins and is never overwritten. When the petition's text changes,
-- the machine translations are dropped and made again. Re-runnable.

-- ---------- 1. the switch ----------
alter table public.site_settings add column if not exists auto_translate boolean not null default true;
grant update (auto_translate) on public.site_settings to authenticated;   -- the 0014 row policy limits updates to moderators

-- ---------- 2. room for four languages ----------
-- 0012 allowed 20 000 bytes, enough for one or two hand-made translations; four full ones need more.
alter table public.petitions drop constraint if exists petitions_tr_check;
alter table public.petitions add constraint petitions_tr_check check (jsonb_typeof(tr) = 'object' and octet_length(tr::text) <= 120000);

-- when the last attempt started, so a failing petition is not retried on every page view
alter table public.petitions add column if not exists mt_tried_at timestamptz;
create index if not exists petitions_mt_tried_idx on public.petitions (mt_tried_at) where mt_tried_at is not null;

-- ---------- 3. text changed: old machine translations go ----------
create or replace function public.petition_mt_reset() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.title, new.target, new.ask, new.why, new.lang) is distinct from (old.title, old.target, old.ask, old.why, old.lang) then
    new.tr := coalesce((select jsonb_object_agg(k, v) from jsonb_each(new.tr) e(k, v)
                        where not (jsonb_typeof(v) = 'object' and coalesce(v->>'auto', '') = 'true')), '{}'::jsonb);
    new.mt_tried_at := null;
  end if;
  return new;
end $$;
revoke execute on function public.petition_mt_reset() from public, anon, authenticated;
drop trigger if exists petition_mt_reset on public.petitions;
create trigger petition_mt_reset before update on public.petitions for each row execute function public.petition_mt_reset();

-- ---------- 4. the server asks before translating ----------
-- True when this petition may be translated now: published, switch on, not tried in the last 6 hours,
-- and fewer than p_daily petitions tried in the last 24 hours (a spending limit). Marks the attempt.
create or replace function public.mt_claim(p_id uuid, p_daily int default 100) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if not coalesce((select auto_translate from public.site_settings limit 1), false) then return false; end if;
  if (select count(*) from public.petitions where mt_tried_at > now() - interval '24 hours') >= greatest(p_daily, 0) then return false; end if;
  update public.petitions set mt_tried_at = now()
   where id = p_id and status in ('live', 'closed')
     and (mt_tried_at is null or mt_tried_at < now() - interval '6 hours')
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke execute on function public.mt_claim(uuid, int) from public, anon, authenticated;
grant execute on function public.mt_claim(uuid, int) to service_role;

-- ---------- 5. ...and saves what came back ----------
-- p_tr: {"hu": {"title": …, "target": …, "ask": …, "why": …}, …}. Skips the petition's own language,
-- unknown languages, languages a moderator already translated, and anything too long or empty.
create or replace function public.mt_save(p_id uuid, p_tr jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare cur jsonb; own text; k text; v jsonb; n int := 0;
begin
  select tr, lang into cur, own from public.petitions where id = p_id for update;
  if cur is null or jsonb_typeof(p_tr) <> 'object' then return 0; end if;
  for k, v in select * from jsonb_each(p_tr) loop
    continue when k not in ('en', 'hu', 'de', 'es', 'fr') or k = own or jsonb_typeof(v) <> 'object';
    continue when jsonb_typeof(cur->k) = 'object' and coalesce(cur->k->>'auto', '') <> 'true';   -- a person's translation stays
    continue when coalesce(btrim(v->>'title'), '') = '' or coalesce(btrim(v->>'ask'), '') = ''
      or char_length(coalesce(v->>'title', '')) > 140 or char_length(coalesce(v->>'target', '')) > 200
      or char_length(coalesce(v->>'ask', '')) > 3000 or char_length(coalesce(v->>'why', '')) > 7500;
    cur := cur || jsonb_build_object(k, jsonb_strip_nulls(jsonb_build_object(
      'title', btrim(v->>'title'), 'target', nullif(btrim(v->>'target'), ''), 'ask', btrim(v->>'ask'),
      'why', nullif(btrim(v->>'why'), ''), 'auto', true)));
    n := n + 1;
  end loop;
  if n > 0 then update public.petitions set tr = cur where id = p_id; end if;   -- only tr changes, so the reset trigger keeps it
  return n;
end $$;
revoke execute on function public.mt_save(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mt_save(uuid, jsonb) to service_role;
