/**
 * Public contact form → Henrik’s inbox.
 * POST /api/contact  { name, email, message }
 *
 * Prefers the Cloudflare Email binding (`env.EMAIL`). Falls back to Resend
 * when `RESEND_API_KEY` is set. Always keeps a short KV copy when STATS
 * is bound, so a note is not lost if mail is briefly down.
 */

export const CONTACT_TO = 'henrik@thenewsoulsearchers.de';
export const CONTACT_FROM = 'hello@thenewsoulsearchers.de';

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 5000;
const RATE_WINDOW_SEC = 60 * 10;
const RATE_MAX = 5;

export function cleanEmail(raw) {
  const value = String(raw || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '';
  return value.slice(0, MAX_EMAIL);
}

export function cleanLine(raw, max) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

export function parseContactBody(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    name: cleanLine(src.name, MAX_NAME),
    email: cleanEmail(src.email),
    message: cleanLine(src.message, MAX_MESSAGE),
  };
}

export function validateContact(fields) {
  if (!fields.name) return 'Please add your name.';
  if (!fields.email) return 'Please add a real email.';
  if (!fields.message) return 'Please write a short message.';
  return '';
}

export function contactSubject(name) {
  const who = cleanLine(name, 60) || 'rider';
  return `Soul Searchers note from ${who}`;
}

export function contactText(fields) {
  return [
    `From: ${fields.name}`,
    `Email: ${fields.email}`,
    '',
    fields.message,
    '',
    '—',
    'Sent from thenewsoulsearchers.de/contact',
  ].join('\n');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function readJson(request) {
  const type = String(request.headers.get('content-type') || '').toLowerCase();
  if (type.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      return {
        name: form.get('name'),
        email: form.get('email'),
        message: form.get('message'),
      };
    } catch {
      return {};
    }
  }
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
  return `contact:rate:${ip}:${cf.colo || 'xx'}`;
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
 * @param {any} env
 * @param {{ name: string, email: string, message: string }} fields
 */
async function keepCopy(env, fields) {
  const kv = env?.STATS;
  if (!kv || typeof kv.put !== 'function') return;
  const id = `contact:msg:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await kv.put(
    id,
    JSON.stringify({
      ...fields,
      at: new Date().toISOString(),
    }),
    { expirationTtl: 60 * 60 * 24 * 120 },
  );
}

/**
 * @param {any} env
 * @param {{ name: string, email: string, message: string }} fields
 */
export async function deliverContact(env, fields) {
  const subject = contactSubject(fields.name);
  const text = contactText(fields);
  const payload = {
    from: CONTACT_FROM,
    to: CONTACT_TO,
    replyTo: fields.email,
    subject,
    text,
  };

  if (env?.EMAIL && typeof env.EMAIL.send === 'function') {
    await env.EMAIL.send(payload);
    return { via: 'cloudflare' };
  }

  const key = String(env?.RESEND_API_KEY || '').trim();
  if (key) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: `Soul Searchers <${CONTACT_FROM}>`,
        to: [CONTACT_TO],
        reply_to: fields.email,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    return { via: 'resend' };
  }

  const err = new Error('Mail is not wired on this Worker yet.');
  err.code = 'E_MAIL_NOT_CONFIGURED';
  throw err;
}

/**
 * @param {Request} request
 * @param {any} env
 */
export async function handleContactRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/contact' && url.pathname !== '/api/contact/') return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST a note to send it.' }, 405);
  }

  if (!(await underRateLimit(env, clientKey(request)))) {
    return json({ ok: false, error: 'Easy, rider. Wait a few minutes, then try again.' }, 429);
  }

  const fields = parseContactBody(await readJson(request));
  const problem = validateContact(fields);
  if (problem) return json({ ok: false, error: problem }, 400);

  try {
    await keepCopy(env, fields);
    const sent = await deliverContact(env, fields);
    return json({ ok: true, via: sent.via });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_MAIL_NOT_CONFIGURED') {
      return json(
        {
          ok: false,
          error: 'Mail is not wired yet. Use the mailto fallback.',
          code,
          mailto: true,
        },
        503,
      );
    }
    console.error('contact send failed', error);
    return json(
      {
        ok: false,
        error: 'Could not send just now. Try again, or write Henrik direct.',
        mailto: true,
      },
      502,
    );
  }
}
