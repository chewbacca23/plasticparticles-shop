/**
 * Where I stood — places (dots) and ride lines (thin paths) on the free world map.
 * Henrik only for writes (looks cookie).
 *
 * POST /api/stood-places  { place, when?, note?, detail?, path?, website? }
 *   path = "Perth, Albany, Adelaide, Melbourne" → thin line through those stops
 * GET  /api/stood-places  → { ok, places, routes }
 */

import { cleanLine } from './contact-mail.js';

export const MAX_PLACE = 120;
export const MAX_WHEN = 80;
export const MAX_NOTE = 280;
export const MAX_PATH = 800;
export const MAX_STOPS = 24;
export const STORE_LIMIT = 200;
export const RATE_WINDOW_SEC = 60 * 60;
export const RATE_MAX = 40;
export const STOOD_LIST_KEY = 'stood-places:list';
export const STOOD_ROUTES_KEY = 'stood-routes:list';

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
 * Split a ride path into ordered stop names.
 * "Perth, Albany → Adelaide, Melbourne"
 * @param {unknown} raw
 */
export function parsePathStops(raw) {
  return String(raw || '')
    .split(/\s*(?:,|->|→|;|\n)\s*/)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => part.length >= 2)
    .slice(0, MAX_STOPS);
}

/**
 * @param {unknown} body
 */
export function parseStoodBody(body) {
  const data = body && typeof body === 'object' ? body : {};
  const when = cleanLine(data.when || data.stoodAt || data.date, MAX_WHEN);
  const pathRaw = cleanLine(data.path || data.via || data.route || data.stops, MAX_PATH);
  const stops = parsePathStops(pathRaw);
  return {
    place: cleanLine(data.place || data.point || data.name || data.title, MAX_PLACE),
    when,
    note: cleanLine(data.note || data.line1, MAX_NOTE),
    detail: cleanLine(data.detail || data.line2, MAX_NOTE),
    path: pathRaw,
    stops,
    website: cleanLine(data.website || data.company, 80),
  };
}

/**
 * @param {{ place: string, stops: string[] }} fields
 */
export function validateStood(fields) {
  if (fields.stops.length >= 2) {
    if (!fields.place) return 'Give this ride a short name.';
    return '';
  }
  if (!fields.place || fields.place.length < 2) return 'Add a place name.';
  if (fields.stops.length === 1) {
    return 'A ride line needs at least two stops — like Perth, Adelaide, Melbourne.';
  }
  return '';
}

/**
 * @param {any} env
 * @param {string} key
 */
async function readList(env, key) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return [];
  try {
    const raw = await kv.get(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * @param {any} env
 */
export async function readStoodPlaces(env) {
  return readList(env, STOOD_LIST_KEY);
}

/**
 * @param {any} env
 */
export async function readStoodRoutes(env) {
  return readList(env, STOOD_ROUTES_KEY);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string[]} names
 */
export async function geocodeStops(names) {
  const points = [];
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    try {
      const coords = await geocodePlaceName(name);
      if (coords) points.push({ name, lat: coords.lat, lng: coords.lng });
    } catch (error) {
      console.error('stood stop geocode failed', name, error);
    }
    if (i < names.length - 1) await sleep(1100);
  }
  return points;
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
 * @param {any} env
 * @param {{ place: string, when: string, note: string, detail: string, path: string }} fields
 * @param {Array<{ name: string, lat: number, lng: number }>} points
 */
export async function saveStoodRoute(env, fields, points) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    const err = new Error('Stood place storage is not wired.');
    // @ts-expect-error code
    err.code = 'E_STOOD_KV';
    throw err;
  }
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    title: fields.place,
    when: fields.when,
    note: fields.note,
    detail: fields.detail,
    path: fields.path,
    points,
    at: new Date().toISOString(),
  };
  let list = await readStoodRoutes(env);
  list = [entry, ...list].slice(0, STORE_LIMIT);
  await kv.put(STOOD_ROUTES_KEY, JSON.stringify(list));
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
    const [places, routes] = await Promise.all([readStoodPlaces(env), readStoodRoutes(env)]);
    return json({ ok: true, places, routes });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST a place or ride line.' }, 405);
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

  try {
    if (fields.stops.length >= 2) {
      const points = await geocodeStops(fields.stops);
      if (points.length < 2) {
        return json(
          {
            ok: false,
            error: 'Could not find enough stops on the map. Try clearer place names.',
          },
          400,
        );
      }
      const saved = await saveStoodRoute(env, fields, points);
      return json({ ok: true, kind: 'route', route: saved });
    }

    let coords = null;
    try {
      coords = await geocodePlaceName(fields.place);
    } catch (error) {
      console.error('stood geocode failed', error);
    }
    const saved = await saveStoodPlace(env, fields, coords);
    return json({ ok: true, kind: 'place', place: saved });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_STOOD_KV') {
      return json(
        { ok: false, error: 'Stood places are not wired on the Worker yet.', code },
        503,
      );
    }
    console.error('stood place save failed', error);
    return json({ ok: false, error: 'Could not save that just now.' }, 502);
  }
}
