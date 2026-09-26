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
 * Approximate borough / neighbourhood spots inside the real Berlin outline
 * (percent of the city map before the universe zoom). Educated centroids.
 */
const BERLIN_SPOTS = [
  { keys: ['mitte', 'alex', 'alexanderplatz', 'hackescher'], x: 42, y: 43, spread: 4.5 },
  { keys: ['kreuzberg', 'xberg', 'gorlitzer', 'goerlitzer', 'bergmann'], x: 49, y: 56, spread: 4 },
  { keys: ['friedrichshain', 'fhain', 'boxhagener', 'warschauer'], x: 54, y: 46, spread: 4 },
  { keys: ['prenzlauer', 'prenzlberg', 'prenzl', 'helmholtz', 'mauerpark'], x: 50, y: 34, spread: 4 },
  { keys: ['neukolln', 'neukoelln', 'weserstr', 'weser'], x: 54, y: 68, spread: 4 },
  { keys: ['charlottenburg', 'charlottenbg', 'kurfurstendamm', 'ku damm', 'kudamm', 'savignyplatz'], x: 27, y: 48, spread: 4 },
  { keys: ['wedding', 'leopoldplatz'], x: 36, y: 36, spread: 3.5 },
  { keys: ['moabit'], x: 34, y: 44, spread: 3.2 },
  { keys: ['schoneberg', 'schoeneberg', 'nollendorf'], x: 40, y: 62, spread: 3.5 },
  { keys: ['tempelhof', 'tempelhofer'], x: 46, y: 70, spread: 3.5 },
  { keys: ['steglitz'], x: 28, y: 68, spread: 3.2 },
  { keys: ['zehlendorf', 'wannsee'], x: 18, y: 78, spread: 3.2 },
  { keys: ['wilmersdorf'], x: 30, y: 56, spread: 3.2 },
  { keys: ['pankow'], x: 52, y: 22, spread: 3.5 },
  { keys: ['reinickendorf', 'tegel'], x: 32, y: 26, spread: 3.5 },
  { keys: ['spandau'], x: 16, y: 45, spread: 3.8 },
  { keys: ['lichtenberg'], x: 62, y: 42, spread: 3.5 },
  { keys: ['marzahn'], x: 72, y: 38, spread: 3.2 },
  { keys: ['hellersdorf'], x: 78, y: 44, spread: 3.2 },
  { keys: ['treptow', 'treptower'], x: 66, y: 62, spread: 3.2 },
  { keys: ['kopenick', 'koepenick', 'mueggelsee', 'muggelsee'], x: 80, y: 76, spread: 3.8 },
  { keys: ['weissensee', 'weißensee'], x: 56, y: 30, spread: 3.2 },
  { keys: ['friedenau'], x: 36, y: 66, spread: 2.8 },
  { keys: ['tiergarten'], x: 38, y: 48, spread: 3.2 },
  { keys: ['berlin', 'berlijn', 'berlino'], x: 48, y: 48, spread: 8, generic: true },
];

/** Berlin stays the centre of the lil universe (map % before zoom). */
export const BERLIN_MAP_CENTER = { x: 50, y: 48 };
/** Half-size of the Berlin city map in those same units. */
const BERLIN_MAP_HALF = 42;
const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;

/**
 * Other places riders name — lat/lon so they land around Berlin by real direction.
 * Unknown places still join the map on a soft outer ring (hash angle).
 */
const WORLD_PLACES = [
  { keys: ['nice', 'nizza'], lat: 43.71, lon: 7.26 },
  { keys: ['cannes'], lat: 43.55, lon: 7.02 },
  { keys: ['monaco'], lat: 43.74, lon: 7.42 },
  { keys: ['marseille'], lat: 43.3, lon: 5.37 },
  { keys: ['lyon'], lat: 45.76, lon: 4.84 },
  { keys: ['paris'], lat: 48.86, lon: 2.35 },
  { keys: ['amsterdam'], lat: 52.37, lon: 4.9 },
  { keys: ['rotterdam'], lat: 51.92, lon: 4.48 },
  { keys: ['brugge', 'bruges'], lat: 51.21, lon: 3.22 },
  { keys: ['brussels', 'bruxelles', 'brussel'], lat: 50.85, lon: 4.35 },
  { keys: ['copenhagen', 'kopenhagen', 'kobenhavn'], lat: 55.68, lon: 12.57 },
  { keys: ['stockholm'], lat: 59.33, lon: 18.07 },
  { keys: ['oslo'], lat: 59.91, lon: 10.75 },
  { keys: ['london'], lat: 51.51, lon: -0.13 },
  { keys: ['edinburgh'], lat: 55.95, lon: -3.19 },
  { keys: ['prague', 'praha'], lat: 50.08, lon: 14.44 },
  { keys: ['vienna', 'wien'], lat: 48.21, lon: 16.37 },
  { keys: ['munich', 'munchen', 'muenchen'], lat: 48.14, lon: 11.58 },
  { keys: ['hamburg'], lat: 53.55, lon: 9.99 },
  { keys: ['cologne', 'koln', 'koeln'], lat: 50.94, lon: 6.96 },
  { keys: ['frankfurt'], lat: 50.11, lon: 8.68 },
  { keys: ['leipzig'], lat: 51.34, lon: 12.37 },
  { keys: ['dresden'], lat: 51.05, lon: 13.74 },
  { keys: ['zurich', 'zurich', 'zuerich'], lat: 47.38, lon: 8.54 },
  { keys: ['milan', 'milano'], lat: 45.46, lon: 9.19 },
  { keys: ['rome', 'roma'], lat: 41.9, lon: 12.5 },
  { keys: ['barcelona'], lat: 41.39, lon: 2.17 },
  { keys: ['madrid'], lat: 40.42, lon: -3.7 },
  { keys: ['lisbon', 'lisboa'], lat: 38.72, lon: -9.14 },
  { keys: ['mallorca', 'palma', 'palma de mallorca'], lat: 39.57, lon: 2.65 },
  { keys: ['girona'], lat: 41.98, lon: 2.82 },
  { keys: ['porto'], lat: 41.15, lon: -8.61 },
  { keys: ['new york', 'nyc', 'brooklyn'], lat: 40.71, lon: -74.01 },
  { keys: ['tokyo'], lat: 35.68, lon: 139.69 },
  { keys: ['sydney'], lat: -33.87, lon: 151.21 },
];

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

function matchWorldPlace(folded) {
  if (!folded) return null;
  for (const place of WORLD_PLACES) {
    for (const key of place.keys) {
      if (folded === key || folded.includes(key)) return place;
    }
  }
  return null;
}

function jitterAround(baseX, baseY, spread, key, index) {
  const h = nameHash(`${key}|${baseX}|${baseY}|${index}`);
  const spin = ((h % 628) / 100) + index * GOLDEN;
  const jitter = spread * (0.35 + ((h >>> 8) % 100) / 100);
  const ring = Math.min(spread * 1.15, 0.8 + Math.sqrt(index % 11) * 1.4);
  const r = jitter * (0.55 + ring / (spread + 0.01));
  return {
    x: baseX + Math.cos(spin) * r,
    y: baseY + Math.sin(spin) * r * 0.85,
  };
}

/** Compress real km so Nice sits outside Berlin without flying off the page. */
function worldRadiusFromKm(km) {
  return 1.2 + Math.log1p(Math.max(0, km) / 90) * 0.92;
}

/**
 * Map a free-text place into Berlin-centred world units (Berlin city ≈ ±1).
 * Final room % comes from layoutUniverse — Berlin stays the centre.
 */
export function spotFromPlace(place, key = '', index = 0) {
  const folded = normalizePlace(place);
  const berlin = matchBerlinSpot(folded);
  if (berlin) {
    const local = jitterAround(berlin.x, berlin.y, berlin.spread, key, index);
    return {
      wx: (local.x - BERLIN_MAP_CENTER.x) / BERLIN_MAP_HALF,
      wy: (local.y - BERLIN_MAP_CENTER.y) / BERLIN_MAP_HALF,
      inBerlin: true,
      placeLabel: folded || 'berlin',
    };
  }

  const world = matchWorldPlace(folded);
  const h = nameHash(`${key}|${folded}|${index}`);
  let east;
  let south;
  let radius;
  if (world) {
    const eastKm = (world.lon - BERLIN_LON) * 85;
    const northKm = (world.lat - BERLIN_LAT) * 111;
    const km = Math.hypot(eastKm, northKm) || 1;
    radius = worldRadiusFromKm(km);
    east = eastKm / km;
    south = -northKm / km;
  } else {
    // Unknown town still joins the universe on an outer ring — Berlin stays centre.
    const angle = ((h % 6283) / 1000) + index * 0.37;
    radius = 1.55 + ((h >>> 5) % 90) / 100;
    east = Math.sin(angle);
    south = Math.cos(angle);
  }
  const wobble = 0.08 + ((h >>> 11) % 40) / 400;
  const spin = ((h % 500) / 100) + index * 0.2;
  return {
    wx: east * radius + Math.cos(spin) * wobble,
    wy: south * radius + Math.sin(spin) * wobble * 0.85,
    inBerlin: false,
    placeLabel: folded || 'somewhere',
  };
}

/**
 * Fit everyone into the room with Berlin locked at the centre.
 * When only Berlin is present, zoom ≈ 1. When Nice (or more) joins, the
 * map pulls back so the new place appears — Berlin remains the heart.
 */
export function layoutUniverse(people) {
  const list = Array.isArray(people) ? people : [];
  let maxR = 1;
  for (const person of list) {
    const r = Math.hypot(Number(person.wx) || 0, Number(person.wy) || 0);
    if (r > maxR) maxR = r;
  }
  maxR *= 1.12;
  const zoom = 1 / maxR;
  const half = BERLIN_MAP_HALF * zoom;

  for (const person of list) {
    const wx = Number(person.wx) || 0;
    const wy = Number(person.wy) || 0;
    person.x = Math.round(clampSpot(BERLIN_MAP_CENTER.x + wx * half, 4, 96) * 10) / 10;
    person.y = Math.round(clampSpot(BERLIN_MAP_CENTER.y + wy * half, 6, 94) * 10) / 10;
  }

  return {
    zoom: Math.round(zoom * 1000) / 1000,
    center: { ...BERLIN_MAP_CENTER },
  };
}

function packCrowd(clusters) {
  const people = [];
  clusters.forEach((members, index) => {
    members.forEach((person, j) => {
      const spot = spotFromPlace(personHomePlace(person), person.key, j);
      person.wx = spot.wx;
      person.wy = spot.wy;
      person.inBerlin = spot.inBerlin;
      person.cluster = index;
      people.push(person);
    });
  });
  return layoutUniverse(people);
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

  const universe = packCrowd(clusters);

  return {
    people,
    clusters: clusters.map((members) => members.map((person) => person.key)),
    universe,
  };
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
  layoutUniverse,
  BERLIN_MAP_CENTER,
  parseHookPin,
  parseHookWrite,
  validatePin,
  validateWrite,
};
