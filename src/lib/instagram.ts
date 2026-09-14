export type InstagramSettings = {
  handle?: string | null;
  latestPost?: string | null;
};

export type InstagramPost = {
  permalink: string;
  kind: 'p' | 'reel';
};

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const RESERVED = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'about']);

/** Username only, or pulled out of a profile URL. No @. */
export function cleanHandle(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const fromUrl = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = (fromUrl?.[1] ?? trimmed).replace(/^@/, '').replace(/\/+$/, '');
  if (!HANDLE_RE.test(handle)) return null;
  if (RESERVED.has(handle.toLowerCase())) return null;
  return handle;
}

export function instagramProfileUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

/** Share → Copy link from a public photo or reel. */
export function parseInstagramPost(raw?: string | null): InstagramPost | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const match = trimmed.match(
    /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels)\/([A-Za-z0-9_-]+)/i,
  );
  if (!match) return null;

  const kind = match[1].toLowerCase() === 'p' ? 'p' : 'reel';
  return {
    permalink: `https://www.instagram.com/${kind}/${match[2]}/`,
    kind,
  };
}

export function instagramBind(settings: InstagramSettings): {
  handle: string;
  profileUrl: string;
  post: InstagramPost | null;
} | null {
  const handle = cleanHandle(settings.handle);
  if (!handle) return null;
  return {
    handle,
    profileUrl: instagramProfileUrl(handle),
    post: parseInstagramPost(settings.latestPost),
  };
}
