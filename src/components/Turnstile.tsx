'use client';
import { useEffect, useRef } from 'react';

// Cloudflare's "are you a person" check. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
export const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading: Promise<void> | null = null;
function load() {
  if ((window as any).turnstile) return Promise.resolve();
  return (loading ??= new Promise<void>((ok, fail) => {
    const s = document.createElement('script'); s.src = SRC; s.async = true; s.onload = () => ok(); s.onerror = () => { loading = null; fail(); };
    document.head.appendChild(s);
  }));
}

// Remount (change `key`) to get a fresh token: each token works once.
export function Turnstile({ onToken, lang }: { onToken: (token: string | null) => void; lang: string }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken); cb.current = onToken;
  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    let id: string | undefined; let gone = false;
    load().then(() => {
      if (gone || !el.current) return;
      id = (window as any).turnstile.render(el.current, {
        sitekey: TURNSTILE_KEY, language: lang, theme: 'auto', size: 'flexible',
        callback: (t: string) => cb.current(t), 'expired-callback': () => cb.current(null), 'error-callback': () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => { gone = true; try { if (id) (window as any).turnstile.remove(id); } catch {} };
  }, [lang]);
  if (!TURNSTILE_KEY) return null;
  return <div ref={el} className="turnstile" />;
}
