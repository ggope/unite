import Link from 'next/link';
import type { TOPICS } from '@/lib/topics';
import type { Key } from '@/lib/i18n/langs';
import { SignButton } from './SignButton';

import type { T } from '@/lib/i18n/langs';
export const statOf = (p: any) => (Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats) ?? { combined: 0, united_count: 1 };

// One petition in a list: topic and target, title, progress and the Sign button. `note` adds a line (a deadline, a place).
export function PetitionRow({ p, t, fmt, signed, viewer, note, action }: {
  p: any; t: T; fmt: (n: number) => string; signed: boolean; viewer: any; note?: React.ReactNode; action?: React.ReactNode;
}) {
  const s = statOf(p);
  const open = p.status ? p.status === 'live' : true;
  return (
    <div className="prow">
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <span className="hint">{t(`topic.${p.topic as keyof typeof TOPICS}` as Key)} · {t('pet.to', { target: p.target })} {Number(s.united_count) > 1 && <span className="united">{t('pet.united', { n: s.united_count })}</span>}</span>
        <h2><Link href={`/p/${p.id}`}>{p.title}</Link></h2>
        {note && <span className="rownote">{note}</span>}
        <span className="row hint"><b className="num">{fmt(Number(s.combined))}</b> {t('common.of')} {fmt(p.goal)}<span className="prog"><i style={{ width: `${Math.min(100, Number(s.combined) / p.goal * 100)}%` }} /></span></span>
      </div>
      <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
        {open && <SignButton variant="small" petitionId={p.id} title={p.title} signed={signed} viewer={viewer} />}
        {action}
      </div>
    </div>
  );
}
