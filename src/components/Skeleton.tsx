import { LogoBlink } from '@/lib/logo';
// Shown instantly while a page loads, so a tap never feels ignored.
export function ListSkeleton({ rows = 6, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {title && <div className="sk sk-title" />}
      <div className="sk sk-input" />
      {Array.from({ length: rows }, (_, i) => (
        <div className="sk-row" key={i}><div className="stack" style={{ gap: 8, flex: 1 }}><div className="sk sk-line short" /><div className="sk sk-line" /><div className="sk sk-line mid" /></div><div className="sk sk-pill" /></div>
      ))}
    </div>
  );
}
export function ReelSkeleton() {
  return (
    <div className="reel" aria-busy="true" aria-label="Loading">
      <div className="sk-logo"><LogoBlink size={84} id="load-logo" /></div>
      <div className="sk-reel"><div className="sk dark sk-line mid" /><div className="sk dark sk-line" /><div className="sk dark sk-card" /></div>
    </div>
  );
}
