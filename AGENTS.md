## Cursor Cloud specific instructions

This checkout is **The Soul Searchers** blog (Astro) when you are on branch **`thenewsoulsearchers`** (files at repo root).

The Plastic Particles **shop** is the same GitHub repo on branch **`main`** (`npm start`, port 3000). Do not mix them: `git checkout thenewsoulsearchers` for the blog, `git checkout main` for the game.

### Run (blog)

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.

### Content & routes

- Stories (six photo tiles): `src/content/stories/*.md` and `public/stories/`
- Journal posts: `src/content/journal/*.md`
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories`, `/journal`, `/about`, `/contact`, `/impressum`, `/rss.xml`

### Live domain

`thenewsoulsearchers.de` is hosted at **Strato**. Until `dist/` is uploaded over FTP, the public site can still be WordPress. Deploy steps: `STRATO.md`. Cloudflare Pages is optional (`CLOUDFLARE.md`).
