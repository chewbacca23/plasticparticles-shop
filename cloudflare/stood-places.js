/**
 * Where I stood — add a place from the page (Henrik only, looks cookie).
 * POST /api/stood-places  { place, when?, note?, detail?, website? }
 * GET  /api/stood-places  → { ok, places } (public list for the map)
 */

import { cleanLine } from './contact-mail.js';

export const MAX_PLACE = 120;
export const MAX_NOTE = 280;
export const STORE_LIMIT = 200;
export const RATE_WINDOW_SEC = 60 * 60;
export const RATE_MAX = 40;
export const STOOD_LIST_KEY = 'stood-places:list';

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
  return `stood-places:rate:${ip}:${cf.colo || 'xx'}`;
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
export function parseStoodBody(body) {
  const data = body && typeof body === 'object' ? body : {};
  let when = cleanLine(data.when || data.stoodAt || data.date, 32);
  if (when && !/^\d{4}-\d{2}-\d{2}/.test(when)) when = when.slice(0, 32);
  else if (when) when = when.slice(0, 10);
  return {
    place: cleanLine(data.place || data.point || data.name, MAX_PLACE),
    when,
    note: cleanLine(data.note || data.line1, MAX_NOTE),
    detail: cleanLine(data.detail || data.line2, MAX_NOTE),
    website: cleanLine(data.website || data.company, 80),
  };
}

/**
 * @param {{ place: string }} fields
 */
export function validateStood(fields) {
  if (!fields.place || fields.place.length < 2) return 'Add a place name.';
  return '';
}

/**
 * @param {any} env
 */
export async function readStoodPlaces(env) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return [];
  try {
    const raw = await kv.get(STOOD_LIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Free Nominatim lookup — no API key.
 * @param {string} place
 */
export async function geocodePlaceName(place) {
  const query = String(place || '')
    .trim()
    .replace(/\s*·\s*/g, ', ');
  if (!query) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent':
        'TheSoulSearchersBlog/1.0 (https://thenewsoulsearchers.de; hello@thenewsoulsearchers.de)',
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  const lat = row?.lat != null ? Number(row.lat) : NaN;
  const lng = row?.lon != null ? Number(row.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * @param {any} env
 * @param {{ place: string, when: string, note: string, detail: string }} fields
 * @param {{ lat?: number, lng?: number } | null} coords
 */
export async function saveStoodPlace(env, fields, coords) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    const err = new Error('Stood place storage is not wired.');
    // @ts-expect-error code
    err.code = 'E_STOOD_KV';
    throw err;
  }
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    place: fields.place,
    when: fields.when,
    note: fields.note,
    detail: fields.detail,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    at: new Date().toISOString(),
  };
  let list = await readStoodPlaces(env);
  list = [entry, ...list].slice(0, STORE_LIMIT);
  await kv.put(STOOD_LIST_KEY, JSON.stringify(list));
  return entry;
}

/**
 * @param {Request} request
 * @param {any} env
 */
export async function handleStoodPlacesRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/stood-places' && url.pathname !== '/api/stood-places/') {
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
    const places = await readStoodPlaces(env);
    return json({ ok: true, places });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST a place you stood.' }, 405);
  }

  let privateView = false;
  try {
    const { requestHasLooksAccess } = await import('./page-looks.js');
    privateView = await requestHasLooksAccess(request, env);
  } catch {
    privateView = false;
  }
  if (!privateView) {
    return json(
      {
        ok: false,
        error: 'Open Looks once while signed in, then you can add places here.',
        code: 'E_LOOKS',
      },
      401,
    );
  }

  if (!(await underRateLimit(env, clientKey(request)))) {
    return json({ ok: false, error: 'Easy, rider. Wait a little, then try again.' }, 429);
  }

  const fields = parseStoodBody(await readJson(request));
  if (fields.website) {
    return json({ ok: true, via: 'discard' });
  }

  const problem = validateStood(fields);
  if (problem) return json({ ok: false, error: problem }, 400);

  let coords = null;
  try {
    coords = await geocodePlaceName(fields.place);
  } catch (error) {
    console.error('stood geocode failed', error);
  }

  try {
    const saved = await saveStoodPlace(env, fields, coords);
    return json({ ok: true, place: saved });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_STOOD_KV') {
      return json(
        { ok: false, error: 'Stood places are not wired on the Worker yet.', code },
        503,
      );
    }
    console.error('stood place save failed', error);
    return json({ ok: false, error: 'Could not save that place just now.' }, 502);
  }
}
