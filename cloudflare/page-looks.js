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

export async function handleLooksPage(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/looks') return null;
  if (await requestHasLooksAccess(request, env)) return null;
  return looksGatePage();
}

export async function handleLooksRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/looks') return null;

  const store = looksStoreFor(env);
  if (request.method === 'GET') {
    if (!(await requestHasLooksAccess(request, env))) {
      return new Response(JSON.stringify({ error: 'login' }), {
        status: 401,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }
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
