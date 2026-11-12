import type { Lang } from './i18n/dict';

// A petition is written in one language (`lang`); `tr` holds the other language's version.
// Any field missing from the translation falls back to the original text.
type Fields = 'title' | 'target' | 'ask' | 'why';
export type Translatable = { lang?: string | null; tr?: unknown } & Partial<Record<Fields, string | null>>;

export function trOf(p: Translatable, lang: Lang): Partial<Record<Fields, string>> {
  if (!p || p.lang === lang || !p.tr || typeof p.tr !== 'object') return {};
  const t = (p.tr as Record<string, unknown>)[lang];
  if (!t || typeof t !== 'object') return {};
  const out: Partial<Record<Fields, string>> = {};
  for (const k of ['title', 'target', 'ask', 'why'] as Fields[]) { const v = (t as Record<string, unknown>)[k]; if (typeof v === 'string' && v.trim()) out[k] = v.trim(); }
  return out;
}

// The petition with its text in the reader's language where a translation exists.
export function localize<T extends Translatable>(p: T, lang: Lang): T {
  const t = trOf(p, lang);
  return Object.keys(t).length ? { ...p, ...t } : p;
}
