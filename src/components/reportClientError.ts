// Sends a crash in the visitor's browser to /api/errors, once per page view and error.
const seen = new Set<string>();
export function reportClientError(error: Error & { digest?: string }) {
  try {
    const key = `${error?.message}|${location.pathname}`;
    if (seen.has(key)) return; seen.add(key);
    fetch('/api/errors', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: String(error?.message ?? error).slice(0, 500), path: location.pathname, digest: error?.digest, stack: String(error?.stack ?? '').slice(0, 1500) }) }).catch(() => {});
  } catch {}
}
