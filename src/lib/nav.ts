import type { Key } from '@/lib/i18n/langs';

// Everything the left bar (and the phone "Explore" page) links to besides the five main tabs.
// Add a page here once and it shows up in both places. `hint` is the one-line description on the Explore page.
export type NavLink = { href: string; label: Key; icon: string; hint: Key };
export type NavGroup = { label: Key; items: NavLink[] };

export const MORE: NavGroup[] = [
  { label: 'nav.discover', items: [
    { href: '/causes', label: 'nav.causes', icon: 'causes', hint: 'nav.causesHint' },
    { href: '/near', label: 'nav.near', icon: 'pin', hint: 'nav.nearHint' },
    { href: '/deadlines', label: 'nav.deadlines', icon: 'clock', hint: 'nav.deadlinesHint' },
    { href: '/saved', label: 'nav.saved', icon: 'star', hint: 'nav.savedHint' },
  ] },
  { label: 'nav.results', items: [
    { href: '/wins', label: 'wins.title', icon: 'trophy', hint: 'nav.winsHint' },
    { href: '/targets', label: 'board.title', icon: 'megaphone', hint: 'nav.targetsHint' },
    { href: '/transparency', label: 'tr.title', icon: 'scale', hint: 'nav.trHint' },
  ] },
  { label: 'nav.aboutGroup', items: [
    { href: '/how', label: 'nav.how', icon: 'info', hint: 'nav.howHint' },
    { href: '/mylo', label: 'mylo.meet', icon: 'mylo', hint: 'nav.myloHint' },
    { href: '/kids', label: 'nav.kids', icon: 'kids', hint: 'nav.kidsHint' },
    { href: '/donate', label: 'don.link', icon: 'heart', hint: 'nav.donateHint' },
  ] },
];
