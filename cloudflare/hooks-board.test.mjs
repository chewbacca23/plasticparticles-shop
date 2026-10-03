import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  handleHooksRequest,
  isHooksApiPath,
  publicHook,
  publicHookList,
  publicCallThread,
  marketFromHooks,
  groupFromHooks,
  normalizePlace,
  spotFromPlace,
  parseHookPin,
  validatePin,
  validateWrite,
  validateCall,
  callPairKey,
  arePeopleNear,
  canCallUpon,
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
    assert.equal(isHooksApiPath('/api/hooks/call'), true);
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

  it('stands people who offered next to the person they were drawn to', () => {
    const group = groupFromHooks([
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
    const a = group.people.find((person) => person.name === 'A');
    const b = group.people.find((person) => person.name === 'B');
    const c = group.people.find((person) => person.name === 'C');
    assert.equal(group.people.length, 3);
    assert.ok(a.neighborKeys.includes(b.key));
    assert.equal(a.cluster, b.cluster);
    assert.notEqual(a.cluster, c.cluster);
    const ab = Math.hypot(a.x - b.x, a.y - b.y);
    const ac = Math.hypot(a.x - c.x, a.y - c.y);
    assert.ok(ab < ac);
    assert.equal(groupFromHooks([{ id: 'h3', name: 'A', note: 'x', offers: [{ id: 'o2', name: 'a', note: 'self' }] }]).people.length, 1);
  });

  it('packs a thousand people inside the room', () => {
    const hooks = Array.from({ length: 1000 }, (_, i) => ({
      id: `h${i}`,
      name: `Rider${i}`,
      place: 'Berlin',
      note: i % 5 === 0 ? 'Old 28mm tires, take them.' : 'Looking for a Sunday ride.',
      offers:
        i > 0 && i % 6 === 0
          ? [{ id: `o${i}`, name: `Rider${i - 1}`, note: 'I have a stem.' }]
          : [],
      at: '2026-09-25T00:00:00.000Z',
    }));
    const group = groupFromHooks(hooks);
    assert.equal(group.people.length, 1000);
    for (const person of group.people) {
      assert.ok(person.x >= 5 && person.x <= 95);
      assert.ok(person.y >= 8 && person.y <= 92);
      assert.equal(person.inBerlin, true);
    }
  });

  it('lays Berlin boroughs on the city map, and grows the universe around Berlin', () => {
    assert.equal(normalizePlace('Kreuzberg'), 'kreuzberg');
    assert.equal(normalizePlace('Neukölln'), 'neukolln');

    const kreuz = spotFromPlace('Kreuzberg', 'a', 0);
    const mitte = spotFromPlace('Mitte', 'b', 0);
    const nice = spotFromPlace('Nice', 'c', 0);
    const berlin = spotFromPlace('Berlin', 'd', 0);

    assert.equal(kreuz.inBerlin, true);
    assert.equal(mitte.inBerlin, true);
    assert.equal(berlin.inBerlin, true);
    assert.equal(nice.inBerlin, false);

    // Kreuzberg sits south of Mitte in world units (wy grows south).
    assert.ok(kreuz.wy > mitte.wy);
    // Nice is outside the Berlin city radius (~1).
    assert.ok(Math.hypot(nice.wx, nice.wy) > 1.15);
    // Roughly south of Berlin (Côte d’Azur).
    assert.ok(nice.wy > 0.4);

    const onlyBerlin = groupFromHooks([
      {
        id: 'h0',
        name: 'B',
        place: 'Berlin',
        note: 'Home.',
        offers: [],
        at: '2026-09-25T08:00:00.000Z',
      },
    ]);
    assert.ok(onlyBerlin.universe.zoom >= 0.85);

    const group = groupFromHooks([
      {
        id: 'h1',
        name: 'K',
        place: 'Kreuzberg',
        note: 'Sunday from Görli.',
        offers: [],
        at: '2026-09-25T09:00:00.000Z',
      },
      {
        id: 'h2',
        name: 'N',
        place: 'Neukölln',
        note: 'Spare stem.',
        offers: [],
        at: '2026-09-25T10:00:00.000Z',
      },
      {
        id: 'h3',
        name: 'Far',
        place: 'Nice',
        note: 'Col d’Èze.',
        offers: [],
        at: '2026-09-25T11:00:00.000Z',
      },
    ]);
    const k = group.people.find((person) => person.name === 'K');
    const n = group.people.find((person) => person.name === 'N');
    const far = group.people.find((person) => person.name === 'Far');
    assert.equal(k.inBerlin, true);
    assert.equal(n.inBerlin, true);
    assert.equal(far.inBerlin, false);
    assert.ok(group.universe.zoom < onlyBerlin.universe.zoom);
    const kn = Math.hypot(k.x - n.x, k.y - n.y);
    const kf = Math.hypot(k.x - far.x, k.y - far.y);
    assert.ok(kn < kf);
    // Nice still south of Berlin riders after the zoom.
    assert.ok(far.y > k.y);
  });

  it('keeps Bar Italia and a near-spelling on the city, not the south edge', () => {
    const cafe = spotFromPlace('akex, bar italia', 'henrik', 0);
    assert.equal(cafe.inBerlin, true);
    const typo = spotFromPlace('akex', 'henrik', 0);
    assert.equal(typo.inBerlin, true);

    const group = groupFromHooks([
      {
        id: 'h-cafe',
        name: 'henrik',
        place: 'akex, bar italia',
        note: 'coffee on me',
        offers: [],
        at: '2026-10-01T12:01:37.511Z',
      },
    ]);
    assert.ok(group.universe.zoom >= 0.85);
    const person = group.people[0];
    assert.ok(person.y < 75);
    assert.ok(person.y > 20);
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

  it('swallows an empty honeypot and still saves a real stall', async () => {
    const kv = memoryKv();
    const bot = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company: 'Acme' }),
      }),
      { STATS: kv },
    );
    assert.equal(bot.status, 200);
    assert.equal((await bot.json()).hooks.length, 0);

    const human = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Alex',
          place: 'Berlin',
          note: 'Coffee after the park.',
          company: 'Safari filled this',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(human.status, 200);
    const body = await human.json();
    assert.equal(body.hooks[0].name, 'Alex');
    assert.equal(body.market[0].kind, 'stall');
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

describe('hooks call upon', () => {
  it('needs a short note and a soul', () => {
    assert.equal(validateCall({ toKey: '', name: 'A', message: 'Hey' }), 'Who are you calling upon?');
    assert.equal(validateCall({ toKey: 'b', name: '', message: 'Hey' }), 'Pick a name. Any name.');
    assert.equal(validateCall({ toKey: 'b', name: 'A', message: '' }), 'Say a little something.');
    assert.equal(validateCall({ toKey: 'b', name: 'A', message: 'Brother — coffee?' }), '');
    assert.equal(callPairKey('B', 'A'), 'a|b');
  });

  it('treats neighbors and same place as near, without GPS', () => {
    const group = groupFromHooks([
      {
        id: 'h1',
        name: 'A',
        place: 'Kreuzberg',
        note: 'Ride.',
        offers: [{ id: 'o1', name: 'B', note: 'I bring coffee.' }],
        at: '2026-09-24T00:00:00.000Z',
      },
      {
        id: 'h2',
        name: 'C',
        place: 'Kreuzberg',
        note: 'Spare stem.',
        offers: [],
        at: '2026-09-24T01:00:00.000Z',
      },
      {
        id: 'h3',
        name: 'Far',
        place: 'Nice',
        note: 'Col.',
        offers: [],
        at: '2026-09-24T02:00:00.000Z',
      },
    ]);
    const a = group.people.find((person) => person.name === 'A');
    const b = group.people.find((person) => person.name === 'B');
    const c = group.people.find((person) => person.name === 'C');
    const far = group.people.find((person) => person.name === 'Far');
    assert.equal(arePeopleNear(a, b), true);
    assert.equal(arePeopleNear(a, c), true);
    assert.equal(canCallUpon(group, 'a', 'c', ''), true);
    assert.equal(canCallUpon(group, 'visitor', 'c', 'Kreuzberg'), true);
    assert.equal(canCallUpon(group, 'visitor', 'far', 'Berlin'), false);
    assert.ok(a);
    assert.ok(far);
  });

  it('stores a call thread without exposing emails', async () => {
    const kv = memoryKv({
      'hooks-v1': JSON.stringify([
        {
          id: 'h1',
          name: 'Hanna',
          place: 'Berlin',
          note: 'Sunday from Görli.',
          email: 'hanna@example.com',
          offers: [],
          at: '2026-09-24T00:00:00.000Z',
        },
        {
          id: 'h2',
          name: 'Alex',
          place: 'Berlin',
          note: 'Spare tires.',
          email: 'alex@example.com',
          offers: [],
          at: '2026-09-24T01:00:00.000Z',
        },
      ]),
    });
    const res = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toKey: 'hanna',
          name: 'Alex',
          place: 'Berlin',
          email: 'alex@example.com',
          message: 'Brother — coffee before the climb?',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.calls.length, 1);
    assert.equal(body.calls[0].id, 'alex|hanna');
    assert.equal(body.calls[0].messages[0].fromName, 'Alex');
    assert.equal(body.calls[0].messages[0].text, 'Brother — coffee before the climb?');
    assert.equal(body.calls[0].messages[0].email, undefined);
    assert.doesNotMatch(JSON.stringify(body), /hanna@example.com/);
    assert.doesNotMatch(JSON.stringify(body), /alex@example.com/);
    assert.ok(publicCallThread(body.calls[0]));
  });

  it('mails when both sides left an address, and allows a reply', async () => {
    const kv = memoryKv({
      'hooks-v1': JSON.stringify({
        hooks: [
          {
            id: 'h1',
            name: 'Hanna',
            place: 'Berlin',
            note: 'Sunday from Görli.',
            email: 'hanna@example.com',
            offers: [],
            at: '2026-09-24T00:00:00.000Z',
          },
          {
            id: 'h2',
            name: 'Alex',
            place: 'Berlin',
            note: 'Spare tires.',
            email: 'alex@example.com',
            offers: [],
            at: '2026-09-24T01:00:00.000Z',
          },
        ],
        calls: [],
      }),
    });
    let sent;
    globalThis.fetch = async (_input, init) => {
      sent = JSON.parse(init.body);
      return new Response('{}', { status: 200 });
    };
    const first = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toKey: 'hanna',
          name: 'Alex',
          place: 'Berlin',
          email: 'alex@example.com',
          message: 'Coffee?',
        }),
      }),
      { STATS: kv, SOUL_RESEND_KEY: 're_testkey_abcdefghijklmnopqrstuvwxyz12' },
    );
    assert.equal(first.status, 200);
    assert.deepEqual(sent.to, ['hanna@example.com']);
    assert.equal(sent.reply_to, 'alex@example.com');
    assert.match(sent.subject, /called upon you/i);

    sent = null;
    const reply = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toKey: 'alex',
          name: 'Hanna',
          email: 'hanna@example.com',
          message: 'Yes brother — 10am.',
        }),
      }),
      { STATS: kv, SOUL_RESEND_KEY: 're_testkey_abcdefghijklmnopqrstuvwxyz12' },
    );
    assert.equal(reply.status, 200);
    const body = await reply.json();
    assert.equal(body.calls[0].messages.length, 2);
    assert.equal(body.calls[0].messages[1].fromName, 'Hanna');
    assert.deepEqual(sent.to, ['alex@example.com']);
  });

  it('swallows a honeypot and refuses a far call', async () => {
    const kv = memoryKv({
      'hooks-v1': JSON.stringify([
        {
          id: 'h1',
          name: 'Hanna',
          place: 'Nice',
          note: 'Col.',
          email: '',
          offers: [],
          at: '2026-09-24T00:00:00.000Z',
        },
        {
          id: 'h2',
          name: 'Alex',
          place: 'Berlin',
          note: 'Home.',
          email: '',
          offers: [],
          at: '2026-09-24T01:00:00.000Z',
        },
      ]),
    });
    const bot = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company: 'Acme' }),
      }),
      { STATS: kv },
    );
    assert.equal(bot.status, 200);
    assert.equal((await bot.json()).calls.length, 0);

    const far = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks/call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toKey: 'hanna',
          name: 'Alex',
          place: 'Berlin',
          message: 'Too far?',
        }),
      }),
      { STATS: kv },
    );
    assert.equal(far.status, 400);
    assert.match((await far.json()).error, /near/i);
  });

  it('keeps legacy array boards readable after a pin', async () => {
    const kv = memoryKv({
      'hooks-v1': JSON.stringify([
        {
          id: 'h1',
          name: 'Old',
          place: 'Berlin',
          note: 'Still here.',
          email: 'old@example.com',
          offers: [],
          at: '2026-09-20T00:00:00.000Z',
        },
      ]),
    });
    const listed = await handleHooksRequest(
      new Request('https://thenewsoulsearchers.de/api/hooks'),
      { STATS: kv },
    );
    const data = await listed.json();
    assert.equal(data.hooks.length, 1);
    assert.equal(data.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(data), /old@example.com/);
  });
});
