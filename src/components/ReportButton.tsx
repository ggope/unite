'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { nudgeAi } from '@/lib/ai/actions';
import { useT } from '@/lib/i18n/client';
import { Icon } from './Icon';
import { useSheet } from '@/lib/useSheet';

const REASONS = ['false', 'hate', 'violence', 'privacy', 'spam', 'other'] as const;

// Notice and action (EU Digital Services Act): anyone signed in can report a video or petition.
// Shown reasons and official answers can be reported too: a reason by its random key, so the report never says who wrote it.
export function ReportButton({ videoId, petitionId, profileId, reasonKey, updateId, loggedIn, variant = 'ghost' }: { videoId?: string; petitionId?: string; profileId?: string; reasonKey?: string; updateId?: string; loggedIn: boolean; variant?: 'ghost' | 'reel' | 'mini' }) {
  const { t } = useT(); const router = useRouter(); const path = usePathname();
  const [open, setOpen] = useState(false); const [why, setWhy] = useState<(typeof REASONS)[number] | ''>(''); const [txt, setTxt] = useState('');
  const [state, setState] = useState<'' | 'busy' | 'done' | 'err'>('');
  const sheet = useSheet(open, () => setOpen(false));
  const what = videoId ? t('report.video') : reasonKey ? t('report.reason') : updateId ? t('report.answer') : profileId ? t('report.profile') : t('report.petition');
  function start() { if (!loggedIn) { router.push(`/login?next=${encodeURIComponent(path)}`); return; } setOpen(true); setState(''); }
  async function send() {
    setState('busy');
    const { data: s } = await supabaseBrowser().auth.getSession();
    const target = reasonKey ? { reason_key: reasonKey } : updateId ? { update_id: updateId }
      : { video_id: videoId ?? null, petition_id: videoId ? null : petitionId ?? null, ...(profileId ? { profile_id: profileId } : {}) };
    const { error } = await supabaseBrowser().from('reports').insert({ reporter_id: s.session?.user.id, ...target, reason: `${why}${txt.trim() ? ': ' + txt.trim() : ''}`.slice(0, 500) });
    setState(error ? 'err' : 'done');
    if (!error) nudgeAi().catch(() => {});   // the AI check sorts it for the moderators
  }
  return (
    <>
      {variant === 'reel'
        ? <button className="rb" onClick={start} aria-label={t('report.btn')}><span className="c"><Icon name="flag" /></span>{t('report.btn')}</button>
        : variant === 'mini' ? <button type="button" className="flag-mini noprint" onClick={start} aria-label={t('report.title', { what })} title={t('report.title', { what })}><Icon name="flag" /></button>
        : <button className="btn ghost small" onClick={start}><Icon name="flag" />{t('report.btn')}</button>}
      {open && (
        <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={t('report.title', { what })}>
            <div className="row between"><h2>{t('report.title', { what })}</h2><button className="btn ghost" onClick={() => setOpen(false)} aria-label={t('common.close')}><Icon name="x" /></button></div>
            {state === 'done' ? <><p style={{ margin: 0 }}>{t('report.thanks')}</p><button className="btn primary" onClick={() => setOpen(false)}>{t('common.close')}</button></> : <>
              <span className="label">{t('report.why')}</span>
              {REASONS.map((r) => <label key={r} className="check"><input type="radio" name="why" checked={why === r} onChange={() => setWhy(r)} /><span>{t(`report.r.${r}`)}</span></label>)}
              <div className="field"><label htmlFor="rt">{t('report.details')}</label><textarea id="rt" maxLength={400} value={txt} onChange={(e) => setTxt(e.target.value)} /></div>
              {state === 'err' && <p className="error" style={{ margin: 0 }}>{t('report.err')}</p>}
              <button className="btn primary big block" disabled={!why || state === 'busy'} onClick={send}>{t('report.send')}</button>
            </>}
          </div>
        </div>
      )}
    </>
  );
}
