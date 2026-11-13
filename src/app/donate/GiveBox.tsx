'use client';
import { useId, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { locale, type Key } from '@/lib/i18n/langs';
import { canGive, linkFor, type DonateConfig, type Freq } from '@/lib/donate';

// What a gift of this size helps with. Plain words, no promises of exact numbers.
const IMPACT: [number, Key][] = [[10, 'don.i1'], [25, 'don.i2'], [50, 'don.i3'], [Infinity, 'don.i4']];
const impactFor = (n: number) => IMPACT.find(([max]) => n < max)![1];

export function GiveBox({ cfg }: { cfg: DonateConfig }) {
  const { lang, t } = useT();
  const freqs = (['once', 'monthly'] as Freq[]).filter((f) => canGive(cfg, f));
  const [freq, setFreq] = useState<Freq>(freqs[0] ?? 'once');
  const [picked, setPicked] = useState<number | 'other'>(cfg.amounts[Math.min(2, cfg.amounts.length - 1)]);
  const [other, setOther] = useState('');
  const otherId = useId();

  const money = (n: number) => new Intl.NumberFormat(locale(lang), { style: 'currency', currency: cfg.currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const amount = picked === 'other' ? Math.round(Number(other.replace(',', '.')) * 100) / 100 : picked;
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 100000;
  const link = valid ? linkFor(cfg, freq, amount) : null;

  if (!freqs.length) return (
    <div className="panel give" id="give">
      <p style={{ margin: 0 }}><b>{t('don.soon')}</b></p>
      <span className="hint">{t('don.soonHint')}</span>
    </div>
  );

  return (
    <div className="panel give" id="give">
      {freqs.length > 1 && (
        <div className="seg" role="group" aria-label={t('don.freq')}>
          {freqs.map((f) => (
            <button key={f} type="button" className={freq === f ? 'on' : ''} aria-pressed={freq === f} onClick={() => setFreq(f)}>
              {t(f === 'once' ? 'don.once' : 'don.monthly')}
            </button>))}
        </div>)}
      {freq === 'monthly' && <p className="hint" style={{ margin: 0 }}>{t('don.monthlyWhy')}</p>}

      <fieldset className="amounts">
        <legend className="label">{t('don.amount')}</legend>
        {cfg.amounts.map((n) => (
          <button key={n} type="button" className="amt" aria-pressed={picked === n} onClick={() => setPicked(n)}>{money(n)}</button>))}
        <button type="button" className="amt" aria-pressed={picked === 'other'} onClick={() => setPicked('other')}>{t('don.other')}</button>
      </fieldset>
      {picked === 'other' && (
        <div className="field">
          <label htmlFor={otherId}>{t('don.otherLabel', { cur: cfg.currency })}</label>
          <input id={otherId} inputMode="decimal" autoComplete="off" value={other} autoFocus
            onChange={(e) => setOther(e.target.value.replace(/[^\d.,]/g, '').slice(0, 9))} placeholder="20" />
        </div>)}

      {valid && <p className="impact" aria-live="polite" style={{ margin: 0 }}><b>{money(amount)}</b> {t(impactFor(amount))}</p>}

      {link ? (
        <a className="btn primary big block" href={link.url} target="_blank" rel="noopener">
          {t(freq === 'once' ? 'don.giveOnce' : 'don.giveMonthly', { amt: money(amount) })}
        </a>
      ) : (
        <button type="button" className="btn primary big block" disabled>{t(valid ? 'don.noLink' : 'don.pick')}</button>
      )}
      {link && !link.exact && <span className="hint">{t('don.typeAmount', { amt: money(amount) })}</span>}
      <span className="hint">🔒 {t('don.secure')}</span>
    </div>
  );
}
