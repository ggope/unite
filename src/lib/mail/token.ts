import { createHash } from 'node:crypto';
// Only the hash of an email link's secret is stored, so a database leak cannot confirm or withdraw anything.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
