/**
 * Monotonic intent epochs: each user action supersedes all older async work.
 * Ownership is checked at commit time, not just when a request starts.
 */
export interface AsyncIntentGate {
  begin(): number;
  invalidate(): void;
  isCurrent(epoch: number): boolean;
}

export function createAsyncIntentGate(): AsyncIntentGate {
  let epoch = 0;
  return {
    begin: () => ++epoch,
    invalidate: () => { epoch += 1; },
    isCurrent: (requestEpoch) => requestEpoch === epoch,
  };
}

/** Identity of a particular signed-in account lifetime (including guest). */
export interface AsyncAccountOwner {
  accountId: string | null;
}

/** Returning to the same ID after a different account never revives old work. */
export function nextAsyncAccountOwner(
  previous: AsyncAccountOwner,
  accountId: string | null,
): AsyncAccountOwner {
  return previous.accountId === accountId ? previous : { accountId };
}
