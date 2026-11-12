import Link from 'next/link';
import { loadViewer } from '@/lib/viewer';
import { TOPICS, DAILY_LIMIT } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { LangSwitch } from '@/lib/i18n/client';
import { InstallApp } from '@/components/InstallApp';
import { Friends } from '@/components/Friends';
import { LegalLinks } from '@/components/LegalLinks';
import { saveSettings, withdraw, revokeConsent, resetFeed, signOut, dismissNotice } from './actions';
import { DeleteAccount } from './DeleteAccount';
import { SaveForm } from './SaveForm';
import { Icon } from '@/components/Icon';
import { PushToggle } from '@/components/PushToggle';
import { localize } from '@/lib/petitionText';

export const dynamic = 'force-dynamic';

export default async function You({ searchParams }: { searchParams: Promise<{ friend?: string }> }) {
  const { friend } = await searchParams;
  const [{ sb, user, viewer, settings, weights }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  if (!user) return <div className="stack"><div className="empty"><h1>{t('you.title')}</h1><p>{t('you.signedOut')}</p><Link className="btn primary" href="/login?next=/you">{t('common.signIn')}</Link></div><InstallApp /><div className="panel"><span className="label">{t('lang.label')}</span><LangSwitch /></div><LegalLinks /></div>;
  const [{ data: profile }, { data: sigs }, { data: vids }, { data: code }, { data: fr }, { data: mine }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single(),
    sb.from('signatures').select('petition_id, why, created_at, petitions(title)').order('created_at', { ascending: false }),
    sb.from('videos').select('id, caption, status, moderation_note, created_at').eq('uploader_id', user.id).order('created_at', { ascending: false }),
    sb.rpc('my_invite_code'),
    sb.from('friendships').select('friend_id, profiles!friendships_friend_id_fkey(handle, display_name)').eq('user_id', user.id),
    sb.from('petitions').select('id, title, status, moderation_note, created_at').eq('created_by', user.id).order('created_at', { ascending: false }),
  ]);
  const { data: impact } = await sb.rpc('my_impact');
  const { data: notices } = await sb.from('notices').select('id, kind, body').order('created_at', { ascending: false });
  const { data: reqs } = await sb.from('friend_requests').select('from_id, profiles!friend_requests_from_id_fkey(handle, display_name)').eq('to_id', user.id);
  const requests = (reqs ?? []).map((r: any) => ({ id: r.from_id, handle: r.profiles?.handle ?? null, display_name: r.profiles?.display_name ?? null }));
  const interests: string[] = profile?.interests ?? [];
  const friends = (fr ?? []).map((f: any) => ({ id: f.friend_id, handle: f.profiles?.handle ?? null, display_name: f.profiles?.display_name ?? null }));
  const today = (sigs ?? []).filter((s: any) => new Date(s.created_at) >= new Date(new Date().toISOString().slice(0, 10))).length;
  const max = Math.max(1, ...Object.values(weights).map(Math.abs));
  const on = (k: string) => (settings?.[k] ? true : false);
  return (
    <div className="stack">
      <div className="row between"><h1>{t('you.title')}</h1><div className="row">{profile?.handle && <Link className="btn small" href={`/u/${profile.handle}`}>{t('pr.view')}</Link>}{profile?.is_moderator && <Link className="btn small" href="/admin">Admin</Link>}</div></div>
      {friend && <p className="note" style={{ margin: 0 }}>{t('invite.done')}</p>}
      {(notices ?? []).map((n: any) => (
        <form key={n.id} action={dismissNotice} className="panel row between" role="status">
          <input type="hidden" name="id" value={n.id} />
          <span style={{ flex: 1, minWidth: 0 }}>{t('notice.cleared', { reason: n.body ?? '' })}</span>
          <button className="btn small">{t('notice.dismiss')}</button>
        </form>
      ))}
      <InstallApp />
      <div className="panel"><span className="label">{t('lang.label')}</span><LangSwitch /></div>
      <div className="panel"><span className="label">{t('impact.title')}</span>
        {impact?.total ? <><b className="impact-n">{t('impact.total', { n: impact.total })}</b>
          {(impact.petitions ?? []).map((p: any) => <span key={p.id} className="row between"><Link href={`/p/${p.id}`}>{localize(p, lang).title}</Link><b className="num">{p.n}</b></span>)}</>
          : <span className="hint">{impact?.any ? t('impact.few') : t('impact.none')}</span>}
        <span className="hint">{t('impact.privacy')}</span>
      </div>
      <PushToggle />
      <SaveForm action={saveSettings}>
        <span className="label">{t('you.profile')}</span><span className="hint">{user.email}</span>
        <div className="field"><label htmlFor="handle">{t('you.handle')}</label><input id="handle" name="handle" defaultValue={profile?.handle ?? ''} placeholder={t('you.handlePh')} /></div>
        <div className="field"><label htmlFor="display_name">{t('you.name')}</label><input id="display_name" name="display_name" maxLength={40} defaultValue={profile?.display_name ?? ''} /></div>
        <div className="field"><label htmlFor="bio">{t('you.bio')}</label><input id="bio" name="bio" maxLength={160} defaultValue={profile?.bio ?? ''} placeholder={t('you.bioPh')} /></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 600, marginBottom: 6 }}>{t('you.interests')}</legend>
          <div className="row">{Object.keys(TOPICS).map((k) => <label key={k} className="chip"><input type="checkbox" name="interests" value={k} defaultChecked={interests.includes(k)} style={{ marginRight: 6 }} />{t(`topic.${k as keyof typeof TOPICS}`)}</label>)}</div></fieldset>
        <span className="label">{t('you.people')}</span>
        <label className="check"><input type="checkbox" name="allow_messages" defaultChecked={(settings?.allow_messages ?? 'friends') === 'friends'} /><span>{t('you.allowMessages')}</span></label>
        <label className="check"><input type="checkbox" name="signatures_public" defaultChecked={on('signatures_public')} /><span>{t('you.sigsPublic')}</span></label>
        <span className="label">{t('you.signing')}</span>
        <label className="check"><input type="checkbox" name="one_tap" defaultChecked={on('one_tap')} /><span>{t('you.oneTap')}</span></label>
        <label className="check"><input type="checkbox" name="share_signatures_with_friends" defaultChecked={on('share_signatures_with_friends')} /><span>{t('you.shareFriends')}</span></label>
        <span className="label">{t('you.feedHealthy')}</span>
        <label className="check"><input type="checkbox" name="chronological_feed" defaultChecked={on('chronological_feed')} /><span>{t('you.chrono')}</span></label>
        <label className="check"><input type="checkbox" name="autoplay" defaultChecked={on('autoplay')} /><span>{t('you.autoplay')}</span></label>
        <label className="check"><input type="checkbox" name="is_minor" defaultChecked={on('is_minor')} /><span>{t('you.minor')}</span></label>
        <div className="field"><label htmlFor="br">{t('you.breakReminder')}</label><select id="br" name="break_reminder_minutes" defaultValue={settings?.break_reminder_minutes ?? 20}>{[10, 20, 30, 60].map((m) => <option key={m} value={m}>{t('you.minutes', { n: m })}</option>)}</select></div>
      </SaveForm>
      <Friends code={(code as string) ?? null} friends={friends} requests={requests} />
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
      <div className="panel"><span className="label">{t('you.petitions')}</span>
        {mine?.length ? mine.map((p: any) => <div key={p.id} className="row between"><Link href={`/p/${p.id}`} style={{ flex: 1, minWidth: 0 }}>{p.title}</Link><span className="hint">{t(`status.${p.status as 'live'}`)}{p.status === 'removed' && p.moderation_note ? ` · ${t('mod.reason', { r: p.moderation_note })}` : ''}</span></div>)
          : <p className="hint" style={{ margin: 0 }}>{t('you.noPetitions')} <Link href="/start">{t('common.startPetition')}</Link></p>}
      </div>
      <div className="panel"><span className="label">{t('you.vids')}</span>
        {vids?.length ? vids.map((v: any) => <div key={v.id} className="row between"><span>{v.caption}</span><span className="hint">{v.status === 'pending' ? t('you.inReview') : v.status === 'approved' ? t('you.live') : t('you.notApproved')}{v.status === 'rejected' && v.moderation_note ? ` · ${t('mod.reason', { r: v.moderation_note })}` : ''}</span></div>) : <p className="hint">{t('you.noVids')} <Link href="/post">{t('you.postOne')}</Link>.</p>}
      </div>
      <div className="panel"><span className="label">{t('you.data')}</span>
        <p className="hint" style={{ margin: 0 }}>{t('you.dataText')}</p>
        <a className="btn small" href="/api/account/export" download><Icon name="download" />{t('you.export')}</a>
        <DeleteAccount />
        <form action={signOut}><button className="btn small">{t('you.signOut')}</button></form>
      </div>
      <LegalLinks />
    </div>
  );
}
