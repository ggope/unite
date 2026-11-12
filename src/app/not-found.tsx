import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { LogoBlink } from '@/lib/logo';
export default async function NotFound() {
  const { t } = await getT();
  return <div className="empty"><LogoBlink size={96} id="nf-logo" /><h1>{t('notfound.title')}</h1><p>{t('notfound.text')}</p><Link href="/">{t('notfound.back')}</Link></div>;
}
