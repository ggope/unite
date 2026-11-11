import Link from 'next/link';
import { loadViewer } from '@/lib/viewer';
import { TOPICS, DAILY_LIMIT } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { LangSwitch } from '@/lib/i18n/client';
import { InstallApp } from '@/components/InstallApp';
import { saveSettings, withdraw, revokeConsent, resetFeed, signOut } from './actions';
import { DeleteAccount } from './DeleteAccount';

export const dynamic = 'force-dynamic';

export default async function You() {
  const [{ sb, user, viewer, settings, weights }, { t }] = await Promise.all([loadViewer(), getT()]);
  if (!user) return <div className="stack"><div className="empty"><h2>{t('you.title')}</h2><p>{t('you.signedOut')}</p><Link className="btn primary" href="/login?next=/you">{t('common.signIn')}</Link></div><InstallApp /><div className="panel"><span className="label">{t('lang.label')}</span><LangSwitch /></div></div>;
  const [{ data: profile }, { data: sigs }, { data: vids }] = await Promise.all([
    sb.from('profiles').select('handle, display_name').eq('id', user.id).single(),
    sb.from('signatures').select('petition_id, why, created_at, petitions(title)').order('created_at', { ascending: false }),
    sb.from('videos').select('id, caption, status, created_at').eq('uploader_id', user.id).order('created_at', { ascending: false }),
  ]);
  const today = (sigs ?? []).filter((s: any) => new Date(s.created_at) >= new Date(new Date().toISOString().slice(0, 10))).length;
  const max = Math.max(1, ...Object.values(weights).map(Math.abs));
  const on = (k: string) => (settings?.[k] ? true : false);
  return (
    <div className="stack">
      <h1>{t('you.title')}</h1>
      <InstallApp />
      <div className="panel"><span className="label">{t('lang.label')}</span><LangSwitch /></div>
      <form action={saveSettings} className="panel">
        <span className="label">{t('you.profile')}</span><span className="hint">{user.email}</span>
        <div className="field"><label htmlFor="handle">{t('you.handle')}</label><input id="handle" name="handle" defaultValue={profile?.handle ?? ''} placeholder={t('you.handlePh')} /></div>
        <div className="field"><label htmlFor="display_name">{t('you.name')}</label><input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} /></div>
        <span className="label">{t('you.signing')}</span>
        <label className="check"><input type="checkbox" name="one_tap" defaultChecked={on('one_tap')} /><span>{t('you.oneTap')}</span></label>
        <label className="check"><input type="checkbox" name="share_signatures_with_friends" defaultChecked={on('share_signatures_with_friends')} /><span>{t('you.shareFriends')}</span></label>
        <span className="label">{t('you.feedHealthy')}</span>
        <label className="check"><input type="checkbox" name="chronological_feed" defaultChecked={on('chronological_feed')} /><span>{t('you.chrono')}</span></label>
        <label className="check"><input type="checkbox" name="autoplay" defaultChecked={on('autoplay')} /><span>{t('you.autoplay')}</span></label>
        <label className="check"><input type="checkbox" name="is_minor" defaultChecked={on('is_minor')} /><span>{t('you.minor')}</span></label>
        <div className="field"><label htmlFor="br">{t('you.breakReminder')}</label><select id="br" name="break_reminder_minutes" defaultValue={settings?.break_reminder_minutes ?? 20}>{[10, 20, 30, 60].map((m) => <option key={m} value={m}>{t('you.minutes', { n: m })}</option>)}</select></div>
        <button className="btn primary">{t('common.save')}</button>
      </form>
      <div className="panel"><span className="label">{t('you.today')}</span><b>{t('you.left', { n: Math.max(0, DAILY_LIMIT - today), max: DAILY_LIMIT })}</b></div>
      <div className="panel"><span className="label">{t('you.learns')}</span>
        {Object.keys(weights).length ? Object.entries(TOPICS).map(([k, tp]) => <div key={k} className="row"><span style={{ width: 110 }}>{t(`topic.${k as keyof typeof TOPICS}`)}</span><span className="prog"><i style={{ width: `${Math.max(0, weights[k] ?? 0) / max * 100}%`, background: tp.b }} /></span></div>)
          : <p className="hint">{t('you.startsLearning')}</p>}
        <form action={resetFeed}><button className="btn small">{t('you.resetFeed')}</button></form>
      </div>
      <div className="panel"><span className="label">{t('you.sigs')}</span>
        {sigs?.length ? sigs.map((s: any) => (
          <form key={s.petition_id} action={withdraw} className="row between"><input type="hidden" name="petition_id" value={s.petition_id} />
            <span style={{ flex: 1, minWidth: 0 }}><Link href={`/p/${s.petition_id}`}>{s.petitions?.title}</Link>{s.why && <span className="hint"> · “{s.why}”</span>}</span>
            <button className="btn small">{t('you.withdraw')}</button></form>)) : <p className="hint">{t('you.nothing')}</p>}
        {viewer.hasConsent && <form action={revokeConsent}><button className="btn small danger">{t('you.revoke')}</button></form>}
      </div>
      <div className="panel"><span className="label">{t('you.vids')}</span>
        {vids?.length ? vids.map((v: any) => <div key={v.id} className="row between"><span>{v.caption}</span><span className="hint">{v.status === 'pending' ? t('you.inReview') : v.status === 'approved' ? t('you.live') : t('you.notApproved')}</span></div>) : <p className="hint">{t('you.noVids')} <Link href="/post">{t('you.postOne')}</Link>.</p>}
      </div>
      <div className="panel"><span className="label">{t('you.data')}</span>
        <p className="hint" style={{ margin: 0 }}>{t('you.dataText')}</p>
        <DeleteAccount />
        <form action={signOut}><button className="btn small">{t('you.signOut')}</button></form>
      </div>
    </div>
  );
}
