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
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories` (Rides), `/journal` (Ride notes), `/path` (How we ride), `/about`, `/contact`, `/impressum`, `/rss.xml`, `/admin`

### Live domain

`thenewsoulsearchers.de` is the Cloudflare Worker **`thenewsoulsearchersblog`** (Git repo `chewbacca23/thenewsoulsearchersblog`). See `CLOUDFLARE.md`.
