import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getT } from '@/lib/i18n/server';
import { localize } from '@/lib/petitionText';
import { AnswerForm } from './AnswerForm';

export const dynamic = 'force-dynamic';
// The link is a key: keep it out of search engines and out of other sites' logs.
export const metadata: Metadata = { title: 'UNIER', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Info = { id: string; title: string; target: string; ask: string; lang: string; tr: Record<string, unknown> };

// Where a minister or company answers a petition, through the private link its organiser sent them.
export default async function Answer({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { lang, t } = await getT();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.rpc('answer_info', { p_token: token.slice(0, 64) });
  if (!data) return <div className="empty"><h1>{t('ans.title')}</h1><p>{t('ans.dead')}</p></div>;
  const p = localize(data as Info, lang) as Info;
  return (
    <div className="stack" style={{ maxWidth: 680 }}>
      <span className="label">UNIER · {t('ans.title')}</span>
      <h1 style={{ margin: 0 }}>{p.title}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('ans.intro', { target: p.target })}</p>
      <section className="stack" style={{ gap: 6 }}><h2>{t('rep.ask')}</h2><p style={{ margin: 0 }}>{p.ask}</p></section>
      <AnswerForm token={token} petitionId={p.id} />
    </div>
  );
}
