/** Keep in sync with public/admin/shrink-on-pick.js */

export const MAX_UPLOAD_BYTES = 900_000;

export function shouldAttemptShrink(file: {
  name: string;
  type?: string;
  size: number;
}): boolean {
  const name = file.name || '';
  const type = (file.type || '').toLowerCase();
  if (isHeic(name, type)) return true;
  if (!isRaster(name, type)) return false;
  return file.size > MAX_UPLOAD_BYTES;
}

export function isHeic(name: string, type = ''): boolean {
  const t = type.toLowerCase();
  return t.includes('heic') || t.includes('heif') || /\.(heic|heif)$/i.test(name);
}

export function isRaster(name: string, type = ''): boolean {
  const t = type.toLowerCase();
  return (
    /image\/(jpeg|jpg|pjpeg|png|webp)/i.test(t) ||
    /\.(jpe?g|png|webp)$/i.test(name)
  );
}

export function jpegNameFor(name: string): string {
  return name.replace(/\.(heic|heif)$/i, '.jpg');
}

/**
 * The live editor sets img src to /stories/foo.jpg on thenewsoulsearchers.de.
 * Cloudflare has not rebuilt yet, so that URL 404s and you get the broken
 * image. GitHub already has the file. Public raw URLs do not wait for a rebuild.
 */
export function storiesRawUrl(
  src: string,
  repo = 'chewbacca23/thenewsoulsearchersblog',
): string | null {
  const fromPublic = src.match(/public\/stories\/([^/?#]+)/i);
  const fromStories = src.match(
    /(?:^|\/)stories\/([^/?#]+\.(?:jpe?g|png|webp|gif|heic|heif))/i,
  );
  const file = (fromPublic || fromStories)?.[1];
  if (!file) return null;
  return `https://raw.githubusercontent.com/${repo}/main/public/stories/${file}`;
}

export function editorThumbSrc(src: string, hostname: string): string | null {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) return null;
  if (src.includes('raw.githubusercontent.com')) return null;
  return storiesRawUrl(src);
}

export function isGitHubBlobPostUrl(url: string): boolean {
  return /api\.github\.com\/repos\/.+\/git\/blobs\/?(\?|$)/i.test(url);
}

export function isGitHubContentsImageUrl(src: string): boolean {
  return /api\.github\.com\/repos\/.+\/contents\//i.test(src);
}
