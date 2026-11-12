import type { Metadata } from 'next';
import { loadViewer } from '@/lib/viewer';
import { getT } from '@/lib/i18n/server';
import { asMylo } from '@/lib/mylo';
import { localize } from '@/lib/petitionText';
import { MyloView } from '@/components/mylo/MyloView';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('mylo.title')} · UNIER`, description: t('mylo.aboutText') };
}

export default async function MyloPage() {
  const [{ sb, viewer, signed }, { lang }] = await Promise.all([loadViewer(), getT()]);
  const { data } = await sb.rpc('mylo_today');
  const m = asMylo(data);
  // goals and wins in the reader's language, where a translation exists
  const ids = [...m.goals.map((g) => g.id), ...m.wins.map((w) => w.id)];
  if (ids.length) {
    const { data: tr } = await sb.from('petitions').select('id, title, target, lang, tr').in('id', ids);
    const by = new Map((tr ?? []).map((p: any) => [p.id, localize(p, lang)]));
    m.goals = m.goals.map((g) => ({ ...g, title: by.get(g.id)?.title ?? g.title, target: by.get(g.id)?.target ?? g.target }));
    m.wins = m.wins.map((w) => ({ ...w, title: by.get(w.id)?.title ?? w.title }));
  }
  return <MyloView m={m} viewer={viewer} signed={signed} />;
}
