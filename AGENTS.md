# The Soul Searchers

Self-owned Astro journal for **thenewsoulsearchers.de**.

The Plastic Particles shop is a **different GitHub repo**: [plasticparticles-shop](https://github.com/chewbacca23/plasticparticles-shop). Do not mix them. This tree is the blog only.

Until `chewbacca23/thenewsoulsearchers` is published, this code also lives as branch `thenewsoulsearchers` of the shop repo. Publish with `./scripts/publish-thenewsoulsearchers-repo.sh` from the shop checkout (must run as GitHub user **chewbacca23**).

## Cursor Cloud specific instructions

### Run (blog)

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.
Decap editor (local): run `npm run cms:proxy` in a second terminal, then open `http://localhost:4321/admin/` and use **Login to Local Backend** (not GitHub).
Live Strato is plain HTTP; `/admin` includes a `crypto.randomUUID` polyfill. **GitHub login on Strato fails with “Invalid state key”** until a custom OAuth provider exists — expected. Edit locally → `npm run build` → upload `dist/` (see `STRATO.md`).

### Content & routes

- Stories (six photo tiles): `src/content/stories/*.md` and `public/stories/`
- Journal posts: `src/content/journal/*.md`
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories`, `/journal`, `/about`, `/contact`, `/impressum`, `/rss.xml`, `/admin`

### Live domain

`http://thenewsoulsearchers.de` is hosted at **Strato**. HTTPS currently fails TLS until Strato SSL is enabled. Deploy steps: `STRATO.md`. Cloudflare Pages is optional (`CLOUDFLARE.md`).
