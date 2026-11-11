// The UNIER mark: two overlapping rings, drawn for generated PNG icons.
export function LogoMark({ size, pad = 0.18 }: { size: number; pad?: number }) {
  const inner = size * (1 - pad * 2);
  const r = inner * 0.3, stroke = inner * 0.09, cy = size / 2, dx = inner * 0.13;
  return (
    <div style={{ width: size, height: size, background: '#05060C', display: 'flex' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2 - dx} cy={cy} r={r} fill="none" stroke="#5B72FF" strokeWidth={stroke} />
        <circle cx={size / 2 + dx} cy={cy} r={r} fill="none" stroke="#FFFFFF" strokeWidth={stroke} />
      </svg>
    </div>
  );
}
