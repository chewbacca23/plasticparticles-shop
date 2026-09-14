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
