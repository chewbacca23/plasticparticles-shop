/**
 * Mail and imprint are saved to GitHub at once. The public Contact and
 * Imprint pages can sit on the last Astro build, so write the saved lines
 * into the HTML the same way Looks writes its numbers.
 */

import { escapeHtml } from './fresh-ride.js';

const REPO = 'chewbacca23/thenewsoulsearchersblog';
const BRANCH = 'main';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/src/content/settings/site.json`;
const FALLBACK_EMAIL = 'hello@thenewsoulsearchers.de';

export function isSitePath(pathname) {
  return (
    pathname === '/contact' ||
    pathname === '/contact/' ||
    pathname === '/impressum' ||
    pathname === '/impressum/' ||
    pathname === '/imprint' ||
    pathname === '/imprint/'
  );
}

export function cleanEmail(raw) {
  const value = String(raw || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '';
  return value;
}

function line(raw) {
  return String(raw || '').trim();
}

export function publicEmail(settings = {}) {
  return cleanEmail(settings.email) || FALLBACK_EMAIL;
}

export function publicImprint(settings = {}) {
  return {
    legalName: line(settings.legalName) || 'The Soul Searchers',
    responsible: line(settings.responsible) || 'Henrik Kürschner',
    street: line(settings.street),
    zipCity: line(settings.zipCity),
    country: line(settings.country) || 'Germany',
    phone: line(settings.phone),
    email: publicEmail(settings),
  };
}

export function parseSiteSettings(raw) {
  try {
    const data = JSON.parse(String(raw || '{}'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function linesHtml(...parts) {
  return parts.filter(Boolean).map((part) => escapeHtml(part)).join('<br />');
}

export function fillSiteInHtml(html, settings) {
  const imprint = publicImprint(settings);
  const email = imprint.email;
  const phone = imprint.phone
    ? `<br />Telefon: ${escapeHtml(imprint.phone)}`
    : '';
  return String(html)
    .replace(/href="mailto:[^"]+"/g, `href="mailto:${email}"`)
    .replace(/action="mailto:[^"]+"/g, `action="mailto:${email}"`)
    .replace(
      /<a([^>]*data-site="email"[^>]*)>[\s\S]*?<\/a>/g,
      `<a$1>${escapeHtml(email)}</a>`,
    )
    .replace(
      /<p([^>]*data-site="provider"[^>]*)>[\s\S]*?<\/p>/,
      `<p$1>${linesHtml(
        imprint.legalName,
        imprint.responsible,
        imprint.street,
        imprint.zipCity,
        imprint.country,
      )}</p>`,
    )
    .replace(
      /<p([^>]*data-site="responsible"[^>]*)>[\s\S]*?<\/p>/,
      `<p$1>${linesHtml(imprint.responsible, imprint.street, imprint.zipCity)}</p>`,
    )
    .replace(
      /<span([^>]*data-site="phone"[^>]*)>[\s\S]*?<\/span>/,
      `<span$1>${phone}</span>`,
    );
}

export async function handleFreshSite(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  if (!isSitePath(url.pathname)) return null;
  if (!env?.ASSETS?.fetch) return null;

  let settings = {};
  try {
    const raw = await fetch(RAW, { headers: { 'user-agent': 'soul-searchers-worker' } });
    if (raw.ok) settings = parseSiteSettings(await raw.text());
  } catch {
    settings = {};
  }

  const asset = await env.ASSETS.fetch(request);
  if (!asset?.ok) return asset;
  const type = asset.headers.get('content-type') || '';
  if (type && !type.includes('html') && !type.includes('text')) return asset;
  const html = fillSiteInHtml(await asset.text(), settings);
  const headers = new Headers(asset.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: 200, headers });
}
