import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { looksSetCookie, looksToken } from './page-looks.js';
import {
  handlePostcardSharesRequest,
  parseShareBody,
  postcardSharesListHtml,
  validateShare,
} from './postcard-shares.js';

describe('parseShareBody and validateShare', () => {
  it('trims fields and keeps a clean slug', () => {
    const fields = parseShareBody({
      slug: '  Coast-Road!!  ',
      title: '  Coast road  ',
      path: 'postcard/coast-road',
      website: '',
    });
    assert.equal(fields.slug, 'coast-road');
    assert.equal(fields.title, 'Coast road');
    assert.equal(fields.path, '/postcard/coast-road');
    assert.equal(validateShare(fields), '');
  });

  it('asks for a postcard when empty', () => {
    assert.match(validateShare(parseShareBody({})), /missing postcard/i);
  });
});

describe('postcardSharesListHtml', () => {
  it('shows an empty line when nothing is shared yet', () => {
    assert.match(postcardSharesListHtml([]), /no postcards started/i);
  });

  it('lists newest rides with a date', () => {
    const html = postcardSharesListHtml([
      {
        title: 'Coast road',
        path: '/postcard/coast-road',
        at: '2026-10-15T12:00:00.000Z',
      },
    ]);
    assert.match(html, /Coast road/);
    assert.match(html, /href="\/postcard\/coast-road"/);
    assert.match(html, /15 Oct 2026|Oct/);
  });
});

describe('handlePostcardSharesRequest', () => {
  function memoryKv(start = {}) {
    const store = { ...start };
    return {
      async get(key) {
        return store[key] ?? null;
      },
      async put(key, value) {
        store[key] = value;
      },
      _store: store,
    };
  }

  it('public GET only says ok', async () => {
    const res = await handlePostcardSharesRequest(
      new Request('https://thenewsoulsearchers.de/api/postcard-shares'),
      { STATS: memoryKv() },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.shares, undefined);
  });

  it('discards honeypot posts', async () => {
    const kv = memoryKv();
    const res = await handlePostcardSharesRequest(
      new Request('https://thenewsoulsearchers.de/api/postcard-shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'coast-road',
          title: 'Coast road',
          website: 'http://spam.example',
        }),
      }),
      { STATS: memoryKv() },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.via, 'discard');
    assert.equal(kv._store['postcard-shares:list'], undefined);
  });

  it('saves a share on POST', async () => {
    const kv = memoryKv();
    const res = await handlePostcardSharesRequest(
      new Request('https://thenewsoulsearchers.de/api/postcard-shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'coast-road',
          title: 'Coast road',
          path: '/postcard/coast-road',
        }),
      }),
      {
        STATS: kv,
        // deliverContact will fail without Resend; save should still succeed
      },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.share.slug, 'coast-road');
    assert.equal(data.share.title, 'Coast road');
    const stored = JSON.parse(kv._store['postcard-shares:list']);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].slug, 'coast-road');
  });

  it('private GET returns shares with looks cookie', async () => {
    const secret = 'test-looks-secret';
    const token = await looksToken(secret);
    const cookie = looksSetCookie(token, { secure: false }).split(';')[0];
    const list = [
      {
        id: 'a1',
        slug: 'coast-road',
        title: 'Coast road',
        path: '/postcard/coast-road',
        at: '2026-10-15T12:00:00.000Z',
      },
    ];
    const kv = memoryKv({
      'postcard-shares:list': JSON.stringify(list),
    });
    const res = await handlePostcardSharesRequest(
      new Request('https://thenewsoulsearchers.de/api/postcard-shares', {
        headers: { cookie },
      }),
      {
        STATS: kv,
        GITHUB_OAUTH_CLIENT_SECRET: secret,
      },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.private, true);
    assert.equal(data.count, 1);
    assert.equal(data.shares[0].title, 'Coast road');
  });
});
