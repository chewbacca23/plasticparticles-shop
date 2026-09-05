import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from './cms-oauth-worker.js';
import {
  applyLook,
  berlinDay,
  countryLabel,
  emptyLooks,
  fillLooksInHtml,
  handleLooksPage,
  handleLooksRequest,
  lookFromRequest,
  looksDashboardPage,
  memoryLooksStore,
  recordDocumentLook,
  recordLook,
  sanitizeCountry,
  sanitizeFrom,
  sanitizePath,
  shouldCountDocument,
  shouldRecordPath,
  summarizeLooks,
} from './page-looks.js';

const SITE_LOOKS = `<html><body>
<p class="card-num" data-looks="today">—</p>
<p class="card-num" data-looks="week">—</p>
<p class="card-num" data-looks="total">—</p>
<ol class="pages" data-looks-pages><li class="empty">none</li></ol>
<ol class="pages" data-looks-countries><li class="empty">no country</li></ol>
<ol class="pages" data-looks-from><li class="empty">no from</li></ol>
<footer>Looks</footer>
</body></html>`;

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
    const data = applyLook(emptyLooks(), '/', today, { country: 'DE', from: 'Instagram' });
    const next = applyLook(data, '/now', today, { country: 'FR', from: 'Instagram' });
    const extra = applyLook(next, '/now', today, { country: 'DE', from: 'Google' });
    const summary = summarizeLooks(extra, new Date('2026-09-04T12:00:00+02:00'));
    assert.equal(summary.today, 3);
    assert.equal(summary.week, 3);
    assert.equal(summary.total, 3);
    assert.deepEqual(summary.pages[0], { path: '/now', looks: 2 });
    assert.deepEqual(summary.countries[0], { name: 'Germany', looks: 2 });
    assert.deepEqual(summary.from[0], { name: 'Instagram', looks: 2 });
  });
});

describe('sanitizeFrom', () => {
  it('names Instagram and skips our own site', () => {
    assert.equal(
      sanitizeFrom('https://www.instagram.com/p/abc', 'https://thenewsoulsearchers.de/now'),
      'Instagram',
    );
    assert.equal(
      sanitizeFrom('https://thenewsoulsearchers.de/now', 'https://thenewsoulsearchers.de/'),
      'On this site',
    );
    assert.equal(sanitizeFrom('', 'https://thenewsoulsearchers.de/now'), 'Typed or bookmark');
    assert.equal(sanitizeCountry('de'), 'DE');
    assert.equal(countryLabel('DE'), 'Germany');
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

    const site = await handleLooksPage(
      new Request('https://thenewsoulsearchers.de/looks'),
      {
        ...env,
        ASSETS: {
          fetch: async () =>
            new Response(SITE_LOOKS, { headers: { 'content-type': 'text/html' } }),
        },
      },
    );
    const siteHtml = await site.text();
    assert.match(siteHtml, /<footer>Looks<\/footer>/);
    assert.match(siteHtml, /\/now/);
  });

  it('is reachable through the Worker entrypoint', async () => {
    const env = {
      STATS: memoryKv(),
      ASSETS: {
        fetch: async () =>
          new Response(SITE_LOOKS, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      },
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
    assert.match(html, /data-looks="today">1</);
    assert.match(html, /\/now/);
    assert.match(html, /<footer>Looks<\/footer>/);
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

  it('stores country and the site that sent them', async () => {
    const env = { STATS: memoryKv() };
    const request = new Request('https://thenewsoulsearchers.de/now', {
      headers: {
        'sec-fetch-dest': 'document',
        referer: 'https://www.instagram.com/',
      },
    });
    Object.defineProperty(request, 'cf', { value: { country: 'DE' } });
    assert.deepEqual(lookFromRequest(request), { country: 'DE', from: 'Instagram' });
    await recordDocumentLook(request, env);
    const html = await (await handleLooksPage(new Request('https://thenewsoulsearchers.de/looks'), env)).text();
    assert.match(html, /Germany/);
    assert.match(html, /Instagram/);
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

describe('fillLooksInHtml', () => {
  it('writes the counts into the site page', () => {
    const html = fillLooksInHtml(SITE_LOOKS, {
      today: 2,
      week: 5,
      total: 9,
      pages: [{ path: '/', looks: 4 }],
      countries: [{ name: 'Germany', looks: 3 }],
      from: [{ name: 'Instagram', looks: 2 }],
    });
    assert.match(html, /data-looks="today">2</);
    assert.match(html, /data-looks="week">5</);
    assert.match(html, /data-looks="total">9</);
    assert.match(html, /Home/);
    assert.match(html, /Germany/);
    assert.match(html, /Instagram/);
    assert.match(html, /<footer>Looks<\/footer>/);
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
    const withFrom = await looksDashboardPage({
      today: 1,
      week: 1,
      total: 1,
      pages: [],
      countries: [{ name: 'France', looks: 1 }],
      from: [{ name: 'Google', looks: 1 }],
    }).text();
    assert.match(withFrom, /France/);
    assert.match(withFrom, /Google/);
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
