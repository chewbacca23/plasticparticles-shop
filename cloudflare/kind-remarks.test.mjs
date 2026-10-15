import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  handleRemarksRequest,
  injectKindRemarks,
  isKindMessage,
  normalizeRemarkPath,
  parseRemarkBody,
  validateRemark,
} from './kind-remarks.js';

describe('normalizeRemarkPath', () => {
  it('keeps a clean public path', () => {
    assert.equal(normalizeRemarkPath('/stories/nice'), '/stories/nice');
    assert.equal(normalizeRemarkPath('/stories/nice/'), '/stories/nice');
    assert.equal(normalizeRemarkPath(''), '');
  });

  it('drops admin, auth, looks, and api paths', () => {
    assert.equal(normalizeRemarkPath('/admin'), '');
    assert.equal(normalizeRemarkPath('/admin/index.html'), '');
    assert.equal(normalizeRemarkPath('/auth'), '');
    assert.equal(normalizeRemarkPath('/callback'), '');
    assert.equal(normalizeRemarkPath('/looks'), '');
    assert.equal(normalizeRemarkPath('/api/remarks'), '');
  });

  it('reads a path out of a full URL', () => {
    assert.equal(
      normalizeRemarkPath('https://thenewsoulsearchers.de/week'),
      '/week',
    );
  });
});

describe('isKindMessage', () => {
  it('accepts a warm line', () => {
    assert.equal(isKindMessage('Beautiful climb — thank you for sharing.'), true);
    assert.equal(isKindMessage('Schöner Tag auf dem Rad.'), true);
  });

  it('rejects rude or hostile words', () => {
    assert.equal(isKindMessage('This is stupid and I hate it.'), false);
    assert.equal(isKindMessage('Was für ein Arschloch.'), false);
  });

  it('rejects links and markup', () => {
    assert.equal(isKindMessage('Visit https://spam.example for more'), false);
    assert.equal(isKindMessage('Click www.bad.example now please'), false);
    assert.equal(isKindMessage('<script>alert(1)</script> hello'), false);
  });
});

describe('parseRemarkBody and validateRemark', () => {
  it('trims fields and keeps a clean note', () => {
    const fields = parseRemarkBody({
      path: '/about/',
      name: '  Ana  ',
      message: '  Loved the coast road.  ',
      website: '',
    });
    assert.equal(fields.path, '/about');
    assert.equal(fields.name, 'Ana');
    assert.equal(fields.message, 'Loved the coast road.');
    assert.equal(validateRemark(fields), '');
  });

  it('refuses a honeypot-free rude note', () => {
    const fields = parseRemarkBody({
      path: '/about',
      name: '',
      message: 'You suck at this.',
    });
    assert.match(validateRemark(fields), /kind words/i);
  });

  it('asks for a longer message', () => {
    const fields = parseRemarkBody({ path: '/', message: 'Hi' });
    assert.match(validateRemark(fields), /at least/i);
  });
});

describe('injectKindRemarks', () => {
  it('places the strip after main once', () => {
    const once = injectKindRemarks('<main>ride</main><script></script></body>');
    assert.match(once, /class="kind-remarks"/);
    assert.match(once, /<\/main>\s*<style>/);
    const twice = injectKindRemarks(once);
    assert.equal(twice, once);
  });
});

describe('handleRemarksRequest', () => {
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

  it('returns an empty list for a fresh path', async () => {
    const res = await handleRemarksRequest(
      new Request('https://thenewsoulsearchers.de/api/remarks?path=/about'),
      { STATS: memoryKv() },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.deepEqual(data.remarks, []);
  });

  it('saves a kind word and lists it back', async () => {
    const kv = memoryKv();
    const post = await handleRemarksRequest(
      new Request('https://thenewsoulsearchers.de/api/remarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: '/stories/demo',
          name: 'Lars',
          message: 'Great ride notes — keep going.',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(post.status, 200);
    const saved = await post.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.remark.message, 'Great ride notes — keep going.');

    const get = await handleRemarksRequest(
      new Request('https://thenewsoulsearchers.de/api/remarks?path=/stories/demo'),
      { STATS: kv },
    );
    const listed = await get.json();
    assert.equal(listed.remarks.length, 1);
    assert.equal(listed.remarks[0].name, 'Lars');
  });

  it('pretends success for a filled honeypot', async () => {
    const res = await handleRemarksRequest(
      new Request('https://thenewsoulsearchers.de/api/remarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: '/',
          message: 'Nice site, brother.',
          website: 'http://bot.test',
        }),
      }),
      { STATS: memoryKv() },
    );
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.via, 'discard');
  });

  it('rejects a rude post before saving', async () => {
    const kv = memoryKv();
    const res = await handleRemarksRequest(
      new Request('https://thenewsoulsearchers.de/api/remarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: '/',
          message: 'This blog is stupid trash.',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /kind words/i);
    assert.equal(Object.keys(kv._store).filter((k) => k.startsWith('remarks:path:')).length, 0);
  });
});
