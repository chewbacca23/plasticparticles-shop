import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Resolve `public/` against the project root. Anchoring to `import.meta.url`
 * breaks once Astro bundles this module into `dist/chunks`, so prefer the
 * working directory and keep the module-relative path as a fallback.
 */
function resolvePublicDir(): string {
  const candidates = [
    path.join(process.cwd(), 'public'),
    fileURLToPath(new URL('../../public/', import.meta.url)),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

const publicDir = resolvePublicDir();

/**
 * Photos get deleted from the CMS media library without touching the rides
 * that point at them, so a referenced file may simply be gone. Check at build
 * time rather than shipping a broken <img>.
 */
export function mediaExists(mediaPath?: string | null): boolean {
  if (!mediaPath) return false;
  if (/^(https?:)?\/\//.test(mediaPath)) return true;

  let relative = mediaPath.replace(/^\/+/, '');
  try {
    relative = decodeURIComponent(relative);
  } catch {
    // A malformed escape means this is not a path we wrote; treat as missing.
    return false;
  }
  if (relative === '') return false;

  const resolved = path.resolve(publicDir, relative);
  // Keep the lookup inside public/ even if a path contains "..".
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) return false;

  return existsSync(resolved);
}

/** Keep only the gallery entries whose files are still present. */
export function existingMedia(paths: readonly (string | null | undefined)[]): string[] {
  return paths.filter((entry): entry is string => mediaExists(entry));
}

/**
 * Photos for a ride page, cover first. The cover is included because a ride
 * whose gallery still lists deleted files would otherwise show nothing even
 * after a new cover is chosen in the editor.
 */
export function galleryMedia(
  cover: string | null | undefined,
  gallery: readonly (string | null | undefined)[] = [],
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const entry of existingMedia([cover, ...gallery])) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    unique.push(entry);
  }
  return unique;
}
