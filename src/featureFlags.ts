/**
 * Feature flags gate in-progress or experimental capabilities.
 * All flags default to false. Set a flag to true in the defaults object
 * when rolling out to everyone, or override per-session via localStorage:
 *   localStorage.setItem('flag:ai-poem-suggestions', 'true')
 */

type FlagKey =
  | 'ai-poem-suggestions'    // Phase 1 – smart design direction picker
  | 'form-aware-layout'      // Phase 1 – auto-detect poem form (haiku, 5-word, etc.)
  | 'video-export'           // Phase 2 – animated/video export
  | 'gallery'                // Phase 4 – public community gallery
  | 'print-export';          // Phase 5 – 300 DPI print export

const DEFAULTS: Record<FlagKey, boolean> = {
  'ai-poem-suggestions': false,
  'form-aware-layout': false,
  'video-export': false,
  'gallery': false,
  'print-export': false,
};

function readLocalOverride(key: FlagKey): boolean | null {
  try {
    const raw = window.localStorage.getItem(`flag:${key}`);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    /* localStorage unavailable (SSR/private) */
  }
  return null;
}

/** Returns true if the feature flag is enabled. */
export function isEnabled(key: FlagKey): boolean {
  const override = readLocalOverride(key);
  return override !== null ? override : DEFAULTS[key];
}

/** Enable a flag for this browser session only. */
export function enableFlag(key: FlagKey) {
  try {
    window.localStorage.setItem(`flag:${key}`, 'true');
  } catch {
    /* ignore */
  }
}

/** Disable a flag for this browser session only. */
export function disableFlag(key: FlagKey) {
  try {
    window.localStorage.setItem(`flag:${key}`, 'false');
  } catch {
    /* ignore */
  }
}
