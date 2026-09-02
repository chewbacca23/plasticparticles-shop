export const site = {
  name: 'The Soul Searchers',
  shortName: 'Soul Searchers',
  tagline: 'A cycling blog — tours, roads, and travel by bike.',
  description:
    'The Soul Searchers is a cycling blog: climbs, coast roads, café stops, bikes on trains, and seeing this planet from the saddle.',
  url: 'https://thenewsoulsearchers.de',
  email: 'hello@thenewsoulsearchers.de',
  locale: 'en',
  domains: ['thenewsoulsearchers.de', 'www.thenewsoulsearchers.de'],

  /** Crest lives at `public/logo.svg` (lowercase — Linux/Cloudflare is case-sensitive) */
  logo: '/logo.svg',
  /** Large faint mark behind pages (0 = off, 0.04–0.12 = subtle) */
  logoWatermarkOpacity: 0.07,
  logoWatermarkBlur: '0.5px',

  /** Impressum — fill in your real details (required on .de sites) */
  imprint: {
    legalName: 'The Soul Searchers',
    responsible: 'Henrik Kürschner',
    street: '[Street / house number]',
    zipCity: '[PLZ] [City]',
    country: 'Germany',
    phone: '[Phone — optional]',
    email: 'hello@thenewsoulsearchers.de',
  },
};
