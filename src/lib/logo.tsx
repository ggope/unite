// The UNIER mark: Mylo caught in a black U on signal orange, looking out at you for help.
// One SVG string feeds the PNG icons (via an <img>), the side rail and the embed box.
export const LOGO_ORANGE = '#FF5A1F';

const INK = '#1A1A1A', RIM = '#FFF7EA', BODY = '#FF8A2A', HAND = '#F7EFE0';

// The drawing on a 200 x 200 grid. The background is added by logoSvg.
const ART =
  // head with its paper edge
  `<circle cx="100" cy="100" r="58" fill="${RIM}"/><circle cx="100" cy="100" r="54" fill="${BODY}"/>` +
  // leaf
  `<g transform="translate(100 44) rotate(6)"><path d="M0 0 C-14 -22 -6 -34 2 -36 C10 -22 8 -8 0 0Z" fill="#4CAF5B"/><path d="M0 0 C16 -16 32 -16 38 -8 C28 2 12 4 0 0Z" fill="#2F8E45"/></g>` +
  // eyes looking straight out, with a small light in each
  `<ellipse cx="79" cy="96" rx="14" ry="17" fill="#fff"/><ellipse cx="121" cy="96" rx="14" ry="17" fill="#fff"/>` +
  `<circle cx="79" cy="97" r="7.5" fill="${INK}"/><circle cx="121" cy="97" r="7.5" fill="${INK}"/>` +
  `<circle cx="82" cy="93.5" r="2.2" fill="#fff"/><circle cx="124" cy="93.5" r="2.2" fill="#fff"/>` +
  // worried brows
  `<path d="M58 74 Q79 63 89 67 L88 71 Q79 67 59 78Z M142 74 Q121 63 111 67 L112 71 Q121 67 141 78Z" fill="${INK}"/>` +
  // cheeks
  `<ellipse cx="62" cy="118" rx="7" ry="5" fill="#FF8C8C" opacity=".85"/><ellipse cx="138" cy="118" rx="7" ry="5" fill="#FF8C8C" opacity=".85"/>` +
  // the U and the inside of the cup
  `<path d="M30 30 V112 a70 70 0 0 0 140 0 V30" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="square"/>` +
  `<path d="M30 128 H170 V112 A70 70 0 0 1 30 112 Z" fill="${INK}"/>` +
  // hands on the rim
  `<ellipse cx="44" cy="116" rx="13" ry="11" fill="${HAND}"/><ellipse cx="156" cy="116" rx="13" ry="11" fill="${HAND}"/>`;

// pad: empty space around the drawing, as a share of its size (more for maskable icons).
// round: rounded corners for places the OS does not round for us (tab icon, side rail).
// paper: the torn-paper edge and shadow; skip it where the icon is drawn very small.
export function logoSvg({ pad = 0, round = false, paper = true, id = 'unier-logo' }: { pad?: number; round?: boolean; paper?: boolean; id?: string } = {}) {
  const o = 200 * pad, s = 200 + o * 2;
  const filter = paper
    ? `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="4"/>` +
      `<feDisplacementMap in="SourceGraphic" scale="3"/><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.4" flood-color="#000" flood-opacity=".28"/></filter>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-o} ${-o} ${s} ${s}">` +
    `<defs>${filter}<clipPath id="${id}-c"><rect x="${-o}" y="${-o}" width="${s}" height="${s}" rx="${round ? s * 0.22 : 0}"/></clipPath></defs>` +
    `<g clip-path="url(#${id}-c)"><rect x="${-o}" y="${-o}" width="${s}" height="${s}" fill="${LOGO_ORANGE}"/>` +
    `<g${paper ? ` filter="url(#${id})"` : ''}>${ART}</g></g></svg>`;
}

export const logoDataUri = (o?: Parameters<typeof logoSvg>[0]) => `data:image/svg+xml;base64,${btoa(logoSvg(o))}`;

// For generated PNG icons (next/og).
export function LogoMark({ size, pad = 0, round = false }: { size: number; pad?: number; round?: boolean }) {
  return (
    <div style={{ width: size, height: size, display: 'flex' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoDataUri({ pad, round, paper: size >= 96 })} width={size} height={size} alt="" />
    </div>
  );
}
