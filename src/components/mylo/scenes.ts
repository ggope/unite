import type { Key } from '@/lib/i18n/langs';
import { MYLO_ART, type Mood } from './art';

// The pictures in Mylo's picture book, drawn as cut paper like Mylo himself.
// Each scene is a 300 x 300 picture with no words in it, so it works in every language.

const mylo = (mood: Mood, x: number, y: number, w: number) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${Math.round(w * 1.2)}" viewBox="0 0 200 240" overflow="visible">${MYLO_ART[mood]}</svg>`;

const tree = (x: number, y: number, s = 1, crown = '#4CAF5B') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-6" width="10" height="34" fill="#8A5A2B"/><circle cx="0" cy="-20" r="22" fill="${crown}"/><circle cx="-12" cy="-8" r="14" fill="${crown}"/><circle cx="13" cy="-9" r="15" fill="${crown}"/></g>`;

const pine = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="0" width="8" height="16" fill="#6B4423"/><path d="M0 -58 L22 -18 H12 L28 6 H-28 L-12 -18 H-22Z" fill="#2F6B3A"/></g>`;

const flame = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C-16 -6 -14 -26 -4 -40 C-4 -28 4 -26 6 -34 C16 -22 16 -6 0 0Z" fill="#FF6A1A"/><path d="M0 -3 C-8 -6 -7 -16 -2 -24 C0 -17 5 -16 6 -20 C10 -12 8 -5 0 -3Z" fill="#FFC93C"/></g>`;

const cloud = (x: number, y: number, s = 1, fill = '#FFFFFF') =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><ellipse cx="0" cy="0" rx="26" ry="14"/><ellipse cx="-18" cy="4" rx="16" ry="10"/><ellipse cx="20" cy="4" rx="18" ry="11"/><ellipse cx="4" cy="-9" rx="14" ry="11"/></g>`;

// a person in the crowd: skin, shirt, and what their sign shows (a heart, a tick or a leaf)
const person = (x: number, y: number, skin: string, shirt: string, sign?: 'heart' | 'tick' | 'leaf', s = 1) => {
  const icon = sign === 'heart' ? `<path d="M0 3 C-9 -4 -5 -11 0 -6 C5 -11 9 -4 0 3Z" fill="#E5484D"/>`
    : sign === 'tick' ? `<path d="M-7 -2 L-2 3 L8 -7" stroke="#2F8E45" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : sign === 'leaf' ? `<path d="M-6 5 C-8 -6 2 -9 8 -8 C8 2 0 7 -6 5Z" fill="#4CAF5B"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    (sign ? `<rect x="10" y="-52" width="3" height="40" fill="#8A5A2B"/><rect x="-6" y="-70" width="36" height="24" rx="2" fill="#FFFDF6"/><g transform="translate(12 -58)">${icon}</g>` : '') +
    `<rect x="-14" y="-8" width="28" height="34" rx="12" fill="${shirt}"/><circle cx="0" cy="-20" r="13" fill="${skin}"/>` +
    `<circle cx="-4" cy="-21" r="1.8" fill="#1A1A1A"/><circle cx="4" cy="-21" r="1.8" fill="#1A1A1A"/><path d="M-4 -15 q4 3 8 0" stroke="#1A1A1A" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
};

const star = (x: number, y: number, s = 1, fill = '#FFC93C') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3Z" fill="${fill}"/>`;

const SKINS = ['#F2C29B', '#8D5A3B', '#FFD9B5', '#6B4F3A', '#E0A47A', '#3B2A20'];
const SHIRTS = ['#2E6E8E', '#7A1F1F', '#1F4D2E', '#4A1F5C', '#0F4C4C', '#B83A0B', '#2E2A6B'];

// 0: Mylo at home on a small round world
const home = () =>
  `<rect width="300" height="300" fill="#CDEAF2"/>` +
  `<circle cx="248" cy="58" r="26" fill="#FFD34E"/>` + cloud(70, 62, 1.1) + cloud(170, 38, .7) +
  `<circle cx="150" cy="470" r="250" fill="#2E6E8E"/><path d="M-20 260 Q40 222 110 230 Q170 236 230 222 Q290 214 330 238 V320 H-20Z" fill="#7FB85A"/>` +
  `<ellipse cx="236" cy="268" rx="30" ry="8" fill="#5FB0E0"/>` +
  tree(48, 214, 1.05) +
  `<g transform="translate(232 196)"><rect x="-20" y="0" width="40" height="30" fill="#F7EFE0"/><path d="M-26 2 L0 -22 L26 2Z" fill="#B83A0B"/><rect x="-5" y="12" width="10" height="18" fill="#8A5A2B"/></g>` +
  mylo('happy', 86, 72, 128);

// 1: the world hurts, and so does he
const hurt = () =>
  `<rect width="300" height="300" fill="#E6D9C4"/>` + cloud(60, 46, 1.3, '#9C9488') + cloud(140, 30, 1, '#B5AC9F') +
  `<rect y="226" width="300" height="74" fill="#A9B37A"/>` +
  pine(28, 222, 1) + pine(70, 226, 1.15) + pine(112, 222, .9) +
  flame(28, 166, .9) + flame(70, 160, 1.1) + flame(112, 170, .8) +
  `<path d="M-10 270 Q60 250 130 268 T300 262 V300 H-10Z" fill="#8C7A5B"/>` +
  `<rect x="60" y="276" width="10" height="6" fill="#6E6E6E" transform="rotate(12 65 279)"/><circle cx="150" cy="282" r="4" fill="#C9C2B4"/><rect x="220" y="272" width="12" height="5" fill="#6E6E6E" transform="rotate(-8 226 274)"/>` +
  mylo('sick', 158, 86, 120);

// 2: very small, in front of a very big building where decisions are made
const small = () =>
  `<rect width="300" height="300" fill="#DDE3E8"/>` + cloud(50, 40, .8) +
  `<rect y="256" width="300" height="44" fill="#B9C0C6"/>` +
  `<path d="M70 92 L182 34 L294 92Z" fill="#E9E4DA"/><rect x="74" y="92" width="216" height="14" fill="#D6CFC2"/>` +
  [0, 1, 2, 3, 4].map((k) => `<rect x="${86 + k * 42}" y="106" width="20" height="128" fill="#F2EEE6"/>`).join('') +
  `<rect x="152" y="160" width="60" height="74" fill="#5A5148"/><rect x="66" y="234" width="232" height="10" fill="#CFC7B8"/><rect x="58" y="244" width="248" height="12" fill="#C2B9A8"/>` +
  `<g transform="translate(64 188)"><path d="M0 0 h42 a10 10 0 0 1 10 10 v14 a10 10 0 0 1 -10 10 h-30 l-10 8 v-8 a10 10 0 0 1 -12 -10 v-14 a10 10 0 0 1 10 -10Z" fill="#FFFDF6"/>` +
  `<circle cx="15" cy="17" r="3" fill="#1A1A1A"/><circle cx="26" cy="17" r="3" fill="#1A1A1A"/><circle cx="37" cy="17" r="3" fill="#1A1A1A"/></g>` +
  mylo('worried', 10, 196, 52);

// 3: many people asking for the same thing
const together = () =>
  `<rect width="300" height="300" fill="#FFE6C7"/><rect y="244" width="300" height="56" fill="#F2C48D"/>` +
  [...Array(7)].map((_, k) => person(20 + k * 44, 170, SKINS[k % 6], SHIRTS[(k + 2) % 7], (['heart', 'tick', 'leaf'] as const)[k % 3], .9)).join('') +
  [0, 1, 4, 5].map((k) => person(30 + k * 48, 226, SKINS[(k + 3) % 6], SHIRTS[k % 7], undefined, 1.05)).join('') +
  mylo('fired', 92, 124, 116);

// 4: every signature helps him grow
const grow = () =>
  `<rect width="300" height="300" fill="#E3F2D9"/><rect y="248" width="300" height="52" fill="#B7D99A"/>` +
  star(40, 50, 1.2) + star(262, 40) + star(30, 160, .8) + star(150, 22, .7) +
  `<g transform="translate(206 118) rotate(6)"><rect x="0" y="0" width="76" height="98" rx="4" fill="#8A5A2B"/><rect x="6" y="10" width="64" height="82" fill="#FFFDF6"/><rect x="26" y="-4" width="24" height="10" rx="3" fill="#6E6E6E"/>` +
  [0, 1, 2, 3, 4].map((k) => `<path d="M14 ${24 + k * 14} l4 4 l7 -8" stroke="#2F8E45" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="32" y="${21 + k * 14}" width="30" height="4" rx="2" fill="#CFC7B8"/>`).join('') +
  `</g>` +
  mylo('growing', 40, 64, 150);

// 5: still in the world, but the world is getting better
const better = () =>
  `<rect width="300" height="300" fill="#FFE2B8"/>` +
  ['#E5484D', '#FF8A2A', '#FFC93C', '#4CAF5B', '#2E6E8E'].map((c, k) => `<path d="M${10 + k * 12} 250 A${140 - k * 12} ${140 - k * 12} 0 0 1 ${290 - k * 12} 250" stroke="${c}" stroke-width="12" fill="none"/>`).join('') +
  `<circle cx="150" cy="250" r="54" fill="#FFC24A"/>` +
  `<circle cx="150" cy="500" r="270" fill="#7FB85A"/>` +
  tree(40, 236, .8) + tree(268, 238, .7, '#2F8E45') +
  person(78, 262, SKINS[1], SHIRTS[0], undefined, .8) + person(222, 262, SKINS[2], SHIRTS[5], undefined, .8) + person(258, 272, SKINS[4], SHIRTS[3], undefined, .7) +
  mylo('cheering', 96, 92, 108);

// the last page: Mylo waving goodbye on his little world
const end = () =>
  `<rect width="300" height="300" fill="#F4ECDD"/>` +
  `<circle cx="150" cy="190" r="96" fill="#CDEAF2"/><path d="M58 210 Q100 186 150 196 Q200 204 242 190 A96 96 0 0 1 58 210Z" fill="#7FB85A"/>` +
  `<circle cx="150" cy="190" r="96" fill="none" stroke="#FFF7EA" stroke-width="6"/>` +
  star(56, 70) + star(250, 96, .8) + star(220, 40, .6) +
  mylo('happy', 102, 104, 96);

// the cover: Mylo on his little world, looking out a bit worried
const cover = () =>
  `<circle cx="150" cy="160" r="112" fill="#CDEAF2"/><path d="M40 182 Q90 156 150 166 Q210 176 262 158 A112 112 0 0 1 40 182Z" fill="#7FB85A"/>` +
  tree(78, 176, .6) + `<circle cx="150" cy="160" r="112" fill="none" stroke="#FFF7EA" stroke-width="7"/>` +
  mylo('worried', 96, 62, 108);

export const SCENES = [home, hurt, small, together, grow, better];
// What each picture shows (the six pages, then the end), for people who listen with a screen reader.
export const ALT: Key[] = ['book.alt0', 'book.alt1', 'book.alt2', 'book.alt3', 'book.alt4', 'book.alt5', 'book.altEnd'];
export const MYLO = mylo;
export const COVER_SCENE = cover;
export const END_SCENE = end;

export function sceneSvg(draw: () => string, id: string) {
  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="presentation">` +
    `<defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="7"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="3.5"/><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.5" flood-color="#000" flood-opacity=".22"/></filter></defs>` +
    // the background stays outside the torn-paper filter, so the page edges stay clean
    (() => { const art = draw(); const bg = art.match(/^<rect width="300" height="300" fill="[^"]+"\/>/)?.[0] ?? ''; return `${bg}<g filter="url(#${id})">${art.slice(bg.length)}</g>`; })() + `</svg>`;
}
