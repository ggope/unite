// Puts a story into one of UNIER's causes by its words. Stories that fit no cause are skipped,
// so the feed stays on problems people can act on (not sport, gossip or markets).
import type { Topic } from '../topics';

const RULES: Record<Topic, RegExp[]> = {
  climate: [/\bclimate\b/i, /global warming/i, /\bemissions?\b/i, /\bcarbon\b/i, /fossil fuel/i, /\bcoal\b/i, /heatwave/i, /\bdrought/i, /\bfloods?\b|flooding/i, /wildfire/i, /deforestation/i, /renewable/i, /\bpollution\b/i, /glacier/i, /net zero/i, /plastic waste/i,
    /klím/i, /éghajlat/i, /felmeleged/i, /kibocsát/i, /szén-?dioxid/i, /aszály/i, /árvíz/i, /hőség/i, /erdőtűz/i, /megújuló/i, /szennyez/i, /műanyag/i],
  housing: [/\bhousing\b/i, /\brent(s|al|ers)?\b/i, /homeless/i, /eviction/i, /mortgage/i, /landlord/i, /affordable homes?/i,
    /lakhatás/i, /\blakás/i, /albérlet/i, /hajléktalan/i, /kilakoltat/i, /lakbér/i, /jelzálog/i],
  labour: [/\bworkers?\b/i, /\bwages?\b/i, /\bon strike\b|general strike|went on strike|strike action|walkout/i, /trade unions?|labou?r unions?/i, /minimum wage/i, /layoffs?|job cuts/i, /unemployment/i, /gig economy|delivery riders?/i, /\bpensions?\b/i,
    /munkavállal/i, /\bbér(e|ek|emel)/i, /sztrájk/i, /szakszervezet/i, /elbocsát/i, /munkanélküli/i, /nyugdíj/i, /minimálbér/i],
  digital: [/\bprivacy\b/i, /surveillance/i, /facial recognition/i, /data protection|data breach/i, /artificial intelligence|\bAI\b/, /algorithm/i, /big tech/i, /social media/i, /spyware/i, /deepfake/i, /\bpatent/i, /\b(Microsoft|Google|Meta|Apple|Amazon|TikTok|OpenAI|X Corp)\b/,
    /adatvéd/i, /megfigyel/i, /arcfelismer/i, /mesterséges intelligencia/i, /kémprogram/i, /közösségi média/i, /szabadalm/i],
  health: [/\bhealth(care)?\b/i, /hospitals?/i, /vaccin/i, /\bdisease/i, /outbreak/i, /epidemic|pandemic/i, /\bcancer\b/i, /mental health/i, /drug prices|medicine prices|insulin/i, /\bnurses?\b|\bdoctors\b/i,
    /egészségügy/i, /kórház/i, /oltás/i, /járvány/i, /betegség/i, /\brák(os)?\b/i, /\borvos/i, /ápoló/i, /gyógyszer/i],
  press: [/journalists?/i, /press freedom|media freedom/i, /\breporters?\b/i, /censorship/i, /disinformation/i,
    /újságíró/i, /sajtószabadság/i, /cenzúr/i, /dezinformáció/i, /propaganda/i],
  oceans: [/\boceans?\b/i, /sea levels?/i, /\bmarine\b/i, /overfishing|fishing fleet|trawl/i, /\bcoral/i, /\bwhales?\b/i, /high seas/i,
    /óceán/i, /\btenger/i, /halász/i, /korall/i, /bálna/i],
};

export function classify(title: string, teaser: string): Topic | null {
  let best: Topic | null = null, top = 0;
  for (const [topic, rules] of Object.entries(RULES) as [Topic, RegExp[]][]) {
    // a hit in the headline counts double
    const n = rules.reduce((a, r) => a + (r.test(title) ? 2 : 0) + (r.test(teaser) ? 1 : 0), 0);
    if (n > top) { top = n; best = topic; }
  }
  return top >= 2 ? best : null;   // at least a headline hit, or two hits in the teaser
}

const STOP = new Set('about after again against also among around because been before being between both could does during every from have here into just like more most much never only other over said says same should since some such than that their them then there these they this those through under until very were what when where which while will with would your year years new news live update updates világ után előtt között miatt szerint több mint amely amikor ahol vagy mert hogy akik ahogy ezért este reggel ma tegnap holnap'.split(' '));
export const tokens = (s: string) => new Set(s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOP.has(w)));
export function sameStory(a: Set<string>, b: Set<string>) {
  let shared = 0; for (const w of a) if (b.has(w)) shared++;
  const jac = shared / (a.size + b.size - shared || 1);
  return shared >= 3 || (shared >= 2 && jac >= 0.3);
}
