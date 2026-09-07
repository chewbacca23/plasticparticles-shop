export const site = {
  name: 'The Soul Searchers',
  shortName: 'Soul Searchers',
  tagline: 'A cycling blog. Tours, roads, and travel by bike.',
  description:
    'The Soul Searchers is a cycling blog: climbs, coast roads, café stops, bikes on trains, and seeing this planet from the saddle.',
  url: 'https://thenewsoulsearchers.de',
  email: 'hello@thenewsoulsearchers.de',
  locale: 'en',
  domains: ['thenewsoulsearchers.de', 'www.thenewsoulsearchers.de'],

  /** Crest lives at `public/logo.svg`, which wraps `public/logo.png`. */
  logo: '/logo.svg',
  /**
   * Soft, pre-blurred crest for the page backdrop only.
   * Header / favicon keep the sharp `logo` above.
   */
  logoWatermark: '/logo-watermark.png',
  /** Large faint mark behind pages (0 = off, 0.04–0.12 = subtle) */
  logoWatermarkOpacity: 0.11,
  /** Extra CSS blur on top of the soft PNG (hides chat-PNG pixel edges) */
  logoWatermarkBlur: '2px',

  /** Impressum defaults. Henrik fills the real lines in the editor (Site → Mail and imprint). */
  imprint: {
    legalName: 'The Soul Searchers',
    responsible: 'Henrik Kürschner',
    street: '',
    zipCity: '',
    country: 'Germany',
    phone: '',
    email: 'hello@thenewsoulsearchers.de',
  },
};
