# Plastic Particles Shop & The Soul Searchers

## Cursor Cloud specific instructions

### Two apps in this repo

| App | Path | Dev command | Port |
| --- | --- | --- | --- |
| Island shop (CRA) | repo root | `npm start` | 3000 |
| Soul Searchers blog (Astro) | `soul-searchers/` | `cd soul-searchers && npm run dev` (or `npm run blog:dev`) | 4321 |

Do not mix their installs: root `npm install` for the shop; `npm install` inside `soul-searchers/` for the blog.

### Blog notes

- Posts: `soul-searchers/src/content/journal/*.md`
- Site/domain config: `soul-searchers/src/site.config.ts`
- See `soul-searchers/README.md` and `soul-searchers/AGENTS.md` for deploy and content details.
