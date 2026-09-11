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
  isAdminPath,
  isStatsKvBinding,
  lookFromRequest,
  looksDashboardPage,
  looksSetCookie,
  looksStoreKind,
  looksToken,
  memoryLooksStore,
  recordDocumentLook,
  recordLook,
  sanitizeCountry,
  sanitizeFrom,
  sanitizePath,
  fromSiteHref,
  looksFromRows,
  shouldCountDocument,
  shouldRecordPath,
  summarizeLooks,
} from './page-looks.js';

const LOOKS_SECRET = 'test-looks-secret';

async function looksAuthEnv(extra = {}) {
  const token = await looksToken(LOOKS_SECRET);
  return {
    GITHUB_OAUTH_CLIENT_SECRET: LOOKS_SECRET,
    cookie: looksSetCookie(token, { secure: false }).split(';')[0],
    ...extra,
  };
}

function withLooksCookie(url, cookie, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('cookie', cookie);
  return new Request(url, { ...init, headers });
}

const SITE_LOOKS = `<html><body>
<p class="card-num" data-looks="today">—</p>
<p class="card-num" data-looks="week">—</p>
<p class="card-num" data-looks="year">—</p>
<p class="card-num" data-looks="total">—</p>
<ol class="pages" data-looks-years><li class="empty">no years</li></ol>
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

describe('isAdminPath', () => {
  it('marks the editor page so Looks can sit in the bar', () => {
    assert.equal(isAdminPath('/admin'), true);
    assert.equal(isAdminPath('/admin/'), true);
    assert.equal(isAdminPath('/admin/index.html'), true);
    assert.equal(isAdminPath('/looks'), false);
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
    assert.equal(shouldRecordPath('/logo.png'), false);
  });
});

describe('summarizeLooks', () => {
  it('adds today, the week, the year, and the busiest pages', () => {
    const today = berlinDay(new Date('2026-09-04T12:00:00+02:00'));
    const data = applyLook(emptyLooks(), '/', today, { country: 'DE', from: 'Instagram' });
    const next = applyLook(data, '/now', today, { country: 'FR', from: 'Instagram' });
    const extra = applyLook(next, '/now', today, { country: 'DE', from: 'Google' });
    const withOld = {
      ...extra,
      days: { ...extra.days, '2025-12-31': 7 },
      total: extra.total + 7,
    };
    const summary = summarizeLooks(withOld, new Date('2026-09-04T12:00:00+02:00'));
    assert.equal(summary.today, 3);
    assert.equal(summary.week, 3);
    assert.equal(summary.year, 3);
    assert.equal(summary.total, 10);
    assert.deepEqual(summary.years, [
      { name: '2026', looks: 3 },
      { name: '2025', looks: 7 },
    ]);
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

describe('fromSiteHref', () => {
  it('opens Instagram and Facebook, and skips typed visits', () => {
    assert.equal(fromSiteHref('Instagram'), 'https://www.instagram.com/');
    assert.equal(fromSiteHref('Facebook'), 'https://www.facebook.com/');
    assert.equal(fromSiteHref('goldsprint.de'), 'https://goldsprint.de/');
    assert.equal(fromSiteHref('Typed or bookmark'), '');
    assert.equal(fromSiteHref('On this site'), '');
  });
});

describe('looksFromRows', () => {
  it('turns What sent them into clickable site links', () => {
    const html = looksFromRows(
      [
        { name: 'Instagram', looks: 4 },
        { name: 'Typed or bookmark', looks: 2 },
      ],
      'none',
    );
    assert.match(html, /href="https:\/\/www\.instagram\.com\/"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, />Instagram</);
    assert.match(html, /class="looks-name">Typed or bookmark</);
    assert.doesNotMatch(html, /Typed or bookmark<\/a>/);
  });
});

describe('isStatsKvBinding', () => {
  it('accepts STATS objects and rejects fetch-only bindings', () => {
    assert.equal(
      isStatsKvBinding({ get: async () => null, put: async () => {} }),
      true,
    );
    assert.equal(isStatsKvBinding({}), true);
    assert.equal(isStatsKvBinding({ fetch: async () => new Response('') }), false);
    assert.equal(isStatsKvBinding(undefined), false);
  });
});

describe('looksStoreKind', () => {
  it('prefers durable KV over cache', () => {
    assert.equal(
      looksStoreKind({ STATS: { get: async () => null, put: async () => {} } }),
      'kv',
    );
    assert.ok(['cache', 'memory'].includes(looksStoreKind({})));
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
    const auth = await looksAuthEnv({ STATS: memoryKv() });
    const post = await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        method: 'POST',
        headers: { origin: 'https://thenewsoulsearchers.de', 'content-type': 'text/plain' },
        body: '/now',
      }),
      auth,
    );
    assert.equal(post.status, 204);

    const get = await handleLooksRequest(
      withLooksCookie('https://thenewsoulsearchers.de/api/looks', auth.cookie),
      auth,
    );
    const body = await get.json();
    assert.equal(body.total, 1);
    assert.equal(body.pages[0].path, '/now');
  });

  it('keeps Looks private until login cookie is set', async () => {
    const env = { STATS: memoryKv(), GITHUB_OAUTH_CLIENT_SECRET: LOOKS_SECRET };
    await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks', {
        method: 'POST',
        headers: { origin: 'https://thenewsoulsearchers.de', 'content-type': 'text/plain' },
        body: '/now',
      }),
      env,
    );
    const closedApi = await handleLooksRequest(
      new Request('https://thenewsoulsearchers.de/api/looks'),
      env,
    );
    assert.equal(closedApi.status, 401);

    const closedPage = await handleLooksPage(
      new Request('https://thenewsoulsearchers.de/looks'),
      env,
    );
    assert.equal(closedPage.status, 401);
    const closedHtml = await closedPage.text();
    assert.match(closedHtml, /Nothing to see here/);
    assert.doesNotMatch(closedHtml, /GitHub/);

    const auth = await looksAuthEnv({ STATS: env.STATS });
    const open = await handleLooksRequest(
      withLooksCookie('https://thenewsoulsearchers.de/api/looks', auth.cookie),
      auth,
    );
    assert.equal(open.status, 200);
    assert.equal((await open.json()).total, 1);

    const page = await handleLooksPage(
      withLooksCookie('https://thenewsoulsearchers.de/looks', auth.cookie),
      auth,
    );
    assert.equal(page.status, 200);
    assert.match(await page.text(), /\/now/);

    const site = await handleLooksPage(
      withLooksCookie('https://thenewsoulsearchers.de/looks', auth.cookie),
      {
        ...auth,
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
    const auth = await looksAuthEnv({
      STATS: memoryKv(),
      ASSETS: {
        fetch: async () =>
          new Response(SITE_LOOKS, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      },
    });
    await worker.fetch(
      new Request('https://thenewsoulsearchers.de/now', {
        headers: { 'sec-fetch-dest': 'document' },
      }),
      auth,
    );
    const closed = await worker.fetch(new Request('https://thenewsoulsearchers.de/api/looks'), auth);
    assert.equal(closed.status, 401);

    const res = await worker.fetch(
      withLooksCookie('https://thenewsoulsearchers.de/api/looks', auth.cookie),
      auth,
    );
    const body = await res.json();
    assert.equal(body.total, 1);

    const open = await worker.fetch(
      withLooksCookie('https://thenewsoulsearchers.de/looks', auth.cookie),
      auth,
    );
    const html = await open.text();
    assert.match(html, /data-looks="today">1</);
    assert.match(html, /\/now/);
    assert.match(html, /<footer>Looks<\/footer>/);

    const editor = await worker.fetch(
      withLooksCookie('https://thenewsoulsearchers.de/admin/', auth.cookie),
      {
        ...auth,
        ASSETS: {
          fetch: async () =>
            new Response(
              '<a class="cms-looks" href="/looks">Looks <span data-looks="today">—</span></a>',
              { headers: { 'content-type': 'text/html' } },
            ),
        },
      },
    );
    assert.match(await editor.text(), /data-looks="today">1</);

    const editorPublic = await worker.fetch(new Request('https://thenewsoulsearchers.de/admin/'), {
      ...auth,
      ASSETS: {
        fetch: async () =>
          new Response(
            '<a class="cms-looks" href="/looks">Looks <span data-looks="today">—</span></a>',
            { headers: { 'content-type': 'text/html' } },
          ),
      },
    });
    assert.match(await editorPublic.text(), /data-looks="today">—</);
  });

  it('counts a real page open without /api/looks', async () => {
    const auth = await looksAuthEnv({ STATS: memoryKv() });
    const counted = await recordDocumentLook(
      new Request('https://thenewsoulsearchers.de/now', {
        headers: { 'sec-fetch-dest': 'document' },
      }),
      auth,
    );
    assert.equal(counted.recorded, true);
    const page = await handleLooksPage(
      withLooksCookie('https://thenewsoulsearchers.de/looks', auth.cookie),
      auth,
    );
    assert.match(await page.text(), /\/now/);
  });

  it('stores country and the site that sent them', async () => {
    const auth = await looksAuthEnv({ STATS: memoryKv() });
    const request = new Request('https://thenewsoulsearchers.de/now', {
      headers: {
        'sec-fetch-dest': 'document',
        referer: 'https://www.instagram.com/',
      },
    });
    Object.defineProperty(request, 'cf', { value: { country: 'DE' } });
    assert.deepEqual(lookFromRequest(request), { country: 'DE', from: 'Instagram' });
    await recordDocumentLook(request, auth);
    const html = await (
      await handleLooksPage(
        withLooksCookie('https://thenewsoulsearchers.de/looks', auth.cookie),
        auth,
      )
    ).text();
    assert.match(html, /Germany/);
    assert.match(html, /href="https:\/\/www\.instagram\.com\/"/);
    assert.match(html, />Instagram</);
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
      year: 8,
      total: 9,
      years: [{ name: '2026', looks: 8 }],
      pages: [{ path: '/', looks: 4 }],
      countries: [{ name: 'Germany', looks: 3 }],
      from: [{ name: 'Instagram', looks: 2 }],
    });
    assert.match(html, /data-looks="today">2</);
    assert.match(html, /data-looks="week">5</);
    assert.match(html, /data-looks="year">8</);
    assert.match(html, /data-looks="total">9</);
    assert.match(html, /Home/);
    assert.match(html, /Germany/);
    assert.match(html, /class="looks-name">2026</);
    assert.match(html, /href="https:\/\/www\.instagram\.com\/"/);
    assert.match(html, />Instagram</);
    assert.match(html, /<footer>Looks<\/footer>/);
  });
});

describe('looksDashboardPage', () => {
  it('prints the numbers in the HTML', async () => {
    const html = await looksDashboardPage({
      today: 2,
      week: 5,
      year: 8,
      total: 9,
      years: [{ name: '2026', looks: 8 }],
      pages: [{ path: '/', looks: 4 }],
    }).text();
    assert.match(html, />2</);
    assert.match(html, />5</);
    assert.match(html, />8</);
    assert.match(html, />9</);
    assert.match(html, /This year/);
    assert.match(html, /All the years/);
    assert.match(html, /Home/);
    const withFrom = await looksDashboardPage({
      today: 1,
      week: 1,
      year: 1,
      total: 1,
      years: [{ name: '2026', looks: 1 }],
      pages: [],
      countries: [{ name: 'France', looks: 1 }],
      from: [{ name: 'Google', looks: 1 }],
    }).text();
    assert.match(withFrom, /France/);
    assert.match(withFrom, /href="https:\/\/www\.google\.com\/"/);
    assert.match(withFrom, />Google</);
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
