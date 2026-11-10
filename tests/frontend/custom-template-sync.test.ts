import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_TEMPLATE_KEY,
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

function fixture(id: string): UserCustomTemplate {
  return {
    id, name: id, createdAt: 123,
    accentFrom: '#ffffff', accentTo: '#ffffff',
    background: { backgroundType: 'solid' },
    typography: { fontFamily: 'serif' },
    decorations: { logos: [], customTexts: [] },
    poemStyle: { bodyAlign: 'center' },
  } as unknown as UserCustomTemplate;
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
