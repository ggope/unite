import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
export async function LegalLinks() {
  const { t } = await getT();
  return <nav className="legal" aria-label={t('legal.privacy')}><Link href="/privacy">{t('legal.privacy')}</Link><Link href="/terms">{t('legal.terms')}</Link><Link href="/imprint">{t('legal.imprint')}</Link></nav>;
}
