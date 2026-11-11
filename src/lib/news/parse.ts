// Small RSS / Atom / RDF reader. Feeds are untrusted input: we keep only plain text and http(s) links.
export type RawItem = { title: string; url: string; teaser: string; published: Date | null };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const safeChar = (c: number) => (c > 0 && c < 0x110000 ? String.fromCodePoint(c) : '');
export const plain = (html: string) =>
  decode(decode(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

function tag(block: string, names: string[]) {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'));
    if (m) return m[1];
  }
  return '';
}
function link(block: string) {
  const atom = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  for (const a of atom) {
    const href = a.match(/href=["']([^"']+)["']/i)?.[1];
    const rel = a.match(/rel=["']([^"']+)["']/i)?.[1];
    if (href && (!rel || rel === 'alternate')) return decode(href);
  }
  return plain(tag(block, ['link', 'guid', 'id']));
}

export function parseFeed(xml: string): RawItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  return blocks.map((b) => {
    const date = plain(tag(b, ['pubDate', 'published', 'updated', 'dc:date']));
    const d = date ? new Date(date) : null;
    return {
      title: plain(tag(b, ['title'])),
      url: link(b).trim(),
      teaser: plain(tag(b, ['description', 'summary', 'content:encoded', 'content'])),
      published: d && !isNaN(+d) ? d : null,
    };
  }).filter((i) => i.title.length >= 5 && /^https?:\/\//.test(i.url));
}

export function shorten(s: string, max = 280) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1); const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.;:\s]+$/, '') + '…';
}
