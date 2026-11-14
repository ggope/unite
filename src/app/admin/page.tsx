import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { fmtN, LANGS, type Lang } from '@/lib/i18n/dict';
import { noop, review, petitionStatus, setOfficial, setLink, setFeatured, setTranslation, setOriginalLang, setEasy, unite, separate, resolveReport, setModerator, setHumanCheck, importNews, newsAction, toggleSource, importClips, clipAction, toggleVideoSource, removeSamples, decideAppeal, runLifecycle, resolveError, testAlert, setTeamContent, draftNow, editDraft, setAiMode, runAiNow, setAutoTranslate } from './actions';
import { translateModel, translateDailyLimit } from '@/lib/ai/translate';
import { aiReady } from '@/lib/team/draft';
import { aiKeySet, aiModel, aiDailyLimit } from '@/lib/ai/moderate';
import { legalPlaceholders } from '@/lib/legal';
import { mailReady } from '@/lib/mail/send';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;   // "Draft now" in Team content can take a few minutes; "Check waiting items now" asks the AI about up to 20 items
const TABS = [['overview', 'Overview'], ['launch', 'Launch checklist'], ['queue', 'Review queue'], ['reports', 'Reports'], ['ai', 'AI check'], ['appeals', 'Appeals'], ['petitions', 'Petitions'], ['news', 'News'], ['team', 'Team content'], ['clips', 'Team videos'], ['people', 'People'], ['errors', 'Errors']] as const;
type Tab = (typeof TABS)[number][0];
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const n = (x: number) => fmtN(x, 'en');

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; err?: string; tr?: string; ran?: string }> }) {
  const { sb, user } = await currentUser();
  if (!user) redirect('/login?next=/admin');
  const { data: me } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!me?.is_moderator) return (
    <div className="empty"><h1>Admin is for moderators</h1>
      <p>You are signed in as <b>{user.email}</b>, but this account is not a moderator yet. Make it one in the Supabase SQL editor, then reload this page.</p>
      <Link className="btn" href="/">← Back to UNIER</Link></div>
  );
  const { tab: raw = 'overview', q = '', err, tr: open = '', ran } = await searchParams;
  const tab = (TABS.some(([k]) => k === raw) ? raw : 'overview') as Tab;
  const { data: stats } = await sb.rpc('admin_stats');
  const st = (stats ?? {}) as Record<string, number>;
  const { count: appealsOpen } = await sb.from('appeals').select('id', { count: 'exact', head: true }).eq('status', 'open');   // null before 0018
  const badge: Partial<Record<Tab, number>> = { queue: (st.petitions_pending ?? 0) + (st.videos_pending ?? 0), reports: st.reports_open ?? 0, appeals: appealsOpen ?? 0 };

  return (
    <div className="stack admin">
      <div className="row between"><h1>Admin</h1><Link className="hint" href="/">← Back to UNIER</Link></div>
      <nav className="chips" aria-label="Admin sections">
        {TABS.map(([k, label]) => <Link key={k} className="chip" aria-current={(tab === k) ? 'page' : undefined} href={`/admin?tab=${k}`}>{label}{badge[k] ? ` · ${badge[k]}` : ''}</Link>)}
      </nav>
      {err && <p className="error" role="alert">That did not work: {err}</p>}
      {tab === 'overview' && <Overview st={st} sb={sb} />}
      {tab === 'launch' && <Launch sb={sb} />}
      {tab === 'queue' && <Queue sb={sb} />}
      {tab === 'reports' && <Reports sb={sb} />}
      {tab === 'ai' && <AiCheck sb={sb} />}
      {tab === 'appeals' && <Appeals sb={sb} me={user.id} />}
      {tab === 'petitions' && <Petitions sb={sb} q={q} open={open} />}
      {tab === 'news' && <News sb={sb} />}
      {tab === 'team' && <Team sb={sb} ran={ran} />}
      {tab === 'clips' && <Clips sb={sb} />}
      {tab === 'people' && <People sb={sb} q={q} me={user.id} />}
      {tab === 'errors' && <Errors sb={sb} />}
    </div>
  );
}

async function Overview({ st, sb }: { st: Record<string, number>; sb: any }) {
  const { data: live } = await sb.from('petitions').select('id, title, petition_stats(combined, last_hour)').eq('status', 'live').limit(500);
  const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};
  const hot = (live ?? []).map((p: any) => ({ id: p.id, title: p.title, combined: Number(one(p.petition_stats).combined ?? 0), last_hour: Number(one(p.petition_stats).last_hour ?? 0) }))
    .sort((a: any, b: any) => b.last_hour - a.last_hour || b.combined - a.combined).slice(0, 8);
  const tiles: [string, number, string?][] = [
    ['People', st.people ?? 0, `+${n(st.people_7d ?? 0)} this week`], ['Signatures', st.signatures ?? 0, `+${n(st.signatures_24h ?? 0)} in 24 h`],
    ['Live petitions', st.petitions_live ?? 0], ['Live videos', st.videos_live ?? 0],
    ['Waiting for review', (st.petitions_pending ?? 0) + (st.videos_pending ?? 0)], ['Open reports', st.reports_open ?? 0],
    ['Updates posted', st.updates_7d ?? 0, 'this week'], ['News imported', st.news_24h ?? 0, 'in 24 h'],
  ];
  return (<>
    <div className="tiles">{tiles.map(([k, v, sub]) => <div className="tile" key={k}><span className="label">{k}</span><b className="num">{n(v)}</b>{sub && <span className="hint">{sub}</span>}</div>)}</div>
    <div className="panel"><b>Moving fastest right now</b>
      {hot?.length ? hot.map((h: any) => <div className="row between" key={h.id}><Link href={`/p/${h.id}`} style={{ flex: 1, minWidth: 0 }}>{h.title}</Link><span className="hint num">+{n(h.last_hour)}/h · {n(h.combined)}</span></div>) : <p className="hint" style={{ margin: 0 }}>No live petitions yet.</p>}
    </div>
  </>);
}

const Decide = ({ kind, id, note }: { kind: string; id: string; note?: string }) => (
  <form action={noop} className="row"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
    <input name="note" defaultValue={note ?? ''} placeholder="Reason if not approved (the author sees this)" style={{ flex: 1, minWidth: 0 }} />
    <button className="btn small primary" formAction={review.bind(null, 'approve')}>Approve</button><button className="btn small danger" formAction={review.bind(null, 'reject')}>Reject</button></form>
);

async function Queue({ sb }: { sb: any }) {
  const [{ data: pets }, { data: vids }] = await Promise.all([
    sb.from('petitions').select('*').eq('status', 'pending').order('created_at').limit(30),
    sb.from('videos').select('id, caption, storage_path, petition_id, created_at, blur_faces, audience, petitions(title)').eq('status', 'pending').order('created_at').limit(30),
  ]);
  const urls = vids?.length ? (await sb.storage.from('videos').createSignedUrls(vids.map((v: any) => v.storage_path), 3600)).data ?? [] : [];
  const [ap, av] = await Promise.all([aiReviews(sb, 'petition_id', (pets ?? []).map((p: any) => p.id)), aiReviews(sb, 'video_id', (vids ?? []).map((v: any) => v.id))]);
  urls.forEach((u: any, i: number) => { if (vids?.[i]) vids[i].url = u?.signedUrl; });   // keep each video's link when the list is re-ordered
  byRisk(pets, ap); byRisk(vids, av);
  // team drafts (0023): the helper's note and its sources, so the facts can be checked before approving
  const teamIds = (pets ?? []).filter((p: any) => p.origin === 'team').map((p: any) => p.id);
  const [{ data: notes }, { data: srcs }] = teamIds.length ? await Promise.all([
    sb.from('team_drafts').select('petition_id, note, reason').in('petition_id', teamIds),
    sb.from('petition_sources').select('petition_id, url, outlet, title').in('petition_id', teamIds),
  ]) : [{ data: [] }, { data: [] }];
  return (<>
    <AiLine />
    <h2>Petitions ({pets?.length ?? 0})</h2>
    {pets?.length ? pets.map((p: any) => <div className="panel" key={p.id}><AiBadge r={ap.get(p.id)} /><b>{p.title}</b><span className="hint">{p.organiser_name} → {p.target} · {p.region} · {p.topic} · goal {n(p.goal)} · {when(p.created_at)}</span><p style={{ margin: 0 }}>{p.ask}</p><p className="hint" style={{ margin: 0 }}>{p.why}</p>{p.origin === 'team' ? <TeamDraft p={p} note={notes?.find((x: any) => x.petition_id === p.id)} sources={(srcs ?? []).filter((x: any) => x.petition_id === p.id)} /> : p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">Source</a>}{p.link_url && <span className="hint">Button link ({p.link_cta}): <a href={p.link_url} target="_blank" rel="noopener nofollow">{p.link_url}</a> · check it is safe and belongs to the organiser</span>}<Decide kind="petition" id={p.id} note={suggested(ap.get(p.id))} /></div>) : <p className="hint">Nothing waiting.</p>}
    <h2>Videos ({vids?.length ?? 0})</h2>
    {vids?.length ? vids.map((v: any) => <div className="panel" key={v.id}><AiBadge r={av.get(v.id)} video /><b>{v.caption}</b><span className="hint">For: {v.petitions?.title} · {v.audience === 'friends' ? 'friends only · ' : ''}{when(v.created_at)}</span>{v.blur_faces && <p className="error" style={{ margin: 0 }}>The uploader says other people can be recognised. Approve only if they clearly agreed to be filmed or cannot be identified.</p>}{v.url && <video src={v.url} controls muted playsInline style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 10 }} />}<Decide kind="video" id={v.id} note={suggested(av.get(v.id))} /></div>) : <p className="hint">Nothing waiting.</p>}
  </>);
}

// Everything that still needs doing before real people use UNIER, checked live.
// A database update counts as missing only when the thing it adds does not exist.
const MIGRATIONS: [string, string, string][] = [
  ['0002', 'invites', 'user_id'], ['0003', 'news_items', 'id'], ['0004', 'reports', 'resolved_at'], ['0005', 'petitions', 'official_url'],
  ['0006', 'profiles', 'bio'], ['0007', 'petitions', 'link_url'], ['0012', 'petitions', 'tr'], ['0014', 'notices', 'id'],
  ['0015', 'share_codes', 'code'], ['0016', 'answer_links', 'petition_id'], ['0017', 'signatures', 'reason_key'],
  ['0018', 'appeals', 'id'], ['0019', 'petitions', 'easy'], ['0021', 'error_events', 'fingerprint'], ['0023', 'petition_sources', 'id'], ['0024', 'ai_reviews', 'id'], ['0025', 'team_videos', 'id'], ['0026', 'petitions', 'mt_tried_at'],
  ['0020', 'petition_counts', 'petition_id'],   // private table: "permission denied" means it exists
  ['0027', 'mail_sent', 'day'],                 // private table too
];
const FILES: Record<string, string> = { '0002': '0002_updates_invites', '0003': '0003_news', '0004': '0004_trust', '0005': '0005_report', '0006': '0006_social', '0007': '0007_links', '0012': '0012_translations', '0014': '0014_notify', '0015': '0015_reach', '0016': '0016_answers', '0017': '0017_safety_wins', '0018': '0018_lifecycle', '0019': '0019_kids', '0020': '0020_quality', '0021': '0021_email_sign', '0023': '0023_team_content', '0024': '0024_ai_moderation', '0025': '0025_team_videos', '0026': '0026_auto_translate', '0027': '0027_email_updates' };
const missing = (e: any) => !!e && /does not exist|PGRST20[45]|42703|42P01|schema cache/i.test(`${e.code} ${e.message}`);

async function Launch({ sb }: { sb: any }) {
  const probes = await Promise.all(MIGRATIONS.map(async ([v, table, col]) => [v, !missing((await sb.from(table).select(col).limit(1)).error)] as const));
  const todo = probes.filter(([, ok]) => !ok).map(([v]) => v);
  const [{ count: samples }, { data: mods }] = await Promise.all([
    sb.from('petitions').select('id', { count: 'exact', head: true }).ilike('organiser_name', '%(sample)%').neq('status', 'removed'),
    sb.rpc('admin_find_people', { p_query: '' }),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const ph = legalPlaceholders();
  const env = (...k: string[]) => k.every((x) => !!process.env[x]);
  const items: { ok: boolean; what: string; how: React.ReactNode }[] = [
    { ok: !todo.length, what: todo.length ? `Database updates to run: ${todo.join(', ')}` : 'Database is up to date',
      how: <>In Supabase, open SQL editor and run, in order: {todo.map((v) => <code key={v}>{FILES[v]}.sql </code>)}. The files are in the project&apos;s sql folder.</> },
    { ok: !samples, what: samples ? `${samples} sample petitions are still live` : 'No sample petitions left',
      how: samples ? <form action={removeSamples}><button className="btn small danger">Take the sample petitions down</button></form> : null },
    { ok: ph === 0, what: ph ? `${ph} gaps in the legal pages (name, address, email…)` : 'Legal pages are filled in',
      how: <>Send me the operator&apos;s name, address and contact email, and have a lawyer read <Link href="/privacy">Privacy</Link>, <Link href="/terms">Terms</Link> and <Link href="/imprint">Imprint</Link>.</> },
    { ok: !!site && !/vercel\.app|localhost/.test(site), what: site && !/vercel\.app|localhost/.test(site) ? `Own web address: ${site}` : 'Own web address',
      how: <>Buy a domain, add it in Vercel → Settings → Domains, then set <code>NEXT_PUBLIC_SITE_URL</code> to it.</> },
    { ok: env('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'), what: 'Phone notification keys',
      how: <>Add <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code> in Vercel → Settings → Environment Variables (they are in the project&apos;s setup folder).</> },
    { ok: env('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'), what: 'Bot check keys (Cloudflare Turnstile)',
      how: <>Make a free Turnstile widget at Cloudflare, add both keys in Vercel, then switch the check on under People.</> },
    { ok: env('CRON_SECRET'), what: 'Daily jobs secret', how: <>Set <code>CRON_SECRET</code> in Vercel so the daily news import and clean-up run.</> },
    { ok: env('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS') || env('BREVO_API_KEY', 'MAIL_FROM') || env('RESEND_API_KEY', 'MAIL_FROM'), what: 'Email sender (signing with only an email, error alerts)',
      how: <>For now, a Gmail address with an app password: set <code>SMTP_HOST</code>=smtp.gmail.com, <code>SMTP_PORT</code>=465, <code>SMTP_USER</code> and <code>SMTP_PASS</code> in Vercel. Put the same in Supabase → Authentication → Emails → SMTP, so login emails stop hitting the hourly limit. Once you have a domain, switch both to Resend or Brevo.</> },
    { ok: env('BREVO_API_KEY', 'MAIL_FROM') || env('RESEND_API_KEY', 'MAIL_FROM'), what: 'Email service for update emails (Brevo recommended)',
      how: <>Gmail is fine to start but not for many update emails. With a domain: make a free Brevo account, verify the domain (Senders &amp; Domains), create an API key, and set <code>BREVO_API_KEY</code> and <code>MAIL_FROM</code> (&quot;UNIER &lt;hello@your-domain&gt;&quot;) in Vercel. Resend works too with <code>RESEND_API_KEY</code>.</> },
    { ok: !!(process.env.NEXT_PUBLIC_DONATE_URL || process.env.NEXT_PUBLIC_DONATE_MONTHLY_URL || process.env.NEXT_PUBLIC_DONATE_LINKS), what: 'Donation links',
      how: <>Make Stripe Payment Links (one where the giver chooses the amount; a monthly one too if you like) and set <code>NEXT_PUBLIC_DONATE_URL</code> and <code>NEXT_PUBLIC_DONATE_MONTHLY_URL</code> in Vercel. Optional: amounts, currency, bank transfer and a contact email (see <code>.env.example</code>). Until then <Link href="/donate">Donate</Link> says &quot;opening soon&quot;.</> },
    { ok: env('ALERT_EMAIL'), what: 'Error alerts by email', how: <>Set <code>ALERT_EMAIL</code> in Vercel to the address that should hear when something breaks. See <Link href="/admin?tab=errors">Errors</Link>.</> },
    { ok: env('SUPABASE_SERVICE_ROLE_KEY'), what: 'Server key for Supabase', how: <>Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel (Supabase → Project settings → API).</> },
    { ok: aiReady() && aiKeySet(), what: 'AI key (sorts the review queue, drafts team petitions)',
      how: <>Create a key at console.anthropic.com, add a monthly spending limit there, and set <code>ANTHROPIC_API_KEY</code> in Vercel. Then choose a mode under <Link href="/admin?tab=ai">AI check</Link> and <Link href="/admin?tab=team">Team content</Link>. Without it, everything waits for a person and no petitions are drafted from the news.</> },
    { ok: (mods?.length ?? 0) >= 2, what: `${mods?.length ?? 0} moderator${mods?.length === 1 ? '' : 's'}`, how: <>Two or more, so reports are answered when one of you is away. Add one under <Link href="/admin?tab=people">People</Link>.</> },
  ];
  const left = items.filter((x) => !x.ok).length;
  return (<>
    <p style={{ margin: 0 }}><b>{left ? `${left} of ${items.length} left before launch` : 'Ready for launch ✓'}</b></p>
    <ul className="launch">{items.map((x) => (
      <li key={x.what} className={x.ok ? 'ok' : ''}><span aria-hidden="true">{x.ok ? '✓' : '○'}</span>
        <span className="stack" style={{ gap: 4 }}><b>{x.what}</b>{!x.ok && x.how && <span className="hint">{x.how}</span>}</span></li>))}</ul>
  </>);
}

async function Reports({ sb }: { sb: any }) {
  const base = 'id, reason, video_id, petition_id, created_at, videos(caption, storage_path), petitions(title)';
  let { data: reports, error } = await sb.from('reports').select(`${base}, profile_id, person:profiles!reports_profile_id_fkey(handle, display_name, bio), reason_key, update_id, answer:petition_updates(title, body, petition_id)`).eq('status', 'open').order('created_at').limit(50);
  if (error) ({ data: reports, error } = await sb.from('reports').select(`${base}, profile_id, person:profiles!reports_profile_id_fkey(handle, display_name, bio)`).eq('status', 'open').order('created_at').limit(50));   // before 0017
  if (error) ({ data: reports } = await sb.from('reports').select(base).eq('status', 'open').order('created_at').limit(50));   // before 0006_social.sql
  // A reported reason is read through a moderator-only function, which never says who wrote it.
  const said = new Map<string, any>(await Promise.all((reports ?? []).filter((r: any) => r.reason_key)
    .map(async (r: any) => [r.reason_key, (await sb.rpc('reported_reason', { p_key: r.reason_key })).data] as const)));
  const ar = await aiReviews(sb, 'report_id', (reports ?? []).map((r: any) => r.id));
  byRisk(reports, ar);
  const kind = (r: any) => r.reason_key ? 'Reason for signing' : r.update_id ? 'Official answer' : r.video_id ? 'Video' : r.petition_id ? 'Petition' : 'Person';
  return (<>
    <p className="hint" style={{ margin: 0 }}>Removing something sends your reason to its author. Dismiss keeps it online.</p>
    <AiLine />
    {reports?.length ? reports.map((r: any) => {
      const why = r.reason_key ? said.get(r.reason_key) : null;
      return (
      <div className="panel" key={r.id}>
        <AiBadge r={ar.get(String(r.id))} report />
        <span className="hint">{when(r.created_at)} · {kind(r)}</span>
        {r.reason_key ? <>{why?.petition_id && <Link href={`/p/${why.petition_id}`}>{why.title}</Link>}<b>“{why?.why ?? 'Already removed'}”</b>{why?.hidden && <span className="hint">Already hidden</span>}</>
          : r.update_id ? <>{r.answer?.petition_id && <Link href={`/p/${r.answer.petition_id}`}>See the petition</Link>}<b>{r.answer?.title ?? 'Already removed'}</b>{r.answer?.body && <span className="hint" style={{ whiteSpace: 'pre-line' }}>{r.answer.body}</span>}</>
          : <><b>{r.video_id ? r.videos?.caption : r.petition_id ? <Link href={`/p/${r.petition_id}`}>{r.petitions?.title}</Link>
            : <Link href={`/u/${r.person?.handle ?? r.profile_id}`}>{r.person?.display_name || (r.person?.handle ? '@' + r.person.handle : 'Profile')}</Link>}</b>
            {r.profile_id && r.person?.bio && <span className="hint">Bio: “{r.person.bio}”</span>}</>}
        <p style={{ margin: 0 }}>Report: “{r.reason}”</p>
        <form action={noop} className="row"><input type="hidden" name="report_id" value={r.id} /><input type="hidden" name="video_id" value={r.video_id ?? ''} /><input type="hidden" name="petition_id" value={r.petition_id ?? ''} /><input type="hidden" name="profile_id" value={r.profile_id ?? ''} /><input type="hidden" name="reason_key" value={r.reason_key ?? ''} /><input type="hidden" name="update_id" value={r.update_id ?? ''} />
          <input name="note" defaultValue={suggested(ar.get(String(r.id)))} placeholder={r.update_id ? 'Why it was removed (kept in the log)' : 'Reason shown to the author if removed'} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small" formAction={resolveReport.bind(null, 'dismiss')}>Dismiss</button><button className="btn small danger" formAction={resolveReport.bind(null, 'remove')}>{r.reason_key ? 'Hide reason' : r.profile_id && !r.video_id && !r.petition_id ? 'Clear name and bio' : 'Remove'}</button></form>
      </div>); }) : <p className="hint">No open reports.</p>}
  </>);
}

// Appeals: people asking for a second look at a moderation decision (EU Digital Services Act, article 20).
async function Appeals({ sb, me }: { sb: any; me: string }) {
  const [{ data: open, error }, { data: recent }] = await Promise.all([
    sb.from('appeals').select('*, petitions(title, status), videos(caption, storage_path)').eq('status', 'open').order('created_at').limit(50),
    sb.from('appeals').select('id, kind, status, reply, decided_at, petitions(title)').neq('status', 'open').order('decided_at', { ascending: false }).limit(15),
  ]);
  if (error) return <p className="hint">Appeals arrive here once the database update 0018_lifecycle.sql has run (see Launch checklist).</p>;
  const urls = new Map<string, string>();
  for (const a of (open ?? []).filter((x: any) => x.videos?.storage_path)) {
    const { data } = await sb.storage.from('videos').createSignedUrl(a.videos.storage_path, 3600); if (data?.signedUrl) urls.set(a.id, data.signedUrl);
  }
  const said = new Map<string, any>(await Promise.all((open ?? []).filter((a: any) => a.reason_key)
    .map(async (a: any) => [a.reason_key, (await sb.rpc('reported_reason', { p_key: a.reason_key })).data] as const)));
  const label: Record<string, string> = { petition: 'Petition removed', video: 'Video not approved', reason: 'Reason for signing hidden', profile: 'Name and bio cleared' };
  const wait = (d: string) => Math.floor((Date.now() - Date.parse(d)) / 864e5);
  return (<>
    <p className="hint" style={{ margin: 0 }}>Look at the decision again with fresh eyes. Reverse puts the content back; Keep leaves it down. Either way the author sees your reason, so write it for them. Answer within a week where you can.</p>
    {open?.length ? open.map((a: any) => (
      <div className="panel" key={a.id}>
        <span className="hint">{label[a.kind]} · appealed {when(a.created_at)}{wait(a.created_at) >= 7 ? ` · waiting ${wait(a.created_at)} days` : ''}</span>
        {a.kind === 'petition' && a.petition_id && <Link href={`/p/${a.petition_id}`}><b>{a.petitions?.title ?? 'Petition'}</b></Link>}
        {a.kind === 'video' && <><b>{a.videos?.caption ?? 'Video'}</b>{urls.get(a.id) && <video src={urls.get(a.id)} controls muted playsInline style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 10 }} />}</>}
        {a.kind === 'reason' && <b>“{said.get(a.reason_key)?.why ?? 'Reason no longer exists'}”</b>}
        {a.decision && <span>First decision: “{a.decision}”</span>}
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}><b>Their appeal:</b> {a.body}</p>
        {a.decided_first === me && <p className="note" style={{ margin: 0 }}>You made the first decision. If another moderator can look at this, let them, so the second look is a fresh one.</p>}
        <form action={noop} className="row"><input type="hidden" name="id" value={a.id} />
          <input name="note" required placeholder="Your reason (the author sees this)" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small" formAction={decideAppeal.bind(null, false)}>Keep decision</button>
          <button className="btn small primary" formAction={decideAppeal.bind(null, true)}>{a.kind === 'profile' ? 'Agree (they can rewrite it)' : 'Reverse and restore'}</button></form>
      </div>)) : <p className="hint">No open appeals.</p>}
    {!!recent?.length && <div className="panel" style={{ gap: 6 }}><b>Recently decided</b>
      {recent.map((a: any) => <span key={a.id} className="hint">{a.decided_at ? when(a.decided_at) : ''} · {label[a.kind]}{a.petitions?.title ? ` · ${a.petitions.title}` : ''} · <b>{a.status === 'reversed' ? 'reversed' : 'kept'}</b>{a.reply ? ` · “${a.reply}”` : ''}</span>)}</div>}
  </>);
}

// The petition in other languages. The original stays as written; readers see the version for their language.
function Translation({ p, open, q }: { p: any; open: boolean; q: string }) {
  const orig = (p.lang ?? 'en') as Lang;
  const others = (Object.keys(LANGS) as Lang[]).filter((l) => l !== orig);
  const count = (l: Lang) => ['title', 'target', 'ask', 'why'].filter((k) => (p.tr ?? {})[l]?.[k]).length;
  const href = (tr: string) => `/admin?tab=petitions${q ? `&q=${encodeURIComponent(q)}` : ''}${tr ? `&tr=${tr}` : ''}`;
  const status = others.map((l) => `${l.toUpperCase()} ${count(l) === 4 ? '✓' : count(l) ? `${count(l)}/4` : '–'}`).join(' · ');
  // The forms only render for the petition being translated, so the page stays light.
  const easy = (p.easy ?? {}) as Record<string, { title?: string; text?: string }>;
  const kids = (Object.keys(LANGS) as Lang[]).filter((l) => easy[l]?.title && easy[l]?.text);
  if (!open) return <div className="row between"><span className="hint">Written in {LANGS[orig]} · {status} · Kids: {kids.length ? kids.map((l) => l.toUpperCase()).join(' ') : '–'}</span><a className="btn small" href={href(p.id)}>Translations</a></div>;
  return (
    <section className="stack" style={{ gap: 8 }} id={`tr-${p.id}`}>
      <div className="row between"><b>Translations</b><a className="btn ghost small" href={href('')}>Done</a></div>
      <form action={setOriginalLang} className="row">
        <input type="hidden" name="id" value={p.id} />
        <label className="row">Written in <select name="lang" defaultValue={orig}>{(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l}>{LANGS[l]}</option>)}</select></label>
        <button className="btn small">Save</button>
      </form>
      {others.map((l) => {
        const tr = (p.tr ?? {})[l] ?? {};
        return (
          <form key={l} action={setTranslation} className="stack" lang={l}>
            <b className="hint">{LANGS[l]} {count(l) === 4 ? '· complete' : count(l) ? `· ${count(l)} of 4 fields` : '· missing'}{tr.auto ? ' · machine translated (saving it makes it yours, and it will not be replaced)' : ''}</b>
            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value={l} />
            <input name="title" maxLength={90} defaultValue={tr.title ?? ''} placeholder={`Title (${l})`} aria-label={`Title (${LANGS[l]})`} />
            <input name="target" maxLength={120} defaultValue={tr.target ?? ''} placeholder={`Target (${l})`} aria-label={`Target (${LANGS[l]})`} />
            <textarea name="ask" maxLength={2000} rows={3} defaultValue={tr.ask ?? ''} placeholder={`What we ask (${l})`} aria-label={`What we ask (${LANGS[l]})`} />
            <textarea name="why" maxLength={5000} rows={4} defaultValue={tr.why ?? ''} placeholder={`Why it matters (${l})`} aria-label={`Why it matters (${LANGS[l]})`} />
            <button className="btn small">Save {LANGS[l]}</button>
          </form>
        );
      })}
      {'easy' in p && <form action={setEasy} className="stack" id={`easy-${p.id}`}>
        <b>Easy-read for kids</b>
        <span className="hint">A short title and two or three plain sentences a 7 year old understands. With text in any language, the petition shows in the kids corner (/kids) and gets an easy-read box. Leave everything empty to take it out.</span>
        <input type="hidden" name="id" value={p.id} />
        {(Object.keys(LANGS) as Lang[]).map((l) => (
          <div key={l} className="stack" style={{ gap: 4 }} lang={l}>
            <input name={`title_${l}`} maxLength={70} defaultValue={easy[l]?.title ?? ''} placeholder={`Kids' title (${l})`} aria-label={`Kids' title (${LANGS[l]})`} />
            <textarea name={`text_${l}`} maxLength={400} rows={2} defaultValue={easy[l]?.text ?? ''} placeholder={`In simple words (${l})`} aria-label={`In simple words (${LANGS[l]})`} />
          </div>))}
        <button className="btn small">Save easy-read</button>
      </form>}
    </section>
  );
}

async function Petitions({ sb, q, open }: { sb: any; q: string; open: string }) {
  let query = sb.from('petitions').select('*, petition_stats(combined)').order('created_at', { ascending: false }).limit(60);
  if (q) query = query.ilike('title', `%${q}%`);
  const [{ data: ps }, { data: all }] = await Promise.all([query, sb.from('petitions').select('id, title').eq('status', 'live').order('title').limit(500)]);
  return (<>
    <LiveList items={all} />
    <form action={runLifecycle} className="row"><button className="btn small">Close ended petitions now</button><span className="hint">Also runs every night: closes petitions after their end date, reminds organisers to deliver, and tells followers when a target has been silent 30 or 90 days.</span></form>
    <form className="field" action="/admin"><input type="hidden" name="tab" value="petitions" /><input name="q" type="search" defaultValue={q} placeholder="Search petitions" aria-label="Search petitions" /></form>
    {ps?.map((p: any) => (
      <div className="panel" key={p.id} style={{ gap: 8 }}>
        <div className="row between"><Link href={`/p/${p.id}`} style={{ flex: 1, minWidth: 0 }}><b>{p.title}</b></Link><span className="hint">{p.status}{p.ends_on ? ` · ends ${p.ends_on}` : ''} · {n(Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0))}{p.cluster_id ? ' · united' : ''}</span></div>
        <form action={noop} className="row"><input type="hidden" name="id" value={p.id} />
          <input name="note" placeholder="Reason if removing" style={{ flex: 1, minWidth: 0 }} />
          {p.status !== 'live' && <button className="btn small" formAction={petitionStatus.bind(null, 'live')}>Make live</button>}
          {p.status === 'live' && <button className="btn small" formAction={petitionStatus.bind(null, 'closed')}>Close</button>}
          {p.status !== 'removed' && <button className="btn small danger" formAction={petitionStatus.bind(null, 'removed')}>Remove</button>}</form>
        {p.status === 'live' && <form action={setFeatured} className="row"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.featured ? '' : '1'} />
          <span className="hint" style={{ flex: 1 }}>{p.featured ? '★ Big community goal (shown on the Mylo page)' : 'Not a big community goal'}</span>
          <button className="btn small">{p.featured ? 'Unpin goal' : 'Pin as big goal'}</button></form>}
        {p.status === 'live' && <form action={unite} className="row"><input type="hidden" name="id" value={p.id} />
          <input name="with" list="live-petitions" required placeholder="Unite with… (type a title or paste a link)" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small">Unite</button></form>}
        <form action={setOfficial} className="row"><input type="hidden" name="id" value={p.id} />
          <input name="url" type="url" defaultValue={p.official_url ?? ''} placeholder="Official petition link (https://…)" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small">Save link</button></form>
        <form action={setLink} className="row"><input type="hidden" name="id" value={p.id} />
          <input name="url" type="url" defaultValue={p.link_url ?? ''} placeholder="Organiser's website (https://…)" style={{ flex: 1, minWidth: 0 }} />
          <select name="cta" defaultValue={p.link_cta ?? 'learn'}>{['learn', 'visit', 'donate', 'join', 'event'].map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <button className="btn small">Save</button></form>
        <Translation p={p} open={open === p.id} q={q} />
        {p.cluster_id && <form action={separate}><input type="hidden" name="id" value={p.id} /><button className="btn ghost small">Separate from its group</button></form>}
      </div>))}
  </>);
}

async function News({ sb }: { sb: any }) {
  const [{ data: sources }, { data: news }, { data: live }] = await Promise.all([
    sb.from('news_sources').select('*').order('lang').order('name'),
    sb.from('news_items').select('id, url, title, topic, lang, status, petition_id, published_at, news_sources(name)').gte('published_at', new Date(Date.now() - 48 * 3.6e6).toISOString()).order('published_at', { ascending: false }).limit(80),
    sb.from('petitions').select('id, title').eq('status', 'live').order('title').limit(500),
  ]);
  return (<>
    <LiveList items={live} />
    <form action={importNews} className="row"><button className="btn primary">Import news now</button><span className="hint">Also runs on its own every morning.</span></form>
    <div className="panel" style={{ gap: 6 }}><b>Sources</b>
      {sources?.map((s: any) => <form key={s.id} action={toggleSource} className="row between"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} />
        <span style={{ flex: 1, minWidth: 0 }}>{s.active ? '' : '⏸ '}{s.name} <span className="hint">({s.lang}) · {s.last_fetched_at ? `${when(s.last_fetched_at)} · ${s.last_status} · +${s.last_count}` : 'never fetched'}</span></span>
        <button className="btn ghost small">{s.active ? 'Pause' : 'Resume'}</button></form>)}
    </div>
    <div className="panel" style={{ gap: 12 }}><b>Last 48 hours ({news?.length ?? 0})</b>
      {news?.map((x: any) => (
        <div key={x.id} className="stack" style={{ gap: 4, opacity: x.status === 'hidden' ? 0.45 : 1 }}>
          <a href={x.url} target="_blank" rel="noopener nofollow"><b>{x.title}</b></a>
          <span className="hint">{x.news_sources?.name} · {x.topic} · {x.lang} · {when(x.published_at)}{x.status === 'hidden' ? ' · hidden' : ''}</span>
          <form action={newsAction.bind(null, 'attach')} className="row"><input type="hidden" name="id" value={x.id} />
            <input name="petition_id" list="live-petitions" defaultValue={x.petition_id ?? ''} placeholder="Attach a petition (type a title)" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn small">Attach</button>
            {x.status !== 'hidden' && <button className="btn small danger" formAction={newsAction.bind(null, 'hide')}>Hide</button>}</form>
        </div>))}
    </div>
  </>);
}

// Team content (0023): how much the UNIER team makes and shows, and what the drafting helper decided.
const LEVELS: [string, string, string][] = [
  ['auto', 'Automatic', 'Full while people start fewer than 30 petitions a month, then less on its own.'],
  ['full', 'Full', 'Up to 3 drafts a day from the news; team petitions and videos rank like any other.'],
  ['less', 'Less', '1 draft a day; team content ranks lower in the feed so people\'s own petitions come first.'],
  ['off', 'Off', 'No new drafts or team videos, and team content leaves the feed. Links and signatures keep working.'],
];
async function Team({ sb, ran }: { sb: any; ran?: string }) {
  const [{ data: site, error }, { data: level }, { data: log }, { count: waiting }, { count: live }, { count: people }] = await Promise.all([
    sb.from('site_settings').select('team_content').maybeSingle(),
    sb.rpc('team_content_level'),
    sb.from('team_drafts').select('id, headline, decision, reason, petition_id, created_at').order('created_at', { ascending: false }).limit(25),
    sb.from('petitions').select('id', { count: 'exact', head: true }).eq('origin', 'team').eq('status', 'pending'),
    sb.from('petitions').select('id', { count: 'exact', head: true }).eq('origin', 'team').eq('status', 'live'),
    sb.from('petitions').select('id', { count: 'exact', head: true }).neq('origin', 'team').in('status', ['live', 'closed']).gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);
  if (error) return <p className="hint">Team content needs the database update 0023_team_content.sql (see Launch checklist).</p>;
  const now = site?.team_content ?? 'auto';
  const label: Record<string, string> = { drafted: 'Drafted', skipped: 'Skipped', duplicate: 'Already covered', failed: 'Failed' };
  return (<>
    <p className="hint" style={{ margin: 0 }}>Until enough people start their own petitions and post videos, the UNIER team fills the gap. An AI helper reads the biggest stories from the trusted sources under News each morning and drafts petitions with their sources. Every draft waits in the <Link href="/admin?tab=queue">Review queue</Link>: check the facts, edit, then approve or reject. Team petitions are labelled &ldquo;From the UNIER team&rdquo; everywhere.</p>
    <form action={setTeamContent} className="panel" style={{ gap: 8 }}><b>How much team content</b>
      {LEVELS.map(([k, name, what]) => <label key={k} className="row" style={{ alignItems: 'flex-start', gap: 8 }}><input type="radio" name="level" value={k} defaultChecked={now === k} /><span><b>{name}</b>{k === 'auto' && now === 'auto' ? ` (now: ${level ?? 'full'})` : ''}<br /><span className="hint">{what}</span></span></label>)}
      <span className="hint">People-made petitions in the last 30 days: {n(people ?? 0)} (automatic switches to less at 30).</span>
      <button className="btn small primary" style={{ alignSelf: 'flex-start' }}>Save</button>
    </form>
    <div className="tiles"><div className="tile"><span className="label">Waiting for review</span><b className="num">{n(waiting ?? 0)}</b></div><div className="tile"><span className="label">Live team petitions</span><b className="num">{n(live ?? 0)}</b></div></div>
    {!aiReady() && <p className="note" style={{ margin: 0 }}>No AI key yet, so nothing is drafted. Set <code>ANTHROPIC_API_KEY</code> in Vercel (see Launch checklist).</p>}
    <form action={draftNow} className="row"><button className="btn">Draft now</button><span className="hint">Also runs on its own every morning at 6:30 (Hungarian time), after the news import.</span></form>
    {ran && <p className="note" role="status" style={{ margin: 0 }}>{ran}</p>}
    <div className="panel" style={{ gap: 8 }}><b>What the helper decided</b>
      {log?.length ? log.map((d: any) => <span key={d.id} className="hint">{when(d.created_at)} · <b>{label[d.decision]}</b> · {d.petition_id ? <Link href={`/p/${d.petition_id}`}>{d.headline}</Link> : d.headline}{d.reason ? ` · ${d.reason}` : ''}</span>) : <p className="hint" style={{ margin: 0 }}>Nothing yet.</p>}
    </div>
  </>);
}

// A team draft in the review queue: why the helper picked it, what to check, its sources, and an edit form.
function TeamDraft({ p, note, sources }: { p: any; note?: any; sources: any[] }) {
  return (<div className="stack" style={{ gap: 6 }}>
    <span className="team-tag">From the UNIER team · drafted by AI · check the facts</span>
    {note?.note && <p className="note" style={{ margin: 0 }}>To check: {note.note}</p>}
    {sources.length > 0 && <span className="hint">Sources: {sources.map((x: any, i: number) => <span key={x.url}>{i ? ' · ' : ''}<a href={x.url} target="_blank" rel="noopener nofollow">{x.outlet}</a></span>)}</span>}
    <details><summary>Edit before approving</summary>
      <form action={editDraft} className="stack" style={{ gap: 6 }}><input type="hidden" name="id" value={p.id} />
        <label>Title <input name="title" defaultValue={p.title} maxLength={90} required /></label>
        <label>To <input name="target" defaultValue={p.target} maxLength={120} required /></label>
        <label>Where <input name="region" defaultValue={p.region} maxLength={80} required /></label>
        <label>The ask <textarea name="ask" defaultValue={p.ask} rows={3} maxLength={2000} required /></label>
        <label>Why <textarea name="why" defaultValue={p.why} rows={6} maxLength={5000} required /></label>
        <button className="btn small" style={{ alignSelf: 'flex-start' }}>Save changes</button></form>
    </details>
  </div>);
}

// Team videos: clips from trusted channels that fill the feed until people post their own.
async function Clips({ sb }: { sb: any }) {
  const [{ data: sources, error }, { data: clips }, { data: live }, { data: level }] = await Promise.all([
    sb.from('video_sources').select('*').order('name'),
    sb.from('team_videos').select('id, youtube_id, title, topic, status, published_at, petition_id, video_sources(name), petitions(title)').order('published_at', { ascending: false }).limit(60),
    sb.from('petitions').select('id, title').eq('status', 'live').order('title').limit(500),
    sb.rpc('team_content_level'),
  ]);
  if (missing(error)) return <p className="hint">Team videos arrive here once the database update 0025_team_videos.sql has run (see Launch checklist).</p>;
  return (<>
    <LiveList items={live} />
    <p className="hint">Short clips from trusted channels, each shown in the feed under the petition it fits, marked “UNIER team pick”. Only the link is stored; the clip plays in YouTube’s own player after a tap.
      {' '}How many show follows the team content switch{level ? <> (now: <b>{level}</b>)</> : ''}: <i>less</i> shows a few and ranks them below people’s videos, <i>off</i> hides them.</p>
    <form action={importClips} className="row"><button className="btn primary">Fetch new clips now</button><span className="hint">Also runs on its own every morning, with the news.</span></form>
    <div className="panel" style={{ gap: 6 }}><b>Channels</b>
      {sources?.map((x: any) => <form key={x.id} action={toggleVideoSource} className="row between"><input type="hidden" name="source" value={x.id} /><input type="hidden" name="active" value={String(!x.active)} />
        <span style={{ flex: 1, minWidth: 0 }}>{x.active ? '' : '⏸ '}{x.name} <span className="hint">({x.lang}) · {x.last_fetched_at ? `${when(x.last_fetched_at)} · ${x.last_status} · +${x.last_count}` : 'never fetched'}</span></span>
        <button className="btn ghost small">{x.active ? 'Pause' : 'Resume'}</button></form>)}
    </div>
    <div className="panel" style={{ gap: 12 }}><b>Clips ({clips?.length ?? 0})</b>
      {!clips?.length && <span className="hint">None yet. Press “Fetch new clips now”.</span>}
      {clips?.map((x: any) => (
        <div key={x.id} className="stack clip-row" style={{ gap: 4, opacity: x.status === 'hidden' ? 0.45 : 1 }}>
          <a href={`https://www.youtube.com/watch?v=${x.youtube_id}`} target="_blank" rel="noopener nofollow"><b>{x.title}</b></a>
          <span className="hint">{x.video_sources?.name} · {x.topic} · {when(x.published_at)} · under “{x.petitions?.title ?? '?'}”{x.status === 'hidden' ? ' · hidden' : ''}</span>
          <form action={clipAction.bind(null, 'attach')} className="row"><input type="hidden" name="clip" value={x.id} />
            <input name="petition_id" list="live-petitions" defaultValue={x.petition_id ?? ''} placeholder="Move to a petition (type a title)" aria-label="Petition for this clip" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn small">Move</button>
            {x.status === 'hidden' ? <button className="btn small" formAction={clipAction.bind(null, 'show')}>Show again</button>
              : <button className="btn small danger" formAction={clipAction.bind(null, 'hide')}>Hide</button>}</form>
        </div>))}
    </div>
  </>);
}

// One shared list of live petitions for every "unite" and "attach" box (typing a title suggests the match).
const LiveList = ({ items }: { items: any[] | null }) => <datalist id="live-petitions">{items?.map((o) => <option key={o.id} value={o.id} label={o.title} />)}</datalist>;

async function People({ sb, q, me }: { sb: any; q: string; me: string }) {
  const [{ data: people }, { data: site }] = await Promise.all([sb.rpc('admin_find_people', { p_query: q }), sb.from('site_settings').select('require_human_check').maybeSingle()]);
  const keys = !!(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  const push = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const on = !!site?.require_human_check;
  return (<>
    <form action={setHumanCheck} className="panel stack" style={{ gap: 8 }}>
      <span className="label">Protection against fake accounts</span>
      <span className="hint">Cloudflare keys: {keys ? 'set ✓' : 'not set yet (sign-up and signing work without the check)'} · Phone notifications: {push ? 'ready ✓' : 'need the two VAPID keys'}</span>
      <input type="hidden" name="on" value={String(!on)} />
      <span>Bot check before signing: <b>{on ? 'on' : 'off'}</b>. People pass it once every 30 days.</span>
      <button className={`btn small ${on ? 'danger' : ''}`} disabled={!on && !keys}>{on ? 'Switch off' : keys ? 'Switch on' : 'Add the Cloudflare keys first'}</button>
    </form>
    <form className="field" action="/admin"><input type="hidden" name="tab" value="people" /><input name="q" type="search" defaultValue={q} placeholder="Search by email, handle or name" aria-label="Search people" /></form>
    <p className="hint" style={{ margin: 0 }}>{q ? 'Results' : 'Moderators'}. Signatures stay private, even here.</p>
    {people?.map((p: any) => (
      <form action={setModerator} key={p.id} className="panel row between" style={{ gap: 8 }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={String(!p.is_moderator)} />
        <span style={{ flex: 1, minWidth: 0 }}><b>{p.display_name || (p.handle ? '@' + p.handle : p.email)}</b><span className="hint" style={{ display: 'block' }}>{p.email} · joined {when(p.created_at)}{p.is_moderator ? ' · moderator' : ''}</span></span>
        {p.id !== me && <button className={`btn small ${p.is_moderator ? 'danger' : ''}`}>{p.is_moderator ? 'Remove moderator' : 'Make moderator'}</button>}
      </form>))}
  </>);
}

async function Errors({ sb }: { sb: any }) {
  const { data, error } = await sb.from('error_events').select('fingerprint, source, message, path, detail, count, first_seen, last_seen, resolved_at').order('last_seen', { ascending: false }).limit(60);
  if (missing(error)) return <p className="hint">Run <code>0021_email_sign.sql</code> to start keeping a log of errors.</p>;
  const open = (data ?? []).filter((e: any) => !e.resolved_at);
  const fixed = (data ?? []).filter((e: any) => e.resolved_at);
  const ready = !!process.env.ALERT_EMAIL && mailReady();
  const Row = ({ e }: { e: any }) => (
    <div className="panel">
      <span className="hint">{e.source} · {e.count}× · last {when(e.last_seen)} · first {when(e.first_seen)}</span>
      <b style={{ overflowWrap: 'anywhere' }}>{e.message}</b>
      {e.path && <code>{e.path}</code>}
      {e.detail && <details><summary className="hint">Details</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{e.detail}</pre></details>}
      {!e.resolved_at && <form action={resolveError}><input type="hidden" name="fp" value={e.fingerprint} /><button className="btn small">Mark as fixed</button></form>}
    </div>
  );
  return (<>
    <p className="hint" style={{ margin: 0 }}>
      {ready ? <>Alerts go to <b>{process.env.ALERT_EMAIL}</b>: once per kind of error, then at most every 6 hours while it continues.</> : <>Alerts are off. Set <code>ALERT_EMAIL</code> and the email sender in Vercel (see Launch checklist).</>}
      {' '}To hear when the whole site is down, add a free monitor (for example UptimeRobot) for <code>/api/health</code>.
    </p>
    {ready && <form action={testAlert}><button className="btn small">Send a test alert</button></form>}
    {open.length ? open.map((e: any) => <Row key={e.fingerprint} e={e} />) : <p className="hint">No open errors.</p>}
    {fixed.length > 0 && <details><summary className="hint">Marked as fixed ({fixed.length})</summary>{fixed.map((e: any) => <Row key={e.fingerprint} e={e} />)}</details>}
  </>);
}

// ---------- AI check (0024) ----------
// The latest AI opinion for each item, by id. Empty (no labels) before 0024 has run.
async function aiReviews(sb: any, col: 'petition_id' | 'video_id' | 'report_id', ids: (string | number)[]): Promise<Map<string, any>> {
  if (!ids.length) return new Map();
  const { data } = await sb.from('ai_reviews').select(`${col}, verdict, risk, confidence, rules, summary, author_note, action, created_at`).in(col, ids).order('created_at');
  return new Map((data ?? []).map((r: any) => [String(r[col]), r]));
}
const RISK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
// Most worrying first; items the AI has not seen yet keep their place among the medium ones.
function byRisk(list: any[] | null, ai: Map<string, any>) {
  list?.sort((a, b) => (RISK[ai.get(String(a.id))?.risk ?? 'medium'] - RISK[ai.get(String(b.id))?.risk ?? 'medium']) || (a.created_at < b.created_at ? -1 : 1));
}
// The AI's proposed reason for the author, ready in the box. The moderator can change it or approve anyway.
const suggested = (r?: any) => (r && r.verdict !== 'ok' && r.author_note ? r.author_note : undefined);
const RULE_NAMES: Record<string, string> = { spam: 'spam', scam: 'scam', hate: 'hate', harassment: 'harassment', threat: 'threat', violence: 'violence', sexual: 'sexual content', child_safety: 'child safety', self_harm: 'self-harm', private_info: 'private information', false_information: 'false information', impersonation: 'impersonation', illegal: 'illegal', manipulation: 'tries to instruct the AI', not_a_petition: 'not a petition', unsafe_link: 'unsafe link' };

function AiBadge({ r, video, report }: { r?: any; video?: boolean; report?: boolean }) {
  if (!r) return null;
  const pct = `${Math.round(Number(r.confidence) * 100)}% sure`;
  const rules = (r.rules ?? []).map((x: string) => RULE_NAMES[x] ?? x).join(', ');
  const head = r.verdict === 'ok' ? (report ? 'AI: the report looks unfounded' : 'AI: looks fine')
    : r.verdict === 'breaks_rules' ? (report ? `AI: the report looks right${rules ? ` (${rules})` : ''}` : `AI: may break the rules${rules ? ` (${rules})` : ''}`)
    : `AI: a person should look${rules ? ` (${rules})` : ''}`;
  return (
    <div className={`ai-flag ai-${r.risk === 'urgent' ? 'urgent' : r.verdict}`} role="note">
      <b>{r.risk === 'urgent' ? 'Urgent · ' : ''}{head}</b> <span className="hint">· {pct}{video ? ' · caption only, watch the video' : ''}</span>
      {r.summary && <span className="hint" style={{ display: 'block' }}>{r.summary}</span>}
    </div>
  );
}
async function AiLine() {
  return aiKeySet() ? null : <p className="hint" style={{ margin: 0 }}>The AI check is not set up, so nothing here is pre-sorted. See <Link href="/admin?tab=ai">AI check</Link>.</p>;
}

// Automatic translations (0026): petitions show in each visitor's language.
async function Translations({ sb }: { sb: any }) {
  const [{ data: site, error }, { count: done }, { count: today }] = await Promise.all([
    sb.from('site_settings').select('auto_translate').maybeSingle(),
    sb.from('petitions').select('id', { count: 'exact', head: true }).not('tr', 'eq', '{}').in('status', ['live', 'closed']),
    sb.from('petitions').select('id', { count: 'exact', head: true }).gte('mt_tried_at', new Date(Date.now() - 864e5).toISOString()),
  ]);
  if (missing(error) || !site || site.auto_translate === undefined) return <div className="panel"><span className="hint">Run <code>0026_auto_translate.sql</code> in Supabase to translate petitions automatically.</span></div>;
  const on = !!site.auto_translate;
  return (
    <div className="panel stack" style={{ gap: 8 }} id="translations">
      <span className="label">Automatic translations</span>
      <span className="hint">The first time someone opens a published petition, the AI translates it into the other site languages and keeps the result. Visitors see it marked as a machine translation, with a link to the original. Your own translations (under Petitions) always win and are never replaced. When a petition&apos;s text changes, it is translated again.</span>
      <span className="hint">{aiKeySet() ? <>Model <code>{translateModel()}</code></> : <>Needs <code>ANTHROPIC_API_KEY</code> in Vercel; until then visitors see the original text.</>} · Petitions with a translation: {n(done ?? 0)} · Translated in the last 24 hours: {n(today ?? 0)} of {n(translateDailyLimit())} (<code>AI_TRANSLATE_DAILY_LIMIT</code>)</span>
      <form action={setAutoTranslate.bind(null, !on)} className="row between" style={{ gap: 8 }}>
        <b>{on ? 'On' : 'Off'}</b>
        <button className="btn small">{on ? 'Switch off' : 'Switch on'}</button>
      </form>
    </div>);
}

async function AiCheck({ sb }: { sb: any }) {
  const [{ data: site, error }, { data: recent }, { count: today }, { data: stats }] = await Promise.all([
    sb.from('site_settings').select('ai_moderation').maybeSingle(),
    sb.from('ai_reviews').select('id, kind, verdict, risk, confidence, rules, summary, action, created_at, petition_id, petitions(title, status)').neq('action', 'none').order('created_at', { ascending: false }).limit(30),
    sb.from('ai_reviews').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 864e5).toISOString()),
    sb.rpc('ai_stats'),
  ]);
  if (missing(error) || !site || site.ai_moderation === undefined) return <p className="hint">Run <code>0024_ai_moderation.sql</code> in Supabase to use the AI check (see <Link href="/admin?tab=launch">Launch checklist</Link>).</p>;
  const mode = site.ai_moderation as 'off' | 'suggest' | 'auto';
  const key = aiKeySet();
  const MODES = [
    ['off', 'Off', 'No AI. Every item waits for a person, as before.'],
    ['suggest', 'Suggest', 'The AI reads every new petition, video caption and report, labels it, sorts the most worrying first and drafts the reason for the author. People still decide everything.'],
    ['auto', 'Auto', 'Like Suggest, and it also publishes petitions it is very sure are fine (no button link, not written by the UNIER team) and takes down clear spam and scams, telling the author it was automatic and that they can ask a person for a second look. Videos and reports always wait for a person.'],
  ] as const;
  const st = (stats ?? {}) as Record<string, number>;
  return (<>
    <div className="panel stack" style={{ gap: 8 }}>
      <span className="label">How it works</span>
      <span className="hint">Key: {key ? <>set ✓ · model <code>{aiModel()}</code></> : <>not set. Add <code>ANTHROPIC_API_KEY</code> in Vercel; until then the queue stays fully manual.</>} · Checks in the last 24 hours: {n(today ?? 0)} of {n(aiDailyLimit())} (<code>AI_DAILY_LIMIT</code>)</span>
      <span className="hint">New items are checked a few seconds after they arrive, and again every night for anything missed. Urgent ones (threats, child safety, self-harm, private details) are emailed to <code>ALERT_EMAIL</code> straight away. The AI sees the text only, never who wrote a report or who signed.</span>
      {MODES.map(([k, label, text]) => (
        <form key={k} action={setAiMode.bind(null, k)} className="row between" style={{ gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0 }}><b>{label}{mode === k ? ' · on now' : ''}</b><span className="hint" style={{ display: 'block' }}>{text}</span></span>
          {mode !== k && <button className="btn small">Use {label}</button>}
        </form>))}
      {key && mode !== 'off' && <form action={runAiNow}><button className="btn small">Check waiting items now</button></form>}
    </div>
    <Translations sb={sb} />
    <div className="tiles">{([['Checked (30 days)', st.checked_30d], ['Published by the AI', st.approved_30d], ['Taken down by the AI', st.removed_30d], ['Sent to a person', st.to_people_30d]] as const).map(([k, v]) =>
      <div className="tile" key={k}><span className="label">{k}</span><b className="num">{n(Number(v ?? 0))}</b></div>)}</div>
    <div className="panel" style={{ gap: 6 }}><b>Decided by the AI, newest first</b>
      <span className="hint">Spot-check these now and then. To undo, open the petition under <Link href="/admin?tab=petitions">Petitions</Link>; the author can also appeal.</span>
      {recent?.length ? recent.map((r: any) => (
        <span key={r.id}>{when(r.created_at)} · <b>{r.action === 'approved' ? 'published' : 'taken down'}</b> · {r.petition_id ? <Link href={`/p/${r.petition_id}`}>{r.petitions?.title ?? 'Petition'}</Link> : r.kind}
          <span className="hint"> · now {r.petitions?.status ?? '–'} · {Math.round(Number(r.confidence) * 100)}% sure{r.summary ? ` · ${r.summary}` : ''}</span></span>))
        : <span className="hint">{mode === 'auto' ? 'Nothing yet.' : 'Nothing: the AI only decides on its own in Auto mode.'}</span>}
    </div>
  </>);
}
