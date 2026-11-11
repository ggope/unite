'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ROLE_LABEL } from '@/lib/topics';
import { SignButton, type Viewer } from '@/components/SignButton';

type Pet = { id: string; title: string; role: 'founder' | 'supporter' | null };

export function PostFlow({ userId, petitions, initial, viewer }: { userId: string; petitions: Pet[]; initial: string | null; viewer: Viewer }) {
  const sb = supabaseBrowser(); const router = useRouter();
  const [pid, setPid] = useState<string | null>(petitions.find((p) => p.id === initial && p.role) ? initial : null);
  const [q, setQ] = useState('');
  const [file, setFile] = useState<File | null>(null); const [url, setUrl] = useState<string | null>(null);
  const [dur, setDur] = useState(0); const [ts, setTs] = useState(0); const [te, setTe] = useState(0);
  const [caption, setCaption] = useState(''); const [blur, setBlur] = useState(true); const [aud, setAud] = useState<'everyone' | 'friends'>('everyone');
  const [ok, setOk] = useState(false); const [stage, setStage] = useState<'' | 'uploading' | 'done'>(''); const [pct, setPct] = useState(0); const [err, setErr] = useState('');
  const vid = useRef<HTMLVideoElement>(null);
  const pet = petitions.find((p) => p.id === pid);
  const shown = useMemo(() => petitions.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase())).slice(0, q ? 20 : 8), [petitions, q]);

  function pick(f: File | undefined) {
    if (!f) return; if (!f.type.startsWith('video/')) { setErr('Choose a video file (MP4, MOV or WebM).'); return; }
    if (f.size > 500 * 1024 * 1024) { setErr('Videos can be up to 500 MB.'); return; }
    setErr(''); setFile(f); const u = URL.createObjectURL(f); setUrl(u);
    const probe = document.createElement('video'); probe.preload = 'metadata'; probe.src = u;
    probe.onloadedmetadata = () => { const d = Math.round(probe.duration * 10) / 10 || 30; setDur(d); setTs(0); setTe(Math.min(d, 180)); };
  }
  async function cover(): Promise<Blob | null> {
    const v = vid.current; if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas'); const k = 720 / Math.max(v.videoWidth, v.videoHeight); c.width = v.videoWidth * k; c.height = v.videoHeight * k;
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  }
  async function post() {
    if (!file || !pet) return;
    setStage('uploading'); setErr(''); setPct(10);
    const id = crypto.randomUUID(); const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${userId}/${id}.${ext}`, coverPath = `${userId}/${id}.jpg`;
    const up = await sb.storage.from('videos').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setStage(''); setErr('Upload failed. Check your connection and try again.'); return; }
    setPct(80);
    const cv = await cover(); if (cv) await sb.storage.from('videos').upload(coverPath, cv, { contentType: 'image/jpeg' });
    const ins = await sb.from('videos').insert({ id, petition_id: pet.id, uploader_id: userId, storage_path: path, cover_path: cv ? coverPath : null,
      caption: caption.trim(), trim_start: ts, trim_end: te, blur_faces: blur, audience: aud });
    if (ins.error) { setStage(''); setErr(ins.error.message.includes('row-level') ? 'You need to sign this petition before posting a video for it.' : 'Could not save the video. Try again.'); return; }
    setPct(100); setStage('done');
  }

  if (stage === 'done') return (
    <div className="panel"><h2>Sent for review</h2>
      <p style={{ margin: 0 }}>An automatic scan checks every video, and a person reviews anything flagged. Most videos are live within an hour. You will see it under You.</p>
      <div className="row"><Link className="btn primary" href={`/p/${pet!.id}`}>Back to the petition</Link><button className="btn" onClick={() => router.refresh()}>Post another</button></div></div>
  );

  // step 1: which petition
  if (!pet) return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>Which petition is your video for?</p>
      <Link className="panel" href="/start?then=video" style={{ textDecoration: 'none', color: 'inherit' }}><b>A new petition</b><span className="hint">Start the petition first, then add your video. You will be its founder.</span></Link>
      <div className="panel"><b>An existing petition</b>
        <div className="field"><input type="search" placeholder="Search petitions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search petitions" /></div>
        {shown.map((p) => (
          <div className="row between" key={p.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <span style={{ minWidth: 0, flex: 1 }}>{p.title}<br /><span className="hint">{p.role === 'founder' ? 'You founded it' : p.role ? 'You signed' : 'Sign it to post a video'}</span></span>
            {p.role ? <button className="btn small primary" onClick={() => setPid(p.id)}>Choose</button>
              : <SignButton variant="small" petitionId={p.id} title={p.title} signed={false} viewer={viewer} onChange={(on) => on && setPid(p.id)} />}
          </div>))}
      </div>
    </div>
  );

  const role = pet.role ?? 'supporter';
  return (
    <div className="stack">
      <div className="panel" style={{ background: 'var(--accent-soft)' }}><span className="label">Posting for</span><b>{pet.title}</b>
        <span>You post as <span className={`role ${role}`}>({ROLE_LABEL[role]})</span> <button className="btn ghost small" onClick={() => setPid(null)}>Change</button></span></div>
      {!url ? (
        <div className="panel">
          <label className="btn primary big" htmlFor="rec">Record</label><input id="rec" type="file" accept="video/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <label className="btn big" htmlFor="up">Upload from gallery</label><input id="up" type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <p className="hint">Up to 3 minutes and 500 MB. Never put yourself or others in danger to get a shot.</p>
        </div>
      ) : (
        <div className="panel">
          <video ref={vid} src={url} muted playsInline autoPlay loop style={{ width: '100%', maxHeight: '50vh', borderRadius: 12, background: '#000' }}
            onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= te) e.currentTarget.currentTime = ts; }} />
          <div className="field"><label htmlFor="cap">Description</label><textarea id="cap" maxLength={150} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What does it show? Where and when was it filmed?" /></div>
          <details><summary>Trim (optional) · {Math.round(te - ts)}s</summary>
            <div className="field"><label htmlFor="ts">Start {ts.toFixed(1)}s</label><input id="ts" type="range" min={0} max={dur} step={0.1} value={ts} onChange={(e) => setTs(Math.min(+e.target.value, te - 1))} /></div>
            <div className="field"><label htmlFor="te">End {te.toFixed(1)}s</label><input id="te" type="range" min={0} max={dur} step={0.1} value={te} onChange={(e) => setTe(Math.max(+e.target.value, ts + 1))} /></div>
          </details>
          {te - ts > 180 && <p className="error">Trim it to 3 minutes or less.</p>}
          <label className="check"><input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} /><span>Blur faces of bystanders</span></label>
          <div className="row"><button className="chip" aria-pressed={aud === 'everyone'} onClick={() => setAud('everyone')}>Everyone</button><button className="chip" aria-pressed={aud === 'friends'} onClick={() => setAud('friends')}>Friends only</button></div>
          <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>I filmed this or have the right to share it, and it shows what really happened.</span></label>
          {err && <p className="error">{err}</p>}
          <div className="row between"><button className="btn" onClick={() => { setUrl(null); setFile(null); }}>Change video</button>
            <button className="btn primary big" disabled={!ok || caption.trim().length < 5 || te - ts > 180 || stage === 'uploading'} onClick={post}>{stage === 'uploading' ? `Uploading ${pct}%` : 'Post video'}</button></div>
        </div>
      )}
      {err && !url && <p className="error">{err}</p>}
    </div>
  );
}
