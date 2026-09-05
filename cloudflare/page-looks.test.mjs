import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from './cms-oauth-worker.js';
import {
  applyLook,
  berlinDay,
  emptyLooks,
  handleLooksPage,
  handleLooksRequest,
  looksDashboardPage,
  memoryLooksStore,
  recordDocumentLook,
  recordLook,
  sanitizePath,
  shouldCountDocument,
  shouldRecordPath,
  summarizeLooks,
} from './page-looks.js';

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

    const get = await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks'),
      env,
    );
    const body = await get.json();
    assert.equal(body.total, 1);
    assert.equal(body.pages[0].path, '/now');
  });

  it('lets anyone open Looks without logging in', async () => {
    const env = { STATS: memoryKv() };
    await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        method: 'POST',
        headers: { origin: 'https://thenewsoulsearchers.de', 'content-type': 'text/plain' },
        body: '/now',
      }),
      env,
    );
    const open = await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks'),
      env,
    );
    assert.equal(open.status, 200);
    assert.equal((await open.json()).total, 1);

    const page = await handleLooksPage(
      new Request('https://thenewsoulsearchers.de/looks'),
      env,
    );
    assert.equal(page.status, 200);
    assert.match(await page.text(), /\/now/);
  });

  it('is reachable through the Worker entrypoint', async () => {
    const env = {
      STATS: memoryKv(),
      ASSETS: { fetch: async () => new Response('looks-ok') },
    };
    await worker.fetch(
      new Request('https://thenewsoulsearchers.de/now', {
        headers: { 'sec-fetch-dest': 'document' },
      }),
      env,
    );
    const res = await worker.fetch(new Request('https://thenewsoulsearchers.de/api/looks'), env);
    const body = await res.json();
    assert.equal(body.total, 1);

    const open = await worker.fetch(new Request('https://thenewsoulsearchers.de/looks'), env);
    const html = await open.text();
    assert.match(html, />1</);
    assert.match(html, /\/now/);
  });

  it('counts a real page open without /api/looks', async () => {
    const env = { STATS: memoryKv() };
    const counted = await recordDocumentLook(
      new Request('https://thenewsoulsearchers.de/now', {
        headers: { 'sec-fetch-dest': 'document' },
      }),
      env,
    );
    assert.equal(counted.recorded, true);
    const page = await handleLooksPage(new Request('https://thenewsoulsearchers.de/looks'), env);
    assert.match(await page.text(), /\/now/);
  });
});

describe('shouldCountDocument', () => {
  it('counts a page open and skips a photo', () => {
    assert.equal(
      shouldCountDocument(new Request('https://thenewsoulsearchers.de/now')),
      true,
    );
    assert.equal(
      shouldCountDocument(new Request('https://thenewsoulsearchers.de/stories/img_5940.jpg')),
      false,
    );
  });
});

describe('looksDashboardPage', () => {
  it('prints the numbers in the HTML', async () => {
    const html = await looksDashboardPage({
      today: 2,
      week: 5,
      total: 9,
      pages: [{ path: '/', looks: 4 }],
    }).text();
    assert.match(html, />2</);
    assert.match(html, />5</);
    assert.match(html, />9</);
    assert.match(html, /Home/);
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
