/**
 * Turn a place name into lat/lng for Where I stood pins.
 * Uses a local cache first, then free OpenStreetMap Nominatim (no API key).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type StoodCoords = { lat: number; lng: number };

const CACHE_PATH = join(process.cwd(), 'src/data/stood-geocode.json');
const memory = new Map<string, StoodCoords | null>();
let queue: Promise<void> = Promise.resolve();

function cacheKey(place: string) {
  return place.trim().replace(/\s+/g, ' ');
}

function loadCache(): Record<string, StoodCoords> {
  try {
    if (!existsSync(CACHE_PATH)) return {};
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveCache(data: Record<string, StoodCoords>) {
  try {
    writeFileSync(CACHE_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  } catch {
    // Cloudflare / read-only builds can skip writing — fetch still works that run.
  }
}

function lookupCache(place: string): StoodCoords | null {
  const key = cacheKey(place);
  const data = loadCache();
  if (data[key]) return data[key];
  // soft match without middle dots
  const soft = key.replace(/\s*·\s*/g, ' ');
  for (const [name, coords] of Object.entries(data)) {
    if (name.replace(/\s*·\s*/g, ' ').toLowerCase() === soft.toLowerCase()) return coords;
  }
  return null;
}

function remember(place: string, coords: StoodCoords) {
  const key = cacheKey(place);
  const data = loadCache();
  data[key] = coords;
  saveCache(data);
  memory.set(key, coords);
}

async function nominatim(place: string): Promise<StoodCoords | null> {
  const query = cacheKey(place).replace(/\s*·\s*/g, ', ');
  if (!query) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'TheSoulSearchersBlog/1.0 (https://thenewsoulsearchers.de; hello@thenewsoulsearchers.de)',
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const row = Array.isArray(rows) ? rows[0] : null;
  const lat = row?.lat != null ? Number(row.lat) : NaN;
  const lng = row?.lon != null ? Number(row.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100)),
  );
  return run;
}

/**
 * Prefer explicit lat/lng. Otherwise geocode the place name (free, no key).
 */
export async function resolveStoodCoords(options: {
  place: string;
  lat?: number;
  lng?: number;
}): Promise<StoodCoords | null> {
  const { place, lat, lng } = options;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat: lat as number, lng: lng as number };
  }
  const key = cacheKey(place);
  if (!key) return null;
  if (memory.has(key)) return memory.get(key) ?? null;
  const cached = lookupCache(key);
  if (cached) {
    memory.set(key, cached);
    return cached;
  }
  return enqueue(async () => {
    if (memory.has(key)) return memory.get(key) ?? null;
    const again = lookupCache(key);
    if (again) {
      memory.set(key, again);
      return again;
    }
    try {
      const found = await nominatim(key);
      if (found) remember(key, found);
      else memory.set(key, null);
      return found;
    } catch {
      memory.set(key, null);
      return null;
    }
  });
}
