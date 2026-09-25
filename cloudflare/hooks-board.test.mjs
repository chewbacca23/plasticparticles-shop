import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  handleHooksRequest,
  isHooksApiPath,
  publicHook,
  publicHookList,
  marketFromHooks,
  parseHookPin,
  validatePin,
  validateWrite,
} from './hooks-board.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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

describe('hooks paths', () => {
  it('marks the api and not the page', () => {
    assert.equal(isHooksApiPath('/api/hooks'), true);
    assert.equal(isHooksApiPath('/api/hooks/write'), true);
    assert.equal(isHooksApiPath('/hooks'), false);
    assert.equal(isHooksApiPath('/api/contact'), false);
  });
});

describe('hooks privacy', () => {
  it('never puts an email on a public card', () => {
    const card = publicHook({
      id: 'h1',
      name: 'Joerg',
      place: 'Berlin',
      note: 'Coffee after the park.',
      email: 'hidden@example.com',
      at: '2026-09-24T00:00:00.000Z',
    });
    assert.equal(card.email, undefined);
    assert.equal(card.name, 'Joerg');
    assert.doesNotMatch(JSON.stringify(card), /hidden@example.com/);
    assert.equal(publicHookList([{ name: '' }]).length, 0);
  });

  it('lays every stall and offer on the same market floor', () => {
    const market = marketFromHooks([
      {
        id: 'h1',
        name: 'A',
        place: 'Nice',
        note: 'Col d’Èze.',
        offers: [{ id: 'o1', name: 'B', note: 'I bring coffee.', at: '2026-09-25T10:00:00.000Z' }],
        at: '2026-09-25T09:00:00.000Z',
      },
      {
        id: 'h2',
        name: 'C',
        place: 'Berlin',
        note: 'Spare sofa.',
        offers: [],
        at: '2026-09-25T11:00:00.000Z',
      },
    ]);
    const names = market.map((card) => card.name);
    assert.ok(names.includes('A'));
    assert.ok(names.includes('B'));
    assert.ok(names.includes('C'));
    assert.equal(market[0].name, 'C');
    const b = market.find((card) => card.name === 'B');
    assert.equal(b.kind, 'offer');
    assert.equal(b.forName, 'A');
  });
});

describe('hooks pin', () => {
  it('asks for the quiet fields', () => {
    const fields = parseHookPin({
      name: 'Alex',
      place: 'Kreuzberg',
      note: 'Panini and a ride.',
      email: 'alex@example.com',
    });
    assert.equal(validatePin(fields), '');
    assert.equal(validatePin({ ...fields, email: '' }), '');
    assert.equal(validatePin({ ...fields, name: '' }), 'Pick a name. Any name.');
  });

  it('saves a pin and lists it without the mail', async () => {
    const kv = memoryKv();
    const res = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Goetz',
          place: 'Daily Bread',
          note: 'Tires and a calm shop.',
          email: 'goetz@example.com',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.hooks[0].name, 'Goetz');
    assert.equal(body.market[0].kind, 'stall');
    assert.equal(body.market[0].name, 'Goetz');
    assert.equal(body.hooks[0].email, undefined);

    const listed = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks'),
      { STATS: kv },
    );
    const data = await listed.json();
    assert.equal(data.hooks.length, 1);
    assert.equal(data.hooks[0].place, 'Daily Bread');
    assert.doesNotMatch(JSON.stringify(data), /goetz@example.com/);
  });

  it('swallows the honeypot', async () => {
    const res = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Bot',
          place: 'Spam',
          note: 'Buy this',
          email: 'bot@example.com',
          company: 'Acme',
        }),
      }),
      { STATS: memoryKv() },
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });
});

describe('hooks write', () => {
  it('needs a note', () => {
    assert.equal(validateWrite({ hookId: 'h1', name: 'A', email: '', message: '' }), 'Write your offer.');
    assert.equal(validateWrite({ hookId: 'h1', name: 'A', email: '', message: 'Coffee?' }), '');
  });

  it('pins a public offer on the board', async () => {
    const kv = memoryKv({
      'hooks-v1': JSON.stringify([
        {
          id: 'h1',
          name: 'Hanna',
          place: 'Nice',
          note: 'Col d’Èze before lunch.',
          email: '',
          offers: [],
          at: '2026-09-24T00:00:00.000Z',
        },
      ]),
    });
    const res = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hookId: 'h1',
          name: 'The Dog',
          message: 'I bring the coffee.',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hooks[0].offers[0].name, 'The Dog');
    assert.equal(body.hooks[0].offers[0].note, 'I bring the coffee.');
    assert.equal(body.hooks[0].offers[0].email, undefined);
    assert.ok(body.market.some((card) => card.kind === 'stall' && card.name === 'Hanna'));
    assert.ok(body.market.some((card) => card.kind === 'offer' && card.name === 'The Dog' && card.forName === 'Hanna'));
  });

  it('mails the hidden address and not the public list', async () => {
    const kv = memoryKv({
      'hooks-v1': JSON.stringify([
        {
          id: 'h1',
          name: 'Hanna',
          place: 'Nice',
          note: 'Col d’Èze before lunch.',
          email: 'hanna@example.com',
          at: '2026-09-24T00:00:00.000Z',
        },
      ]),
    });
    let sent;
    globalThis.fetch = async (input, init) => {
      sent = JSON.parse(init.body);
      return new Response('{}', { status: 200 });
    };
    const res = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hookId: 'h1',
          name: 'Henrik',
          email: 'henrik@thenewsoulsearchers.de',
          message: 'Coffee on Sunday?',
        }),
      }),
      { STATS: kv, SOUL_RESEND_KEY: 're_testkey_abcdefghijklmnopqrstuvwxyz12' },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(sent.to, ['hanna@example.com']);
    assert.equal(sent.reply_to, 'henrik@thenewsoulsearchers.de');
    assert.match(sent.text, /Coffee on Sunday/);
  });
});
