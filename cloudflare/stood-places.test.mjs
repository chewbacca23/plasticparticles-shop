import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { looksSetCookie, looksToken } from './page-looks.js';
import {
  handleStoodPlacesRequest,
  parseStoodBody,
  validateStood,
} from './stood-places.js';

describe('parseStoodBody and validateStood', () => {
  it('reads place, when, and two lines', () => {
    const fields = parseStoodBody({
      place: '  Mallorca  ',
      when: '2008 – 2015',
      note: '  Salt and climbs.  ',
      detail: '  With the boys.  ',
      website: '',
    });
    assert.equal(fields.place, 'Mallorca');
    assert.equal(fields.when, '2008 – 2015');
    assert.equal(fields.note, 'Salt and climbs.');
    assert.equal(fields.detail, 'With the boys.');
    assert.equal(validateStood(fields), '');
  });

  it('asks for a place name', () => {
    assert.match(validateStood(parseStoodBody({})), /place name/i);
  });
});

describe('handleStoodPlacesRequest', () => {
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

  it('public GET lists places', async () => {
    const list = [
      {
        id: '1',
        place: 'Mallorca',
        when: '2024-06-01',
        note: 'Salt',
        detail: '',
        lat: 39.6,
        lng: 2.9,
        at: '2026-10-16T12:00:00.000Z',
      },
    ];
    const res = await handleStoodPlacesRequest(
      new Request('https://thenewsoulsearchers.de/api/stood-places'),
      { STATS: memoryKv({ 'stood-places:list': JSON.stringify(list) }) },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.places[0].place, 'Mallorca');
  });

  it('refuses POST without looks cookie', async () => {
    const res = await handleStoodPlacesRequest(
      new Request('https://thenewsoulsearchers.de/api/stood-places', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ place: 'Mallorca' }),
      }),
      { STATS: memoryKv(), GITHUB_OAUTH_CLIENT_SECRET: 'secret' },
    );
    assert.equal(res.status, 401);
  });

  it('saves a place with looks cookie', async () => {
    const secret = 'test-stood-secret';
    const token = await looksToken(secret);
    const cookie = looksSetCookie(token, { secure: false }).split(';')[0];
    const kv = memoryKv();
    const res = await handleStoodPlacesRequest(
      new Request('https://thenewsoulsearchers.de/api/stood-places', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          place: 'Testville Nowhereland XYZ',
          when: '2024-01-01',
          note: 'First line',
          detail: 'Second line',
        }),
      }),
      { STATS: kv, GITHUB_OAUTH_CLIENT_SECRET: secret },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.place.place, 'Testville Nowhereland XYZ');
    assert.equal(data.place.note, 'First line');
    assert.equal(data.place.detail, 'Second line');
    const stored = JSON.parse(kv._store['stood-places:list']);
    assert.equal(stored.length, 1);
  });
});
