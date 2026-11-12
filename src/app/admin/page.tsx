import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { fmtN, LANGS, type Lang } from '@/lib/i18n/dict';
import { noop, review, petitionStatus, setOfficial, setLink, setFeatured, setTranslation, setOriginalLang, setEasy, unite, separate, resolveReport, setModerator, setHumanCheck, importNews, newsAction, toggleSource, removeSamples } from './actions';
import { legalPlaceholders } from '@/lib/legal';

export const dynamic = 'force-dynamic';
const TABS = [['overview', 'Overview'], ['launch', 'Launch checklist'], ['queue', 'Review queue'], ['reports', 'Reports'], ['petitions', 'Petitions'], ['news', 'News'], ['people', 'People']] as const;
type Tab = (typeof TABS)[number][0];
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const n = (x: number) => fmtN(x, 'en');

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; err?: string; tr?: string }> }) {
  const { sb, user } = await currentUser();
  if (!user) redirect('/login?next=/admin');
  const { data: me } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!me?.is_moderator) return (
    <div className="empty"><h1>Admin is for moderators</h1>
      <p>You are signed in as <b>{user.email}</b>, but this account is not a moderator yet. Make it one in the Supabase SQL editor, then reload this page.</p>
      <Link className="btn" href="/">← Back to UNIER</Link></div>
  );
  const { tab: raw = 'overview', q = '', err, tr: open = '' } = await searchParams;
  const tab = (TABS.some(([k]) => k === raw) ? raw : 'overview') as Tab;
  const { data: stats } = await sb.rpc('admin_stats');
  const st = (stats ?? {}) as Record<string, number>;
  const badge: Partial<Record<Tab, number>> = { queue: (st.petitions_pending ?? 0) + (st.videos_pending ?? 0), reports: st.reports_open ?? 0 };

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
      {tab === 'petitions' && <Petitions sb={sb} q={q} open={open} />}
      {tab === 'news' && <News sb={sb} />}
      {tab === 'people' && <People sb={sb} q={q} me={user.id} />}
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

const Decide = ({ kind, id }: { kind: string; id: string }) => (
  <form action={noop} className="row"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
    <input name="note" placeholder="Reason if not approved (the author sees this)" style={{ flex: 1, minWidth: 0 }} />
    <button className="btn small primary" formAction={review.bind(null, 'approve')}>Approve</button><button className="btn small danger" formAction={review.bind(null, 'reject')}>Reject</button></form>
);

async function Queue({ sb }: { sb: any }) {
  const [{ data: pets }, { data: vids }] = await Promise.all([
    sb.from('petitions').select('*').eq('status', 'pending').order('created_at').limit(30),
    sb.from('videos').select('id, caption, storage_path, petition_id, created_at, blur_faces, audience, petitions(title)').eq('status', 'pending').order('created_at').limit(30),
  ]);
  const urls = vids?.length ? (await sb.storage.from('videos').createSignedUrls(vids.map((v: any) => v.storage_path), 3600)).data ?? [] : [];
  return (<>
    <h2>Petitions ({pets?.length ?? 0})</h2>
    {pets?.length ? pets.map((p: any) => <div className="panel" key={p.id}><b>{p.title}</b><span className="hint">{p.organiser_name} → {p.target} · {p.region} · {p.topic} · goal {n(p.goal)} · {when(p.created_at)}</span><p style={{ margin: 0 }}>{p.ask}</p><p className="hint" style={{ margin: 0 }}>{p.why}</p>{p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">Source</a>}{p.link_url && <span className="hint">Button link ({p.link_cta}): <a href={p.link_url} target="_blank" rel="noopener nofollow">{p.link_url}</a> · check it is safe and belongs to the organiser</span>}<Decide kind="petition" id={p.id} /></div>) : <p className="hint">Nothing waiting.</p>}
    <h2>Videos ({vids?.length ?? 0})</h2>
    {vids?.length ? vids.map((v: any, i: number) => <div className="panel" key={v.id}><b>{v.caption}</b><span className="hint">For: {v.petitions?.title} · {v.audience === 'friends' ? 'friends only · ' : ''}{when(v.created_at)}</span>{v.blur_faces && <p className="error" style={{ margin: 0 }}>The uploader says other people can be recognised. Approve only if they clearly agreed to be filmed or cannot be identified.</p>}{urls[i]?.signedUrl && <video src={urls[i].signedUrl} controls muted playsInline style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 10 }} />}<Decide kind="video" id={v.id} /></div>) : <p className="hint">Nothing waiting.</p>}
  </>);
}

// Everything that still needs doing before real people use UNIER, checked live.
// A database update counts as missing only when the thing it adds does not exist.
const MIGRATIONS: [string, string, string][] = [
  ['0002', 'invites', 'user_id'], ['0003', 'news_items', 'id'], ['0004', 'reports', 'resolved_at'], ['0005', 'petitions', 'official_url'],
  ['0006', 'profiles', 'bio'], ['0007', 'petitions', 'link_url'], ['0012', 'petitions', 'tr'], ['0014', 'notices', 'id'],
  ['0015', 'share_codes', 'code'], ['0016', 'answer_links', 'petition_id'], ['0017', 'signatures', 'reason_key'], ['0018', 'petitions', 'easy'],
];
const FILES: Record<string, string> = { '0002': '0002_updates_invites', '0003': '0003_news', '0004': '0004_trust', '0005': '0005_report', '0006': '0006_social', '0007': '0007_links', '0012': '0012_translations', '0014': '0014_notify', '0015': '0015_reach', '0016': '0016_answers', '0017': '0017_safety_wins', '0018': '0018_kids' };
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
    { ok: env('SUPABASE_SERVICE_ROLE_KEY'), what: 'Server key for Supabase', how: <>Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel (Supabase → Project settings → API).</> },
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
  const kind = (r: any) => r.reason_key ? 'Reason for signing' : r.update_id ? 'Official answer' : r.video_id ? 'Video' : r.petition_id ? 'Petition' : 'Person';
  return (<>
    <p className="hint" style={{ margin: 0 }}>Removing something sends your reason to its author. Dismiss keeps it online.</p>
    {reports?.length ? reports.map((r: any) => {
      const why = r.reason_key ? said.get(r.reason_key) : null;
      return (
      <div className="panel" key={r.id}>
        <span className="hint">{when(r.created_at)} · {kind(r)}</span>
        {r.reason_key ? <>{why?.petition_id && <Link href={`/p/${why.petition_id}`}>{why.title}</Link>}<b>“{why?.why ?? 'Already removed'}”</b>{why?.hidden && <span className="hint">Already hidden</span>}</>
          : r.update_id ? <>{r.answer?.petition_id && <Link href={`/p/${r.answer.petition_id}`}>See the petition</Link>}<b>{r.answer?.title ?? 'Already removed'}</b>{r.answer?.body && <span className="hint" style={{ whiteSpace: 'pre-line' }}>{r.answer.body}</span>}</>
          : <><b>{r.video_id ? r.videos?.caption : r.petition_id ? <Link href={`/p/${r.petition_id}`}>{r.petitions?.title}</Link>
            : <Link href={`/u/${r.person?.handle ?? r.profile_id}`}>{r.person?.display_name || (r.person?.handle ? '@' + r.person.handle : 'Profile')}</Link>}</b>
            {r.profile_id && r.person?.bio && <span className="hint">Bio: “{r.person.bio}”</span>}</>}
        <p style={{ margin: 0 }}>Report: “{r.reason}”</p>
        <form action={noop} className="row"><input type="hidden" name="report_id" value={r.id} /><input type="hidden" name="video_id" value={r.video_id ?? ''} /><input type="hidden" name="petition_id" value={r.petition_id ?? ''} /><input type="hidden" name="profile_id" value={r.profile_id ?? ''} /><input type="hidden" name="reason_key" value={r.reason_key ?? ''} /><input type="hidden" name="update_id" value={r.update_id ?? ''} />
          <input name="note" placeholder={r.update_id ? 'Why it was removed (kept in the log)' : 'Reason shown to the author if removed'} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small" formAction={resolveReport.bind(null, 'dismiss')}>Dismiss</button><button className="btn small danger" formAction={resolveReport.bind(null, 'remove')}>{r.reason_key ? 'Hide reason' : r.profile_id && !r.video_id && !r.petition_id ? 'Clear name and bio' : 'Remove'}</button></form>
      </div>); }) : <p className="hint">No open reports.</p>}
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
            <b className="hint">{LANGS[l]} {count(l) === 4 ? '· complete' : count(l) ? `· ${count(l)} of 4 fields` : '· missing'}</b>
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
    <form className="field" action="/admin"><input type="hidden" name="tab" value="petitions" /><input name="q" type="search" defaultValue={q} placeholder="Search petitions" aria-label="Search petitions" /></form>
    {ps?.map((p: any) => (
      <div className="panel" key={p.id} style={{ gap: 8 }}>
        <div className="row between"><Link href={`/p/${p.id}`} style={{ flex: 1, minWidth: 0 }}><b>{p.title}</b></Link><span className="hint">{p.status} · {n(Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0))}{p.cluster_id ? ' · united' : ''}</span></div>
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
