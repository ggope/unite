-- 0019: the kids side. A petition can have an easy-read version in plain words, one per language:
--   easy = {"en": {"title": "…", "text": "…"}, "hu": {…}, …}
-- A live petition with any easy-read text is kid-friendly and shows in the kids corner (/kids).
-- Moderators write it in Admin → Petitions. Kids never sign; the kids corner sends them to a grown-up.
alter table public.petitions add column if not exists easy jsonb not null default '{}'::jsonb;
alter table public.petitions drop constraint if exists petitions_easy_check;
alter table public.petitions add constraint petitions_easy_check
  check (jsonb_typeof(easy) = 'object' and octet_length(easy::text) <= 8000);
create index if not exists petitions_kids_idx on public.petitions (created_at desc) where easy <> '{}'::jsonb and status = 'live';

-- Easy-read text for the kid-friendly starter petitions (only where none has been written yet).
-- Re-runnable: it never overwrites text a moderator has edited.
with v(title, easy) as (values
  ('Turn the fossil fuel roadmap into a binding plan', jsonb_build_object(
    'en', jsonb_build_object('title', 'Keep the Earth from getting too hot', 'text', $$Coal, oil and gas make the Earth warmer. Leaders made a plan to use less of them, but nobody has to follow it. We ask them to turn the plan into a real promise.$$),
    'hu', jsonb_build_object('title', 'Ne melegedjen túl a Föld', 'text', $$A szén, az olaj és a gáz melegebbé teszi a Földet. A vezetők terveztek, hogy kevesebbet használjunk belőlük, de senkinek sem kötelező betartani. Azt kérjük, legyen ebből igazi ígéret.$$),
    'de', jsonb_build_object('title', 'Damit die Erde nicht zu heiß wird', 'text', $$Kohle, Öl und Gas machen die Erde wärmer. Die Regierungen haben einen Plan gemacht, weniger davon zu benutzen, aber niemand muss sich daran halten. Wir bitten sie, daraus ein echtes Versprechen zu machen.$$),
    'es', jsonb_build_object('title', 'Que la Tierra no se caliente demasiado', 'text', $$El carbón, el petróleo y el gas calientan la Tierra. Los gobiernos hicieron un plan para usar menos, pero nadie está obligado a cumplirlo. Les pedimos que lo conviertan en una promesa de verdad.$$),
    'fr', jsonb_build_object('title', 'Pour que la Terre ne chauffe pas trop', 'text', $$Le charbon, le pétrole et le gaz réchauffent la Terre. Les dirigeants ont fait un plan pour en utiliser moins, mais personne n'est obligé de le suivre. Nous leur demandons d'en faire une vraie promesse.$$))),
  ('Stop deep-sea mining before it starts', jsonb_build_object(
    'en', jsonb_build_object('title', 'Leave the deep sea in peace', 'text', $$Deep down in the ocean live animals nobody has even met yet. Some companies want to dig up the sea floor with huge machines. We ask leaders to stop it before it starts.$$),
    'hu', jsonb_build_object('title', 'Hagyjuk békén a mélytengert', 'text', $$Az óceán mélyén olyan állatok élnek, amelyekkel még senki sem találkozott. Néhány cég hatalmas gépekkel akarja felásni a tengerfeneket. Azt kérjük a vezetőktől, hogy állítsák meg, mielőtt elkezdődik.$$),
    'de', jsonb_build_object('title', 'Lasst die Tiefsee in Ruhe', 'text', $$Tief unten im Meer leben Tiere, die noch niemand kennt. Einige Firmen wollen den Meeresboden mit riesigen Maschinen aufgraben. Wir bitten die Regierungen, das zu stoppen, bevor es anfängt.$$),
    'es', jsonb_build_object('title', 'Dejemos en paz el fondo del mar', 'text', $$En lo más hondo del océano viven animales que nadie ha conocido todavía. Algunas empresas quieren excavar el fondo del mar con máquinas enormes. Pedimos a los gobiernos que lo paren antes de que empiece.$$),
    'fr', jsonb_build_object('title', 'Laissons les fonds marins tranquilles', 'text', $$Tout au fond de l'océan vivent des animaux que personne n'a encore rencontrés. Des entreprises veulent creuser le fond de la mer avec d'énormes machines. Nous demandons aux dirigeants de l'arrêter avant que ça commence.$$))),
  ('A plastics treaty that cuts plastic at the source', jsonb_build_object(
    'en', jsonb_build_object('title', 'Less plastic, right from the start', 'text', $$Lots of plastic ends up in rivers, in the sea and even in animals' tummies. Countries are making a plan together. We ask them to make less plastic in the first place, not just clean it up.$$),
    'hu', jsonb_build_object('title', 'Kevesebb műanyagot, már az elejétől', 'text', $$Rengeteg műanyag kerül a folyókba, a tengerbe, sőt az állatok pocakjába is. Az országok közösen terveznek. Azt kérjük, eleve kevesebb műanyagot gyártsanak, ne csak takarítsanak utána.$$),
    'de', jsonb_build_object('title', 'Weniger Plastik, von Anfang an', 'text', $$Viel Plastik landet in Flüssen, im Meer und sogar in den Bäuchen von Tieren. Die Länder machen gerade zusammen einen Plan. Wir bitten sie, gleich weniger Plastik herzustellen, statt es nur aufzuräumen.$$),
    'es', jsonb_build_object('title', 'Menos plástico desde el principio', 'text', $$Mucho plástico acaba en los ríos, en el mar y hasta en la barriga de los animales. Los países están haciendo un plan juntos. Les pedimos que fabriquen menos plástico, no solo que lo limpien después.$$),
    'fr', jsonb_build_object('title', 'Moins de plastique, dès le départ', 'text', $$Beaucoup de plastique finit dans les rivières, la mer et même le ventre des animaux. Les pays préparent un plan ensemble. Nous leur demandons de fabriquer moins de plastique, pas seulement de le ramasser.$$))),
  ('Tartsuk meg a vizet az Alföldön', jsonb_build_object(
    'en', jsonb_build_object('title', 'Keep water on the Great Plain', 'text', $$On the big flat land in Hungary, the ground is getting drier and drier. Farmers, plants and animals need water. We ask that rain and river water stays there instead of running away.$$),
    'hu', jsonb_build_object('title', 'Maradjon víz az Alföldön', 'text', $$Az Alföldön, Magyarország nagy, lapos vidékén egyre szárazabb a föld. A gazdáknak, a növényeknek és az állatoknak víz kell. Azt kérjük, hogy az eső- és a folyóvíz maradjon ott, ne folyjon el.$$),
    'de', jsonb_build_object('title', 'Wasser für die Ungarische Tiefebene', 'text', $$Im großen, flachen Land in Ungarn wird der Boden immer trockener. Bauern, Pflanzen und Tiere brauchen Wasser. Wir bitten darum, Regen- und Flusswasser dort zu halten, statt es abfließen zu lassen.$$),
    'es', jsonb_build_object('title', 'Que no falte agua en la Gran Llanura', 'text', $$En la gran llanura de Hungría, la tierra está cada vez más seca. Los agricultores, las plantas y los animales necesitan agua. Pedimos que el agua de la lluvia y de los ríos se quede allí en vez de escaparse.$$),
    'fr', jsonb_build_object('title', 'Gardons l''eau dans la Grande Plaine', 'text', $$Dans la grande plaine de Hongrie, la terre devient de plus en plus sèche. Les agriculteurs, les plantes et les animaux ont besoin d'eau. Nous demandons de garder l'eau de pluie et des rivières sur place au lieu de la laisser partir.$$))),
  ('Tiszta Tiszát: állítsuk meg a műanyagáradatot', jsonb_build_object(
    'en', jsonb_build_object('title', 'A clean Tisza river', 'text', $$The Tisza is a long river in Hungary. Lots of plastic bottles float down it. We ask for help to stop the plastic before it gets into the water.$$),
    'hu', jsonb_build_object('title', 'Tiszta Tiszát!', 'text', $$A Tisza egy hosszú folyó Magyarországon. Rengeteg műanyag palack úszik rajta. Azt kérjük, segítsenek megállítani a műanyagot, mielőtt a vízbe kerül.$$),
    'de', jsonb_build_object('title', 'Eine saubere Theiß', 'text', $$Die Theiß ist ein langer Fluss in Ungarn. Viele Plastikflaschen schwimmen darin. Wir bitten um Hilfe, das Plastik aufzuhalten, bevor es ins Wasser kommt.$$),
    'es', jsonb_build_object('title', 'Un río Tisza limpio', 'text', $$El Tisza es un río largo de Hungría. Muchas botellas de plástico flotan en él. Pedimos ayuda para frenar el plástico antes de que llegue al agua.$$),
    'fr', jsonb_build_object('title', 'Une Tisza propre', 'text', $$La Tisza est une longue rivière de Hongrie. Beaucoup de bouteilles en plastique flottent dessus. Nous demandons de l'aide pour arrêter le plastique avant qu'il arrive dans l'eau.$$)))
)
update public.petitions p set easy = v.easy from v where p.title = v.title and p.easy = '{}'::jsonb;
