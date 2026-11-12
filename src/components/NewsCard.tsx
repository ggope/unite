'use client';
import Link from 'next/link';
import { TOPICS } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { fmtN } from '@/lib/i18n/langs';
import { ago, type NewsStory } from '@/lib/news/load';
import { SignButton, type Viewer } from './SignButton';

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// A headline from a trusted outlet. The full story stays on the publisher's site.
export function NewsCard({ n, viewer, signed, onDark = false }: { n: NewsStory; viewer: Viewer; signed: boolean; onDark?: boolean }) {
  const { lang, t } = useT();
  const tp = TOPICS[n.topic];
  return (
    <article className={`news ${onDark ? 'dark' : ''}`}>
      <span className="hint"><i className="tdot" style={{ background: tp.b }} />{t(`topic.${n.topic}`)} · {n.source_name} · {ago(n.published_at, t)}{n.outlets > 1 ? ` · ${t('news.outlets', { n: n.outlets })}` : ''}</span>
      <h3><a href={n.url} target="_blank" rel="noopener nofollow">{n.title}</a></h3>
      {n.teaser && <p>{n.teaser}</p>}
      <div className="row">
        <a className="btn small" href={n.url} target="_blank" rel="noopener nofollow">{t('news.read', { source: host(n.url) || n.source_name })} ↗</a>
        {!n.petition && <Link className="btn ghost small" href={`/start?source=${encodeURIComponent(n.url)}&topic=${n.topic}`}>{t('news.start')}</Link>}
      </div>
      {n.petition && (
        <div className="newspet">
          <span className="label">{t('news.related')}</span>
          <Link href={`/p/${n.petition.id}`}><b>{n.petition.title}</b></Link>
          <span className="row hint"><b className="num">{fmtN(n.petition.combined, lang)}</b> {t('common.of')} {fmtN(n.petition.goal, lang)}</span>
          <SignButton variant="small" petitionId={n.petition.id} title={n.petition.title} signed={signed} viewer={viewer} />
        </div>
      )}
    </article>
  );
}
