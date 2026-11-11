import { LoginForm } from './LoginForm';
import { getT } from '@/lib/i18n/server';
import { LangSwitch } from '@/lib/i18n/client';
import { LegalLinks } from '@/components/LegalLinks';
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { t } = await getT();
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1 style={{ marginBottom: 0 }}>{t('login.welcome')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('login.intro')}</p>
      <LoginForm next={safe} initialError={error ? t('login.badLink') : undefined} />
      <LangSwitch />
      <LegalLinks />
    </div>
  );
}
