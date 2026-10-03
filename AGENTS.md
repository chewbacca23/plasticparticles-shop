## Cursor Cloud specific instructions

This checkout is **The Soul Searchers** blog (Astro) when you are on branch **`thenewsoulsearchers`** (files at repo root).

The Plastic Particles **shop** is the same GitHub repo on branch **`main`** (`npm start`, port 3000). Do not mix them: `git checkout thenewsoulsearchers` for the blog, `git checkout main` for the game.

### Run (blog)

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.
Decap editor (live): `https://thenewsoulsearchers.de/admin/` → Login with GitHub (OAuth Worker at `/auth` + `/callback`; first-time secrets in `CLOUDFLARE.md`).
Decap editor (local): run `npm run cms:proxy` in a second terminal, then open `http://localhost:4321/admin/` and use **Login to Local Backend** (not GitHub).

### Content & routes

- Rides (six photo tiles): `src/content/stories/*.md` and `public/stories/`
- Ride notes: `src/content/journal/*.md`
- Stores around the world: `src/content/stores/*.md` → `/stores`
- This week / what happened: `src/content/week/*.md` → `/week` (short dated notes; not the old Now photo grid)
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories` (Rides), `/week` (This week), `/stores` (Stores), `/marketplace` (Marketplace), `/about`, `/contact`, `/impressum`, `/rss.xml`, `/admin` (`/now` shot feed and `/journal` stay reachable; off primary nav. `/path` redirects to About)
- Kit: `/kit` (public)
- Marketplace: `/marketplace` (`/hooks` redirects here) — group of people, public stalls and offers, optional hidden email / Telegram username / WhatsApp phone (opt-in bridges only; handles and digits never on the public map; Telegram first)

### Photos

- Size budget: `npm run photos:check` / `npm run photos:fix` (`scripts/optimise-photos.py`, under ~1 MB CMS / ~350 KB web)
- Enhance (colour + crispness): `npm run photos:enhance -- path/to/pic.jpg` → writes `*_enhanced.jpg`; `--in-place` overwrites. Dry-run: `npm run photos:enhance:check -- path`. Needs `pip3 install pillow`. Mac one-shot (HEIC via `sips`): `sh scripts/enhance-photo.sh ~/Desktop/IMG.HEIC`. Run `photos:fix` after if anything is still heavy.

### Live domain

`thenewsoulsearchers.de` is the Cloudflare Worker **`thenewsoulsearchersblog`** (Git repo `chewbacca23/thenewsoulsearchersblog`). See `CLOUDFLARE.md`.
