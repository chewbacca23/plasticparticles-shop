/**
 * Riders marketplace. Room for a thousand people. Ride together, or trade
 * a tire, a stem, a saddle, a frame. Emails never appear on the page.
 *
 * GET  /api/hooks           public stalls + market + group dots + call threads (no emails)
 * POST /api/hooks           pin { name, place, note, email?, company }
 * POST /api/hooks           { action: 'remove', id } — Henrik, Looks cookie
 * POST /api/hooks/write     offer { hookId, name, message, email?, company }
 * POST /api/hooks/call      call upon { toKey, name, message, email?, place?, company }
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
const MAX_CALL_TEXT = 500;
export const MAX_HOOKS = 1000;
export const MAX_OFFERS = 80;
export const MAX_CALL_THREADS = 500;
export const MAX_CALL_MESSAGES = 40;
/** Map distance (% of room) for “nearby” without GPS. */
export const NEAR_MAP_DIST = 14;
const RATE_WINDOW_SEC = 60 * 10;
const RATE_PIN = 3;
const RATE_WRITE = 8;
const RATE_CALL = 10;

export function isHooksApiPath(pathname) {
  return (
    pathname === '/api/hooks' ||
    pathname === '/api/hooks/' ||
    pathname === '/api/hooks/write' ||
    pathname === '/api/hooks/write/' ||
    pathname === '/api/hooks/call' ||
    pathname === '/api/hooks/call/'
  );
}

export function isHooksWritePath(pathname) {
  return pathname === '/api/hooks/write' || pathname === '/api/hooks/write/';
}

export function isHooksCallPath(pathname) {
  return pathname === '/api/hooks/call' || pathname === '/api/hooks/call/';
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

export function parseHookCall(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    toKey: personKey(src.toKey || src.to || ''),
    name: cleanLine(src.name, MAX_NAME),
    email: cleanEmail(src.email),
    place: cleanLine(src.place, MAX_PLACE),
    message: cleanLine(src.message || src.text || src.note, MAX_CALL_TEXT),
    company: cleanLine(src.company || src.fax_number_leave_blank, 80),
  };
}

function isEmptyHoneypot(fields) {
  if (!fields.company) return false;
  const hasPin = !!(fields.name && fields.place && fields.note);
  const hasWrite = !!(fields.hookId && fields.name && fields.message);
  const hasCall = !!(fields.toKey && fields.name && fields.message);
  return !hasPin && !hasWrite && !hasCall;
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

export function validateCall(fields) {
  if (!fields.toKey) return 'Who are you calling upon?';
  if (!fields.name) return 'Pick a name. Any name.';
  if (!fields.message) return 'Say a little something.';
  return '';
}

/** Stable pair id for a 1:1 call-upon thread. */
export function callPairKey(a, b) {
  const left = personKey(a);
  const right = personKey(b);
  if (!left || !right || left === right) return '';
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

export function publicCallMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const id = cleanLine(msg.id, 40);
  const fromName = cleanLine(msg.fromName || msg.name, MAX_NAME);
  const fromKey = personKey(msg.fromKey || fromName);
  const text = cleanLine(msg.text || msg.message || msg.note, MAX_CALL_TEXT);
  if (!id || !fromName || !fromKey || !text) return null;
  return {
    id,
    fromKey,
    fromName,
    text,
    at: typeof msg.at === 'string' ? msg.at : '',
  };
}

export function publicCallThread(thread) {
  if (!thread || typeof thread !== 'object') return null;
  const aKey = personKey(thread.aKey || thread.a);
  const bKey = personKey(thread.bKey || thread.b);
  const id = cleanLine(thread.id, 120) || callPairKey(aKey, bKey);
  if (!id || !aKey || !bKey || aKey === bKey) return null;
  const messages = (Array.isArray(thread.messages) ? thread.messages : [])
    .map(publicCallMessage)
    .filter(Boolean);
  return { id, aKey, bKey, messages };
}

export function publicCallList(calls) {
  return (Array.isArray(calls) ? calls : []).map(publicCallThread).filter(Boolean);
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

function boardPayload(hooks, calls = []) {
  return {
    hooks: publicHookList(hooks),
    market: marketFromHooks(hooks),
    group: groupFromHooks(hooks),
    calls: publicCallList(calls),
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
  { keys: ['kreuzberg', 'xberg', 'gorlitzer', 'goerlitzer', 'bergmann', 'bar italia', 'baritalia'], x: 49, y: 56, spread: 4 },
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

/** One-letter slip on a borough name still lands in the city, not the south edge. */
function almostPlaceKey(token, key) {
  if (!token || !key || key.includes(' ')) return false;
  if (token === key) return true;
  if (token.length < 4 || key.length < 4) return false;
  if (Math.abs(token.length - key.length) > 1) return false;
  let misses = 0;
  if (token.length === key.length) {
    for (let i = 0; i < token.length; i += 1) {
      if (token[i] !== key[i]) misses += 1;
      if (misses > 1) return false;
    }
    return true;
  }
  const longer = token.length > key.length ? token : key;
  const shorter = token.length > key.length ? key : token;
  let i = 0;
  let j = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
      continue;
    }
    i += 1;
    misses += 1;
    if (misses > 1) return false;
  }
  return true;
}

function matchBerlinSpot(folded) {
  if (!folded) return null;
  let generic = null;
  let fuzzy = null;
  const tokens = folded.split(' ').filter(Boolean);
  for (const spot of BERLIN_SPOTS) {
    for (const key of spot.keys) {
      if (folded === key || folded.includes(key)) {
        if (spot.generic) {
          generic = spot;
          break;
        }
        return spot;
      }
      if (!fuzzy && !spot.generic) {
        for (const token of tokens) {
          if (almostPlaceKey(token, key)) {
            fuzzy = spot;
            break;
          }
        }
      }
    }
  }
  return fuzzy || generic;
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
    // Unknown town still joins — close ring so one typo does not sink the map.
    const angle = ((h % 6283) / 1000) + index * 0.37;
    radius = 1.08 + ((h >>> 5) % 40) / 200;
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

/**
 * Same place, offer-neighbour, shared crowd cluster, or close on the map.
 * No live GPS — only what the board already knows.
 */
export function arePeopleNear(a, b, maxDist = NEAR_MAP_DIST) {
  if (!a || !b || a.key === b.key) return false;
  if ((a.neighborKeys || []).includes(b.key) || (b.neighborKeys || []).includes(a.key)) {
    return true;
  }
  if (
    typeof a.cluster === 'number' &&
    typeof b.cluster === 'number' &&
    a.cluster === b.cluster
  ) {
    return true;
  }
  const placeA = normalizePlace(personHomePlace(a));
  const placeB = normalizePlace(personHomePlace(b));
  if (placeA && placeB && placeA === placeB) return true;
  const ax = Number(a.x);
  const ay = Number(a.y);
  const bx = Number(b.x);
  const by = Number(b.y);
  if ([ax, ay, bx, by].every((n) => Number.isFinite(n))) {
    if (Math.hypot(ax - bx, ay - by) <= maxDist) return true;
  }
  return false;
}

/** Caller may be on the map, or only known by a place they typed. */
export function canCallUpon(group, fromKey, toKey, fromPlace = '') {
  const people = Array.isArray(group?.people) ? group.people : [];
  const to = people.find((person) => person.key === toKey);
  if (!to) return false;
  const from = people.find((person) => person.key === fromKey);
  if (from) return arePeopleNear(from, to);
  const place = normalizePlace(fromPlace);
  if (!place) return false;
  const toPlace = normalizePlace(personHomePlace(to));
  if (place && toPlace && place === toPlace) return true;
  // Soft: same Berlin borough token or shared world place label.
  if (place && toPlace) {
    const aTokens = place.split(' ').filter(Boolean);
    const bTokens = toPlace.split(' ').filter(Boolean);
    if (aTokens.some((token) => token.length > 3 && bTokens.includes(token))) return true;
  }
  return false;
}

export function emailForPersonKey(hooks, calls, key) {
  const want = personKey(key);
  if (!want) return '';
  for (const hook of Array.isArray(hooks) ? hooks : []) {
    if (personKey(hook.name) === want) {
      const mail = cleanEmail(hook.email);
      if (mail) return mail;
    }
    for (const offer of Array.isArray(hook.offers) ? hook.offers : []) {
      if (personKey(offer.name) === want) {
        const mail = cleanEmail(offer.email);
        if (mail) return mail;
      }
    }
  }
  for (const thread of Array.isArray(calls) ? calls : []) {
    for (const msg of Array.isArray(thread.messages) ? thread.messages : []) {
      if (personKey(msg.fromKey || msg.fromName) === want) {
        const mail = cleanEmail(msg.email);
        if (mail) return mail;
      }
    }
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

async function readBoard(env) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return { hooks: [], calls: [] };
  try {
    const raw = await kv.get(HOOKS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) return { hooks: data, calls: [] };
    if (data && typeof data === 'object') {
      return {
        hooks: Array.isArray(data.hooks) ? data.hooks : [],
        calls: Array.isArray(data.calls) ? data.calls : [],
      };
    }
    return { hooks: [], calls: [] };
  } catch {
    return { hooks: [], calls: [] };
  }
}

async function readHooks(env) {
  const board = await readBoard(env);
  return board.hooks;
}

async function writeBoard(env, board) {
  const kv = env?.STATS;
  if (!kv || typeof kv.put !== 'function') {
    const err = new Error('The board is not wired yet.');
    err.code = 'E_STORE';
    throw err;
  }
  const hooks = (Array.isArray(board?.hooks) ? board.hooks : []).slice(0, MAX_HOOKS);
  const calls = (Array.isArray(board?.calls) ? board.calls : []).slice(0, MAX_CALL_THREADS);
  await kv.put(HOOKS_KEY, JSON.stringify({ hooks, calls }));
}

async function writeHooks(env, hooks) {
  const board = await readBoard(env);
  board.hooks = hooks;
  await writeBoard(env, board);
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

async function deliverCall(env, { toEmail, fromName, fromEmail, message, toName }) {
  const subject = `Soul Searchers · ${fromName} called upon you`;
  const text = [
    `${fromName} called upon you on the Soul Searchers marketplace.`,
    toName ? `(For ${toName}.)` : '',
    '',
    message,
    '',
    'Answer on the board, or hit Reply if you want the inbox path.',
    'Your email was never on the public page.',
    'https://thenewsoulsearchers.de/marketplace',
  ]
    .filter(Boolean)
    .join('\n');
  await sendMail(env, {
    to: toEmail,
    replyTo: fromEmail,
    subject,
    text,
    html: [
      '<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#122">',
      `<p style="margin:0 0 1rem">${esc(fromName)} called upon you on the Soul Searchers marketplace.</p>`,
      `<p style="white-space:pre-wrap;margin:0 0 1.25rem">${esc(message)}</p>`,
      '<p style="color:#666;font-size:13px">Answer on the board, or hit Reply. Your email was never on the public page.</p>',
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

  if (request.method === 'GET' && !isHooksWritePath(url.pathname) && !isHooksCallPath(url.pathname)) {
    const board = await readBoard(env);
    return json({
      ok: true,
      mailWired: mailReady(env),
      canModerate: await requestHasLooksAccess(request, env),
      ...boardPayload(board.hooks, board.calls),
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }

  const body = await readJson(request);

  if (
    !isHooksWritePath(url.pathname) &&
    !isHooksCallPath(url.pathname) &&
    body.action === 'remove'
  ) {
    if (!(await requestHasLooksAccess(request, env))) {
      return json({ error: 'private' }, 401);
    }
    const id = cleanLine(body.id, 40);
    const board = await readBoard(env);
    board.hooks = board.hooks.filter((hook) => hook.id !== id);
    await writeBoard(env, board);
    return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
  }

  if (isHooksCallPath(url.pathname)) {
    const fields = parseHookCall(body);
    if (isEmptyHoneypot(fields)) {
      const board = await readBoard(env);
      return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
    }
    const bad = validateCall(fields);
    if (bad) return json({ error: bad }, 400);
    if (!(await underRateLimit(env, clientKey(request, 'call'), RATE_CALL))) {
      return json({ error: 'Easy. Try again in a few minutes.' }, 429);
    }

    const board = await readBoard(env);
    const group = groupFromHooks(board.hooks);
    const toPerson = group.people.find((person) => person.key === fields.toKey);
    if (!toPerson) {
      return json({ error: 'That soul is no longer on the map.' }, 404);
    }

    const fromKey = personKey(fields.name);
    if (!fromKey || fromKey === fields.toKey) {
      return json({ error: 'Call upon someone else, brother.' }, 400);
    }

    const pair = callPairKey(fromKey, fields.toKey);
    let thread = board.calls.find((row) => row.id === pair);
    const alreadyTalking = !!(thread && Array.isArray(thread.messages) && thread.messages.length);
    if (!alreadyTalking && !canCallUpon(group, fromKey, fields.toKey, fields.place)) {
      return json(
        {
          error:
            'Call upon someone near you — same place, standing close, or someone you already wrote.',
        },
        400,
      );
    }

    const message = {
      id: newHookId(),
      fromKey,
      fromName: fields.name,
      text: fields.message,
      email: fields.email,
      at: new Date().toISOString(),
    };

    if (!thread) {
      thread = {
        id: pair,
        aKey: fromKey < fields.toKey ? fromKey : fields.toKey,
        bKey: fromKey < fields.toKey ? fields.toKey : fromKey,
        messages: [],
      };
      board.calls = [thread, ...board.calls].slice(0, MAX_CALL_THREADS);
    }
    thread.messages = [...(Array.isArray(thread.messages) ? thread.messages : []), message].slice(
      -MAX_CALL_MESSAGES,
    );
    const threadIndex = board.calls.findIndex((row) => row.id === pair);
    if (threadIndex >= 0) board.calls[threadIndex] = thread;

    try {
      await writeBoard(env, board);
    } catch {
      return json({ error: 'The board could not save that call.' }, 503);
    }

    const toEmail = emailForPersonKey(board.hooks, board.calls, fields.toKey);
    if (toEmail && fields.email) {
      try {
        await deliverCall(env, {
          toEmail,
          fromName: fields.name,
          fromEmail: fields.email,
          message: fields.message,
          toName: toPerson.name,
        });
      } catch {
        // The call is on the board even if the inbox copy fails.
      }
    }

    return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
  }

  if (isHooksWritePath(url.pathname)) {
    const fields = parseHookWrite(body);
    if (isEmptyHoneypot(fields)) {
      const board = await readBoard(env);
      return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
    }
    const bad = validateWrite(fields);
    if (bad) return json({ error: bad }, 400);
    if (!(await underRateLimit(env, clientKey(request, 'write'), RATE_WRITE))) {
      return json({ error: 'Easy. Try again in a few minutes.' }, 429);
    }
    const board = await readBoard(env);
    const index = board.hooks.findIndex((row) => row.id === fields.hookId);
    if (index === -1) {
      return json({ error: 'That pin is no longer on the board.' }, 404);
    }
    const hook = board.hooks[index];
    const offer = {
      id: newHookId(),
      name: fields.name,
      note: fields.message,
      email: fields.email,
      at: new Date().toISOString(),
    };
    hook.offers = [...(Array.isArray(hook.offers) ? hook.offers : []), offer].slice(-MAX_OFFERS);
    board.hooks[index] = hook;
    try {
      await writeBoard(env, board);
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
    return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
  }

  const fields = parseHookPin(body);
  if (isEmptyHoneypot(fields)) {
    const board = await readBoard(env);
    return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
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
  const board = await readBoard(env);
  board.hooks = [hook, ...board.hooks].slice(0, MAX_HOOKS);
  try {
    await writeBoard(env, board);
  } catch {
    return json({ error: 'The board could not save that just now.' }, 503);
  }
  try {
    await notifyHenrikPin(env, hook);
  } catch {
    // The pin is up even if the quiet copy to Henrik fails.
  }
  return json({ ok: true, ...boardPayload(board.hooks, board.calls) });
}

export const testables = {
  HOOKS_KEY,
  MAX_HOOKS,
  MAX_OFFERS,
  MAX_CALL_THREADS,
  MAX_CALL_MESSAGES,
  publicHook,
  publicOffer,
  publicHookList,
  publicCallThread,
  publicCallList,
  publicCallMessage,
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
  parseHookCall,
  validatePin,
  validateWrite,
  validateCall,
  callPairKey,
  arePeopleNear,
  canCallUpon,
  emailForPersonKey,
};
