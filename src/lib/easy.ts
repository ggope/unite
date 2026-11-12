import type { Lang } from './i18n/langs';

// A petition's easy-read version (0018): a kid-sized title and a few plain sentences, one per language.
export type Easy = { title: string; text: string };

function pick(v: unknown): Easy | null {
  if (!v || typeof v !== 'object') return null;
  const { title, text } = v as Record<string, unknown>;
  return typeof title === 'string' && typeof text === 'string' && title.trim() && text.trim() ? { title: title.trim(), text: text.trim() } : null;
}
// In the reader's language, else English, else any language that has one.
export function easyOf(p: { easy?: unknown } | null | undefined, lang: Lang): Easy | null {
  const e = p?.easy;
  if (!e || typeof e !== 'object') return null;
  const all = e as Record<string, unknown>;
  return pick(all[lang]) ?? pick(all.en) ?? Object.values(all).map(pick).find(Boolean) ?? null;
}
export const EASY_TITLE = 70, EASY_TEXT = 400;
