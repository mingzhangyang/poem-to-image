import { getOperationalHealth, pruneExpiredRateLimits } from './db';
import { logError, logInfo } from './observability';
import type { WorkerEnv } from './env';
import { pruneOrphanedShareAttempts, pruneRevokedShareAssets } from './shares';

export async function runOperationalChecks(env: WorkerEnv): Promise<void> {
  await env.DB.prepare(`UPDATE shared_artworks SET revoked_at = CURRENT_TIMESTAMP, title = '', author = '', assets_deleted_at = CASE WHEN image_key IS NULL AND card_key IS NULL THEN CURRENT_TIMESTAMP ELSE assets_deleted_at END WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP`).run();
  // Drop reports of revoked shares, and reports a maintainer has resolved
  // (filed before the share's last review).
  await env.DB.prepare(`DELETE FROM share_reports WHERE share_id IN (SELECT id FROM shared_artworks WHERE revoked_at IS NOT NULL)
    OR created_at < (SELECT s.gallery_reviewed_at FROM shared_artworks s WHERE s.id = share_reports.share_id)`).run();
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
