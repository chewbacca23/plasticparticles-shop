/**
 * GitHub OAuth proxy for Decap CMS on the Soul Searchers Worker.
 * Handles /auth and /callback, then serves the static Astro site.
 *
 * Secrets (Cloudflare dashboard → thenewsoulsearchersblogc → Settings →
 * Variables and Secrets):
 *   GITHUB_OAUTH_CLIENT_ID
 *   GITHUB_OAUTH_CLIENT_SECRET
 */

const PROVIDER = 'github';
const SCOPE = 'public_repo,user';

/**
 * @param {unknown} env
 * @returns {{ id: string, secret: string } | null}
 */
function oauthCreds(env) {
  const id = String(env.GITHUB_OAUTH_CLIENT_ID || env.GITHUB_CLIENT_ID || '').trim();
  const secret = String(env.GITHUB_OAUTH_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET || '').trim();
  if (!id || !secret) return null;
  return { id, secret };
}

/** @param {string} origin */
function callbackUrl(origin) {
  return `${origin}/callback`;
}

/**
 * @param {string} origin
 * @returns {boolean}
 */
function originAllowed(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return false;
    }
    if (hostname === 'thenewsoulsearchers.de' || hostname === 'www.thenewsoulsearchers.de') {
      return true;
    }
    if (hostname.endsWith('.workers.dev')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
}

function missingSecretsPage() {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CMS login not wired yet</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #0c1218; color: #eef3f7;
      max-width: 40rem; margin: 2rem auto; padding: 0 1.2rem; line-height: 1.45; }
    h1 { color: #f0c27a; font-size: 1.25rem; }
    ol { padding-left: 1.2rem; }
    code { color: #f0c27a; }
    a { color: #8ec8ff; }
  </style>
</head>
<body>
  <h1>One GitHub app, then two Cloudflare secrets</h1>
  <p>The editor is ready. GitHub login still needs credentials (not in git — you add them in the dashboards).</p>
  <p><strong>A. GitHub OAuth app</strong></p>
  <ol>
    <li>Open <a href="https://github.com">github.com</a> as <code>chewbacca23</code></li>
    <li>Photo (top right) → <strong>Settings</strong></li>
    <li>Bottom of the left list → <strong>Developer settings</strong></li>
    <li><strong>OAuth Apps</strong> → <strong>New OAuth App</strong></li>
    <li>Application name: <code>Soul Searchers CMS</code></li>
    <li>Homepage URL: <code>https://thenewsoulsearchers.de</code></li>
    <li>Authorization callback URL: <code>https://thenewsoulsearchers.de/callback</code></li>
    <li><strong>Register application</strong> → copy the Client ID</li>
    <li><strong>Generate a new client secret</strong> → copy it (once)</li>
  </ol>
  <p><strong>B. Cloudflare secrets</strong></p>
  <ol>
    <li>Open <a href="https://dash.cloudflare.com">dash.cloudflare.com</a></li>
    <li><strong>Workers &amp; Pages</strong> → <strong>thenewsoulsearchersblogc</strong> (the live journal Worker — the one with a <code>c</code>, not the shop)</li>
    <li><strong>Settings</strong> → <strong>Variables and Secrets</strong> → <strong>Add</strong></li>
    <li>Name <code>GITHUB_OAUTH_CLIENT_ID</code>, type Text, paste the Client ID → Save</li>
    <li><strong>Add</strong> again: name <code>GITHUB_OAUTH_CLIENT_SECRET</code>, type <strong>Secret</strong>, paste the secret → Save</li>
  </ol>
  <p>Then close this window, open <a href="https://thenewsoulsearchers.de/admin/">thenewsoulsearchers.de/admin/</a> (not www), and click <strong>Login with GitHub</strong> again.</p>
</body>
</html>`,
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

/** @param {URL} url @param {{ id: string, secret: string }} creds */
function handleAuth(url, creds) {
  const provider = url.searchParams.get('provider');
  if (provider && provider !== PROVIDER) {
    return new Response('Invalid provider', { status: 400 });
  }

  const origin = url.origin;
  const state = crypto.randomUUID();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', creds.id);
  authorize.searchParams.set('redirect_uri', callbackUrl(origin));
  authorize.searchParams.set('scope', SCOPE);
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      'cache-control': 'no-store',
      'set-cookie': `cms_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

/**
 * @param {string} status
 * @param {Record<string, unknown>} content
 */
function callbackHtml(status, content) {
  const payload = JSON.stringify(content);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Authorizing…</title></head>
<body>
<p>Logging you into the Soul Searchers editor…</p>
<script>
(function () {
  function allowed(origin) {
    try {
      var host = new URL(origin).hostname;
      return (
        host === "thenewsoulsearchers.de" ||
        host === "www.thenewsoulsearchers.de" ||
        host.endsWith(".workers.dev") ||
        host === "localhost" ||
        host === "127.0.0.1"
      );
    } catch (e) {
      return false;
    }
  }
  function receiveMessage(e) {
    if (!allowed(e.origin)) return;
    window.opener.postMessage(
      "authorization:github:${status}:" + ${JSON.stringify(payload)},
      e.origin
    );
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body>
</html>`;
}

/**
 * @param {URL} url
 * @param {{ id: string, secret: string }} creds
 */
async function handleCallback(url, creds) {
  const ghError = url.searchParams.get('error');
  if (ghError) {
    const html = callbackHtml('error', {
      error: ghError,
      errorDescription: url.searchParams.get('error_description') || 'GitHub login was cancelled.',
    });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: creds.id,
      client_secret: creds.secret,
      code,
      redirect_uri: callbackUrl(url.origin),
    }),
  });

  const data = await tokenRes.json().catch(() => ({}));
  if (!data.access_token) {
    const html = callbackHtml('error', {
      error: data.error || 'token_exchange_failed',
      errorDescription: data.error_description || 'GitHub did not return an access token.',
    });
    return new Response(html, {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const html = callbackHtml('success', { token: data.access_token, provider: PROVIDER });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS?: { fetch: (request: Request) => Promise<Response> }, GITHUB_OAUTH_CLIENT_ID?: string, GITHUB_OAUTH_CLIENT_SECRET?: string, GITHUB_CLIENT_ID?: string, GITHUB_CLIENT_SECRET?: string }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth' || url.pathname === '/callback') {
      const creds = oauthCreds(env);
      if (!creds) return missingSecretsPage();
      if (url.pathname === '/auth') return handleAuth(url, creds);
      return handleCallback(url, creds);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};

export const testables = {
  oauthCreds,
  originAllowed,
  callbackUrl,
  handleAuth,
  handleCallback,
  missingSecretsPage,
};
