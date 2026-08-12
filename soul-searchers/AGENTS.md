## Cursor Cloud specific instructions

This folder is **The Soul Searchers** self-owned blog (Astro), separate from the React shop at the repo root.

### Run

```sh
cd soul-searchers
npm install
npm run dev
```

Dev server defaults to **http://localhost:4321**. Production: `npm run build` then `npm run preview`.

### Content & routes

- Posts: `src/content/journal/*.md`
- Config: `src/site.config.ts` (name, domain, email)
- Key routes: `/`, `/journal`, `/path`, `/about`, `/contact`, `/rss.xml`

### Do not confuse with the shop

Root `npm start` is the plasticparticles CRA game shop on port 3000. This blog is only under `soul-searchers/`.
