# The Soul Searchers

Self-owned blog for **thenewsoulsearchers.de** — landing page, journal, path, about, and contact.

> For the dreamers, the believers and the hopeful.

**Game shop (separate repo):** [plasticparticles-shop](https://github.com/chewbacca23/plasticparticles-shop)

## Quick start

```sh
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

| Command | Action |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

## Write a post

Add Markdown in `src/content/journal/`:

```md
---
title: Your title
description: One-line summary
pubDate: 2026-08-14
heroLabel: Essay
---

Your words here.
```

## Deploy

| Host | Guide |
| --- | --- |
| **Cloudflare Pages** (recommended) | [`CLOUDFLARE.md`](./CLOUDFLARE.md) |
| Strato FTP | [`STRATO.md`](./STRATO.md) |
| Other / DNS | [`DEPLOY.md`](./DEPLOY.md) |

Domain: **https://thenewsoulsearchers.de**

## Customize

| Change | File |
| --- | --- |
| Site name / tagline | `src/site.config.ts` |
| Home headline | `src/pages/index.astro` |
| Colours | `src/styles/global.css` |
| Hero background | `src/pages/index.astro` (`.sky` styles) |
| About page | `src/pages/about.astro` |
