import type { TemplateScope } from './customTemplateCache';

/**
 * An account lifetime is an identity, not merely a scope string. Switching
 * A -> B -> A creates a new lease, so queued A work cannot come back to life.
 */
export interface TemplateScopeLifetime {
  scope: TemplateScope | null;
  active: boolean;
  pendingMutations: number;
  /**
   * Writes still in flight in this lifetime, by key (a create, or the delete
   * of one template). A repeated request joins or is refused instead of
   * sending a second write; a new lifetime starts empty.
   */
  inFlight: Map<string, Promise<unknown>>;
}

export function createTemplateScopeLifetime(scope: TemplateScope | null): TemplateScopeLifetime {
  return { scope, active: true, pendingMutations: 0, inFlight: new Map() };
}

/** Records `task` under `key` in this lifetime until it settles. */
export function trackTemplateMutation<T>(
  lifetime: TemplateScopeLifetime,
  key: string,
  task: Promise<T>,
): Promise<T> {
  lifetime.inFlight.set(key, task);
  const release = () => {
    if (lifetime.inFlight.get(key) === task) lifetime.inFlight.delete(key);
  };
  task.then(release, release);
  return task;
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
