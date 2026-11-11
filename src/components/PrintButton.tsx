'use client';
export function PrintButton({ label }: { label: string }) { return <button className="btn small noprint" onClick={() => window.print()}>{label}</button>; }
