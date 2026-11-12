import { createClient } from '@supabase/supabase-js';
import { makeT, fmtN, pickLang, type Lang } from '@/lib/i18n/dict';
import { localize } from '@/lib/petitionText';

// A small sign box other websites can put in an iframe. Signing itself happens on UNIER.
export const revalidate = 120;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = new URL(req.url);
  const lang = pickLang(u.searchParams.get('lang'), req.headers.get('accept-language')) as Lang;
  const t = makeT(lang);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const ok = /^[0-9a-f-]{36}$/.test(id);
  const [{ data: raw }, { data: st }] = ok ? await Promise.all([
    sb.from('petitions').select('id, title, target, ask, why, goal, status, lang, tr').eq('id', id).in('status', ['live', 'closed']).maybeSingle(),
    sb.from('petition_stats').select('combined').eq('id', id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const base = u.origin;
  if (!raw) return new Response(`<!doctype html><meta charset="utf-8"><p style="font-family:system-ui">${esc(t('embed.missing'))}</p>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const p = localize(raw, lang);
  const n = Number(st?.combined ?? 0), pct = Math.min(100, (n / p.goal) * 100);
  const href = `${base}/p/${p.id}?utm_source=embed`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} · UNIER</title>
<style>
:root{--bg:#F2EEE6;--ink:#111;--muted:#555;--accent:#FF5A1F;--edge:#111}
@media (prefers-color-scheme:dark){:root{--bg:#15130F;--ink:#F2EEE6;--muted:#B8B1A6;--accent:#FF6A33;--edge:#F2EEE6}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.box{border:2px solid var(--edge);padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-height:100vh}
.brand{font-weight:900;letter-spacing:.12em;font-size:11px;color:var(--muted);text-decoration:none}
h1{font-size:19px;line-height:1.15;margin:0;text-transform:uppercase;font-weight:900}
.to{color:var(--muted);font-size:13px}
.n{font-weight:900;font-size:22px}.goal{color:var(--muted);font-size:13px}
.bar{height:10px;border:2px solid var(--edge);background:transparent}.bar i{display:block;height:100%;background:var(--accent)}
a.go{align-self:flex-start;background:var(--accent);color:#111;font-weight:900;text-decoration:none;text-transform:uppercase;padding:10px 16px;border:2px solid var(--edge);box-shadow:3px 3px 0 var(--edge)}
a.go:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
</style></head><body><div class="box">
<a class="brand" href="${base}" target="_blank" rel="noopener">UNIER</a>
<h1>${esc(p.title)}</h1><span class="to">${esc(t('poster.to', { target: p.target }))}</span>
<div><span class="n">${fmtN(n, lang)}</span> <span class="goal">${esc(t('poster.signed', { goal: fmtN(p.goal, lang) }))}</span></div>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct.toFixed(1)}%"></i></div>
${raw.status === 'live' ? `<a class="go" href="${href}" target="_blank" rel="noopener">${esc(t('sign.signThis'))} ↗</a>` : `<span class="goal">${esc(t('sign.errClosed'))}</span>`}
</div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
}
