// The UNIER mark: a bold black U on signal orange, like a protest sign. Drawn for generated PNG icons.
export function LogoMark({ size, pad = 0.18 }: { size: number; pad?: number }) {
  const s = 100 * (1 + pad * 2), o = 100 * pad;
  return (
    <div style={{ width: size, height: size, background: '#FF5A1F', display: 'flex' }}>
      <svg width={size} height={size} viewBox={`${-o} ${-o} ${s} ${s}`}>
        <path d="M24 14 V56 a26 26 0 0 0 52 0 V14" fill="none" stroke="#111111" strokeWidth="20" strokeLinecap="square" />
      </svg>
    </div>
  );
}
