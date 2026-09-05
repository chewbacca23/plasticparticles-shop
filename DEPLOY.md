# Wire `thenewsoulsearchers.de` to this site

Static Astro site — deploy `dist/` to your host, then point DNS.

**Live setup:** Cloudflare Worker `thenewsoulsearchersblogc`, built from `chewbacca23/thenewsoulsearchersblog`. See [`CLOUDFLARE.md`](./CLOUDFLARE.md).

Domain config: `astro.config.mjs` and `src/site.config.ts`.

---

## Cloudflare (live)

See **[CLOUDFLARE.md](./CLOUDFLARE.md)** — repo root is the project (no subfolder).

---

## GitHub Pages

Not used. The `deploy-pages.yml` workflow was removed: it ran on every push and failed, because Pages was never enabled on the repository. Add it back only if you move off Cloudflare.

---

## Netlify

1. Import repo **`chewbacca23/thenewsoulsearchers`**
2. Build: `npm run build` · Publish: `dist`
3. Custom domain: `thenewsoulsearchers.de`

`netlify.toml` included.

---

## Strato FTP

See **[STRATO.md](./STRATO.md)**.

---

## Verify

```sh
curl -I https://thenewsoulsearchers.de/
```

You should see the Soul Searchers landing page.

---

## Visitor stats

Open `/looks` or the Looks link in the footer. Anyone can see Today, last 7 days, all time, and the pages people opened. Counts start from the day this ships.
