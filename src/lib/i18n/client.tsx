'use client';
import { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { makeTFrom, LANGS, type Lang, type Key } from './langs';

// The server hands over only the reader's language.
const Ctx = createContext<{ lang: Lang; messages: Record<Key, string> }>({ lang: 'en', messages: {} as Record<Key, string> });
export function LangProvider({ lang, messages, children }: { lang: Lang; messages: Record<Key, string>; children: React.ReactNode }) {
  const v = useMemo(() => ({ lang, messages }), [lang, messages]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useT() {
  const { lang, messages } = useContext(Ctx);
  return useMemo(() => ({ lang, t: makeTFrom(messages) }), [lang, messages]);
}

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useT();
  const router = useRouter();
  const set = (l: Lang) => { document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`; router.refresh(); };
  return (
    <div className="langs" role="group" aria-label={t('lang.label')}>
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => set(l)} lang={l}>{compact ? l.toUpperCase() : LANGS[l]}</button>
      ))}
    </div>
  );
}
