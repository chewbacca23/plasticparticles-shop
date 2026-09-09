// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thenewsoulsearchers.de',
  trailingSlash: 'never',
  redirects: {
    '/patches': '/shop',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/looks'),
    }),
  ],
});
