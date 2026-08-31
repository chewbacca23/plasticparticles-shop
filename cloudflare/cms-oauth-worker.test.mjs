import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import worker, { testables } from './cms-oauth-worker.js';

const { handleAuth, handleCallback, oauthCreds } = testables;

const creds = { id: 'client-id-test', secret: 'client-secret-test' };

describe('oauthCreds', () => {
  it('reads GITHUB_OAUTH_* names', () => {
    assert.deepEqual(
      oauthCreds({ GITHUB_OAUTH_CLIENT_ID: 'abc', GITHUB_OAUTH_CLIENT_SECRET: 'xyz' }),
      { id: 'abc', secret: 'xyz' },
    );
  });

  it('returns null when secrets are missing', () => {
    assert.equal(oauthCreds({}), null);
    assert.equal(oauthCreds({ GITHUB_OAUTH_CLIENT_ID: 'abc' }), null);
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
