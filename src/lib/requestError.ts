import type { Instrumentation } from 'next';
import { reportProblem } from './alert';

export async function reportRequestError(...[err, request, context]: Parameters<Instrumentation.onRequestError>) {
  const e = err as Error & { digest?: string };
  // notFound() and redirect() are thrown on purpose; they are not errors.
  if (/NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR)/.test(`${e?.digest ?? ''} ${e?.message ?? ''}`)) return;
  await reportProblem({
    source: 'server', message: `${e?.name ?? 'Error'}: ${e?.message ?? String(err)}`, path: request.path,
    detail: [`${request.method} ${request.path}`, `${context.routeType} ${context.routePath}`, e?.digest ? `digest ${e.digest}` : '', (e?.stack ?? '').split('\n').slice(0, 8).join('\n')].filter(Boolean).join('\n'),
  });
}
