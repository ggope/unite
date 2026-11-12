import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { MyloBook } from '@/components/mylo/MyloBook';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('story.title')} · UNIER`, description: t('story.sub'), openGraph: { title: t('story.title'), description: t('story.sub') } };
}

// Mylo's story as a picture book: tap the cover and it opens. Big enough to read together with a child.
export default async function StoryPage() {
  const { t } = await getT();
  return (
    <div className="stack story-wrap">
      <Link href="/mylo" className="hint">← {t('mylo.title')}</Link>
      <h1 style={{ textAlign: 'center' }}>{t('story.title')}</h1>
      <p className="muted" style={{ margin: 0, textAlign: 'center' }}>{t('story.sub')}</p>
      <MyloBook inline />
      <Link href="/mylo/story/print" style={{ textAlign: 'center' }}>{t('print.link')}</Link>
    </div>
  );
}
