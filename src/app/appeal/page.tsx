import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/dict';
import { AppealForm } from './AppealForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'UNIER', robots: { index: false, follow: false } };
const KINDS = ['petition', 'video', 'reason', 'profile'] as const;
type Kind = (typeof KINDS)[number];

// Ask for a second look. A different person reviews it where we can, and the author always hears why.
export default async function Appeal({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
  const { kind: k = '', id = '' } = await searchParams;
  const [{ sb, user }, { lang, t }] = await Promise.all([currentUser(), getT()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/appeal?kind=${k}&id=${id}`)}`);
  const kind = (KINDS as readonly string[]).includes(k) ? (k as Kind) : null;
  const day = (d: string) => new Date(d).toLocaleDateString(locale(lang), { year: 'numeric', month: 'long', day: 'numeric' });

  // what was decided, read with the person's own access: only their own things come back
  let what: string | null = null, why: string | null = null, when: string | null = null, link: string | null = null;
  if (kind === 'petition' && /^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await sb.from('petitions').select('*').eq('id', id).eq('created_by', user.id).eq('status', 'removed').maybeSingle();
    if (data) { what = data.title; why = data.moderation_note; when = data.moderated_at ?? null; link = `/p/${data.id}`; }
  } else if (kind === 'video' && /^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await sb.from('videos').select('*').eq('id', id).eq('uploader_id', user.id).eq('status', 'rejected').maybeSingle();
    if (data) { what = data.caption; why = data.moderation_note; when = data.moderated_at ?? null; }
  } else if ((kind === 'reason' || kind === 'profile') && /^\d{1,18}$/.test(id)) {
    const { data } = await sb.from('notices').select('*').eq('id', Number(id)).eq('kind', kind === 'reason' ? 'reason_hidden' : 'profile_cleared').maybeSingle();
    if (data) { what = t(kind === 'reason' ? 'appeal.whatReason' : 'appeal.whatProfile'); why = data.body; when = data.created_at; link = data.petition_id ? `/p/${data.petition_id}` : null; }
  }
  const { error: notReady } = await sb.from('appeals').select('id').limit(1);   // before 0018 there is nowhere to send it

  return (
    <div className="stack">
      <Link href="/you" className="hint">← {t('you.title')}</Link>
      <h1 style={{ margin: 0 }}>{t('appeal.title')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('appeal.lead')}</p>
      {!what ? <div className="empty"><p>{t('appeal.missing')}</p><Link className="btn" href="/you">{t('you.title')}</Link></div> : <>
        <section className="panel appeal-what">
          <span className="label">{t('appeal.decision')}</span>
          <b>{link ? <Link href={link}>{what}</Link> : what}</b>
          {why && <span>{t('mod.reason', { r: why })}</span>}
          {when && <span className="hint">{day(when)}</span>}
        </section>
        {notReady ? <p className="note">{t('appeal.soon')}</p> : <AppealForm kind={kind!} id={id} />}
        <section className="panel tsec"><h2>{t('appeal.howTitle')}</h2>
          <ul>{(['appeal.h1', 'appeal.h2', 'appeal.h3', 'appeal.h4'] as const).map((x) => <li key={x}>{t(x)}</li>)}</ul></section>
      </>}
    </div>
  );
}
