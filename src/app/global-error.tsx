'use client';
import { useEffect } from 'react';
import { reportClientError } from '@/components/reportClientError';

// Last resort when even the page frame failed. No translations are loaded here, so it says it in all five languages.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F2EEE6', color: '#15130F', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, padding: 16, textAlign: 'center' }}>
        <div role="alert" style={{ maxWidth: 420 }}>
          <h1>Something went wrong</h1>
          <p>We have been told and are fixing it. · Hiba történt, már javítjuk. · Etwas ist schiefgelaufen. · Algo salió mal. · Une erreur est survenue.</p>
          <button onClick={reset} style={{ font: 'inherit', padding: '10px 18px', borderRadius: 999, border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
