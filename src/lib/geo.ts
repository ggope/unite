// The approximate country the middleware saw for this connection, or null.
export function geo(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )geo=([A-Za-z]{2})(?:;|$)/);
  return m ? m[1].toUpperCase() : null;
}
