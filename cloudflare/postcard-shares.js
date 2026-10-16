/**
 * Visitors send postcards themselves (mailto). When they tap Send this ride,
 * we record the intent and quietly tell Henrik.
 *
 * POST /api/postcard-shares  { slug, title, path, website? }
 * GET  /api/postcard-shares  → public { ok } / private { shares, count } with looks cookie
 */

import { cleanLine, deliverContact } from './contact-mail.js';

export const MAX_TITLE = 160;
export const MAX_SLUG = 120;
export const MAX_PATH = 200;
export const STORE_LIMIT = 100;
export const RATE_WINDOW_SEC = 60 * 60;
export const RATE_MAX = 20;
export const SHARES_LIST_KEY = 'postcard-shares:list';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function clientKey(request) {
  const cf = /** @type {{ colo?: string }} */ (request.cf || {});
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown';
  return `postcard-shares:rate:${ip}:${cf.colo || 'xx'}`;
}

/**
 * @param {any} env
 * @param {string} key
 */
async function underRateLimit(env, key) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return true;
  const now = Date.now();
  let hits = [];
  try {
    const raw = await kv.get(key);
    hits = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(hits)) hits = [];
  } catch {
    hits = [];
  }
  hits = hits.filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_SEC * 1000);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  await kv.put(key, JSON.stringify(hits), { expirationTtl: RATE_WINDOW_SEC + 60 });
  return true;
}

/**
 * @param {unknown} body
 */
export function parseShareBody(body) {
  const data = body && typeof body === 'object' ? body : {};
  let path = cleanLine(data.path, MAX_PATH);
  if (path && !path.startsWith('/')) path = `/${path}`;
  return {
    slug: cleanLine(data.slug, MAX_SLUG)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, MAX_SLUG),
    title: cleanLine(data.title, MAX_TITLE),
    path,
    website: cleanLine(data.website || data.company, 80),
  };
}

/**
 * @param {{ slug: string, title: string }} fields
 */
export function validateShare(fields) {
  if (!fields.slug && !fields.title) return 'Missing postcard.';
  return '';
}

/**
 * @param {any} env
 */
export async function readPostcardShares(env) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return [];
  try {
    const raw = await kv.get(SHARES_LIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * @param {any} env
 * @param {{ slug: string, title: string, path: string }} fields
 */
export async function savePostcardShare(env, fields) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    const err = new Error('Postcard share storage is not wired.');
    // @ts-expect-error code
    err.code = 'E_SHARES_KV';
    throw err;
  }
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    slug: fields.slug,
    title: fields.title || fields.slug || 'a ride',
    path: fields.path || (fields.slug ? `/postcard/${fields.slug}` : ''),
    at: new Date().toISOString(),
  };
  let list = await readPostcardShares(env);
  list = [entry, ...list].slice(0, STORE_LIMIT);
  await kv.put(SHARES_LIST_KEY, JSON.stringify(list));
  return entry;
}

/**
 * @param {any} env
 * @param {{ slug: string, title: string, path: string }} fields
 */
export async function notifyPostcardShare(env, fields) {
  const title = fields.title || fields.slug || 'a ride';
  const path = fields.path || (fields.slug ? `/postcard/${fields.slug}` : '/postcard');
  const url = `https://thenewsoulsearchers.de${path.startsWith('/') ? path : `/${path}`}`;
  await deliverContact(env, {
    name: 'Postcard share',
    email: 'hello@thenewsoulsearchers.de',
    message: [
      `Someone started a postcard for ${title}.`,
      '',
      `Ride: ${title}`,
      fields.slug ? `Slug: ${fields.slug}` : '',
      `Link: ${url}`,
      '',
      'They opened their own mail app to send it. Membership stays free.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {unknown} iso
 */
export function formatShareWhen(iso) {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return raw.slice(0, 10);
  }
}

/**
 * Private roster HTML for /looks.
 * @param {Array<{ title?: string, path?: string, slug?: string, at?: string }>} shares
 */
export function postcardSharesListHtml(shares) {
  const list = Array.isArray(shares) ? shares : [];
  if (!list.length) {
    return '<li class="empty">No postcards started yet. When someone taps Send this ride, it shows here.</li>';
  }
  return list
    .map((row) => {
      const title = escapeHtml(row?.title || row?.slug || 'a ride');
      const path =
        row?.path || (row?.slug ? `/postcard/${row.slug}` : '/postcard');
      const href = escapeHtml(path);
      const when = formatShareWhen(row?.at);
      return `<li><a href="${href}">${title}</a><span>${escapeHtml(when)}</span></li>`;
    })
    .join('');
}

/**
 * @param {Request} request
 * @param {any} env
 */
export async function handlePostcardSharesRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/postcard-shares' && url.pathname !== '/api/postcard-shares/') {
    return null;
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (request.method === 'GET') {
    let privateView = false;
    try {
      const { requestHasLooksAccess } = await import('./page-looks.js');
      privateView = await requestHasLooksAccess(request, env);
    } catch {
      privateView = false;
    }
    if (!privateView) {
      return json({ ok: true });
    }
    const shares = await readPostcardShares(env);
    return json({ ok: true, private: true, count: shares.length, shares });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST when a postcard is started.' }, 405);
  }

  if (!(await underRateLimit(env, clientKey(request)))) {
    return json({ ok: false, error: 'Easy, rider. Wait a little, then try again.' }, 429);
  }

  const fields = parseShareBody(await readJson(request));
  if (fields.website) {
    return json({ ok: true, via: 'discard' });
  }

  const problem = validateShare(fields);
  if (problem) return json({ ok: false, error: problem }, 400);

  try {
    const saved = await savePostcardShare(env, fields);
    try {
      await notifyPostcardShare(env, fields);
    } catch (mailErr) {
      console.error('postcard share notify failed', mailErr);
    }
    return json({ ok: true, share: saved });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_SHARES_KV') {
      return json(
        { ok: false, error: 'Postcard shares are not wired on the Worker yet.', code },
        503,
      );
    }
    console.error('postcard share save failed', error);
    return json({ ok: false, error: 'Could not record that just now.' }, 502);
  }
}
