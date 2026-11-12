import { MYLO_ART, type Mood } from './art';

// Mylo, drawn as torn paper. The torn edge and the drop shadow come from one SVG filter.
// An empty label makes the drawing decorative.
// `id` must be unique on the page because the filter is referenced by id.
export function MyloArt({ mood, size = 120, id, label }: { mood: Mood; size?: number; id: string; label: string }) {
  const fid = `mylo-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const html =
    `<defs><filter id="${fid}" x="-15%" y="-15%" width="130%" height="130%">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="4"></feTurbulence>` +
    `<feDisplacementMap in="SourceGraphic" scale="5"></feDisplacementMap>` +
    `<feDropShadow dx="2" dy="3" stdDeviation="1.5" flood-color="#000" flood-opacity=".28"></feDropShadow></filter></defs>` +
    `<g filter="url(#${fid})">${MYLO_ART[mood]}</g>`;
  return (
    <svg className="mylo-art" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} viewBox="0 0 200 240" width={size} height={Math.round(size * 1.2)}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}
