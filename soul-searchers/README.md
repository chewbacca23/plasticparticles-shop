# The Soul Searchers

Self-owned blog for **The Soul Searchers** — landing page, journal, about, and contact.

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

1. Run `npm run build` inside `soul-searchers/`.
2. Upload / connect the `dist/` folder to any static host (Netlify, Cloudflare Pages, Vercel, nginx, etc.).
3. Point `thesoulsearchers.de` (or your domain) DNS at that host.
4. Update `site.url` in `src/site.config.ts` and `site` in `astro.config.mjs` if the final domain differs.

## Stack

Astro 7 · Markdown content collections · no WordPress, no Jetpack — analytics can be added later with Plausible, Umami, or similar.
