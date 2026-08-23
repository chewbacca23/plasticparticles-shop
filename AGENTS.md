## Cursor Cloud specific instructions

This checkout is **The Soul Searchers** blog (Astro) when you are on branch **`thenewsoulsearchers`** (files at repo root).

The Plastic Particles **shop** is the same GitHub repo on branch **`main`** (`npm start`, port 3000). Do not mix them: `git checkout thenewsoulsearchers` for the blog, `git checkout main` for the game.

### Run (blog)

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.
Decap editor: `npm run cms`, then `http://localhost:4321/admin/index.html`. After Cloudflare Pages is connected (`CLOUDFLARE.md`), `git push` on branch `thenewsoulsearchers` updates the live site. Until then, `npm run build` + Strato upload (`STRATO.md`).

### Content & routes

- Stories (six photo tiles): `src/content/stories/*.md` and `public/stories/`
- Journal posts: `src/content/journal/*.md`
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories`, `/journal`, `/about`, `/contact`, `/impressum`, `/rss.xml`, `/admin`

### Live domain

Live domain: **https://thenewsoulsearchers.de** on **Cloudflare Pages** (see `CLOUDFLARE.md`). Domain registration can stay at Strato. Old FTP path: `STRATO.md`.
