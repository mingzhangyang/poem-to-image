import { normalizeUserCustomTemplate } from './poemStyle';
import type { UserCustomTemplate } from './types';

/**
 * The pre-2026 cache had no user identity. Never silently attribute it to an
 * authenticated account, or show it after sign-out from that account.
 * Keep it intact until the user explicitly imports it as a guest.
 */
export const LEGACY_TEMPLATE_KEY = 'poem-to-image.custom-templates';
const SCOPED_TEMPLATE_PREFIX = 'poem-to-image.custom-templates.v2.';
const LEGACY_REVIEW_KEY = 'poem-to-image.custom-templates.v2.legacy-reviewed';

export type TemplateScope = 'guest' | `account:${string}`;

export function resolveTemplateScope(
  isLoaded: boolean,
  isSignedIn: boolean,
  userId: string | null | undefined,
): TemplateScope | null {
  if (!isLoaded) return null;
  if (!isSignedIn) return 'guest';
  return userId ? `account:${userId}` : null;
}

export function templateCacheKey(scope: TemplateScope): string {
  return SCOPED_TEMPLATE_PREFIX + encodeURIComponent(scope);
}

export function isTemplate(value: unknown): value is UserCustomTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<UserCustomTemplate>;
  return typeof item.id === 'string' && item.id.length > 0
    && typeof item.name === 'string'
    && typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
    && !!item.background && typeof item.background === 'object'
    && !!item.typography && typeof item.typography === 'object'
    && !!item.decorations && typeof item.decorations === 'object';
}

export function parseTemplateList(input: unknown): UserCustomTemplate[] {
  if (!Array.isArray(input) || !input.every(isTemplate)) {
    throw new Error('INVALID_TEMPLATE_LIST');
  }
  return input.map((template) => normalizeUserCustomTemplate(template));
}

export function parseCloudTemplateList(payload: unknown): UserCustomTemplate[] {
  if (!payload || typeof payload !== 'object' || !('templates' in payload)) {
    throw new Error('INVALID_TEMPLATE_RESPONSE');
  }
  return parseTemplateList((payload as { templates: unknown }).templates);
}

export function readTemplateCache(scope: TemplateScope, storage: Pick<Storage, 'getItem'>): UserCustomTemplate[] {
  const raw = storage.getItem(templateCacheKey(scope));
  if (raw === null) return [];
  try {
    return parseTemplateList(JSON.parse(raw) as unknown);
  } catch {
    throw new Error('INVALID_SCOPED_TEMPLATE_CACHE');
  }
}

export function writeTemplateCache(
  scope: TemplateScope,
  templates: UserCustomTemplate[],
  storage: Pick<Storage, 'setItem'>,
): void {
  storage.setItem(templateCacheKey(scope), JSON.stringify(templates));
}

export function hasLegacyTemplateCache(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    if (storage.getItem(LEGACY_REVIEW_KEY) === 'true') return false;
    const raw = storage.getItem(LEGACY_TEMPLATE_KEY);
    if (!raw) return false;
    try {
      return parseTemplateList(JSON.parse(raw) as unknown).length > 0;
    } catch {
      // A malformed historic cache still needs a visible recovery path.
      // Import will reject it without changing the original bytes.
      return true;
    }
  } catch {
    // Storage itself may be inaccessible; readScope will surface that error.
    return false;
  }
}

/** Only an explicit guest action may recover the unscoped historical cache. */
export function importLegacyGuestTemplates(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): UserCustomTemplate[] {
  const raw = storage.getItem(LEGACY_TEMPLATE_KEY);
  if (!raw) return readTemplateCache('guest', storage);
  const old = parseTemplateList(JSON.parse(raw) as unknown);
  const current = readTemplateCache('guest', storage);
  const keys = new Set(current.map((template) => template.id));
  const merged = [...current];
  for (const item of old) {
    if (keys.has(item.id)) continue;
    keys.add(item.id);
    merged.push(item);
  }
  // Mark reviewed only after the new guest cache has been written.
  // Retain the legacy key as a backup; do not expose it automatically.
  writeTemplateCache('guest', merged, storage);
  storage.setItem(LEGACY_REVIEW_KEY, 'true');
  return merged;
}
