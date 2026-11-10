import type { TemplateScope } from './customTemplateCache';

/**
 * An account lifetime is an identity, not merely a scope string. Switching
 * A -> B -> A creates a new lease, so queued A work cannot come back to life.
 */
export interface TemplateScopeLifetime {
  scope: TemplateScope | null;
  active: boolean;
  pendingMutations: number;
}

export function createTemplateScopeLifetime(scope: TemplateScope | null): TemplateScopeLifetime {
  return { scope, active: true, pendingMutations: 0 };
}

export function isCurrentTemplateScopeLifetime(
  current: TemplateScopeLifetime,
  owner: TemplateScopeLifetime,
): boolean {
  return current === owner && owner.active;
}

/**
 * Only run tasks while their captured lifetime is alive. Count queued as well
 * as running writes; the server is refreshed only after the entire queue has
 * settled, so a GET between two writes cannot overwrite a later result.
 */
export function enqueueTemplateMutation<T>(
  queue: { current: Promise<void> },
  lifetime: TemplateScopeLifetime,
  isCurrent: () => boolean,
  operation: () => Promise<T>,
  staleResult: T,
  onIdle: () => void,
): Promise<T> {
  lifetime.pendingMutations += 1;
  const task = queue.current.then(() => (isCurrent() ? operation() : staleResult));
  // A rejected write must not poison the queue for subsequent operations.
  queue.current = task.then(() => undefined, () => undefined);
  return task.finally(() => {
    lifetime.pendingMutations -= 1;
    if (isCurrent() && lifetime.pendingMutations === 0) onIdle();
  });
}
