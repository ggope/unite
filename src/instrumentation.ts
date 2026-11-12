import type { Instrumentation } from 'next';

// Every unhandled error in a page, route or server action on the live site is logged and, the first time, emailed to the owner.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportRequestError } = await import('./lib/requestError');
    await reportRequestError(err, request, context);
  }
};
