## Cursor Cloud specific instructions

**The Soul Searchers** blog — standalone repo for **thenewsoulsearchers.de** (Astro).

The Plastic Particles game shop lives in a separate repo: `chewbacca23/plasticparticles-shop`.

### Run

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.

### Content & routes

- Posts: `src/content/journal/*.md`
- Config: `src/site.config.ts`
- Routes: `/`, `/stories`, `/journal`, `/about`, `/contact`, `/impressum`, `/rss.xml`

### Deploy

- Cloudflare Pages: see `CLOUDFLARE.md`
- Strato FTP: see `STRATO.md`
- General DNS: see `DEPLOY.md`
