/**
 * Home opens on a soft dia of road photos. Astro bakes that list at deploy
 * time, so a new ride can sit on GitHub while `/` still shows last week's
 * opener. Same trick as fresh-ride: read main, then paint the dia.
 *
 * Ride covers lead. CMS Site → Home slides fill gaps. This does not shrink
 * photos — that stays with keep-photos-small / photos:fix.
 */

import { escapeHtml, galleryPaths, parseMarkdownFile } from './fresh-ride.js';

const REPO = 'chewbacca23/thenewsoulsearchersblog';
const BRANCH = 'main';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const LIST = `https://api.github.com/repos/${REPO}/contents/src/content/stories?ref=${BRANCH}`;
const HOME_SETTINGS = `${RAW}/src/content/settings/home.json`;
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/i;
const STORY_PHOTO = /^\/stories\/[^/]+$/;
export const HERO_SLIDE_LIMIT = 6;

export function isHomePath(pathname) {
  return pathname === '/' || pathname === '/index.html' || pathname === '/index';
}

export function cmsSlides(heroSlides) {
  if (!Array.isArray(heroSlides)) return [];
  const out = [];
  for (const entry of heroSlides) {
    let photo = '';
    if (typeof entry === 'string') photo = entry.trim();
    else if (entry && typeof entry === 'object') {
      photo = String(entry.slide || entry.image || entry.photo || '').trim();
    }
    if (!photo || out.includes(photo)) continue;
    out.push(photo);
  }
  return out;
}

export function rideCoverFromData(data) {
  if (!data || data.draft === true) return '';
  const cover = galleryPaths(data.cover, data.gallery)[0] || '';
  const path = cover.split('?')[0];
  if (!STORY_PHOTO.test(path)) return '';
  return cover;
}

export function rideDateValue(data) {
  const raw = data?.pubDate;
  if (raw == null || raw === '') return 0;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? 0 : date.valueOf();
}

export function sortRideCovers(rides) {
  return [...rides]
    .sort((a, b) => {
      const byDate = rideDateValue(b.data) - rideDateValue(a.data);
      if (byDate !== 0) return byDate;
      return String(a.slug || '').localeCompare(String(b.slug || ''));
    })
    .map((ride) => rideCoverFromData(ride.data))
    .filter(Boolean)
    .filter((photo, index, all) => all.indexOf(photo) === index);
}

/**
 * Newest ride covers go first so a published ride opens the site.
 * Cap six: a new cover slides in at the front, the one that has been
 * on the dia longest drops off the end. CMS / baked slides fill gaps only.
 */
export function mergeStartupPics(existing = [], rideCovers = [], limit = HERO_SLIDE_LIMIT) {
  const out = [];
  for (const photo of [...rideCovers, ...existing]) {
    const path = String(photo || '').trim();
    if (!path || out.includes(path)) continue;
    out.push(path);
    if (out.length >= limit) break;
  }
  return out;
}

export function slidesFromHtml(html) {
  return [...String(html || '').matchAll(/<img\b[^>]*class="[^"]*\bhero-photo\b[^"]*"[^>]*\bsrc="([^"]+)"/gi)]
    .map((match) => match[1])
    .filter(Boolean);
}

function astroCid(html) {
  const dia = String(html || '').match(/<div[^>]*data-hero-dia[^>]*>/);
  const fromDia = dia ? dia[0].match(/data-astro-cid-[a-z0-9]+/i) : null;
  if (fromDia) return fromDia[0];
  const sky = String(html || '').match(/<div[^>]*class="[^"]*\bsky\b[^"]*"[^>]*>/);
  const fromSky = sky ? sky[0].match(/data-astro-cid-[a-z0-9]+/i) : null;
  return fromSky ? fromSky[0] : '';
}

function renderDiaImgs(slides, cid) {
  const attr = cid ? ` ${cid}` : '';
  return slides
    .map((src, index) => {
      const decoding = index === 0 ? 'sync' : 'async';
      const priority = index === 0 ? 'high' : 'low';
      return `<img class="hero-photo" src="${escapeHtml(src)}" alt="" width="1920" height="1080" decoding="${decoding}" fetchpriority="${priority}" loading="eager" style="--dia-i: ${index};"${attr}>`;
    })
    .join('');
}

export function renderHomeDia(slides, cid = '') {
  const count = slides.length;
  const cidAttr = cid ? ` ${cid}` : '';
  return `<div class="hero-dia" data-hero-dia data-count="${count}" style="--dia-count: ${count};"${cidAttr}> ${renderDiaImgs(slides, cid)} </div>`;
}

function withHasPhoto(html) {
  return String(html).replace(/class="hero(?![-\w])([^"]*)"/g, (full, rest) => {
    if (/\bhas-photo\b/.test(rest)) return full;
    return `class="hero has-photo${rest}"`;
  });
}

export function fillHomeDiaInHtml(html, slides) {
  const source = String(html || '');
  if (!slides.length) return source;
  const cid = astroCid(source);
  const block = renderHomeDia(slides, cid);
  let next = source;
  if (/<div[^>]*data-hero-dia[^>]*>/i.test(next)) {
    next = next.replace(/<div[^>]*data-hero-dia[^>]*>[\s\S]*?<\/div>/i, block);
  } else if (/<div[^>]*class="[^"]*\bsky\b[^"]*"[^>]*>/i.test(next)) {
    next = next.replace(/(<div[^>]*class="[^"]*\bsky\b[^"]*"[^>]*>)/i, `$1 ${block}`);
  } else {
    return source;
  }
  return withHasPhoto(next);
}

export function sameSlides(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'soul-searchers-worker' },
  });
  if (!response.ok) return '';
  return response.text();
}

export async function listRideSlugs() {
  try {
    const response = await fetch(LIST, {
      headers: {
        'user-agent': 'soul-searchers-worker',
        accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) return [];
    const items = await response.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => item && item.type === 'file' && /\.md$/i.test(item.name || ''))
      .map((item) => String(item.name).replace(/\.md$/i, ''))
      .filter((slug) => SAFE_SLUG.test(slug));
  } catch {
    return [];
  }
}

export async function loadRidesFromGitHub() {
  const slugs = await listRideSlugs();
  const rides = [];
  for (const slug of slugs) {
    try {
      const raw = await fetchText(`${RAW}/src/content/stories/${encodeURIComponent(slug)}.md`);
      if (!raw) continue;
      const parsed = parseMarkdownFile(raw);
      rides.push({ slug, data: parsed.data });
    } catch {
      // Skip a missing file and keep the rest.
    }
  }
  return rides;
}

export async function loadHomeSettings() {
  try {
    const raw = await fetchText(HOME_SETTINGS);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function startupPicsFrom(rides, settings = {}, baked = []) {
  return mergeStartupPics([...baked, ...cmsSlides(settings.heroSlides)], sortRideCovers(rides));
}

export async function handleFreshHome(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  if (!isHomePath(url.pathname)) return null;
  if (!env?.ASSETS?.fetch) return null;

  const asset = await env.ASSETS.fetch(request);
  if (!asset?.ok) return asset;
  const type = asset.headers.get('content-type') || '';
  if (type && !type.includes('html') && !type.includes('text')) return asset;

  const html = await asset.text();
  let rides = [];
  let settings = {};
  try {
    [rides, settings] = await Promise.all([loadRidesFromGitHub(), loadHomeSettings()]);
  } catch {
    rides = [];
    settings = {};
  }

  const baked = slidesFromHtml(html);
  const slides = startupPicsFrom(rides, settings, baked);
  if (!slides.length || sameSlides(slides, baked)) {
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': asset.headers.get('content-type') || 'text/html; charset=utf-8',
      },
    });
  }

  const filled = fillHomeDiaInHtml(html, slides);
  const headers = new Headers(asset.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(filled, { status: 200, headers });
}
