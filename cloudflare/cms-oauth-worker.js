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

const ID_PATTERNS = [
  /^GITHUB_OAUTH_CLIENT_ID$/i,
  /^GITHUB_CLIENT_ID$/i,
  /^(GITHUB|OAUTH).*(CLIENT_?)?ID$/i,
  /CLIENT_?ID$/i,
];

const SECRET_PATTERNS = [
  /^GITHUB_OAUTH_CLIENT_SECRET$/i,
  /^GITHUB_CLIENT_SECRET$/i,
  /^(GITHUB|OAUTH).*SECRET$/i,
  /CLIENT_?SECRET$/i,
];

/**
 * Names drift when secrets are typed by hand, so match the documented names
 * first and fall back to anything unambiguous.
 * @param {Record<string, unknown>} env
 * @param {RegExp[]} patterns
 */
function pickByName(env, patterns) {
  const entries = Object.entries(env).filter(
    ([, value]) => typeof value === 'string' && value.trim() !== '',
  );
  for (const pattern of patterns) {
    const hit = entries.find(([key]) => pattern.test(key));
    if (hit) return { key: hit[0], value: String(hit[1]).trim() };
  }
  return null;
}

/**
 * @param {Record<string, unknown>} env
 * @returns {{ id: string, secret: string, idKey: string, secretKey: string } | null}
 */
function oauthCreds(env) {
  const secret = pickByName(env, SECRET_PATTERNS);
  const id = pickByName(
    // Never let the secret double as the client id.
    Object.fromEntries(Object.entries(env).filter(([key]) => key !== secret?.key)),
    ID_PATTERNS,
  );
  if (!id || !secret) return null;
  return { id: id.value, secret: secret.value, idKey: id.key, secretKey: secret.key };
}

/**
 * Report which binding names this Worker can actually see. Names only — no
 * values — so it is safe to open in a browser and paste into a chat.
 * @param {Record<string, unknown>} env
 */
function statusPage(env) {
  const creds = oauthCreds(env);
  const stringKeys = Object.keys(env)
    .filter((key) => typeof env[key] === 'string')
    .sort();
  const otherKeys = Object.keys(env)
    .filter((key) => typeof env[key] !== 'string')
    .sort();

  // GitHub OAuth app client ids are public and prefixed, so this is a safe
  // way to confirm the right value landed in the right binding.
  const idShape = creds ? (/^(Ov23|Iv1\.|[0-9a-f]{20})/.test(creds.id) ? 'looks like a GitHub client id' : 'does NOT look like a GitHub client id') : 'n/a';

  const body = {
    loginWired: Boolean(creds),
    clientIdBinding: creds ? creds.idKey : null,
    clientIdShape: idShape,
    clientSecretBinding: creds ? creds.secretKey : null,
    clientSecretLength: creds ? creds.secret.length : 0,
    textBindingsVisibleToWorker: stringKeys,
    otherBindingsVisibleToWorker: otherKeys,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
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

/**
 * Say which of the two likely mistakes this actually is, rather than
 * repeating generic setup steps the reader has already followed.
 * @param {Record<string, unknown>} env
 */
function diagnosisHtml(env) {
  const names = Object.keys(env).filter((key) => typeof env[key] === 'string' && env[key] !== '');

  if (names.length === 0) {
    return `<p class="diag"><strong>What this Worker sees:</strong> no variables or secrets at all.</p>
  <p class="diag">So the two keys are somewhere else. Either they went on a different Worker
  (the dashboard also lists <code>thenewsoulsearchersblog</code> without the <code>c</code>,
  plus <code>bloga</code>, <code>blogb</code>, <code>bl</code>, <code>blo</code> — only
  <code>thenewsoulsearchersblogc</code> is on the domain), or they were added under
  <strong>Build</strong> variables, which never reach the running site.</p>`;
  }

  return `<p class="diag"><strong>What this Worker sees:</strong>
  <code>${names.map((n) => n.replace(/[<>&]/g, '')).join('</code>, <code>')}</code></p>
  <p class="diag">The right Worker has the values, but the names did not match a client id
  <em>and</em> a client secret. Rename them to <code>GITHUB_OAUTH_CLIENT_ID</code> and
  <code>GITHUB_OAUTH_CLIENT_SECRET</code>.</p>`;
}

/** @param {Record<string, unknown>} env */
function missingSecretsPage(env = {}) {
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
    .diag { background: rgba(30, 40, 48, 0.92); border: 1px solid rgba(240, 194, 122, 0.35);
      border-radius: 8px; padding: 0.7rem 0.9rem; margin: 0.6rem 0; }
  </style>
</head>
<body>
  <h1>One GitHub app, then two Cloudflare secrets</h1>
  ${diagnosisHtml(env)}
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
    <li><strong>Workers</strong> → <strong>thenewsoulsearchersblogc</strong> (the live journal Worker — the one with a <code>c</code>, not the shop)</li>
    <li><strong>Settings</strong> → <strong>Variables and Secrets</strong> — the runtime one. Values added under <strong>Build</strong> do not reach the live site.</li>
    <li>Name <code>GITHUB_OAUTH_CLIENT_ID</code>, type Text, paste the Client ID → Save</li>
    <li><strong>Add</strong> again: name <code>GITHUB_OAUTH_CLIENT_SECRET</code>, type <strong>Secret</strong>, paste the secret → Save</li>
  </ol>
  <p><strong>Stuck?</strong> Open <a href="/cms-status">/cms-status</a>. It lists the binding names this Worker can actually see — never the values — so you can tell “wrong Worker” from “wrong name” instead of guessing.</p>
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

    if (url.pathname === '/cms-status') return statusPage(env);

    if (url.pathname === '/auth' || url.pathname === '/callback') {
      const creds = oauthCreds(env);
      if (!creds) return missingSecretsPage(env);
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
  statusPage,
  pickByName,
};
