/**
 * Anonymous page opens for Henrik's Looks dashboard.
 * No cookies, no names. One count per open of a public page.
 */

const STORE_KEY = 'looks-v1';
const SKIP = new Set([
  '/admin',
  '/auth',
  '/callback',
  '/cms-status',
  '/api/looks',
  '/looks',
  '/looks/',
  '/rss.xml',
  '/sitemap-index.xml',
  '/sitemap-0.xml',
  '/robots.txt',
  '/favicon.ico',
  '/logo.svg',
  '/og.svg',
]);

export function berlinDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function emptyLooks() {
  return { total: 0, days: {}, paths: {} };
}

export function sanitizePath(raw) {
  if (typeof raw !== 'string') return '/';
  let path = raw.split('?')[0].split('#')[0].trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (path.includes('..')) return '';
  if (path.length > 120) return '';
  return path || '/';
}

export function shouldRecordPath(path) {
  if (!path) return false;
  if (SKIP.has(path)) return false;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/api/')) return false;
  if (/\.[a-z0-9]{1,8}$/i.test(path)) return false;
  return true;
}

export function applyLook(data, path, day) {
  const next = {
    total: Number(data.total) || 0,
    days: { ...(data.days || {}) },
    paths: { ...(data.paths || {}) },
  };
  next.total += 1;
  next.days[day] = (Number(next.days[day]) || 0) + 1;
  next.paths[path] = (Number(next.paths[path]) || 0) + 1;
  return next;
}

export function summarizeLooks(data, now = new Date()) {
  const days = data.days || {};
  const today = berlinDay(now);
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const at = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    weekDays.push(berlinDay(at));
  }
  const week = weekDays.reduce((sum, day) => sum + (Number(days[day]) || 0), 0);
  const pages = Object.entries(data.paths || {})
    .map(([path, looks]) => ({ path, looks: Number(looks) || 0 }))
    .sort((a, b) => b.looks - a.looks || a.path.localeCompare(b.path))
    .slice(0, 12);
  return {
    today: Number(days[today]) || 0,
    week,
    total: Number(data.total) || 0,
    pages,
  };
}

export function memoryLooksStore(seed = null) {
  let value = seed;
  return {
    async load() {
      return value ? structuredClone(value) : emptyLooks();
    },
    async save(data) {
      value = structuredClone(data);
    },
  };
}

export function kvLooksStore(kv) {
  return {
    async load() {
      const raw = await kv.get(STORE_KEY);
      if (!raw) return emptyLooks();
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return emptyLooks();
        return {
          total: Number(parsed.total) || 0,
          days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
          paths: parsed.paths && typeof parsed.paths === 'object' ? parsed.paths : {},
        };
      } catch {
        return emptyLooks();
      }
    },
    async save(data) {
      await kv.put(STORE_KEY, JSON.stringify(data));
    },
  };
}

export function cacheLooksStore(cache = globalThis.caches?.default, requestUrl = 'https://thenewsoulsearchers.de/__internal/looks-v1') {
  return {
    async load() {
      if (!cache) return emptyLooks();
      const hit = await cache.match(requestUrl);
      if (!hit) return emptyLooks();
      try {
        return await hit.json();
      } catch {
        return emptyLooks();
      }
    },
    async save(data) {
      if (!cache) return;
      await cache.put(
        requestUrl,
        new Response(JSON.stringify(data), {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'max-age=31536000',
          },
        }),
      );
    },
  };
}

export function looksStoreFor(env) {
  if (env?.STATS && typeof env.STATS.get === 'function' && typeof env.STATS.put === 'function') {
    return kvLooksStore(env.STATS);
  }
  if (typeof caches !== 'undefined' && caches.default) {
    return cacheLooksStore();
  }
  if (!env.__memoryLooks) env.__memoryLooks = memoryLooksStore();
  return env.__memoryLooks;
}

export async function recordLook(store, rawPath, now = new Date()) {
  const path = sanitizePath(rawPath);
  if (!shouldRecordPath(path)) return { recorded: false, path };
  const data = applyLook(await store.load(), path, berlinDay(now));
  await store.save(data);
  return { recorded: true, path, total: data.total };
}

export async function readLooks(store, now = new Date()) {
  return summarizeLooks(await store.load(), now);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const LOOKS_COOKIE = 'ss_looks';
const LOOKS_MESSAGE = 'soul-searchers-looks';

function looksSecret(env) {
  const value =
    env?.GITHUB_OAUTH_CLIENT_SECRET ||
    env?.GITHUB_CLIENT_SECRET ||
    env?.CLIENT_SECRET;
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bits = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function looksToken(secret) {
  if (!secret) return '';
  return hmacHex(secret, LOOKS_MESSAGE);
}

export function cookieValue(header, name) {
  if (!header) return '';
  for (const part of String(header).split(';')) {
    const trimmed = part.trim();
    const cut = trimmed.indexOf('=');
    if (cut === -1) continue;
    if (trimmed.slice(0, cut) === name) return trimmed.slice(cut + 1);
  }
  return '';
}

export function looksSetCookie(token, { secure = true } = {}) {
  return `${LOOKS_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${
    secure ? '; Secure' : ''
  }`;
}

export async function requestHasLooksAccess(request, env) {
  const secret = looksSecret(env);
  const token = await looksToken(secret);
  if (!token) return false;
  return cookieValue(request.headers.get('cookie'), LOOKS_COOKIE) === token;
}

export function looksGatePage() {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Looks · The Soul Searchers</title>
  <style>
    body { font-family: Figtree, system-ui, sans-serif; background: #0c1218; color: #d7e0e8;
      max-width: 28rem; margin: 4rem auto; padding: 0 1.2rem; line-height: 1.5; }
    h1 { color: #f0c27a; font-size: 1.4rem; }
    a { color: #f0c27a; }
    ol { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>Looks is only for you</h1>
  <p>This page shows how many times people opened the site. Visitors do not see it.</p>
  <ol>
    <li>Open <a href="/admin/">the editor</a></li>
    <li>Click <strong>Login with GitHub</strong></li>
    <li>Come back to <a href="/looks">/looks</a></li>
  </ol>
</body>
</html>`,
    {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

export function isLooksPath(pathname) {
  return pathname === '/looks' || pathname === '/looks/';
}

export function shouldCountDocument(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (dest && dest !== 'document' && dest !== 'empty') return false;
  const path = new URL(request.url).pathname;
  if (/\.[a-z0-9]{1,8}$/i.test(path)) return false;
  return true;
}

export async function recordDocumentLook(request, env) {
  if (!shouldCountDocument(request)) return { recorded: false };
  try {
    return await recordLook(looksStoreFor(env), new URL(request.url).pathname);
  } catch {
    return { recorded: false };
  }
}

export function looksDashboardPage(summary) {
  const today = Number(summary?.today) || 0;
  const week = Number(summary?.week) || 0;
  const total = Number(summary?.total) || 0;
  const pages = Array.isArray(summary?.pages) ? summary.pages : [];
  const rows = pages.length
    ? pages
        .map((row) => {
          const label = row.path === '/' ? 'Home' : escapeHtml(row.path);
          const href = escapeHtml(row.path);
          return `<li><a href="${href}">${label}</a><span>${Number(row.looks) || 0}</span></li>`;
        })
        .join('')
    : '<li class="empty">Open Home, Now, or a ride in another tab, then refresh this page.</li>';

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Looks · The Soul Searchers</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <style>
    :root { --ink:#0c1218; --fog:#d7e0e8; --paper:#eef3f7; --amber:#d4a35a; --amber-hot:#f0c27a; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; color:var(--fog); background:var(--ink);
      font-family: Figtree, "Avenir Next", system-ui, sans-serif; }
    a { color: inherit; }
    a:hover { color: var(--amber-hot); }
    .site-shell { width: min(40rem, calc(100% - 2rem)); margin: 0 auto; padding: 2.5rem 0 4rem; }
    .eyebrow { margin:0 0 .4rem; letter-spacing:.16em; text-transform:uppercase; font-size:.78rem; color:var(--amber); font-weight:700; }
    h1 { margin:0 0 .75rem; font-size: clamp(2rem, 4vw, 2.8rem); color:var(--paper); }
    .lead { margin:0 0 1.75rem; color:rgba(215,224,232,.75); }
    .cards { display:grid; gap:.85rem; margin:0 0 2.25rem; }
    @media (min-width:640px) { .cards { grid-template-columns:repeat(3,1fr); } }
    .card { padding:1.1rem 1.15rem; border:1px solid rgba(215,224,232,.1); border-radius:1rem; background:rgba(18,26,34,.55); }
    .card-label { margin:0; color:var(--amber); font-size:.78rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
    .card-num { margin:.45rem 0 0; color:var(--paper); font-size:2.4rem; line-height:1; }
    h2 { margin:0 0 .85rem; font-size:1.35rem; }
    ol { margin:0; padding:0; list-style:none; border:1px solid rgba(215,224,232,.1); border-radius:1rem; overflow:hidden; }
    li { display:flex; justify-content:space-between; gap:1rem; padding:.85rem 1.1rem; border-top:1px solid rgba(215,224,232,.08); }
    li:first-child { border-top:0; }
    li a { color:var(--paper); text-decoration:none; }
    li span { color:var(--amber-hot); font-weight:600; }
    .empty { color:rgba(215,224,232,.68); }
    .back { margin:1.5rem 0 0; }
    .back a { color:var(--amber-hot); font-weight:600; text-decoration:none; }
  </style>
</head>
<body>
  <main class="site-shell">
    <p class="eyebrow">Looks</p>
    <h1>Looks</h1>
    <p class="lead">How many times someone opened a page. No names.</p>
    <div class="cards">
      <article class="card"><p class="card-label">Today</p><p class="card-num">${today}</p></article>
      <article class="card"><p class="card-label">Last 7 days</p><p class="card-num">${week}</p></article>
      <article class="card"><p class="card-label">All time</p><p class="card-num">${total}</p></article>
    </div>
    <h2>Pages people opened</h2>
    <ol>${rows}</ol>
    <p class="back"><a href="/">← Home</a> · <a href="/admin/">Editor</a></p>
  </main>
</body>
</html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

export function looksPageRows(pages) {
  const list = Array.isArray(pages) ? pages : [];
  if (!list.length) {
    return '<li class="empty">Open Home, Now, or a ride, then refresh this page.</li>';
  }
  return list
    .map((row) => {
      const label = row.path === '/' ? 'Home' : escapeHtml(row.path);
      const href = escapeHtml(row.path);
      return `<li><a href="${href}">${label}</a><span>${Number(row.looks) || 0}</span></li>`;
    })
    .join('');
}

export function fillLooksInHtml(html, summary) {
  const today = String(Number(summary?.today) || 0);
  const week = String(Number(summary?.week) || 0);
  const total = String(Number(summary?.total) || 0);
  const rows = looksPageRows(summary?.pages);
  return String(html)
    .replace(/data-looks="today"([^>]*)>[\s\S]*?</, `data-looks="today"$1>${today}<`)
    .replace(/data-looks="week"([^>]*)>[\s\S]*?</, `data-looks="week"$1>${week}<`)
    .replace(/data-looks="total"([^>]*)>[\s\S]*?</, `data-looks="total"$1>${total}<`)
    .replace(
      /<ol([^>]*data-looks-pages[^>]*)>[\s\S]*?<\/ol>/,
      `<ol$1>${rows}</ol>`,
    );
}

async function safeReadLooks(env) {
  try {
    return await readLooks(looksStoreFor(env));
  } catch {
    return summarizeLooks(emptyLooks());
  }
}

async function fetchLooksAsset(request, env) {
  if (!env?.ASSETS?.fetch) return null;
  const paths = ['/looks', '/looks/', '/looks/index.html'];
  for (const path of paths) {
    const url = new URL(request.url);
    url.pathname = path;
    const asset = await env.ASSETS.fetch(
      new Request(url, { method: 'GET', headers: request.headers }),
    );
    if (asset.ok) return asset;
    const location = asset.headers.get('location');
    if (asset.status >= 300 && asset.status < 400 && location) {
      const next = await env.ASSETS.fetch(
        new Request(new URL(location, url), { method: 'GET', headers: request.headers }),
      );
      if (next.ok) return next;
    }
  }
  return null;
}

export async function applyLooksToAsset(request, env, asset) {
  const url = new URL(request.url);
  if (!isLooksPath(url.pathname)) return asset;
  if (!asset || !asset.ok) return null;
  const type = asset.headers.get('content-type') || '';
  if (type && !type.includes('html') && !type.includes('text')) return asset;
  const summary = await safeReadLooks(env);
  const html = fillLooksInHtml(await asset.text(), summary);
  const headers = new Headers(asset.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status: 200, headers });
}

export async function handleLooksPage(request, env) {
  const url = new URL(request.url);
  if (!isLooksPath(url.pathname)) return null;
  const asset = await fetchLooksAsset(request, env);
  const filled = await applyLooksToAsset(request, env, asset);
  if (filled) return filled;
  return looksDashboardPage(await safeReadLooks(env));
}

export async function handleLooksRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/looks') return null;

  const store = looksStoreFor(env);
  if (request.method === 'GET') {
    const summary = await readLooks(store);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const host = new URL(origin).hostname;
      const ok =
        host === 'thenewsoulsearchers.de' ||
        host === 'www.thenewsoulsearchers.de' ||
        host.endsWith('.workers.dev') ||
        host === 'localhost' ||
        host === '127.0.0.1';
      if (!ok) return new Response('No', { status: 403 });
    } catch {
      return new Response('No', { status: 403 });
    }
  }

  let path = url.searchParams.get('path') || '/';
  const contentType = request.headers.get('content-type') || '';
  try {
    const raw = await request.text();
    if (raw) {
      if (contentType.includes('application/json') || raw.trim().startsWith('{')) {
        const body = JSON.parse(raw);
        if (body && typeof body.path === 'string') path = body.path;
      } else {
        path = raw;
      }
    }
  } catch {
    /* sendBeacon can send the path as plain text */
  }

  const result = await recordLook(store, path);
  return new Response(result.recorded ? null : JSON.stringify(result), {
    status: result.recorded ? 204 : 200,
    headers: { 'cache-control': 'no-store' },
  });
}
