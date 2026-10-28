import { getOperationalHealth, pruneExpiredRateLimits } from './db';
import { logError, logInfo } from './observability';
import type { WorkerEnv } from './env';
import { pruneOrphanedShareAttempts, pruneRevokedShareAssets } from './shares';

export async function runOperationalChecks(env: WorkerEnv): Promise<void> {
  const [health, prunedRateLimits, cleanedShareAssets, cleanedOrphanedAttempts] = await Promise.all([
    getOperationalHealth(env.DB),
    pruneExpiredRateLimits(env.DB),
    pruneRevokedShareAssets(env),
    pruneOrphanedShareAttempts(env),
  ]);
  const fields = { ...health, prunedRateLimits, cleanedShareAssets, cleanedOrphanedAttempts };
  const hasAlert = health.paidPendingOrders > 0
    || health.reviewItems > 0
    || health.billingInvariantFailures > 0
    || health.staleGenerationReservations > 0;

  if (hasAlert) {
    logError('ops.reconciliation_alert', new Error('Operational reconciliation requires attention.'), fields);
    return;
  }

  logInfo('ops.reconciliation_healthy', fields);
}
