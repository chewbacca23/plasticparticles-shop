// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thenewsoulsearchers.de',
  trailingSlash: 'never',
  compressHTML: true,
  redirects: {
    '/patches': '/shop',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/looks') && !page.includes('/kit'),
    }),
  ],
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
