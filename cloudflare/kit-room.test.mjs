import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from './cms-oauth-worker.js';
import {
  handleKitRoom,
  isKitPath,
  isKitRoomPath,
  kitPassword,
  kitSetCookie,
  kitToken,
  requestHasKitAccess,
  timingSafeEqual,
} from './kit-room.js';
import { shouldRecordPath } from './page-looks.js';

const PASSWORD = 'test-kit-word';

async function kitEnv(extra = {}) {
  const token = await kitToken(PASSWORD);
  return {
    KIT_PASSWORD: PASSWORD,
    cookie: kitSetCookie(token, { secure: false }).split(';')[0],
    ...extra,
  };
}

function withKitCookie(url, cookie) {
  return new Request(url, { headers: { cookie } });
}

describe('kit paths', () => {
  it('marks the room and its pictures, not kitchen', () => {
    assert.equal(isKitPath('/kit'), true);
    assert.equal(isKitPath('/kit/'), true);
    assert.equal(isKitRoomPath('/kit/jersey-white.png'), true);
    assert.equal(isKitRoomPath('/api/kit'), true);
    assert.equal(isKitRoomPath('/kitchen'), false);
    assert.equal(isKitRoomPath('/shop'), false);
  });
});

describe('kit password', () => {
  it('reads KIT_PASSWORD or SOUL_KIT_PASSWORD', () => {
    assert.equal(kitPassword({ KIT_PASSWORD: 'test-kit-word' }), 'test-kit-word');
    assert.equal(kitPassword({ SOUL_KIT_PASSWORD: 'test-kit-word' }), 'test-kit-word');
    assert.equal(kitPassword({}), '');
  });

  it('compares words without an early length leak', () => {
    assert.equal(timingSafeEqual('thedog', 'thedog'), true);
    assert.equal(timingSafeEqual('thedog', 'wrong'), false);
    assert.equal(timingSafeEqual('', 'thedog'), false);
  });
});

describe('kit gate', () => {
  it('hides the room without a cookie', async () => {
    const env = { KIT_PASSWORD: PASSWORD };
    const closed = await handleKitRoom(new Request('https://thenewsoulsearchers.de/kit'), env);
    assert.equal(closed.status, 401);
    assert.match(await closed.text(), /Riders only/);
    assert.equal(closed.headers.get('x-robots-tag'), 'noindex, nofollow');
  });

  it('hides pictures as missing without a cookie', async () => {
    const env = { KIT_PASSWORD: PASSWORD };
    const hidden = await handleKitRoom(
      new Request('https://thenewsoulsearchers.de/kit/jersey-white.png'),
      env,
    );
    assert.equal(hidden.status, 404);
  });

  it('unlocks with the word and sets a cookie', async () => {
    const env = { KIT_PASSWORD: PASSWORD };
    const res = await handleKitRoom(
      new Request('https://thenewsoulsearchers.de/kit', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'password=test-kit-word',
      }),
      env,
    );
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/kit');
    assert.match(res.headers.get('set-cookie') || '', /ss_kit=/);
  });

  it('rejects a wrong word', async () => {
    const env = { KIT_PASSWORD: PASSWORD };
    const res = await handleKitRoom(
      new Request('https://thenewsoulsearchers.de/kit', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'password=nope',
      }),
      env,
    );
    assert.equal(res.status, 401);
    assert.match(await res.text(), /was not it/);
  });

  it('serves the room once the cookie is set', async () => {
    const auth = await kitEnv({
      ASSETS: {
        fetch: async () =>
          new Response('<html>white jersey</html>', {
            headers: { 'content-type': 'text/html' },
          }),
      },
    });
    const res = await handleKitRoom(
      withKitCookie('https://thenewsoulsearchers.de/kit', auth.cookie),
      auth,
    );
    assert.equal(res.status, 200);
    assert.match(await res.text(), /white jersey/);
    assert.match(res.headers.get('cache-control') || '', /private/);
    assert.equal(await requestHasKitAccess(withKitCookie('https://x/', auth.cookie), auth), true);
  });
});

describe('kit worker', () => {
  it('does not let ASSETS leak the room to the public', async () => {
    const res = await worker.fetch(new Request('https://thenewsoulsearchers.de/kit'), {
      KIT_PASSWORD: PASSWORD,
      ASSETS: {
        fetch: async () => new Response('leaked-kit'),
      },
    });
    assert.equal(res.status, 401);
    assert.doesNotMatch(await res.text(), /leaked-kit/);
  });
});

describe('kit stays out of Looks', () => {
  it('does not count the private room', () => {
    assert.equal(shouldRecordPath('/kit'), false);
    assert.equal(shouldRecordPath('/kit/jersey-white.png'), false);
  });
});
