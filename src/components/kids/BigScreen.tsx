'use client';
import { useRef } from 'react';

// Puts its contents on the whole screen, for showing the picture book on a classroom projector. Esc leaves.
export function BigScreen({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }}
        onClick={() => ref.current?.requestFullscreen?.().catch(() => {})}>⛶ {label}</button>
      <div ref={ref} className="bigscreen">{children}</div>
    </div>
  );
}
