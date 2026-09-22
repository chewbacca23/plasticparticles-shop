/**
 * Private first-kit room for riders.
 * /kit and /kit/* stay off the public site until KIT_PASSWORD unlocks a cookie.
 */

import { cookieValue, hmacHex } from './page-looks.js';

export const KIT_COOKIE = 'ss_kit';
const KIT_MESSAGE = 'soul-searchers-kit';

export function kitPassword(env) {
  const value = env?.KIT_PASSWORD || env?.SOUL_KIT_PASSWORD;
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function isKitPath(pathname) {
  return pathname === '/kit' || pathname === '/kit/' || pathname === '/kit/index.html';
}

export function isKitRoomPath(pathname) {
  return isKitPath(pathname) || pathname.startsWith('/kit/') || pathname === '/api/kit';
}

export async function kitToken(secret) {
  if (!secret) return '';
  return hmacHex(secret, KIT_MESSAGE);
}

export function kitSetCookie(token, { secure = true } = {}) {
  return `${KIT_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${
    secure ? '; Secure' : ''
  }`;
}

export function timingSafeEqual(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function requestHasKitAccess(request, env) {
  const secret = kitPassword(env);
  const token = await kitToken(secret);
  if (!token) return false;
  return cookieValue(request.headers.get('cookie'), KIT_COOKIE) === token;
}

export function kitGatePage({ wrong = false, wired = true } = {}) {
  const note = !wired
    ? 'This room is not open yet.'
    : wrong
      ? 'That word was not it. Try again.'
      : 'Riders only. Henrik has the word.';
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Riders · The Soul Searchers</title>
  <link rel="icon" type="image/png" href="/logo.png" />
  <style>
    :root { --ink:#0c1218; --fog:#d7e0e8; --paper:#eef3f7; --amber:#d4a35a; --amber-hot:#f0c27a; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; color:var(--fog); background:var(--ink);
      font-family: Figtree, "Avenir Next", system-ui, sans-serif; }
    main { max-width:22rem; margin:0 auto; padding:5rem 1.2rem 4rem; }
    .eyebrow { margin:0 0 .85rem; color:var(--amber); font-size:.78rem; font-weight:700;
      letter-spacing:.18em; text-transform:uppercase; }
    h1 { margin:0 0 .65rem; color:var(--paper); font-family: Fraunces, Georgia, serif;
      font-size:2rem; font-weight:500; letter-spacing:-.02em; }
    p { margin:0 0 1.4rem; line-height:1.6; color:rgba(215,224,232,.72); }
    form { display:grid; gap:.85rem; }
    label { display:grid; gap:.4rem; }
    label span { font-size:.86rem; font-weight:600; letter-spacing:.04em;
      text-transform:uppercase; color:rgba(215,224,232,.72); }
    input { width:100%; padding:.85rem 1rem; border:1px solid rgba(215,224,232,.18);
      border-radius:.85rem; background:rgba(26,36,48,.7); color:var(--paper); font:inherit; }
    input:focus { outline:2px solid rgba(212,163,90,.55); outline-offset:2px; border-color:var(--amber); }
    button { display:inline-flex; align-items:center; justify-content:center;
      padding:.55rem 1.1rem; border:0; border-radius:999px; cursor:pointer;
      background:linear-gradient(135deg,var(--amber-hot),var(--amber)); color:var(--ink);
      font:inherit; font-size:.8rem; font-weight:700; }
    a { color:var(--amber-hot); }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Riders</p>
    <h1>A quiet room</h1>
    <p>${note}</p>
    <form method="post" action="/kit">
      <label>
        <span>Word</span>
        <input type="password" name="password" autocomplete="current-password" required />
      </label>
      <button type="submit">Enter</button>
    </form>
    <p><a href="/">Home</a></p>
  </main>
</body>
</html>`,
    {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    },
  );
}

export function kitHiddenAsset() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

async function readPostedPassword(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    return String(body?.password || '');
  }
  const text = await request.text();
  return new URLSearchParams(text).get('password') || '';
}

export async function handleKitUnlock(request, env) {
  const secret = kitPassword(env);
  const given = await readPostedPassword(request);
  const url = new URL(request.url);
  if (!secret || !timingSafeEqual(given, secret)) {
    if (url.pathname === '/api/kit') {
      return new Response(JSON.stringify({ error: 'private' }), {
        status: 401,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }
    return kitGatePage({ wrong: Boolean(secret && given), wired: Boolean(secret) });
  }

  const token = await kitToken(secret);
  const headers = {
    location: '/kit',
    'cache-control': 'no-store',
    'set-cookie': kitSetCookie(token, { secure: url.protocol === 'https:' }),
  };
  return new Response(null, { status: 303, headers });
}

function privateAsset(asset) {
  const headers = new Headers(asset.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(asset.body, { status: asset.status, headers });
}

export async function handleKitRoom(request, env) {
  const url = new URL(request.url);
  if (!isKitRoomPath(url.pathname)) return null;

  if (request.method === 'POST') {
    return handleKitUnlock(request, env);
  }

  if (!(await requestHasKitAccess(request, env))) {
    if (isKitPath(url.pathname)) return kitGatePage({ wired: Boolean(kitPassword(env)) });
    return kitHiddenAsset();
  }

  if (!env?.ASSETS?.fetch) return null;
  const asset = await env.ASSETS.fetch(request);
  return privateAsset(asset);
}
