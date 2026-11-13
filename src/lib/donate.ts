// Donation settings. Everything comes from Vercel environment variables, so the owner can change
// amounts and links without a code change. Payments happen on hosted pages (Stripe Payment Links),
// so UNIER never touches card data. Anything left empty is simply not shown.
//
// NEXT_PUBLIC_DONATE_URL            one-off link where the giver chooses the amount
// NEXT_PUBLIC_DONATE_MONTHLY_URL    monthly link where the giver chooses the amount
// NEXT_PUBLIC_DONATE_CURRENCY       ISO code, default EUR
// NEXT_PUBLIC_DONATE_AMOUNTS        suggested amounts, default "5,10,25,50,100"
// NEXT_PUBLIC_DONATE_LINKS          optional fixed-amount links, JSON: {"once":{"10":"https://…"},"monthly":{"5":"https://…"}}
// NEXT_PUBLIC_DONATE_IBAN           bank transfer (optional), with NEXT_PUBLIC_DONATE_ACCOUNT_NAME and NEXT_PUBLIC_DONATE_BIC
// NEXT_PUBLIC_DONATE_EMAIL          address for larger gifts, organisations and questions (optional)

export type Freq = 'once' | 'monthly';
export type DonateConfig = {
  currency: string;
  amounts: number[];
  base: Partial<Record<Freq, string>>;
  fixed: Record<Freq, Record<string, string>>;
  bank: { iban: string; name?: string; bic?: string } | null;
  email?: string;
};

const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/\S+$/.test(u.trim());

function parseFixed(raw: string | undefined): DonateConfig['fixed'] {
  const out: DonateConfig['fixed'] = { once: {}, monthly: {} };
  if (!raw) return out;
  try {
    const j = JSON.parse(raw);
    for (const f of ['once', 'monthly'] as const)
      for (const [amt, url] of Object.entries(j?.[f] ?? {}))
        if (Number(amt) > 0 && https(url)) out[f][String(Number(amt))] = url.trim();
  } catch { /* a typo in the setting must never break the page */ }
  return out;
}

export function donateConfig(): DonateConfig {
  const e = process.env;
  const currency = /^[A-Za-z]{3}$/.test(e.NEXT_PUBLIC_DONATE_CURRENCY ?? '') ? e.NEXT_PUBLIC_DONATE_CURRENCY!.toUpperCase() : 'EUR';
  const amounts = (e.NEXT_PUBLIC_DONATE_AMOUNTS ?? '5,10,25,50,100').split(',').map((x) => Math.round(Number(x.trim())))
    .filter((n) => Number.isFinite(n) && n > 0).slice(0, 6);
  const base: DonateConfig['base'] = {};
  if (https(e.NEXT_PUBLIC_DONATE_URL)) base.once = e.NEXT_PUBLIC_DONATE_URL.trim();
  if (https(e.NEXT_PUBLIC_DONATE_MONTHLY_URL)) base.monthly = e.NEXT_PUBLIC_DONATE_MONTHLY_URL.trim();
  const iban = (e.NEXT_PUBLIC_DONATE_IBAN ?? '').replace(/\s+/g, '').toUpperCase();
  return {
    currency, amounts: amounts.length ? amounts : [5, 10, 25, 50, 100], base,
    fixed: parseFixed(e.NEXT_PUBLIC_DONATE_LINKS),
    bank: /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban) ? { iban, name: e.NEXT_PUBLIC_DONATE_ACCOUNT_NAME || undefined, bic: e.NEXT_PUBLIC_DONATE_BIC || undefined } : null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.NEXT_PUBLIC_DONATE_EMAIL ?? '') ? e.NEXT_PUBLIC_DONATE_EMAIL : undefined,
  };
}

// Which frequencies can actually take money right now.
export const canGive = (c: DonateConfig, f: Freq) => !!c.base[f] || Object.keys(c.fixed[f]).length > 0;

// Where the button goes: a fixed-amount link when there is one, else the choose-your-amount link.
export function linkFor(c: DonateConfig, f: Freq, amount: number): { url: string; exact: boolean } | null {
  const fixed = c.fixed[f][String(amount)];
  if (fixed) return { url: fixed, exact: true };
  return c.base[f] ? { url: c.base[f]!, exact: false } : null;
}

// Group IBANs in fours, the way banks print them.
export const prettyIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();
