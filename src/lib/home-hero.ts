import { mediaExists } from './media.ts';

/**
 * Home opens on one full-bleed road photo. Prefer the shot Henrik picks in
 * Site → Home. If that field is empty or the file is gone, use the newest
 * Now photo so the page still feels like the ride.
 */
export function resolveHomeHero(
  preferred?: string | null,
  fallbacks: readonly (string | null | undefined)[] = [],
): string | null {
  const picked = String(preferred || '').trim();
  if (picked && mediaExists(picked)) return picked;

  for (const entry of fallbacks) {
    const photo = String(entry || '').trim();
    if (photo && mediaExists(photo)) return photo;
  }

  return null;
}

/** Soft default dia: Nice promenade, café cup, Henrik, little moped. */
export const DEFAULT_HERO_SLIDES = [
  '/stories/img_6372.jpeg',
  '/stories/img_5940.jpg',
  '/stories/img_1442.jpeg',
  '/stories/img_5956.jpg',
] as const;

/**
 * Same scene as a hero slide. Keep these off Now so the café cups and the
 * promenade portrait do not sit beside the dia (or next to each other).
 */
export const HERO_ONCE_EXTRAS = [
  '/stories/img_6344.jpg',
  '/stories/nice-promenade-detail.jpg',
] as const;

const HERO_SLIDE_LIMIT = 6;

function uniqueExisting(paths: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of paths) {
    const photo = String(entry || '').trim();
    if (!photo || seen.has(photo) || !mediaExists(photo)) continue;
    seen.add(photo);
    out.push(photo);
  }
  return out;
}

function parseCmsSlides(heroSlides: unknown): string[] {
  if (!Array.isArray(heroSlides)) return [];
  return uniqueExisting(
    heroSlides.map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const rec = entry as { slide?: string; image?: string; photo?: string };
        return String(rec.slide || rec.image || rec.photo || '').trim();
      }
      return '';
    }),
  );
}

/** Drop photos the home dia already shows, plus the extra cup and portrait. */
export function feedWithoutHeroRepeats<T extends { photo: string }>(
  items: readonly T[],
  heroSlides: readonly string[] = [],
): T[] {
  const hide = new Set<string>([...heroSlides, ...HERO_ONCE_EXTRAS]);
  return items.filter((item) => !hide.has(item.photo));
}

/**
 * Rotate the dia so each calendar day opens on a different shot. Static
 * builds freeze at deploy time; pass Date.now() from the client when needed.
 */
export function rotateSlidesForDay(
  slides: readonly string[],
  dayMs: number = Date.now(),
): string[] {
  if (slides.length < 2) return [...slides];
  const offset = Math.floor(dayMs / 86_400_000) % slides.length;
  return [...slides.slice(offset), ...slides.slice(0, offset)];
}

/**
 * Up to a few full-bleed hero slides for the home dia.
 * Newest Now photos lead so occasional fans catch fresh road shots;
 * CMS Site → Home picks and soft defaults fill any gaps.
 */
export function resolveHomeHeroSlides(
  settings: { heroPhoto?: string | null; heroSlides?: unknown } = {},
  fallbacks: readonly (string | null | undefined)[] = [],
): string[] {
  const fromCms = parseCmsSlides(settings.heroSlides);
  const fromFeed = uniqueExisting(fallbacks);
  const defaults = uniqueExisting(DEFAULT_HERO_SLIDES);

  const pool: string[] = [];
  for (const source of [fromFeed, fromCms, defaults]) {
    for (const photo of source) {
      if (pool.includes(photo)) continue;
      pool.push(photo);
      if (pool.length >= HERO_SLIDE_LIMIT) return pool;
    }
  }

  if (pool.length >= 2) return pool;

  const single = resolveHomeHero(settings.heroPhoto, fallbacks);
  return single ? [single] : [];
}
