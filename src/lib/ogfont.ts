// Loads Anton (only the letters needed) for generated images, so shared cards look like the site.
// Falls back to the default font if Google Fonts cannot be reached.
export async function antonFont(text: string): Promise<{ name: string; data: ArrayBuffer; weight: 400; style: 'normal' }[]> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Anton&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype|woff)'\)/)?.[1];
    if (!url) return [];
    const res = await fetch(url);
    return res.ok ? [{ name: 'Anton', data: await res.arrayBuffer(), weight: 400, style: 'normal' }] : [];
  } catch { return []; }
}
