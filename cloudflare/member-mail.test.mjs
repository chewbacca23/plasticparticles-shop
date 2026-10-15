import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addMemberToAudience,
  handleMembersRequest,
  parseMemberBody,
  splitMemberName,
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

describe('splitMemberName', () => {
  it('splits first and last', () => {
    assert.deepEqual(splitMemberName('Lars Rider'), {
      firstName: 'Lars',
      lastName: 'Rider',
    });
    assert.deepEqual(splitMemberName('Ana'), { firstName: 'Ana', lastName: '' });
  });
});

describe('addMemberToAudience', () => {
  it('posts the email into the pinned Resend audience', async () => {
    const calls = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: 'contact_1' }), { status: 200 });
    };
    try {
      const result = await addMemberToAudience(
        { RESEND_API_KEY: 're_testkey_abcdefghijklmnopqrstuvwxyz12', RESEND_AUDIENCE_ID: 'aud_123' },
        { email: 'rider@example.com', name: 'Lars Rider' },
      );
      assert.equal(result.ok, true);
      assert.equal(result.audienceId, 'aud_123');
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /\/audiences\/aud_123\/contacts$/);
      const body = JSON.parse(String(calls[0].init.body));
      assert.equal(body.email, 'rider@example.com');
      assert.equal(body.first_name, 'Lars');
      assert.equal(body.last_name, 'Rider');
    } finally {
      globalThis.fetch = original;
    }
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
