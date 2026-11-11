'use client';
import { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { makeT, LANGS, type Lang } from './dict';

const Ctx = createContext<Lang>('en');
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}
export function useT() {
  const lang = useContext(Ctx);
  return useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
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
