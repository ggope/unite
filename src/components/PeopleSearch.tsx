'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';

type P = { id: string; handle: string | null; display_name: string | null };
export function PeopleSearch() {
  const { t } = useT();
  const [q, setQ] = useState(''); const [res, setRes] = useState<P[] | null>(null);
  useEffect(() => {
    const term = q.trim().replace(/^@/, '');
    if (term.length < 2) { setRes(null); return; }
    const id = setTimeout(async () => { const { data } = await supabaseBrowser().rpc('search_people', { p_query: term }); setRes((data as P[]) ?? []); }, 250);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('friends.findPh')} aria-label={t('friends.find')}
        style={{ border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', width: '100%', minWidth: 0 }} />
      {res && (res.length ? res.map((p) => (
        <Link key={p.id} className="convo" href={`/u/${p.handle ?? p.id}`}><span className="avatar sm" aria-hidden="true">{(p.display_name || p.handle || '?')[0].toUpperCase()}</span>
          <span className="meta"><b>{p.display_name || '@' + p.handle}</b>{p.handle && p.display_name && <span className="hint">@{p.handle}</span>}</span></Link>
      )) : <p className="hint" style={{ margin: 0 }}>{t('friends.noResults')}</p>)}
    </div>
  );
}
