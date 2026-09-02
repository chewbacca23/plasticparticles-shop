import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import worker, { testables } from './cms-oauth-worker.js';

const { handleAuth, handleCallback, oauthCreds, statusPage } = testables;

const creds = { id: 'client-id-test', secret: 'client-secret-test' };

describe('oauthCreds', () => {
  it('reads GITHUB_OAUTH_* names', () => {
    assert.deepEqual(
      oauthCreds({ GITHUB_OAUTH_CLIENT_ID: 'abc', GITHUB_OAUTH_CLIENT_SECRET: 'xyz' }),
      {
        id: 'abc',
        secret: 'xyz',
        idKey: 'GITHUB_OAUTH_CLIENT_ID',
        secretKey: 'GITHUB_OAUTH_CLIENT_SECRET',
      },
    );
  });

  it('returns null when secrets are missing', () => {
    assert.equal(oauthCreds({}), null);
    assert.equal(oauthCreds({ GITHUB_OAUTH_CLIENT_ID: 'abc' }), null);
  });

  it('tolerates hand-typed name variants', () => {
    const creds = oauthCreds({ GITHUB_OAUTH_ID: 'abc', GITHUB_OAUTH_SECRET: 'xyz' });
    assert.deepEqual({ id: creds.id, secret: creds.secret }, { id: 'abc', secret: 'xyz' });

    const bare = oauthCreds({ CLIENT_ID: 'abc', CLIENT_SECRET: 'xyz' });
    assert.deepEqual({ id: bare.id, secret: bare.secret }, { id: 'abc', secret: 'xyz' });
  });

  it('never reuses the secret as the client id', () => {
    assert.equal(oauthCreds({ GITHUB_OAUTH_CLIENT_SECRET: 'xyz' }), null);
  });

  it('ignores blank and non-string bindings', () => {
    assert.equal(
      oauthCreds({ GITHUB_OAUTH_CLIENT_ID: '  ', GITHUB_OAUTH_CLIENT_SECRET: 'xyz' }),
      null,
    );
    assert.equal(oauthCreds({ ASSETS: {}, GITHUB_OAUTH_CLIENT_SECRET: 'xyz' }), null);
  });

  it('prefers the documented names over fuzzy matches', () => {
    const creds = oauthCreds({
      SOME_CLIENT_ID: 'wrong',
      GITHUB_OAUTH_CLIENT_ID: 'right',
      GITHUB_OAUTH_CLIENT_SECRET: 'xyz',
    });
    assert.equal(creds.id, 'right');
    assert.equal(creds.idKey, 'GITHUB_OAUTH_CLIENT_ID');
  });
});

describe('GET /cms-status', () => {
  it('lists binding names without leaking values', async () => {
    const res = await statusPage({
      ASSETS: {},
      GITHUB_OAUTH_CLIENT_ID: 'Ov23abcdefghijklmnop',
      GITHUB_OAUTH_CLIENT_SECRET: 'super-secret-value',
    });
    assert.equal(res.status, 200);
    const raw = await res.text();
    assert.doesNotMatch(raw, /super-secret-value/);
    assert.doesNotMatch(raw, /Ov23abcdefghijklmnop/);

    const body = JSON.parse(raw);
    assert.equal(body.loginWired, true);
    assert.equal(body.clientIdBinding, 'GITHUB_OAUTH_CLIENT_ID');
    assert.equal(body.clientSecretBinding, 'GITHUB_OAUTH_CLIENT_SECRET');
    assert.equal(body.clientSecretLength, 'super-secret-value'.length);
    assert.match(body.clientIdShape, /looks like a GitHub client id/);
    assert.deepEqual(body.textBindingsVisibleToWorker, [
      'GITHUB_OAUTH_CLIENT_ID',
      'GITHUB_OAUTH_CLIENT_SECRET',
    ]);
    assert.deepEqual(body.otherBindingsVisibleToWorker, ['ASSETS']);
  });

  it('shows an empty binding list when secrets landed on another Worker', async () => {
    const body = JSON.parse(await (await statusPage({ ASSETS: {} })).text());
    assert.equal(body.loginWired, false);
    assert.equal(body.clientIdBinding, null);
    assert.deepEqual(body.textBindingsVisibleToWorker, []);
  });

  it('warns when the client secret was pasted into the client id slot', async () => {
    const body = JSON.parse(
      await (
        await statusPage({
          // 40 hex characters: the shape of a GitHub client secret.
          GITHUB_OAUTH_CLIENT_ID: 'a'.repeat(40),
          GITHUB_OAUTH_CLIENT_SECRET: 'b'.repeat(40),
        })
      ).text(),
    );
    assert.match(body.clientIdShape, /client SECRET/);
    assert.match(body.clientIdShape, /rotate/);
  });

  it('accepts a real-shaped GitHub client id but not a 40-hex string', async () => {
    const ok = JSON.parse(
      await (
        await statusPage({
          GITHUB_OAUTH_CLIENT_ID: 'Ov23li8qq16feoZZ0VOo',
          GITHUB_OAUTH_CLIENT_SECRET: 'b'.repeat(40),
        })
      ).text(),
    );
    assert.equal(ok.clientIdShape, 'looks like a GitHub client id');
  });

  it('flags a client id that is not shaped like GitHub', async () => {
    const body = JSON.parse(
      await (
        await statusPage({
          GITHUB_OAUTH_CLIENT_ID: 'pasted-the-wrong-thing',
          GITHUB_OAUTH_CLIENT_SECRET: 'xyz',
        })
      ).text(),
    );
    assert.match(body.clientIdShape, /does NOT look like/);
  });

  it('is reachable through the Worker entrypoint', async () => {
    const res = await worker.fetch(new Request('https://thenewsoulsearchers.de/cms-status'), {
      ASSETS: { fetch: async () => new Response('should not be used') },
    });
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(JSON.parse(await res.text()).loginWired, false);
  });
});

describe('GET /auth', () => {
  it('explains the click-by-click setup when secrets are missing', async () => {
    const res = await worker.fetch(new Request('https://thenewsoulsearchers.de/auth?provider=github'), {});
    assert.equal(res.status, 503);
    const html = await res.text();
    assert.match(html, /GITHUB_OAUTH_CLIENT_SECRET/);
    assert.match(html, /thenewsoulsearchers\.de\/callback/);
    assert.match(html, /thenewsoulsearchersblogc/);
  });

  it('says "no variables at all" when the keys went to another Worker', async () => {
    const res = await worker.fetch(
      new Request('https://thenewsoulsearchers.de/auth?provider=github'),
      { ASSETS: {} },
    );
    const html = await res.text();
    assert.match(html, /no variables or secrets at all/);
    assert.match(html, /Build/);
  });

  it('names the bindings it found when only the names are wrong', async () => {
    const res = await worker.fetch(
      new Request('https://thenewsoulsearchers.de/auth?provider=github'),
      { GITHUB_TOKEN_THING: 'value-should-not-appear' },
    );
    const html = await res.text();
    assert.match(html, /GITHUB_TOKEN_THING/);
    assert.doesNotMatch(html, /value-should-not-appear/);
    assert.doesNotMatch(html, /no variables or secrets at all/);
  });

  it('redirects to GitHub authorize with the live callback', async () => {
    const res = await worker.fetch(
      new Request('https://thenewsoulsearchers.de/auth?provider=github'),
      { GITHUB_OAUTH_CLIENT_ID: creds.id, GITHUB_OAUTH_CLIENT_SECRET: creds.secret },
    );
    assert.equal(res.status, 302);
    const location = new URL(res.headers.get('location'));
    assert.equal(location.hostname, 'github.com');
    assert.equal(location.pathname, '/login/oauth/authorize');
    assert.equal(location.searchParams.get('client_id'), creds.id);
    assert.equal(location.searchParams.get('redirect_uri'), 'https://thenewsoulsearchers.de/callback');
    assert.equal(location.searchParams.get('scope'), 'public_repo,user');
    assert.ok(location.searchParams.get('state'));
  });

  it('rejects a non-github provider', async () => {
    const res = handleAuth(new URL('https://thenewsoulsearchers.de/auth?provider=gitlab'), creds);
    assert.equal(res.status, 400);
  });
});

describe('GET /callback', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns Decap postMessage HTML after a successful token exchange', async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), 'https://github.com/login/oauth/access_token');
      const body = JSON.parse(init.body);
      assert.equal(body.code, 'gh-code');
      assert.equal(body.redirect_uri, 'https://thenewsoulsearchers.de/callback');
      return new Response(JSON.stringify({ access_token: 'gho_test_token' }), {
        headers: { 'content-type': 'application/json' },
      });
    };

    const res = await handleCallback(
      new URL('https://thenewsoulsearchers.de/callback?code=gh-code'),
      creds,
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /authorization:github:success:/);
    assert.match(html, /gho_test_token/);
    assert.match(html, /authorizing:github/);
  });

  it('returns Decap error HTML when GitHub denies login', async () => {
    const res = await handleCallback(
      new URL('https://thenewsoulsearchers.de/callback?error=access_denied'),
      creds,
    );
    const html = await res.text();
    assert.match(html, /authorization:github:error:/);
  });
});

describe('static assets fallback', () => {
  it('forwards non-oauth paths to ASSETS', async () => {
    const res = await worker.fetch(new Request('https://thenewsoulsearchers.de/admin/'), {
      ASSETS: {
        fetch: async () => new Response('admin-ok'),
      },
    });
    assert.equal(await res.text(), 'admin-ok');
  });
});
