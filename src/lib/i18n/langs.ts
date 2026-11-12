// Language helpers without the texts themselves, so the browser only downloads its own language.
import type { Key } from './dict';
export type { Key };

export const LANGS = { en: 'English', hu: 'Magyar', de: 'Deutsch', es: 'Español', fr: 'Français' } as const;
export type Lang = keyof typeof LANGS;
export const isLang = (x: unknown): x is Lang => typeof x === 'string' && Object.hasOwn(LANGS, x);

export type T = (key: Key, vars?: Record<string, string | number>) => string;
export function makeTFrom(d: Record<Key, string>): T {
  return (key, vars) => {
    let s = d[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
const LOCALES: Record<Lang, string> = { en: 'en-GB', hu: 'hu-HU', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
export const locale = (lang: Lang) => LOCALES[lang] ?? 'en-GB';
export const fmtN = (n: number, lang: Lang) => Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : locale(lang));
// The chosen language, else the first browser language UNIER speaks, else English.
export const pickLang = (cookie?: string | null, accept?: string | null): Lang => {
  if (isLang(cookie)) return cookie;
  for (const part of (accept ?? '').split(',')) { const l = part.trim().slice(0, 2).toLowerCase(); if (isLang(l)) return l; }
  return 'en';
};
