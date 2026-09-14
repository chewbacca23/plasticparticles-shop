/**
 * Ride photos: one first photo at the top, the rest sit inside the story.
 * Photos already written into Ride text stay where they are.
 */

const IMAGE_MD = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const IMAGE_IN_MD = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const IMAGE_IN_HTML = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;

export function safePhotoSrc(src) {
  const value = String(src || '').trim();
  if (!value || value.includes('..')) return '';
  if (!value.startsWith('/stories/')) return '';
  if (/[\s<>"'\\]/.test(value)) return '';
  return value;
}

export function bodyImagePaths(body) {
  const text = String(body || '');
  const found = [];
  const seen = new Set();
  for (const match of text.matchAll(IMAGE_IN_MD)) {
    const src = safePhotoSrc(match[1]);
    if (src && !seen.has(src)) {
      seen.add(src);
      found.push(src);
    }
  }
  for (const match of text.matchAll(IMAGE_IN_HTML)) {
    const src = safePhotoSrc(match[1]);
    if (src && !seen.has(src)) {
      seen.add(src);
      found.push(src);
    }
  }
  return found;
}

export function isImageBlock(block) {
  const text = String(block || '').trim();
  if (IMAGE_MD.test(text)) return true;
  return /^<img\b/i.test(text);
}

export function weaveStoryMarkdown(body, photos) {
  const extras = (Array.isArray(photos) ? photos : []).map(safePhotoSrc).filter(Boolean);
  const source = String(body || '')
    .replace(/\r\n/g, '\n')
    .trim();
  const imageBlocks = extras.map((src) => `![](${src})`);
  if (!imageBlocks.length) return source;
  if (!source) return imageBlocks.join('\n\n');

  const blocks = source.split(/\n{2,}/);
  const textIndexes = [];
  blocks.forEach((block, index) => {
    if (!isImageBlock(block)) textIndexes.push(index);
  });
  if (!textIndexes.length) return [...blocks, ...imageBlocks].join('\n\n');

  const after = new Map();
  extras.forEach((src, i) => {
    const slot = Math.floor(((i + 1) * textIndexes.length) / (extras.length + 1));
    const clamped = Math.min(Math.max(slot, 0), textIndexes.length - 1);
    const blockIndex = textIndexes[clamped];
    const list = after.get(blockIndex) || [];
    list.push(`![](${src})`);
    after.set(blockIndex, list);
  });

  const out = [];
  blocks.forEach((block, index) => {
    out.push(block);
    const extra = after.get(index);
    if (extra) out.push(...extra);
  });
  return out.join('\n\n');
}

export function planRidePhotos(photos, body, cover) {
  const list = (Array.isArray(photos) ? photos : []).map(safePhotoSrc).filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const src of list) {
    if (seen.has(src)) continue;
    seen.add(src);
    unique.push(src);
  }
  const inBody = new Set(bodyImagePaths(body));
  const coverSrc = safePhotoSrc(cover);
  const hero = coverSrc && unique.includes(coverSrc) && !inBody.has(coverSrc) ? coverSrc : '';
  const inside = unique.filter((src) => src !== hero && !inBody.has(src));
  return {
    hero,
    inside,
    wovenBody: weaveStoryMarkdown(body, inside),
  };
}
