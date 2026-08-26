export const site = {
  name: 'The Soul Searchers',
  shortName: 'Soul Searchers',
  tagline: 'For the dreamers, the believers and the hopeful.',
  description:
    'A home-owned journal for the dreamers, the believers, and the hopeful — essays, notes, and quiet pushes toward a braver path.',
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
