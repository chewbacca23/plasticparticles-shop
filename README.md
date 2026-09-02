# The Soul Searchers

Cycling blog for **thenewsoulsearchers.de** — rides, ride notes, how we ride, about, contact.

> A cycling blog — tours, roads, and travel by bike.

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
| `npm run cms:proxy` | Local Decap CMS proxy |
| `npm run photos:check` | Report photos too big for the editor preview |
| `npm run photos:fix` | Resize those photos in place |
| `npm test` | Worker OAuth + media checks |

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

## Decap CMS (easy editor)

**Live:** [https://thenewsoulsearchers.de/admin/](https://thenewsoulsearchers.de/admin/) → **Login with GitHub**.  
First-time OAuth clicks: [`CLOUDFLARE.md`](./CLOUDFLARE.md).

**On your Mac** (optional):

1. Terminal A: `npm run cms:proxy`
2. Terminal B: `npm run dev`
3. Open `http://localhost:4321/admin/`
4. Click **Login to Local Backend** (not GitHub)

In the CMS:
- **Rides** = six photo tiles and ride pages
- **Ride notes** = packing, trains, café kilometres, touring posts
- image uploads go into `public/stories/`

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
| **Your logo** | Replace `public/logo.svg` — see [`LOGO.md`](./LOGO.md) |
| Site name / tagline | `src/site.config.ts` |
| Watermark strength | `logoWatermarkOpacity` in `site.config.ts` |
| Home headline | `src/pages/index.astro` |
| Colours | `src/styles/global.css` |
| About page | `src/pages/about.astro` |
