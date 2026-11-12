import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { MyloStory, STORY } from '@/components/mylo/MyloStory';
import { ShareButton } from '@/components/ShareButton';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('story.title')} · UNIER`, description: t('story.sub'), openGraph: { title: t('story.title'), description: t('story.sub') } };
}

// Mylo's story as a picture book, big enough to read together with a child.
export default async function StoryPage() {
  const { t } = await getT();
  return (
    <div className="stack story-wrap">
      <Link href="/mylo" className="hint">← {t('mylo.title')}</Link>
      <h1>{t('story.title')}</h1>
      <MyloStory pages={STORY} id="book" big keys again end={
        <div className="row story-end">
          <ShareButton path="/mylo/story" title={t('story.title')} />
          <Link className="btn primary" href="/mylo">{t('story.end')}</Link>
        </div>
      } />
    </div>
  );
}
