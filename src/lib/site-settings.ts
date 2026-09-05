export type SiteSettings = {
  email?: string | null;
  legalName?: string | null;
  responsible?: string | null;
  street?: string | null;
  zipCity?: string | null;
  country?: string | null;
  phone?: string | null;
};

export const SITE_MAIL_FALLBACK = 'hello@thenewsoulsearchers.de';
export const SITE_NAME_FALLBACK = 'The Soul Searchers';
export const SITE_PERSON_FALLBACK = 'Henrik Kürschner';
export const SITE_COUNTRY_FALLBACK = 'Germany';

export function cleanEmail(raw?: string | null): string {
  const value = String(raw || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '';
  return value;
}

function line(raw?: string | null): string {
  return String(raw || '').trim();
}

export function publicEmail(settings: SiteSettings = {}): string {
  return cleanEmail(settings.email) || SITE_MAIL_FALLBACK;
}

export function publicImprint(settings: SiteSettings = {}) {
  return {
    legalName: line(settings.legalName) || SITE_NAME_FALLBACK,
    responsible: line(settings.responsible) || SITE_PERSON_FALLBACK,
    street: line(settings.street),
    zipCity: line(settings.zipCity),
    country: line(settings.country) || SITE_COUNTRY_FALLBACK,
    phone: line(settings.phone),
    email: publicEmail(settings),
  };
}
