## Cursor Cloud specific instructions

This checkout is **The Soul Searchers** blog (Astro) when you are on branch **`thenewsoulsearchers`** (files at repo root).

The Plastic Particles **shop** is the same GitHub repo on branch **`main`** (`npm start`, port 3000). Do not mix them: `git checkout thenewsoulsearchers` for the blog, `git checkout main` for the game.

### Run (blog)

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.
Decap editor (local): run `npm run cms:proxy` in a second terminal, then open `http://localhost:4321/admin/` and use **Login to Local Backend** (not GitHub).
Live Strato is plain HTTP; `/admin` includes a `crypto.randomUUID` polyfill. **GitHub login on Strato fails with “Invalid state key”** until a custom OAuth provider exists — expected. Edit locally → `npm run build` → upload `dist/` (see `STRATO.md`).

### Content & routes

- Rides (six photo tiles): `src/content/stories/*.md` and `public/stories/`
- Ride notes: `src/content/journal/*.md`
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories` (Rides), `/journal` (Ride notes), `/path` (How we ride), `/about`, `/contact`, `/impressum`, `/rss.xml`, `/admin`

### Live domain

`thenewsoulsearchers.de` is hosted at **Strato**. Until `dist/` is uploaded over FTP, the public site can still be WordPress. Deploy steps: `STRATO.md`. Cloudflare Pages is optional (`CLOUDFLARE.md`).
