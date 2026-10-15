import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  handleMembersRequest,
  parseMemberBody,
  validateMember,
} from './member-mail.js';

describe('parseMemberBody and validateMember', () => {
  it('keeps a clean free-member email', () => {
    const fields = parseMemberBody({
      name: '  Ana  ',
      email: ' Ana@Example.COM ',
      website: '',
    });
    assert.equal(fields.name, 'Ana');
    assert.equal(fields.email, 'ana@example.com');
    assert.equal(validateMember(fields), '');
  });

  it('asks for a real email', () => {
    assert.match(validateMember(parseMemberBody({ email: 'nope' })), /email/i);
  });
});

describe('handleMembersRequest', () => {
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

  it('says membership is free without listing emails', async () => {
    const res = await handleMembersRequest(
      new Request('https://thenewsoulsearchers.de/api/members'),
      { STATS: memoryKv() },
    );
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.free, true);
    assert.equal(data.members, undefined);
  });

  it('saves a new member and treats a second join as already on the list', async () => {
    const kv = memoryKv();
    const env = {
      STATS: kv,
      // No Resend key — notify will fail softly after save.
    };
    const first = await handleMembersRequest(
      new Request('https://thenewsoulsearchers.de/api/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'rider@example.com', name: 'Lars' }),
      }),
      env,
    );
    const saved = await first.json();
    assert.equal(first.status, 200);
    assert.equal(saved.ok, true);
    assert.equal(saved.created, true);

    const second = await handleMembersRequest(
      new Request('https://thenewsoulsearchers.de/api/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'RIDER@example.com' }),
      }),
      env,
    );
    const again = await second.json();
    assert.equal(again.ok, true);
    assert.equal(again.created, false);

    const list = JSON.parse(kv._store['members:list']);
    assert.equal(list.length, 1);
    assert.equal(list[0].email, 'rider@example.com');
  });

  it('discards honeypot posts', async () => {
    const res = await handleMembersRequest(
      new Request('https://thenewsoulsearchers.de/api/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'bot@example.com',
          website: 'http://spam.test',
        }),
      }),
      { STATS: memoryKv() },
    );
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.via, 'discard');
  });
});
