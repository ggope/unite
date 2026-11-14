import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { asMylo } from '@/lib/mylo';
import { localize } from '@/lib/petitionText';
import { MyloRun } from '@/components/mylo/MyloRun';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('game.title')} · UNIER`, description: t('game.intro'), openGraph: { title: t('game.title'), description: t('game.intro') } };
}

// A quick game for bored moments. After a round, it points to one real petition close to its goal.
export default async function PlayPage() {
  const { t, lang } = await getT();
  let signHref = '/petitions', signTitle: string | undefined;
  try {
    const sb = await supabaseServer();
    const { data } = await sb.rpc('mylo_today');
    const goal = asMylo(data).goals[0];
    if (goal) {
      const { data: p } = await sb.from('petitions').select('id, title, target, lang, tr').eq('id', goal.id).maybeSingle();
      signHref = `/p/${goal.id}`;
      signTitle = p ? localize(p as any, lang).title : goal.title;
    }
  } catch { /* the game works without it */ }
  return (
    <div className="stack mrun-page">
      <Link href="/mylo" className="hint">← {t('mylo.title')}</Link>
      <h1>{t('game.title')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('game.intro')}</p>
      <MyloRun signHref={signHref} signTitle={signTitle} />
      <section className="panel mrun-how">
        <h2>{t('game.howTitle')}</h2>
        <ul>
          <li>{t('game.how1')}</li>
          <li>{t('game.how2')}</li>
          <li>{t('game.how3')}</li>
          <li>{t('game.how4')}</li>
          <li>{t('game.how6')}</li>
          <li>{t('game.how5')}</li>
        </ul>
        <p className="hint" style={{ margin: 0 }}>{t('game.private')}</p>
      </section>
    </div>
  );
}
