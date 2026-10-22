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
      filter: (page) =>
        !page.includes('/looks') &&
        !page.includes('/bar-italia') &&
        !page.includes('/members') &&
        !page.includes('/admin') &&
        !page.includes('/auth') &&
        !page.includes('/callback'),
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        const path = new URL(item.url).pathname;
        if (path === '/' || path === '') {
          return { ...item, priority: 1, changefreq: 'daily' };
        }
        if (path.startsWith('/cities')) {
          return { ...item, priority: 0.9, changefreq: 'weekly' };
        }
        if (path.startsWith('/stories') || path === '/week' || path === '/calendar') {
          return { ...item, priority: 0.85, changefreq: 'weekly' };
        }
        return item;
      },
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
