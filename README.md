# The Soul Searchers

Self-owned blog for **The Soul Searchers** — landing page, journal, path, about, and contact.

> For the dreamers, the believers and the hopeful.

## Quick start

```sh
cd soul-searchers
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

| Command | Action |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |

## Site map

- `/` — landing
- `/journal` — all posts
- `/journal/[slug]` — single post
- `/path` — markers for the road
- `/about` — who we are
- `/contact` — say hello
- `/rss.xml` — RSS feed
- auto sitemap via `@astrojs/sitemap`

## Write a post

Add a Markdown file in `src/content/journal/`:

```md
---
title: Your title
description: One-line summary
pubDate: 2026-08-11
heroLabel: Essay
---

Your words here.
```

## Deploy to your domain

Configured for static hosting (Netlify / Cloudflare Pages / Vercel / any nginx/static host):

1. From `soul-searchers/`: `npm run build`
2. Publish the `dist/` folder (Netlify reads `netlify.toml`; Vercel reads `vercel.json`)
3. Point DNS for `thesoulsearchers.de` (or your domain) at the host
4. If the final domain differs, update `src/site.config.ts` and `astro.config.mjs`

## Stack

Astro 7 · Markdown content collections · RSS · sitemap · no WordPress.
