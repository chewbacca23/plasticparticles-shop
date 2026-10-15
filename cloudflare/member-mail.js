/**
 * Free Soul Searchers membership — email on the big mailing list.
 * POST /api/members  { email, name?, website? }
 * GET  /api/members  → { ok, free: true } (never lists addresses publicly)
 *
 * Each join is stored in STATS KV and pushed into one Resend Audience
 * (“Soul Searchers members”). Henrik can email that whole group back from
 * Resend → Broadcasts. Optional secret RESEND_AUDIENCE_ID pins the audience;
 * otherwise the Worker creates/remembers one in KV.
 */

import {
  cleanEmail,
  cleanLine,
  deliverContact,
  resolveContactTo,
  resolveResendKey,
} from './contact-mail.js';

export const MAX_MEMBER_NAME = 80;
export const MEMBER_STORE_LIMIT = 5000;
export const RATE_WINDOW_SEC = 60 * 60;
export const RATE_MAX = 8;
export const MEMBERS_LIST_KEY = 'members:list';
export const MEMBERS_AUDIENCE_KEY = 'members:audience_id';
export const MEMBERS_AUDIENCE_NAME = 'Soul Searchers members';

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
 * Split an optional display name for Resend contact fields.
 * @param {string} name
 */
export function splitMemberName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * @param {any} env
 */
export function audienceIdFromEnv(env) {
  const raw = String(env?.RESEND_AUDIENCE_ID || env?.SOUL_RESEND_AUDIENCE_ID || '').trim();
  return raw || '';
}

/**
 * Resolve or create the one big Resend audience that holds every member.
 * @param {any} env
 */
export async function resolveMemberAudienceId(env) {
  const pinned = audienceIdFromEnv(env);
  if (pinned) return pinned;

  const kv = env?.STATS;
  if (kv && typeof kv.get === 'function') {
    try {
      const saved = String((await kv.get(MEMBERS_AUDIENCE_KEY)) || '').trim();
      if (saved) return saved;
    } catch {
      /* keep going */
    }
  }

  const { key } = resolveResendKey(env);
  if (!key) return '';

  const headers = {
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };

  const created = await fetch('https://api.resend.com/audiences', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: MEMBERS_AUDIENCE_NAME }),
  });
  const createdBody = await created.json().catch(() => ({}));
  let id = created.ok
    ? String(createdBody?.id || createdBody?.data?.id || '').trim()
    : '';

  if (!id) {
    // Name may already exist — pick it from the audience list.
    try {
      const listed = await fetch('https://api.resend.com/audiences', { headers });
      const listedBody = await listed.json().catch(() => ({}));
      const rows = Array.isArray(listedBody?.data)
        ? listedBody.data
        : Array.isArray(listedBody)
          ? listedBody
          : [];
      const match = rows.find(
        (row) => row && String(row.name || '') === MEMBERS_AUDIENCE_NAME,
      );
      id = String(match?.id || '').trim();
    } catch (err) {
      console.error('resend audience list failed', err);
    }
  }

  if (!id) {
    console.error('resend audience create failed', created.status, createdBody);
    return '';
  }
  if (kv && typeof kv.put === 'function') {
    try {
      await kv.put(MEMBERS_AUDIENCE_KEY, id);
    } catch (err) {
      console.error('members audience kv put failed', err);
    }
  }
  return id;
}

/**
 * Push the email into the Resend audience so Henrik can Broadcast to everyone.
 * @param {any} env
 * @param {{ email: string, name: string }} fields
 */
export async function addMemberToAudience(env, fields) {
  const { key } = resolveResendKey(env);
  if (!key) {
    return { ok: false, reason: 'no_resend_key' };
  }
  const audienceId = await resolveMemberAudienceId(env);
  if (!audienceId) {
    return { ok: false, reason: 'no_audience' };
  }

  const { firstName, lastName } = splitMemberName(fields.name);
  const payload = {
    email: fields.email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    unsubscribed: false,
  };

  const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 409) {
    // 409 = already on the list — fine.
    return { ok: true, audienceId, status: res.status };
  }

  const detail = await res.text();
  console.error('resend contact add failed', res.status, detail);
  return { ok: false, reason: 'resend_error', status: res.status, detail };
}

/**
 * Quiet note to Henrik when someone joins the free list.
 * @param {any} env
 * @param {{ email: string, name: string }} fields
 * @param {boolean} created
 * @param {{ ok: boolean, audienceId?: string }} listSync
 */
export async function notifyMemberJoin(env, fields, created, listSync = { ok: false }) {
  const who = fields.name || 'A rider';
  const line = created
    ? 'Joined the free Soul Searchers mailing list.'
    : 'Already on the free mailing list (signed in again).';
  const listLine = listSync.ok
    ? `On the Resend audience (${listSync.audienceId || 'Soul Searchers members'}). Send a Broadcast from Resend when you want to write everyone.`
    : 'Saved on the site list. Resend audience sync was not ready — check RESEND key / RESEND_AUDIENCE_ID on the Worker.';
  await deliverContact(env, {
    name: who,
    email: fields.email,
    message: [
      line,
      '',
      `Email: ${fields.email}`,
      fields.name ? `Name: ${fields.name}` : '',
      '',
      listLine,
      'Membership stays free.',
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
    const { key } = resolveResendKey(env);
    const pinned = audienceIdFromEnv(env);
    return json({
      ok: true,
      free: true,
      inbox: resolveContactTo(env),
      listWired: Boolean(key),
      audiencePinned: Boolean(pinned),
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
    let listSync = { ok: false };
    try {
      listSync = await addMemberToAudience(env, fields);
    } catch (syncErr) {
      console.error('member audience sync failed', syncErr);
    }
    try {
      await notifyMemberJoin(env, fields, saved.created, listSync);
    } catch (mailErr) {
      // List save must win even if the notify mail stalls.
      console.error('member notify failed', mailErr);
    }
    return json({
      ok: true,
      free: true,
      created: saved.created,
      onList: Boolean(listSync.ok),
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
