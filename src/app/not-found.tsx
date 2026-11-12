import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
export default async function NotFound() {
  const { t } = await getT();
  return <div className="empty"><h1>{t('notfound.title')}</h1><p>{t('notfound.text')}</p><Link href="/">{t('notfound.back')}</Link></div>;
}
