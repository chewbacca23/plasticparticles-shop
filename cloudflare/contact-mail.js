/**
 * Public contact form → Henrik’s inbox.
 * POST /api/contact  { name, email, message }
 *
 * Prefers the Cloudflare Email binding (`env.EMAIL`). Falls back to Resend
 * when `RESEND_API_KEY` is set. Always keeps a short KV copy when STATS
 * is bound, so a note is not lost if mail is briefly down.
 */

export const CONTACT_TO = 'henrik.kuerschner@web.de';
export const CONTACT_FROM = 'hello@thenewsoulsearchers.de';

/** Domain inboxes under Strato have been bouncing Resend (SPF/DMARC). */
const DOMAIN_INBOX_SUFFIX = '@thenewsoulsearchers.de';

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 5000;
const RATE_WINDOW_SEC = 60 * 10;
const RATE_MAX = 5;

/**
 * Inbox that receives contact notes.
 * Default is Henrik’s web.de (Strato henrik@ bounces Resend under DMARC reject).
 * Override with Worker secret CONTACT_INBOX if that ever changes.
 * Never delivers to *@thenewsoulsearchers.de via Resend — that path bounced.
 * @param {any} env
 */
export function resolveContactTo(env) {
  const override = cleanEmail(env?.CONTACT_INBOX);
  const candidate = override || CONTACT_TO;
  if (candidate.toLowerCase().endsWith(DOMAIN_INBOX_SUFFIX)) {
    return CONTACT_TO;
  }
  return candidate;
}

/**
 * True when CONTACT_INBOX pointed at the domain address we refuse to use.
 * @param {any} env
 */
export function contactInboxOverridden(env) {
  const override = cleanEmail(env?.CONTACT_INBOX);
  return Boolean(override && override.toLowerCase().endsWith(DOMAIN_INBOX_SUFFIX));
}

/**
 * Resend From — must be on the verified domain (not resend.dev) to reach any inbox.
 * Optional CONTACT_FROM secret overrides the local part/domain.
 * @param {any} env
 */
export function resolveResendFrom(env) {
  const custom = cleanEmail(env?.CONTACT_FROM);
  if (custom) return `The Soul Searchers form <${custom}>`;
  return `The Soul Searchers form <${CONTACT_FROM}>`;
}

/**
 * Resend keys often get pasted with quotes, Bearer, or `NAME=re_…` junk.
 * Pull out the real `re_…` token when it is buried in the paste.
 * @param {unknown} raw
 */
export function cleanResendKey(raw) {
  let value = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/^Bearer\s+/i, '').trim();
  value = value.replace(/^RESEND_API_KEY\s*[:=]\s*/i, '').trim();
  // If junk was pasted around the token, keep only the Resend key itself.
  const embedded = value.match(/re_[A-Za-z0-9_]+/);
  if (embedded) return embedded[0];
  return value;
}

/**
 * Safe shape for /cms-status — never the key itself.
 * @param {unknown} raw
 */
export function describeResendKey(raw) {
  const original = String(raw || '');
  const key = cleanResendKey(raw);
  if (!key && !original.trim()) {
    return {
      present: false,
      length: 0,
      startsWithRe: false,
      shape: 'missing',
    };
  }
  const startsWithRe = key.startsWith('re_');
  const looksClean = /^re_[A-Za-z0-9_]+$/.test(key);
  let shape = 'odd';
  if (looksClean && key.length >= 20) shape = 'looks like a Resend key';
  else if (startsWithRe) shape = 'starts with re_ but has odd characters';
  else if (key.length > 0) shape = 'does NOT look like a Resend key (should start re_)';

  // Leading char codes of the RAW Worker value (not the secret text).
  // Lets us see invisible junk / wrong paste without printing the key.
  const rawTrim = original.replace(/^\uFEFF/, '').trim();
  const leadingCodes = [...rawTrim.slice(0, 6)].map((c) => c.charCodeAt(0));

  return {
    present: true,
    length: key.length,
    rawLength: rawTrim.length,
    startsWithRe,
    shape,
    leadingCodes,
    expectedReCodes: [114, 101, 95], // r e _
  };
}

/**
 * Ask Resend if this key is alive (no email sent).
 * sending_access keys cannot list domains — that still counts as ok for the form.
 * @param {any} env
 */
export async function probeResendKey(env) {
  const key = cleanResendKey(env?.RESEND_API_KEY);
  if (!key) {
    return { ok: false, status: 0, detail: 'no key' };
  }
  if (!key.startsWith('re_') || key.length < 20) {
    return {
      ok: false,
      status: 0,
      detail: `not a full Resend key (got ${key.length} chars; paste the whole re_… value)`,
    };
  }
  try {
    const res = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: { authorization: `Bearer ${key}` },
    });
    if (res.ok) return { ok: true, status: res.status, detail: 'accepted' };
    const body = (await res.text()).slice(0, 160);
    // Full-access check failed, but sending-only keys are fine for /contact.
    if (res.status === 401 && /restricted/i.test(body)) {
      return {
        ok: true,
        status: res.status,
        detail: 'sending_access key (ok for contact form)',
      };
    }
    if (res.status === 401 || res.status === 400 || res.status === 403) {
      return {
        ok: false,
        status: res.status,
        detail: body || 'rejected (dead or wrong key)',
      };
    }
    return { ok: false, status: res.status, detail: body || res.statusText || 'error' };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error && error.message ? String(error.message).slice(0, 120) : 'network error',
    };
  }
}

/** True when this Worker can send without falling back to mailto. */
export function mailReady(env) {
  if (env?.EMAIL && typeof env.EMAIL.send === 'function') return true;
  return Boolean(cleanResendKey(env?.RESEND_API_KEY));
}

export function mailVia(env) {
  if (env?.EMAIL && typeof env.EMAIL.send === 'function') return 'cloudflare';
  if (cleanResendKey(env?.RESEND_API_KEY)) return 'resend';
  return 'none';
}

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
    // Honeypot — bots fill this; humans never see it.
    company: cleanLine(src.company, 80),
  };
}

export function validateContact(fields) {
  if (!fields.name) return 'Please add your name.';
  if (!fields.email) return 'Please add a real email.';
  if (!fields.message) return 'Please write a short message.';
  return '';
}

export function contactSubject(name) {
  const who = cleanLine(name, 60) || 'a rider';
  return `Contact form · thenewsoulsearchers.de · ${who}`;
}

export function contactText(fields) {
  return [
    'New note from the contact form on thenewsoulsearchers.de',
    '',
    `Name: ${fields.name}`,
    `Reply to: ${fields.email}`,
    '',
    fields.message,
    '',
    '—',
    'Hit Reply to answer them. This mail was sent by the site form (not their mail app).',
    'https://thenewsoulsearchers.de/contact',
  ].join('\n');
}

export function contactHtml(fields) {
  const esc = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  return [
    '<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#122">',
    '<p style="margin:0 0 1rem;color:#3d6b7a;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">',
    'Contact form · thenewsoulsearchers.de',
    '</p>',
    `<p style="margin:0 0 .35rem"><strong>Name:</strong> ${esc(fields.name)}</p>`,
    `<p style="margin:0 0 1rem"><strong>Reply to:</strong> <a href="mailto:${esc(fields.email)}">${esc(fields.email)}</a></p>`,
    `<p style="white-space:pre-wrap;margin:0 0 1.25rem">${esc(fields.message)}</p>`,
    '<hr style="border:none;border-top:1px solid #ddd;margin:1.25rem 0" />',
    '<p style="color:#666;font-size:13px;margin:0">',
    'Hit Reply to answer them. This mail was sent by the site form (not their mail app).',
    '<br />',
    '<a href="https://thenewsoulsearchers.de/contact">thenewsoulsearchers.de/contact</a>',
    '</p>',
    '</div>',
  ].join('');
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
        company: form.get('company'),
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
      name: fields.name,
      email: fields.email,
      message: fields.message,
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
  const html = contactHtml(fields);
  const to = resolveContactTo(env);
  const payload = {
    from: CONTACT_FROM,
    to,
    replyTo: fields.email,
    subject,
    text,
    html,
  };

  if (env?.EMAIL && typeof env.EMAIL.send === 'function') {
    await env.EMAIL.send(payload);
    return { via: 'cloudflare', to };
  }

  const key = cleanResendKey(env?.RESEND_API_KEY);
  if (key) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: resolveResendFrom(env),
        to: [to],
        reply_to: fields.email,
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      const err = new Error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`);
      err.code = 'E_RESEND';
      err.status = res.status;
      throw err;
    }
    return { via: 'resend', to, from: resolveResendFrom(env) };
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
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (request.method === 'GET') {
    return json({
      ok: true,
      mailWired: mailReady(env),
      mailVia: mailVia(env),
      to: resolveContactTo(env),
      from: mailVia(env) === 'resend' ? resolveResendFrom(env) : CONTACT_FROM,
    });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST a note to send it.' }, 405);
  }

  if (!(await underRateLimit(env, clientKey(request)))) {
    return json({ ok: false, error: 'Easy, rider. Wait a few minutes, then try again.' }, 429);
  }

  const fields = parseContactBody(await readJson(request));
  // Silent honeypot — pretend success so bots move on.
  if (fields.company) {
    return json({ ok: true, via: 'discard' });
  }

  const problem = validateContact(fields);
  if (problem) return json({ ok: false, error: problem }, 400);

  try {
    // Deliver first. A KV copy failure must never block the rider’s note.
    const sent = await deliverContact(env, fields);
    try {
      await keepCopy(env, fields);
    } catch (copyErr) {
      console.error('contact keepCopy failed', copyErr);
    }
    return json({ ok: true, via: sent.via, to: sent.to });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_MAIL_NOT_CONFIGURED') {
      return json(
        {
          ok: false,
          error: 'Mail is not wired on the site yet. Write Henrik direct for now.',
          code,
          // Soft flag for the form UI — never means “open the visitor mail app”.
          mailto: true,
        },
        503,
      );
    }
    console.error('contact send failed', error);
    const resendStatus =
      error && typeof error === 'object' && typeof error.status === 'number' ? error.status : 0;
    let message = 'Could not send just now. Write Henrik direct if it stalls again.';
    // Resend uses 400 and 401 for a bad/missing key depending on the route.
    if (code === 'E_RESEND' && (resendStatus === 400 || resendStatus === 401)) {
      message =
        'Mail key was rejected. Open /cms-status — mailKeyProbe must be ok before Send works.';
    } else if (code === 'E_RESEND' && (resendStatus === 403 || resendStatus === 422)) {
      message =
        'Mail service refused the note (domain or From address). Check Resend for thenewsoulsearchers.de.';
    } else if (code === 'E_RESEND' && resendStatus === 429) {
      message = 'Mail service asked us to slow down. Wait a minute, then try once.';
    }
    // Do not set mailto here. A flaky Resend reply used to flip the form into
    // endless “try again / open Mail” loops. One calm error is enough.
    return json(
      {
        ok: false,
        error: message,
        code: code || 'E_SEND',
        resendStatus: resendStatus || undefined,
      },
      502,
    );
  }
}
