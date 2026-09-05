export const SITE_SETTINGS_PATH = 'src/content/settings/site.json';

export type SiteMailFields = {
  email: string;
  legalName: string;
  responsible: string;
  street: string;
  zipCity: string;
  country: string;
  phone: string;
};

const KEYS = [
  'email',
  'legalName',
  'responsible',
  'street',
  'zipCity',
  'country',
  'phone',
] as const;

export function emptySiteMail(): SiteMailFields {
  return {
    email: '',
    legalName: 'The Soul Searchers',
    responsible: 'Henrik Kürschner',
    street: '',
    zipCity: '',
    country: 'Germany',
    phone: '',
  };
}

export function line(raw?: string | null): string {
  return String(raw || '').trim();
}

export function siteMailFromUnknown(raw: unknown): SiteMailFields {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const next = emptySiteMail();
  for (const key of KEYS) {
    if (typeof src[key] === 'string') next[key] = src[key].trim();
  }
  return next;
}

export function parseSiteMailJson(raw: string): SiteMailFields {
  try {
    return siteMailFromUnknown(JSON.parse(String(raw || '{}')));
  } catch {
    return emptySiteMail();
  }
}

export function siteMailJson(fields: SiteMailFields): string {
  return `${JSON.stringify(siteMailFromUnknown(fields), null, 2)}\n`;
}

export function isSiteSettingsPath(path?: string | null): boolean {
  return path === SITE_SETTINGS_PATH;
}
