# The Soul Searchers

Self-owned cycling journal for **thenewsoulsearchers.de** — rides, notes from the saddle, about, and contact.

> For riders who travel, and travellers who pedal this wonderful planet.

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

You can edit stories and journal posts in a browser UI:

1. Terminal A:
   ```sh
   npm run cms:proxy
   ```
2. Terminal B:
   ```sh
   npm run dev
   ```
3. Open:
   - `http://localhost:4321/admin`
   - (fallback) `http://localhost:4321/admin/index.html`

In the CMS:
- **Rides** = six big photo tiles and ride pages
- **Journal** = notes from the saddle
- image uploads go into `public/stories/`

Then deploy as usual (`npm run build` + FTP upload of `dist/`).

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
