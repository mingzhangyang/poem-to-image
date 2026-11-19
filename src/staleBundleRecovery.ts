/**
 * Recover a tab whose bundle predates the current deployment.
 *
 * Deploys carry retired hashed files over for a retention window
 * (scripts/carry-over-assets.mjs), but a tab left open longer than that can
 * still request a lazy chunk that is gone. Vite reports that as
 * `vite:preloadError`; reloading picks up the current bundle. The editor's
 * pagehide/beforeunload handlers save the draft or ask before leaving, so a
 * reload does not silently drop edits.
 */
export const RELOAD_MARKER_KEY = 'inkpoem.staleBundleReloadAt';
export const RELOAD_COOLDOWN_MS = 60_000;

interface ReloadMarkerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether to reload now. Refuses a second reload within the cooldown so a
 * chunk that is missing even from the current deployment cannot cause a
 * reload loop.
 */
export function shouldReloadForStaleBundle(storage: ReloadMarkerStorage | null, now: number): boolean {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_MARKER_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_COOLDOWN_MS) return false;
    storage.setItem(RELOAD_MARKER_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function installStaleBundleRecovery(target: Window = window): void {
  target.addEventListener('vite:preloadError', () => {
    let storage: Storage | null;
    try {
      storage = target.sessionStorage;
    } catch {
      storage = null;
    }
    if (shouldReloadForStaleBundle(storage, Date.now())) target.location.reload();
  });
}
