import type { TemplateReconciliationStatus } from './types';

/**
 * Mutation uncertainty is independent of GET health. A valid GET refreshes
 * the list but cannot prove whether an earlier POST was accepted; a failed GET
 * must not be presented as successful reconciliation.
 */
export function templateReadReconciliationStatus(
  mutationUncertain: boolean,
  outcome: 'checking' | 'refreshed' | 'failed',
): TemplateReconciliationStatus {
  return mutationUncertain ? outcome : 'idle';
}
