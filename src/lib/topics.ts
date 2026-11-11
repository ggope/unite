export const TOPICS = {
  climate: { label: 'Climate', a: '#0B4F43', b: '#2BC48A' },
  housing: { label: 'Housing', a: '#4A2A12', b: '#F0913A' },
  labour: { label: 'Workers', a: '#3A1450', b: '#C86BFA' },
  digital: { label: 'Digital rights', a: '#0B2A5C', b: '#3FA9F5' },
  health: { label: 'Health', a: '#5A0F25', b: '#FF6B81' },
  press: { label: 'Press freedom', a: '#3B3B0C', b: '#E8D44D' },
  oceans: { label: 'Oceans', a: '#062F4F', b: '#27C3D9' },
} as const;
export type Topic = keyof typeof TOPICS;
export const TOPIC_KEYS = Object.keys(TOPICS) as Topic[];
export const GOALS = [1000, 10000, 50000, 100000, 250000, 500000, 1000000];
export const DAILY_LIMIT = 10;
export const CONSENT_VERSION = 'signatures-v1';
export const CONSENT_TEXT =
  'I agree that UNIER records the petitions I choose to sign. A signature shows a political opinion, so UNIER needs my explicit consent. ' +
  'Only total counts are shared with petition targets, never my email. I can withdraw any signature, or this consent, at any time.';
export const ROLE_LABEL = { founder: 'Petition Founder', supporter: 'Petition Supporter' } as const;
export const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
