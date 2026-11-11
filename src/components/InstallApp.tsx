'use client';
import { useEffect, useState } from 'react';

// Offers "Install UNIER" where the browser supports it, and Add-to-Home-Screen steps on iPhone.
export function InstallApp() {
  const [prompt, setPrompt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    let dismissed = false; try { dismissed = localStorage.getItem('unier-install-dismissed') === '1'; } catch {}
    if (standalone || dismissed) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setHidden(false);
    const h = (e: Event) => { e.preventDefault(); setPrompt(e); };
    addEventListener('beforeinstallprompt', h);
    return () => removeEventListener('beforeinstallprompt', h);
  }, []);
  if (hidden || (!prompt && !ios)) return null;
  const close = () => { setHidden(true); try { localStorage.setItem('unier-install-dismissed', '1'); } catch {} };
  return (
    <div className="install">
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>Get the UNIER app</b>
        <span className="hint" style={{ display: 'block' }}>{prompt ? 'Opens full screen, straight from your home screen.' : 'Tap the Share button, then “Add to Home Screen”.'}</span>
      </div>
      {prompt && <button className="btn primary small" onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); close(); }}>Install</button>}
      <button className="btn ghost small" onClick={close} aria-label="Not now">✕</button>
    </div>
  );
}
