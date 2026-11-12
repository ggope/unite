'use client';
import { useEffect } from 'react';
import { useT } from '@/lib/i18n/client';
import { reportClientError } from '@/components/reportClientError';

// Shown instead of a page that crashed. The owner is told automatically.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <div className="empty" role="alert">
      <h1>{t('err.title')}</h1>
      <p>{t('err.text')}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" onClick={reset}>{t('err.retry')}</button>
        <a className="btn" href="/">{t('notfound.back')}</a>
      </div>
    </div>
  );
}
