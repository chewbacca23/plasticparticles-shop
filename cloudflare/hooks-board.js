/**
 * Riders marketplace. Room for a thousand people. Ride together, or trade
 * a tire, a stem, a saddle, a frame. Emails never appear on the page.
 *
 * GET  /api/hooks           public stalls + market + group dots (no emails)
 * POST /api/hooks           pin { name, place, note, email?, company }
 * POST /api/hooks           { action: 'remove', id } — Henrik, Looks cookie
 * POST /api/hooks/write     offer { hookId, name, message, email?, company }
 */

import {
  cleanEmail,
  cleanLine,
  CONTACT_FROM,
  mailReady,
  resolveContactTo,
  resolveResendFrom,
  resolveResendKey,
} from './contact-mail.js';
import { requestHasLooksAccess } from './page-looks.js';

export const HOOKS_KEY = 'hooks-v1';
const MAX_NAME = 80;
const MAX_PLACE = 80;
const MAX_NOTE = 400;
const MAX_MESSAGE = 2000;
export const MAX_HOOKS = 1000;
export const MAX_OFFERS = 80;
const RATE_WINDOW_SEC = 60 * 10;
const RATE_PIN = 3;
const RATE_WRITE = 8;

export function isHooksApiPath(pathname) {
  return (
    pathname === '/api/hooks' ||
    pathname === '/api/hooks/' ||
    pathname === '/api/hooks/write' ||
    pathname === '/api/hooks/write/'
  );
}

export function isHooksWritePath(pathname) {
  return pathname === '/api/hooks/write' || pathname === '/api/hooks/write/';
}

export function newHookId(now = Date.now()) {
  return `h${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function parseHookPin(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    name: cleanLine(src.name, MAX_NAME),
    place: cleanLine(src.place, MAX_PLACE),
    note: cleanLine(src.note, MAX_NOTE),
    email: cleanEmail(src.email),
    company: cleanLine(src.company || src.fax_number_leave_blank, 80),
  };
}

export function parseHookWrite(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    hookId: cleanLine(src.hookId, 40),
    name: cleanLine(src.name, MAX_NAME),
    email: cleanEmail(src.email),
    message: cleanLine(src.message, MAX_MESSAGE),
    company: cleanLine(src.company || src.fax_number_leave_blank, 80),
  };
}

function isEmptyHoneypot(fields) {
  if (!fields.company) return false;
  const hasPin = !!(fields.name && fields.place && fields.note);
  const hasWrite = !!(fields.hookId && fields.name && fields.message);
  return !hasPin && !hasWrite;
}

export function validatePin(fields) {
  if (!fields.name) return 'Pick a name. Any name.';
  if (!fields.place) return 'Where do you ride, or where are you going?';
  if (!fields.note) return 'What are you offering, or what do you need?';
  return '';
}

export function validateWrite(fields) {
  if (!fields.hookId) return 'Missing pin.';
  if (!fields.name) return 'Pick a name. Any name.';
  if (!fields.message) return 'Write your offer.';
  return '';
}

export function publicOffer(offer) {
  if (!offer || typeof offer !== 'object') return null;
  const id = cleanLine(offer.id, 40);
  const name = cleanLine(offer.name, MAX_NAME);
  const note = cleanLine(offer.note || offer.message, MAX_MESSAGE);
  if (!id || !name || !note) return null;
  return {
    id,
    name,
    note,
    at: typeof offer.at === 'string' ? offer.at : '',
  };
}

export function publicHook(hook) {
  if (!hook || typeof hook !== 'object') return null;
  const id = cleanLine(hook.id, 40);
  const name = cleanLine(hook.name, MAX_NAME);
  if (!id || !name) return null;
  return {
    id,
    name,
    place: cleanLine(hook.place, MAX_PLACE),
    note: cleanLine(hook.note, MAX_NOTE),
    at: typeof hook.at === 'string' ? hook.at : '',
    offers: (Array.isArray(hook.offers) ? hook.offers : []).map(publicOffer).filter(Boolean),
  };
}

export function publicHookList(hooks) {
  return (Array.isArray(hooks) ? hooks : [])
    .map(publicHook)
    .filter(Boolean);
}

function boardPayload(hooks) {
  return {
    hooks: publicHookList(hooks),
    market: marketFromHooks(hooks),
    group: groupFromHooks(hooks),
  };
}

export function marketFromHooks(hooks) {
  const cards = [];
  for (const hook of publicHookList(hooks)) {
    cards.push({
      kind: 'stall',
      id: hook.id,
      hookId: hook.id,
      name: hook.name,
      place: hook.place,
      note: hook.note,
      at: hook.at,
      offerCount: hook.offers.length,
    });
    for (const offer of hook.offers) {
      cards.push({
        kind: 'offer',
        id: offer.id,
        hookId: hook.id,
        name: offer.name,
        place: hook.place,
        forName: hook.name,
        note: offer.note,
        at: offer.at,
      });
    }
  }
  cards.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return cards;
}

export function personKey(name) {
  return cleanLine(name, MAX_NAME).toLowerCase();
}

function nameHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function findCluster(parent, key) {
  let cursor = key;
  while (parent.get(cursor) !== cursor) {
    parent.set(cursor, parent.get(parent.get(cursor)));
    cursor = parent.get(cursor);
  }
  return cursor;
}

function personWeight(person) {
  return person.stalls.length * 10 + person.neighborKeys.length * 3 + person.offers.length;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function clampSpot(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/** Soft fold for free-text places — accents off, letters only. */
export function normalizePlace(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Approximate borough / neighbourhood spots inside a poetic Berlin outline
 * (percent of the group-room). Not GIS — “well, sort of.”
 */
const BERLIN_SPOTS = [
  { keys: ['mitte', 'alex', 'alexanderplatz', 'hackescher'], x: 48, y: 46, spread: 5 },
  { keys: ['kreuzberg', 'xberg', 'gorlitzer', 'goerlitzer', 'bergmann'], x: 50, y: 58, spread: 4.5 },
  { keys: ['friedrichshain', 'fhain', 'boxhagener', 'warschauer'], x: 60, y: 48, spread: 4.5 },
  { keys: ['prenzlauer', 'prenzlberg', 'prenzl', 'helmholtz', 'mauerpark'], x: 54, y: 36, spread: 4.5 },
  { keys: ['neukolln', 'neukoelln', 'weserstr', 'weser'], x: 56, y: 68, spread: 4.5 },
  { keys: ['charlottenburg', 'charlottenbg', 'kurfurstendamm', 'ku damm', 'kudamm', 'savignyplatz'], x: 28, y: 48, spread: 4.5 },
  { keys: ['wedding', 'leopoldplatz'], x: 40, y: 34, spread: 4 },
  { keys: ['moabit'], x: 38, y: 44, spread: 3.5 },
  { keys: ['schoneberg', 'schoeneberg', 'nollendorf'], x: 40, y: 60, spread: 4 },
  { keys: ['tempelhof', 'tempelhofer'], x: 48, y: 70, spread: 4 },
  { keys: ['steglitz'], x: 34, y: 72, spread: 3.5 },
  { keys: ['zehlendorf'], x: 22, y: 78, spread: 3.5 },
  { keys: ['wilmersdorf'], x: 30, y: 58, spread: 3.5 },
  { keys: ['pankow'], x: 52, y: 18, spread: 4 },
  { keys: ['reinickendorf', 'tegel'], x: 32, y: 22, spread: 4 },
  { keys: ['spandau'], x: 12, y: 42, spread: 4 },
  { keys: ['lichtenberg'], x: 72, y: 42, spread: 4 },
  { keys: ['marzahn'], x: 82, y: 32, spread: 3.5 },
  { keys: ['hellersdorf'], x: 90, y: 36, spread: 3.5 },
  { keys: ['treptow', 'treptower'], x: 68, y: 62, spread: 3.5 },
  { keys: ['kopenick', 'koepenick'], x: 82, y: 72, spread: 4 },
  { keys: ['weissensee', 'weißensee'], x: 62, y: 28, spread: 3.5 },
  { keys: ['friedenau'], x: 36, y: 66, spread: 3 },
  { keys: ['tiergarten'], x: 42, y: 50, spread: 3.5 },
  // Generic Berlin — centre of the outline, looser scatter
  { keys: ['berlin', 'berlijn', 'berlino'], x: 50, y: 50, spread: 9, generic: true },
];

const ELSEWHERE = { x: 88, y: 88, spread: 7 };

function matchBerlinSpot(folded) {
  if (!folded) return null;
  let generic = null;
  for (const spot of BERLIN_SPOTS) {
    for (const key of spot.keys) {
      if (folded === key || folded.includes(key)) {
        if (spot.generic) {
          generic = spot;
          break;
        }
        return spot;
      }
    }
  }
  return generic;
}

export function personHomePlace(person) {
  if (!person || typeof person !== 'object') return '';
  for (const stall of Array.isArray(person.stalls) ? person.stalls : []) {
    const place = cleanLine(stall?.place, MAX_PLACE);
    if (place) return place;
  }
  for (const offer of Array.isArray(person.offers) ? person.offers : []) {
    const place = cleanLine(offer?.place, MAX_PLACE);
    if (place) return place;
  }
  return '';
}

/**
 * Map a free-text place to approximate % coords in the group room.
 * Berlin / boroughs land inside the outline; everyone else soft-edges SE.
 */
export function spotFromPlace(place, key = '', index = 0) {
  const folded = normalizePlace(place);
  const base = matchBerlinSpot(folded) || ELSEWHERE;
  const inBerlin = base !== ELSEWHERE;
  const h = nameHash(`${key}|${folded}|${index}`);
  const spin = ((h % 628) / 100) + index * GOLDEN;
  const jitter = base.spread * (0.35 + ((h >>> 8) % 100) / 100);
  const ring = Math.min(base.spread * 1.15, 0.8 + Math.sqrt(index % 11) * (inBerlin ? 1.35 : 1.6));
  const r = jitter * (0.55 + ring / (base.spread + 0.01));
  const x = clampSpot(base.x + Math.cos(spin) * r, 5, 95);
  const y = clampSpot(base.y + Math.sin(spin) * r * 0.85, 8, 92);
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    inBerlin,
  };
}

function packCrowd(clusters) {
  clusters.forEach((members, index) => {
    members.forEach((person, j) => {
      const spot = spotFromPlace(personHomePlace(person), person.key, j);
      person.x = spot.x;
      person.y = spot.y;
      person.inBerlin = spot.inBerlin;
      person.cluster = index;
    });
  });
}

export function groupFromHooks(hooks) {
  const peopleMap = new Map();

  function ensure(name) {
    const key = personKey(name);
    if (!key) return null;
    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        key,
        name: cleanLine(name, MAX_NAME),
        stalls: [],
        offers: [],
        neighborKeys: [],
      });
    }
    return peopleMap.get(key);
  }

  function link(a, b) {
    if (!a || !b || a.key === b.key) return;
    if (!a.neighborKeys.includes(b.key)) a.neighborKeys.push(b.key);
    if (!b.neighborKeys.includes(a.key)) b.neighborKeys.push(a.key);
  }

  for (const hook of publicHookList(hooks)) {
    const host = ensure(hook.name);
    if (!host) continue;
    host.stalls.push({
      id: hook.id,
      place: hook.place,
      note: hook.note,
      at: hook.at,
      offerCount: hook.offers.length,
    });
    for (const offer of hook.offers) {
      const guest = ensure(offer.name);
      if (!guest) continue;
      guest.offers.push({
        id: offer.id,
        hookId: hook.id,
        forName: hook.name,
        forKey: host.key,
        place: hook.place,
        note: offer.note,
        at: offer.at,
      });
      link(host, guest);
    }
  }

  const people = [...peopleMap.values()];
  const parent = new Map(people.map((person) => [person.key, person.key]));
  for (const person of people) {
    for (const neighbor of person.neighborKeys) {
      const a = findCluster(parent, person.key);
      const b = findCluster(parent, neighbor);
      if (a !== b) parent.set(b, a);
    }
  }

  const buckets = new Map();
  for (const person of people) {
    const root = findCluster(parent, person.key);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(person);
  }

  const clusters = [...buckets.values()].map((members) => {
    members.sort((a, b) => personWeight(b) - personWeight(a) || a.name.localeCompare(b.name));
    return members;
  });
  clusters.sort((a, b) => personWeight(b[0]) - personWeight(a[0]) || a[0].name.localeCompare(b[0].name));

  packCrowd(clusters);

  return { people, clusters: clusters.map((members) => members.map((person) => person.key)) };
}

async function readHooks(env) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return [];
  try {
    const raw = await kv.get(HOOKS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeHooks(env, hooks) {
  const kv = env?.STATS;
  if (!kv || typeof kv.put !== 'function') {
    const err = new Error('The board is not wired yet.');
    err.code = 'E_STORE';
    throw err;
  }
  await kv.put(HOOKS_KEY, JSON.stringify(hooks.slice(0, MAX_HOOKS)));
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
      return Object.fromEntries(form.entries());
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

function clientKey(request, kind) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown';
  return `hooks:rate:${kind}:${ip}`;
}

async function underRateLimit(env, key, max) {
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
  if (hits.length >= max) return false;
  hits.push(now);
  await kv.put(key, JSON.stringify(hits), { expirationTtl: RATE_WINDOW_SEC + 60 });
  return true;
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendMail(env, { to, replyTo, subject, text, html, bcc }) {
  const key = resolveResendKey(env).key;
  if (!key) {
    const err = new Error('Mail is not wired on this Worker yet.');
    err.code = 'E_MAIL_NOT_CONFIGURED';
    throw err;
  }
  const body = {
    from: resolveResendFrom(env),
    to: [to],
    reply_to: replyTo,
    subject,
    text,
    html,
  };
  if (bcc) body.bcc = [bcc];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`);
    err.code = 'E_RESEND';
    throw err;
  }
}

async function notifyHenrikPin(env, hook) {
  const to = resolveContactTo(env);
    const subject = `Marketplace · new pin · ${hook.name}`;
  const text = [
    'Someone pinned themselves on the Soul Searchers board.',
    '',
    `Name: ${hook.name}`,
    `Place: ${hook.place}`,
    `Note: ${hook.note}`,
    hook.email ? `Email (hidden on the site): ${hook.email}` : 'No email left.',
    '',
    'https://thenewsoulsearchers.de/marketplace',
  ].join('\n');
  await sendMail(env, {
    to,
    replyTo: hook.email || CONTACT_FROM,
    subject,
    text,
    html: `<p>${esc(text).replace(/\n/g, '<br />')}</p>`,
  });
}

async function deliverWrite(env, hook, fields) {
  const subject = `Soul Searchers · a note from ${fields.name}`;
  const text = [
    `${fields.name} wrote you from the Soul Searchers board.`,
    '',
    fields.message,
    '',
    'Hit Reply to answer them. Your email was never on the public page.',
    'https://thenewsoulsearchers.de/marketplace',
  ].join('\n');
  await sendMail(env, {
    to: hook.email,
    replyTo: fields.email,
    subject,
    text,
    html: [
      '<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#122">',
      `<p style="margin:0 0 1rem">${esc(fields.name)} wrote you from the Soul Searchers board.</p>`,
      `<p style="white-space:pre-wrap;margin:0 0 1.25rem">${esc(fields.message)}</p>`,
      '<p style="color:#666;font-size:13px">Hit Reply to answer them. Your email was never on the public page.</p>',
      '</div>',
    ].join(''),
  });
}

export async function handleHooksRequest(request, env) {
  const url = new URL(request.url);
  if (!isHooksApiPath(url.pathname)) return null;

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

  if (request.method === 'GET' && !isHooksWritePath(url.pathname)) {
    const hooks = await readHooks(env);
    return json({
      ok: true,
      mailWired: mailReady(env),
      canModerate: await requestHasLooksAccess(request, env),
      ...boardPayload(hooks),
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }

  const body = await readJson(request);

  if (!isHooksWritePath(url.pathname) && body.action === 'remove') {
    if (!(await requestHasLooksAccess(request, env))) {
      return json({ error: 'private' }, 401);
    }
    const id = cleanLine(body.id, 40);
    const hooks = (await readHooks(env)).filter((hook) => hook.id !== id);
    await writeHooks(env, hooks);
    return json({ ok: true, ...boardPayload(hooks) });
  }

  if (isHooksWritePath(url.pathname)) {
    const fields = parseHookWrite(body);
    if (isEmptyHoneypot(fields)) {
      return json({ ok: true, ...boardPayload(await readHooks(env)) });
    }
    const bad = validateWrite(fields);
    if (bad) return json({ error: bad }, 400);
    if (!(await underRateLimit(env, clientKey(request, 'write'), RATE_WRITE))) {
      return json({ error: 'Easy. Try again in a few minutes.' }, 429);
    }
    const hooks = await readHooks(env);
    const index = hooks.findIndex((row) => row.id === fields.hookId);
    if (index === -1) {
      return json({ error: 'That pin is no longer on the board.' }, 404);
    }
    const hook = hooks[index];
    const offer = {
      id: newHookId(),
      name: fields.name,
      note: fields.message,
      email: fields.email,
      at: new Date().toISOString(),
    };
    hook.offers = [...(Array.isArray(hook.offers) ? hook.offers : []), offer].slice(-MAX_OFFERS);
    hooks[index] = hook;
    try {
      await writeHooks(env, hooks);
    } catch {
      return json({ error: 'The board could not save that offer.' }, 503);
    }
    if (cleanEmail(hook.email) && fields.email) {
      try {
        await deliverWrite(env, hook, fields);
      } catch {
        // The offer is on the board even if the inbox copy fails.
      }
    }
    return json({ ok: true, ...boardPayload(hooks) });
  }

  const fields = parseHookPin(body);
  if (isEmptyHoneypot(fields)) {
    return json({ ok: true, ...boardPayload(await readHooks(env)) });
  }
  const bad = validatePin(fields);
  if (bad) return json({ error: bad }, 400);
  if (!(await underRateLimit(env, clientKey(request, 'pin'), RATE_PIN))) {
    return json({ error: 'Easy. Try again in a few minutes.' }, 429);
  }

  const hook = {
    id: newHookId(),
    name: fields.name,
    place: fields.place,
    note: fields.note,
    email: fields.email,
    offers: [],
    at: new Date().toISOString(),
  };
  const hooks = [hook, ...(await readHooks(env))].slice(0, MAX_HOOKS);
  try {
    await writeHooks(env, hooks);
  } catch {
    return json({ error: 'The board could not save that just now.' }, 503);
  }
  try {
    await notifyHenrikPin(env, hook);
  } catch {
    // The pin is up even if the quiet copy to Henrik fails.
  }
  return json({ ok: true, ...boardPayload(hooks) });
}

export const testables = {
  HOOKS_KEY,
  MAX_HOOKS,
  MAX_OFFERS,
  publicHook,
  publicOffer,
  publicHookList,
  marketFromHooks,
  groupFromHooks,
  personKey,
  personHomePlace,
  normalizePlace,
  spotFromPlace,
  parseHookPin,
  parseHookWrite,
  validatePin,
  validateWrite,
};
