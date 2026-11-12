import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import type { Key } from '@/lib/i18n/dict';
import { asMylo } from '@/lib/mylo';
import { easyOf } from '@/lib/easy';
import { MyloArt } from '@/components/mylo/MyloArt';
import type { Mood } from '@/components/mylo/art';
import { KidsAsks, type KidAsk } from '@/components/kids/KidsAsks';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('kids.title')} · UNIER`, description: t('kids.intro'), openGraph: { title: t('kids.title'), description: t('kids.intro') } };
}

// How Mylo feels, in words that don't frighten small children (no news, no numbers).
const FEEL: Record<Mood, 'up' | 'down' | 'calm'> = {
  cheering: 'up', happy: 'up', fired: 'up', growing: 'up', worried: 'down', scared: 'down', sad: 'down', sick: 'down', calm: 'calm', sleepy: 'calm',
};
const KID_MOOD: Record<'up' | 'down' | 'calm', Mood> = { up: 'happy', down: 'worried', calm: 'calm' };

// Mylo's kids corner: no sign-up, no signing, no tracking. Kids read, explore, and show a grown-up.
export default async function Kids() {
  const sb = await supabaseServer();
  const [{ lang, t }, { data: today }, { data: rows }] = await Promise.all([
    getT(),
    sb.rpc('mylo_today'),
    // Kid-friendly petitions: live ones with easy-read text (empty until 0018 has run).
    sb.from('petitions').select('id, topic, goal, easy, petition_stats(combined)').eq('status', 'live').neq('easy', '{}').order('created_at', { ascending: false }).limit(40),
  ]);
  const feel = FEEL[asMylo(today).mood] ?? 'calm';
  const asks: KidAsk[] = (rows ?? []).flatMap((p: any) => {
    const e = easyOf(p, lang); if (!e) return [];
    const st = Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats;
    return [{ id: p.id, topic: p.topic, goal: p.goal, combined: Number(st?.combined ?? 0), ...e }];
  });
  const doKeys: Key[] = ['kids.do1', 'kids.do2', 'kids.do3', 'kids.do4'];
  return (
    <div className="stack kids">
      <section className="kids-hero">
        <MyloArt mood={KID_MOOD[feel]} size={160} id="kids-hero" label={t('mylo.label', { mood: t(`mylo.mood.${KID_MOOD[feel]}` as Key) })} />
        <div className="stack" style={{ gap: 8 }}>
          <h1 style={{ margin: 0 }}>{t('kids.hi')}</h1>
          <p className="kids-say">{t(`kids.feel.${feel}` as Key)}</p>
          <p style={{ margin: 0 }}>{t('kids.intro')}</p>
        </div>
      </section>

      <nav className="kids-tiles" aria-label={t('kids.title')}>
        <Link className="kids-tile" href="/mylo/story"><b>📖 {t('kids.story')}</b><span>{t('kids.storyText')}</span></Link>
        <Link className="kids-tile" href="/mylo/story/print"><b>🖍️ {t('kids.colour')}</b><span>{t('kids.colourText')}</span></Link>
        <Link className="kids-tile" href="/kids/teachers"><b>🏫 {t('kids.teachers')}</b><span>{t('kids.teachersText')}</span></Link>
      </nav>

      <KidsAsks asks={asks} />

      <section className="panel">
        <h2>{t('kids.do')}</h2>
        <ul className="kids-do">{doKeys.map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </section>

      <p className="hint">{t('kids.parents')}</p>
    </div>
  );
}
