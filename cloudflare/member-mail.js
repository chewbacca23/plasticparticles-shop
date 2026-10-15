/**
 * Free Soul Searchers membership — just an email on the mailing list.
 * POST /api/members  { email, name?, website? }
 * GET  /api/members  → { ok, free: true } (never lists addresses publicly)
 *
 * Addresses live in STATS KV. Henrik also gets a short mail when someone joins
 * (same Resend / EMAIL path as the contact form).
 */

import {
  cleanEmail,
  cleanLine,
  deliverContact,
  resolveContactTo,
} from './contact-mail.js';

export const MAX_MEMBER_NAME = 80;
export const MEMBER_STORE_LIMIT = 5000;
export const RATE_WINDOW_SEC = 60 * 60;
export const RATE_MAX = 8;
export const MEMBERS_LIST_KEY = 'members:list';

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
  return `members:rate:${ip}:${cf.colo || 'xx'}`;
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
export function parseMemberBody(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    name: cleanLine(data.name, MAX_MEMBER_NAME),
    email: cleanEmail(data.email).toLowerCase(),
    website: cleanLine(data.website || data.company, 80),
  };
}

/**
 * @param {{ email: string }} fields
 */
export function validateMember(fields) {
  if (!fields.email) return 'Please add a real email.';
  return '';
}

/**
 * @param {any} env
 */
export async function readMemberList(env) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return [];
  try {
    const raw = await kv.get(MEMBERS_LIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * @param {any} env
 * @param {{ email: string, name: string }} fields
 */
export async function saveMember(env, fields) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    const err = new Error('Member storage is not wired.');
    // @ts-expect-error code
    err.code = 'E_MEMBERS_KV';
    throw err;
  }

  const email = fields.email.toLowerCase();
  let list = await readMemberList(env);
  const already = list.find(
    (item) => item && String(item.email || '').toLowerCase() === email,
  );
  if (already) {
    return { entry: already, created: false };
  }

  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: fields.name,
    at: new Date().toISOString(),
  };
  list = [entry, ...list].slice(0, MEMBER_STORE_LIMIT);
  await kv.put(MEMBERS_LIST_KEY, JSON.stringify(list));
  return { entry, created: true };
}

/**
 * Quiet note to Henrik so the new address reaches the mailing list inbox.
 * @param {any} env
 * @param {{ email: string, name: string }} fields
 * @param {boolean} created
 */
export async function notifyMemberJoin(env, fields, created) {
  const who = fields.name || 'A rider';
  const line = created
    ? 'Joined the free Soul Searchers mailing list.'
    : 'Already on the free mailing list (signed in again).';
  await deliverContact(env, {
    name: who,
    email: fields.email,
    message: [
      line,
      '',
      `Email: ${fields.email}`,
      fields.name ? `Name: ${fields.name}` : '',
      '',
      'Add them to your list. Membership stays free.',
      'https://thenewsoulsearchers.de/',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/**
 * @param {Request} request
 * @param {any} env
 */
export async function handleMembersRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/members' && url.pathname !== '/api/members/') return null;

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
    // Never publish the list. Just confirm membership is free and open.
    return json({
      ok: true,
      free: true,
      inbox: resolveContactTo(env),
    });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST your email to join.' }, 405);
  }

  if (!(await underRateLimit(env, clientKey(request)))) {
    return json({ ok: false, error: 'Easy, rider. Wait a little, then try again.' }, 429);
  }

  const fields = parseMemberBody(await readJson(request));
  if (fields.website) {
    return json({ ok: true, via: 'discard' });
  }

  const problem = validateMember(fields);
  if (problem) return json({ ok: false, error: problem }, 400);

  try {
    const saved = await saveMember(env, fields);
    try {
      await notifyMemberJoin(env, fields, saved.created);
    } catch (mailErr) {
      // List save must win even if the notify mail stalls.
      console.error('member notify failed', mailErr);
    }
    return json({
      ok: true,
      free: true,
      created: saved.created,
      message: saved.created
        ? 'Welcome. You are on the free list.'
        : 'You are already on the free list. Welcome back.',
    });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_MEMBERS_KV') {
      return json(
        { ok: false, error: 'Membership is not wired on the Worker yet.', code },
        503,
      );
    }
    console.error('member save failed', error);
    return json({ ok: false, error: 'Could not join just now.' }, 502);
  }
}
