'use client';
import { useT } from '@/lib/i18n/client';
import type { Key } from '@/lib/i18n/dict';

export const CTAS = ['learn', 'visit', 'donate', 'join', 'event'] as const;
export type Cta = (typeof CTAS)[number];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// The organiser's own link as a full-width bar, like the "Learn more" bar under an Instagram post.
// The domain is always shown, so people know where they are going.
export function LinkBar({ url, cta = 'learn', onClick }: { url: string; cta?: string; onClick?: () => void }) {
  const { t } = useT();
  const label = t(`link.${(CTAS as readonly string[]).includes(cta) ? cta : 'learn'}` as Key);
  return (
    <a className="linkbar" href={url} target="_blank" rel="noopener nofollow ugc" onClick={onClick} aria-label={`${label}: ${t('link.leaving', { host: host(url) })}`}>
      <span><b>{label}</b><small>{host(url)}</small></span><span aria-hidden="true">→</span>
    </a>
  );
}
