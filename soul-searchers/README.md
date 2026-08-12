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

**Full wiring guide:** [`DEPLOY.md`](./DEPLOY.md) — Cloudflare Pages (recommended), GitHub Pages, or Netlify + exact DNS for `thenewsoulsearchers.de`.

Quick summary:

1. Merge to `main` and connect the repo to your host (root directory: `soul-searchers`)
2. Build: `npm run build` → publish `dist/`
3. Point DNS for `thenewsoulsearchers.de` at the host (see `DEPLOY.md`)

GitHub Actions workflow: `.github/workflows/deploy-soul-searchers.yml` (Pages source = GitHub Actions).

## Stack

Astro 7 · Markdown content collections · RSS · sitemap · no WordPress.
