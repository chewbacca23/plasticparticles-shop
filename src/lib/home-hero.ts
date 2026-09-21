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

/** Drop photos the home dia already shows, plus the extra cup and portrait. */
export function feedWithoutHeroRepeats<T extends { photo: string }>(
  items: readonly T[],
  heroSlides: readonly string[] = [],
): T[] {
  const hide = new Set<string>([...heroSlides, ...HERO_ONCE_EXTRAS]);
  return items.filter((item) => !hide.has(item.photo));
}

/**
 * Up to a few full-bleed hero slides for the home dia. CMS list first,
 * else the single hero photo, else the default three, else Now fallbacks.
 */
export function resolveHomeHeroSlides(
  settings: { heroPhoto?: string | null; heroSlides?: unknown } = {},
  fallbacks: readonly (string | null | undefined)[] = [],
): string[] {
  const fromCms = Array.isArray(settings.heroSlides)
    ? settings.heroSlides
        .map((entry) => {
          if (typeof entry === 'string') return entry.trim();
          if (entry && typeof entry === 'object') {
            const rec = entry as { slide?: string; image?: string; photo?: string };
            return String(rec.slide || rec.image || rec.photo || '').trim();
          }
          return '';
        })
        .filter((photo) => photo && mediaExists(photo))
    : [];

  if (fromCms.length > 0) return [...new Set(fromCms)].slice(0, 6);

  const single = resolveHomeHero(settings.heroPhoto, fallbacks);
  const defaults = DEFAULT_HERO_SLIDES.filter((photo) => mediaExists(photo));

  if (defaults.length >= 2) {
    // Keep a custom single hero first when Henrik picked one that is not already in the dia.
    if (single && !defaults.includes(single as (typeof DEFAULT_HERO_SLIDES)[number])) {
      return [single, ...defaults].slice(0, 6);
    }
    return [...defaults];
  }

  return single ? [single] : [];
}
