## Cursor Cloud specific instructions

This folder is **The Soul Searchers** self-owned blog (Astro), separate from the React shop at the repo root.

### Run

```sh
cd soul-searchers
npm install
npm run dev
```

Dev server defaults to **http://localhost:4321**. Production: `npm run build` then `npm run preview`.

### Content

Journal posts live in `src/content/journal/*.md`. Site name/domain/email: `src/site.config.ts`.

### Do not confuse with the shop

Root `npm start` is the plasticparticles CRA game shop on port 3000. This blog is only under `soul-searchers/`.
