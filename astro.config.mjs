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
    '/hooks': '/marketplace',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/looks'),
    }),
  ],
  vite: {
    build: {
      cssMinify: true,
    },
    server: {
      // Local Call upon board (scripts/local-hooks-api.mjs on :8788).
      proxy: {
        '/api/hooks': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
      },
    },
  },
});
