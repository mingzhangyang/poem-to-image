import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_TEMPLATE_KEY,
  canImportLegacyGuestTemplates,
  hasLegacyTemplateCache,
  importLegacyGuestTemplates,
  parseCloudTemplateList,
  readTemplateCache,
  resolveTemplateScope,
  templateCacheKey,
  writeTemplateCache,
} from '../../src/customTemplateCache';
import {
  createCloudTemplate,
  deleteCloudTemplate,
  fetchCloudTemplates,
  renameCloudTemplate,
  type TemplateRequestOwner,
} from '../../src/customTemplateApi';
import type { UserCustomTemplate } from '../../src/types';
import { DEFAULT_POEM_STYLE } from '../../src/poemStyle';

function fixture(id: string): UserCustomTemplate {
  return {
    id, name: id, createdAt: 123,
    accentFrom: '#ffffff', accentTo: '#ffffff',
    background: {
      backgroundType: 'solid', backgroundColor: '#ffffff',
      gradientColor1: '#ffffff', gradientColor2: '#eeeeee',
      gradientDirection: 'to bottom', bgBrightness: 100, bgBlur: 0,
    },
    typography: {
      fontFamily: 'serif', fontSize: 32, textColor: '#111111',
      textAlign: 'center', writingMode: 'horizontal-tb',
      padding: 32, lineHeight: 1.8, letterSpacing: 0,
      columns: 1, columnGap: 0, textShadowEnabled: false,
      textShadowColor: '#000000', textShadowBlur: 0,
      textShadowOffsetY: 0, textShadowOffsetX: 0,
    },
    decorations: {
      showBorder: false, borderStyle: 'solid', showStamp: false,
      stamp: {
        text: 'seal', style: 'square', positionX: 50, positionY: 50,
        size: 32, rotation: 0, opacity: 1, fontFamily: 'serif',
      },
      poemPosition: { positionX: 50, positionY: 50 },
      logos: [], customTexts: [],
    },
    poemStyle: { ...DEFAULT_POEM_STYLE },
  };
}

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

function owner(getToken: () => Promise<string | null> = async () => 'signed-token'): TemplateRequestOwner {
  return {
    getToken, signal: new AbortController().signal, isCurrent: () => true,
  };
}

test('scoped guest and account libraries never read the unscoped legacy cache', () => {
  const local = storage();
  local.setItem(LEGACY_TEMPLATE_KEY, JSON.stringify([fixture('legacy')]));
  assert.equal(resolveTemplateScope(false, false, null), null);
  assert.equal(resolveTemplateScope(true, false, null), 'guest');
  assert.equal(resolveTemplateScope(true, true, null), null);
  assert.equal(resolveTemplateScope(true, true, 'user_a'), 'account:user_a');

  assert.deepEqual(readTemplateCache('guest', local), []);
  assert.deepEqual(readTemplateCache('account:user_a', local), []);
  assert.equal(hasLegacyTemplateCache(local), true);

  const migrated = importLegacyGuestTemplates(local);
  assert.equal(migrated[0].id, 'legacy');
  assert.equal(readTemplateCache('guest', local).length, 1);
  assert.deepEqual(readTemplateCache('account:user_a', local), []);
  assert.equal(hasLegacyTemplateCache(local), false);
  assert.ok(local.getItem(LEGACY_TEMPLATE_KEY), 'legacy backup is not erased');
});

test('independent accounts keep isolated caches with stable keys', () => {
  const local = storage();
  writeTemplateCache('account:user_a', [fixture('a')], local);
  writeTemplateCache('account:user_b', [fixture('b')], local);
  writeTemplateCache('guest', [fixture('anonymous')], local);
  assert.notEqual(templateCacheKey('account:user_a'), templateCacheKey('account:user_b'));
  assert.deepEqual(readTemplateCache('account:user_a', local).map((item) => item.id), ['a']);
  assert.deepEqual(readTemplateCache('account:user_b', local).map((item) => item.id), ['b']);
  assert.deepEqual(readTemplateCache('guest', local).map((item) => item.id), ['anonymous']);
});

test('malformed scoped or cloud data is rejected instead of silently treated as an empty list', () => {
  const local = storage();
  local.setItem(templateCacheKey('guest'), '{not-json');
  assert.throws(() => readTemplateCache('guest', local), /INVALID_SCOPED_TEMPLATE_CACHE/);
  assert.throws(() => parseCloudTemplateList({ error: 'not authorized' }), /INVALID_TEMPLATE_RESPONSE/);
  assert.throws(() => parseCloudTemplateList({ templates: null }), /INVALID_TEMPLATE_LIST/);
  assert.deepEqual(parseCloudTemplateList({ templates: [] }), []);
});

test('non-2xx fetch keeps previously cached data untouched', async () => {
  const local = storage();
  writeTemplateCache('account:user_a', [fixture('preserved')], local);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    await assert.rejects(fetchCloudTemplates(owner()), /TEMPLATE_HTTP_401/);
    assert.equal(readTemplateCache('account:user_a', local)[0].id, 'preserved');

    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Server unavailable' }), { status: 503 });
    await assert.rejects(fetchCloudTemplates(owner()), /TEMPLATE_HTTP_503/);
    assert.equal(readTemplateCache('account:user_a', local)[0].id, 'preserved');
  } finally {
    globalThis.fetch = original;
  }
});

test('200 with a missing templates property is not a successful empty account', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ status: 'ok' });
    await assert.rejects(fetchCloudTemplates(owner()), /INVALID_TEMPLATE_RESPONSE/);
    globalThis.fetch = async () => Response.json({ templates: [] });
    assert.deepEqual(await fetchCloudTemplates(owner()), []);
  } finally {
    globalThis.fetch = original;
  }
});

test('a pending token from a prior account may not dispatch an old request with the new token', async () => {
  let resume!: (token: string) => void;
  const pending = new Promise<string>((resolve) => { resume = resolve; });
  let current = true;
  let fetched = false;
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      fetched = true;
      return Response.json({ templates: [] });
    };
    const pendingRead = fetchCloudTemplates({
      getToken: async () => pending,
      signal: new AbortController().signal,
      isCurrent: () => current,
    });
    current = false;
    resume('new-account-token');
    await assert.rejects(pendingRead, /STALE_TEMPLATE_SCOPE/);
    assert.equal(fetched, false, 'no request sent after account switch');
  } finally {
    globalThis.fetch = original;
  }
});

test('create, rename, and delete use the authenticated scoped API', async () => {
  const received: Array<{ path: string; method: string; auth: string | null }> = [];
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      received.push({
        path: String(input),
        method: init?.method ?? '',
        auth: new Headers(init?.headers).get('Authorization'),
      });
      if (init?.method === 'POST') return Response.json(fixture('saved-remote'), { status: 201 });
      return new Response(null, { status: 204 });
    };
    assert.equal((await createCloudTemplate(fixture('new'), owner())).id, 'saved-remote');
    await renameCloudTemplate('id with space', 'new name', owner());
    await deleteCloudTemplate('id with space', owner());
    assert.deepEqual(received.map((item) => item.method), ['POST', 'PATCH', 'DELETE']);
    assert.ok(received[1].path.includes('id%20with%20space'));
    assert.ok(received.every((item) => item.auth === 'Bearer signed-token'));
  } finally {
    globalThis.fetch = original;
  }
});

test('nested template structures are validated before replacing a good cache', async () => {
  const valid = fixture('valid');
  const cases: unknown[] = [
    { ...valid, background: {} },
    { ...valid, typography: { ...valid.typography, textShadowEnabled: 'false' } },
    { ...valid, decorations: { ...valid.decorations, customTexts: undefined } },
    { ...valid, decorations: { ...valid.decorations, logos: {} } },
    { ...valid, decorations: { ...valid.decorations, customTexts: [{ id: 'broken' }] } },
    { ...valid, decorations: { ...valid.decorations, logos: [{ id: 'broken' }] } },
    { ...valid, decorations: { ...valid.decorations, signatures: [null] } },
    { ...valid, decorations: { ...valid.decorations, stamp: null } },
    { ...valid, decorations: { ...valid.decorations, poemPosition: {} } },
    { ...valid, poemStyle: { bodyAlign: [] } },
    { ...valid, decorations: { ...valid.decorations, borderStyle: 'invalid' } },
    { ...valid, poemStyle: { sourcePlacement: 'somewhere' } },
  ];
  for (const malformed of cases) {
    assert.throws(() => parseCloudTemplateList({ templates: [malformed] }), /INVALID_TEMPLATE_LIST/);
  }
  const local = storage();
  writeTemplateCache('account:user_a', [valid], local);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ templates: [cases[2]] });
    await assert.rejects(fetchCloudTemplates(owner()), /INVALID_TEMPLATE_LIST/);
    assert.deepEqual(readTemplateCache('account:user_a', local), [valid]);
  } finally {
    globalThis.fetch = original;
  }
});

test('genuinely optional fields in old templates are normalized safely', () => {
  const valid = fixture('legacy');
  const legacy = {
    ...valid, poemStyle: undefined,
    decorations: { ...valid.decorations, logos: undefined },
  };
  const parsed = parseCloudTemplateList({ templates: [legacy] });
  assert.equal(parsed[0].poemStyle.bodyAlign, 'center');
  assert.deepEqual(parsed[0].decorations.customTexts, []);
  assert.deepEqual(parsed[0].decorations.logos, []);
});

test('guest legacy import waits for durable cache after a failed local edit', () => {
  const local = storage();
  local.setItem(LEGACY_TEMPLATE_KEY, JSON.stringify([fixture('legacy')]));
  const current = fixture('unsaved');
  const quotaStorage = {
    getItem: local.getItem,
    setItem(key: string, value: string) {
      if (key === templateCacheKey('guest')) throw new Error('QuotaExceededError');
      local.setItem(key, value);
    },
  };
  assert.throws(() => writeTemplateCache('guest', [current], quotaStorage), /QuotaExceededError/);
  const dirtyView = { scope: 'guest' as const, cacheCorrupt: false, guestCacheDirty: true };
  assert.equal(canImportLegacyGuestTemplates(dirtyView), false);
  assert.equal(canImportLegacyGuestTemplates({ ...dirtyView, cacheCorrupt: true }), false);
  assert.equal(canImportLegacyGuestTemplates({ ...dirtyView, scope: 'account:a' }), false);
  assert.deepEqual(readTemplateCache('guest', local), [], 'disk is still older than the in-memory edit');

  // Retry sync writes the in-memory snapshot before older templates can merge.
  writeTemplateCache('guest', [current], local);
  assert.equal(canImportLegacyGuestTemplates({ ...dirtyView, guestCacheDirty: false }), true);
  const merged = importLegacyGuestTemplates(local);
  assert.deepEqual(merged.map((template) => template.id), ['unsaved', 'legacy']);
  assert.deepEqual(readTemplateCache('guest', local).map((template) => template.id), ['unsaved', 'legacy']);
  assert.ok(local.getItem(LEGACY_TEMPLATE_KEY), 'legacy backup is preserved');
});
