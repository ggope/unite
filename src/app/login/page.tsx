import { LoginForm } from './LoginForm';
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1 style={{ marginBottom: 0 }}>Welcome to UNIER</h1>
      <p className="muted" style={{ margin: 0 }}>Watching needs no account. To sign petitions, use one confirmed account, so each signature counts once.</p>
      <LoginForm next={safe} initialError={error ? 'That link did not work or has expired. Please try again.' : undefined} />
    </div>
  );
}
