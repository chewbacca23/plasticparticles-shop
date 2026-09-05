import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from './cms-oauth-worker.js';
import {
  applyLook,
  berlinDay,
  emptyLooks,
  handleLooksPage,
  handleLooksRequest,
  LOOKS_COOKIE,
  looksToken,
  memoryLooksStore,
  recordLook,
  sanitizePath,
  shouldRecordPath,
  summarizeLooks,
} from './page-looks.js';

const LOOKS_SECRET = 'looks-test-secret';

async function looksGet(url, env, extra = {}) {
  const token = await looksToken(LOOKS_SECRET);
  return handleLooksRequest(
    new Request(url, {
      ...extra,
      headers: { cookie: `${LOOKS_COOKIE}=${token}`, ...(extra.headers || {}) },
    }),
    { ...env, GITHUB_OAUTH_CLIENT_SECRET: LOOKS_SECRET },
  );
}

describe('sanitizePath', () => {
  it('keeps a public page and drops traversal', () => {
    assert.equal(sanitizePath('/stories/nice?x=1'), '/stories/nice');
    assert.equal(sanitizePath('now'), '/now');
    assert.equal(sanitizePath('/foo/../secret'), '');
  });
});

describe('shouldRecordPath', () => {
  it('counts rides and skips the editor', () => {
    assert.equal(shouldRecordPath('/'), true);
    assert.equal(shouldRecordPath('/now'), true);
    assert.equal(shouldRecordPath('/stories/nice'), true);
    assert.equal(shouldRecordPath('/admin'), false);
    assert.equal(shouldRecordPath('/admin/index.html'), false);
    assert.equal(shouldRecordPath('/looks'), false);
    assert.equal(shouldRecordPath('/logo.svg'), false);
  });
});

describe('summarizeLooks', () => {
  it('adds today, the week, and the busiest pages', () => {
    const today = berlinDay(new Date('2026-09-04T12:00:00+02:00'));
    const data = applyLook(emptyLooks(), '/', today);
    const next = applyLook(data, '/now', today);
    const extra = applyLook(next, '/now', today);
    const summary = summarizeLooks(extra, new Date('2026-09-04T12:00:00+02:00'));
    assert.equal(summary.today, 3);
    assert.equal(summary.week, 3);
    assert.equal(summary.total, 3);
    assert.deepEqual(summary.pages[0], { path: '/now', looks: 2 });
  });
});

describe('recordLook', () => {
  it('writes a public look and ignores /admin', async () => {
    const store = memoryLooksStore();
    const ok = await recordLook(store, '/stories/nice', new Date('2026-09-04T12:00:00+02:00'));
    const skip = await recordLook(store, '/admin/index.html');
    assert.equal(ok.recorded, true);
    assert.equal(skip.recorded, false);
    const summary = await store.load();
    assert.equal(summary.total, 1);
    assert.equal(summary.paths['/stories/nice'], 1);
  });
});

describe('GET/POST /api/looks', () => {
  it('counts a look then returns the dashboard numbers', async () => {
    const env = { STATS: memoryKv() };
    const post = await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        method: 'POST',
        headers: { origin: 'https://thenewsoulsearchers.de', 'content-type': 'text/plain' },
        body: '/now',
      }),
      env,
    );
    assert.equal(post.status, 204);

    const get = await looksGet('https://thenewsoulsearchers.de/api/looks', env);
    const body = await get.json();
    assert.equal(body.total, 1);
    assert.equal(body.pages[0].path, '/now');
  });

  it('hides the numbers until GitHub login sets the Looks cookie', async () => {
    const env = { STATS: memoryKv(), GITHUB_OAUTH_CLIENT_SECRET: LOOKS_SECRET };
    await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        method: 'POST',
        headers: { origin: 'https://thenewsoulsearchers.de', 'content-type': 'text/plain' },
        body: '/now',
      }),
      env,
    );
    const closed = await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks'),
      env,
    );
    assert.equal(closed.status, 401);
    assert.equal((await closed.json()).error, 'login');

    const page = await handleLooksPage(
      new Request('https://thenewsoulsearchers.de/looks'),
      env,
    );
    assert.equal(page.status, 401);
    assert.match(await page.text(), /only for you/i);
  });

  it('is reachable through the Worker entrypoint after login', async () => {
    const env = {
      STATS: memoryKv(),
      GITHUB_OAUTH_CLIENT_SECRET: LOOKS_SECRET,
      ASSETS: { fetch: async () => new Response('looks-ok') },
    };
    await worker.fetch(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        method: 'POST',
        body: JSON.stringify({ path: '/' }),
        headers: { 'content-type': 'application/json', origin: 'https://thenewsoulsearchers.de' },
      }),
      env,
    );
    const token = await looksToken(LOOKS_SECRET);
    const res = await worker.fetch(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        headers: { cookie: `${LOOKS_COOKIE}=${token}` },
      }),
      env,
    );
    const body = await res.json();
    assert.equal(body.total, 1);

    const open = await worker.fetch(
      new Request('https://thenewsoulsearchers.de/looks', {
        headers: { cookie: `${LOOKS_COOKIE}=${token}` },
      }),
      env,
    );
    assert.equal(await open.text(), 'looks-ok');
  });
});

function memoryKv() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
  };
}
