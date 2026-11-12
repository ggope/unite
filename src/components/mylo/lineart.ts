// Turns a coloured paper drawing into a colouring page: light shapes become white with a black outline,
// near-black details (eyes, shoes) stay black, and thick painted strokes become thin lines.
const isDark = (c: string) => {
  const m = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return false;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.1;
};

export function lineArt(svg: string) {
  return svg
    .replace(/\sstyle="[^"]*"/g, '')                     // no animation on paper
    .replace(/\sfilter="[^"]*"/g, '')                    // no torn-paper shadow either
    .replace(/<(path|rect|circle|ellipse|polygon|polyline|line)\b([^>]*?)(\s*\/?)>/g, (_m, tag: string, attrs: string, close: string) => {
      const fill = attrs.match(/\sfill="([^"]+)"/)?.[1];
      const stroke = attrs.match(/\sstroke="([^"]+)"/)?.[1];
      let a = attrs;
      if (stroke && stroke !== 'none') {
        a = a.replace(/\sstroke="[^"]+"/, ' stroke="#111"').replace(/\sstroke-width="([\d.]+)"/, (_x, w) => ` stroke-width="${Math.min(Number(w), 2.5)}"`);
      }
      if (fill && fill !== 'none' && !isDark(fill)) {
        a = a.replace(/\sfill="[^"]+"/, ' fill="#fff"');
        if (!stroke || stroke === 'none') a = a.replace(/\sstroke="none"/, '') + ' stroke="#111" stroke-width="2" stroke-linejoin="round"';
      }
      return `<${tag}${a}${close}>`;
    });
}
