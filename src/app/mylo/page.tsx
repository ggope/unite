import type { Metadata } from 'next';
import { loadViewer } from '@/lib/viewer';
import { getT } from '@/lib/i18n/server';
import { asMylo } from '@/lib/mylo';
import { MyloView } from '@/components/mylo/MyloView';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('mylo.title')} · UNIER`, description: t('mylo.aboutText') };
}

export default async function MyloPage() {
  const { sb, viewer, signed } = await loadViewer();
  const { data } = await sb.rpc('mylo_today');
  return <MyloView m={asMylo(data)} viewer={viewer} signed={signed} />;
}
