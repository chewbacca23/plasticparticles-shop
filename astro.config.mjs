// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thenewsoulsearchers.de',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  redirects: {
    '/admin': '/admin/index.html',
    '/admin/': '/admin/index.html',
  },
});
