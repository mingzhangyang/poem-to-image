import { DEFAULT_POEM_STYLE, normalizeUserCustomTemplate } from './poemStyle';
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

/** Do not enable saves while authentication is unresolved or scope state is changing. */
export function isWritableTemplateScope(
  scope: TemplateScope | null,
  viewScope: TemplateScope | null,
  cacheCorrupt: boolean,
): boolean {
  return scope !== null && viewScope === scope && !(scope === 'guest' && cacheCorrupt);
}

// Validate the full template shape before any server snapshot or cache replaces
// known-good data. A shallow object check is insufficient: applying malformed
// decorations otherwise crashes while normalizing customTexts/logos.
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string');
}

function hasNumbers(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]));
}

function hasBooleans(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'boolean');
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOneOf(value: unknown, options: readonly string[]): boolean {
  return typeof value === 'string' && options.includes(value);
}

function isPositioned(value: unknown): boolean {
  return isRecord(value)
    && hasNumbers(value, ['positionX', 'positionY'])
    && optionalNumber(value.exportLeft) && optionalNumber(value.exportTop)
    && optionalNumber(value.boxWidth);
}

function isStamp(value: unknown): boolean {
  return isRecord(value)
    && hasStrings(value, ['text', 'fontFamily'])
    && isOneOf(value.style, ['square', 'round', 'brush'])
    && hasNumbers(value, ['positionX', 'positionY', 'size', 'rotation', 'opacity'])
    && (value.colorScheme === undefined || isOneOf(value.colorScheme, ['outline', 'filled']))
    && optionalString(value.inkColor) && optionalNumber(value.weathering)
    && (value.textureStyle === undefined || isOneOf(value.textureStyle, ['classic', 'natural']))
    && (value.textureSeed === undefined
      || (typeof value.textureSeed === 'number'
        && Number.isInteger(value.textureSeed)
        && value.textureSeed >= 0
        && value.textureSeed <= 0xffffffff));
}

function isCustomText(value: unknown): boolean {
  return isRecord(value)
    && hasStrings(value, ['id', 'text', 'color'])
    && isOneOf(value.writingMode, ['horizontal-tb', 'vertical-rl'])
    && hasNumbers(value, ['fontSize', 'rotation', 'positionX', 'positionY'])
    && optionalNumber(value.zIndex) && optionalNumber(value.exportLeft)
    && optionalNumber(value.exportTop) && optionalNumber(value.boxWidth);
}

function isLogo(value: unknown): boolean {
  return isRecord(value)
    && hasStrings(value, ['id', 'imageUrl'])
    && hasNumbers(value, ['positionX', 'positionY', 'size', 'rotation', 'opacity'])
    && optionalNumber(value.zIndex) && optionalNumber(value.exportLeft)
    && optionalNumber(value.exportTop);
}

function isSignature(value: unknown): boolean {
  return isRecord(value)
    && hasStrings(value, ['id', 'text', 'font', 'color'])
    && isOneOf(value.flourish, ['none', 'swoosh', 'double', 'loop', 'strike', 'wave', 'underline'])
    && hasNumbers(value, ['fontSize', 'slant', 'thickness', 'positionX', 'positionY', 'opacity', 'rotation'])
    && optionalNumber(value.zIndex);
}

function isBackground(value: unknown): boolean {
  return isRecord(value)
    && isOneOf(value.backgroundType, ['solid', 'paper', 'gradient', 'transparent', 'image'])
    && hasStrings(value, ['backgroundColor', 'gradientColor1', 'gradientColor2', 'gradientDirection'])
    && hasNumbers(value, ['bgBrightness', 'bgBlur'])
    // The optional fields below were introduced after the original template format.
    && optionalString(value.paperId)
    && (value.backgroundImage == null || typeof value.backgroundImage === 'string')
    && (value.backgroundImageSource == null || isOneOf(value.backgroundImageSource, ['template', 'upload', 'ai']))
    && (value.backgroundSize === undefined || isOneOf(value.backgroundSize, ['cover', 'contain', 'stretch']))
    && optionalString(value.backgroundPosition);
}

function isTypography(value: unknown): boolean {
  return isRecord(value)
    && hasStrings(value, ['fontFamily', 'textColor', 'textShadowColor'])
    && isOneOf(value.textAlign, ['left', 'center', 'right'])
    && isOneOf(value.writingMode, ['horizontal-tb', 'vertical-rl'])
    && hasBooleans(value, ['textShadowEnabled'])
    && hasNumbers(value, [
      'fontSize', 'padding', 'lineHeight', 'letterSpacing', 'columns', 'columnGap',
      'textShadowBlur', 'textShadowOffsetY', 'textShadowOffsetX',
    ]);
}

function isDecorations(value: unknown): boolean {
  return isRecord(value)
    && hasBooleans(value, ['showBorder', 'showStamp'])
    && isOneOf(value.borderStyle, [
      'solid', 'dashed', 'double', 'shadow', 'gradient', 'broken', 'overflow',
      'brush', 'ink', 'cloud', 'wave', 'fractal', 'meander', 'leiwen',
      'ornamental', 'envelope',
    ])
    && optionalString(value.borderColor) && optionalNumber(value.borderWidth)
    && isStamp(value.stamp) && isPositioned(value.poemPosition)
    && Array.isArray(value.customTexts) && value.customTexts.every(isCustomText)
    // Historic templates predate logos. Only absence is normalized to [];
    // a present but malformed collection must always be rejected.
    && (value.logos === undefined
      || (Array.isArray(value.logos) && value.logos.every(isLogo)))
    && (value.signatures === undefined
      || (Array.isArray(value.signatures) && value.signatures.every(isSignature)));
}

function isPoemStyle(value: unknown): boolean {
  if (value == null) return true; // Older templates did not store poemStyle.
  if (!isRecord(value)) return false;
  const alignKeys = ['titleAlign', 'bodyAlign', 'authorAlign', 'sourceAlign'];
  const earlyPlacements = ['before-body', 'after-body'];
  return Object.entries(DEFAULT_POEM_STYLE).every(([key, fallback]) => {
    const field = value[key];
    if (field === undefined) return true;
    if (alignKeys.includes(key)) return isOneOf(field, ['left', 'center', 'right']);
    if (key === 'titlePlacement') return isOneOf(field, earlyPlacements);
    if (key === 'authorPlacement') return isOneOf(field, [...earlyPlacements, 'auto']);
    if (key === 'sourcePlacement') return isOneOf(field, [...earlyPlacements, 'after-author']);
    return typeof field === typeof fallback
      && (typeof field !== 'number' || Number.isFinite(field));
  });
}

export function isTemplate(value: unknown): value is UserCustomTemplate {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string'
    && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
    && hasStrings(value, ['accentFrom', 'accentTo'])
    && isBackground(value.background)
    && isTypography(value.typography)
    && isDecorations(value.decorations)
    && isPoemStyle(value.poemStyle);
}

export function parseTemplateList(input: unknown): UserCustomTemplate[] {
  if (!Array.isArray(input) || !input.every(isTemplate)) {
    throw new Error('INVALID_TEMPLATE_LIST');
  }
  return input.map((template) => normalizeUserCustomTemplate({
    ...template,
    decorations: { ...template.decorations, logos: template.decorations.logos ?? [] },
  }));
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

/**
 * A failed guest write leaves the latest edits only in React state. Reading
 * older disk state during legacy import would undo creations, renames or
 * deletions; require the pending guest snapshot to be durable first.
 */
export function canImportLegacyGuestTemplates(state: {
  scope: TemplateScope | null;
  cacheCorrupt: boolean;
  guestCacheDirty: boolean;
}): boolean {
  return state.scope === 'guest' && !state.cacheCorrupt && !state.guestCacheDirty;
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
