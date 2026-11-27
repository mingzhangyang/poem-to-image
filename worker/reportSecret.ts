import type { WorkerEnv } from './env';

/** Shorter secrets are treated as missing. */
const MIN_REPORT_SECRET_LENGTH = 32;

/**
 * The HMAC key for stored visitor-report identifiers (`SHARE_REPORT_SECRET`),
 * or null when it is missing or too short. Reports are refused without it.
 */
export function reportSecret(env: WorkerEnv): string | null {
  const secret = env.SHARE_REPORT_SECRET;
  return secret && secret.length >= MIN_REPORT_SECRET_LENGTH ? secret : null;
}

/** True when visitor reports can be accepted; the sharing readiness check reports it. */
export function reportsConfigured(env: WorkerEnv): boolean {
  return reportSecret(env) !== null;
}
