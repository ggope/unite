// Loads fonts (only the letters needed) for generated images, so shared cards look like the site.
// Falls back to the default font if Google Fonts cannot be reached.
type Font = { name: string; data: ArrayBuffer; weight: 400 | 800; style: 'normal' };

async function googleFont(query: string, name: string, weight: 400 | 800, text: string): Promise<Font[]> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype|woff)'\)/)?.[1];
    if (!url) return [];
    const res = await fetch(url);
    return res.ok ? [{ name, data: await res.arrayBuffer(), weight, style: 'normal' }] : [];
  } catch { return []; }
}

// Anton for the big poster words.
export const antonFont = (text: string) => googleFont('Anton', 'Anton', 400, text);

// Anton plus a plain bold face for the small sentences, so a line like "See what is happening"
// does not borrow the Anton capitals it happens to share. Use fontFamily 'Body' for those lines.
export async function ogFonts(display: string, body: string) {
  const [a, b] = await Promise.all([antonFont(display), googleFont('Inter:wght@800', 'Body', 800, body)]);
  return { fonts: [...a, ...b], display: a.length ? 'Anton' : 'sans-serif', body: b.length ? 'Body' : 'sans-serif' };
}
