# Wire `thenewsoulsearchers.de` to this site

Static Astro site — deploy `dist/` to your host, then point DNS.

**Recommended:** Cloudflare Pages (see [`CLOUDFLARE.md`](./CLOUDFLARE.md)) — Git branch `thenewsoulsearchers` of `plasticparticles-shop`, not `main`.

Domain config: `astro.config.mjs` and `src/site.config.ts`.

---

## Cloudflare Pages

See **[CLOUDFLARE.md](./CLOUDFLARE.md)** — repo root is the project (no subfolder).

---

## GitHub Pages

1. Repo → **Settings** → **Pages** → Source: **GitHub Actions**
2. Push to `main` — workflow `.github/workflows/deploy-pages.yml`
3. Custom domain: `thenewsoulsearchers.de`
4. DNS A records to GitHub Pages IPs (see GitHub docs) or use Cloudflare instead

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

## Visitor stats (optional)

Plausible, Umami, or Cloudflare Web Analytics — no WordPress/Jetpack needed.
