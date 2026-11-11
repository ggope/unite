import { LoginForm } from './LoginForm';
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <div className="stack"><h1>Sign in</h1><p className="muted" style={{ margin: 0 }}>No password. We email you a link, which also confirms you are one real person, so each signature counts once.</p><LoginForm next={safe} /></div>;
}
