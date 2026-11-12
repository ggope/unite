'use client';
import { useEffect, useRef } from 'react';

// For pop-up sheets: Escape closes, the keyboard lands inside the sheet when it opens,
// and goes back to the button that opened it when it closes (so screen reader users do not get lost).
export function useSheet<T extends HTMLElement = HTMLDivElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('input:not([disabled]),textarea,select') ?? el?.querySelector<HTMLElement>('button,[href]'))?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (back?.isConnected) back.focus(); };
  }, [open]);
  return ref;
}
