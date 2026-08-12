# Wire `thenewsoulsearchers.de` to The Soul Searchers blog

This site is a static Astro build in `soul-searchers/`. Pick **one** host below, then point DNS.

**Recommended:** Cloudflare Pages (fast in Germany, free SSL, easy `.de` apex).

---

## Before you start

1. Merge [PR #5](https://github.com/chewbacca23/plasticparticles-shop/pull/5) (or ensure `soul-searchers/` is on `main`).
2. Confirm domain: **`thenewsoulsearchers.de`** (with **new** in the name).

**Current DNS (Aug 2026):** apex A → `81.169.145.150` (Strato / `rzone.de` nameservers). The domain still serves **WordPress on Apache** today (`wp-json` in headers). When you switch to this Astro site, you either upload the static `dist/` folder to Strato **or** point DNS at Cloudflare Pages / GitHub Pages instead.

3. Domain settings live at your registrar (likely **Strato** given `rzone.de` NS) or Cloudflare.

Site URL is already set in:

- `soul-searchers/astro.config.mjs` → `site: 'https://thenewsoulsearchers.de'`
- `soul-searchers/src/site.config.ts` → `url` and `email`

---

## Option A — Cloudflare Pages (recommended)

### 1. Add the site to Cloudflare

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Add a site** → enter `thenewsoulsearchers.de`
3. Cloudflare shows **two nameservers** — set those at your registrar (replace old NS).
4. Wait until Cloudflare shows the domain as **Active** (often 5–30 minutes).

### 2. Create the Pages project

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Repo: `chewbacca23/plasticparticles-shop`
3. **Production branch:** `main`
4. **Build settings:**

   | Setting | Value |
   | --- | --- |
   | Root directory | `soul-searchers` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | `22` (Environment variable `NODE_VERSION` = `22`) |

5. **Save and deploy** — you get a `*.pages.dev` URL when the first build succeeds.

### 3. Attach custom domain (in Cloudflare)

1. Pages project → **Custom domains** → **Set up a custom domain**
2. Add `thenewsoulsearchers.de`
3. Add `www.thenewsoulsearchers.de` (optional; Cloudflare can redirect www → apex)

Cloudflare creates DNS records automatically when the domain is on their nameservers.

### 4. Check

- https://thenewsoulsearchers.de/
- https://thenewsoulsearchers.de/journal
- https://thenewsoulsearchers.de/rss.xml

---

## Option B — GitHub Pages (free, uses this repo)

### 1. Enable Pages

1. GitHub repo → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. Merge to `main` (or run **Actions** → **Deploy Soul Searchers** → **Run workflow**)

The workflow `.github/workflows/deploy-soul-searchers.yml` builds `soul-searchers/` and publishes `dist/`.

### 2. Custom domain in GitHub

1. **Settings** → **Pages** → **Custom domain**
2. Enter: `thenewsoulsearchers.de`
3. Enable **Enforce HTTPS** once the certificate is ready.

`public/CNAME` in the repo already contains `thenewsoulsearchers.de`.

### 3. DNS at your registrar (if not using Cloudflare)

**Apex** `thenewsoulsearchers.de` — four **A** records:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**www** (optional):

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `chewbacca23.github.io` |

Then in GitHub Pages custom domain, you can also add `www.thenewsoulsearchers.de`.

---

## Option C — Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Repo: `plasticparticles-shop`
3. **Base directory:** `soul-searchers`
4. **Build command:** `npm run build`
5. **Publish directory:** `soul-searchers/dist` (or `dist` if base dir is set)
6. **Site settings** → **Domain management** → **Add custom domain** → `thenewsoulsearchers.de`
7. Netlify shows the DNS records to add at your registrar (usually CNAME or A + ALIAS).

`netlify.toml` in `soul-searchers/` is already configured.

---

## Option D — Keep Strato (domain already there)

Your domain already points at Strato (`81.169.145.150`) and runs WordPress today. To swap in this site **without changing DNS**:

1. Log in at [Strato](https://www.strato.de) → **Login** → your package
2. Open **FTP & SSH** (or **File Manager**) for `thenewsoulsearchers.de`
3. Locally: `cd soul-searchers && npm run build`
4. **Back up** the current web folder (WordPress files)
5. Upload **everything inside** `soul-searchers/dist/` to the web root (`/` or `htdocs/`) — overwrite old `index.html`
6. Ensure Apache serves `index.html` for folders (journal links use `/journal/slug/` directories)

To use Strato **and** Git deploy later, switch DNS to Cloudflare Pages (Option A) instead — simpler long term.

---

## After DNS propagates

Typical wait: **5 minutes to 48 hours** (often under an hour).

Verify:

```sh
dig thenewsoulsearchers.de A +short
curl -I https://thenewsoulsearchers.de/
```

You should see **200** and the Soul Searchers landing page.

---

## Optional: visitor stats (replacement for WordPress Stats)

Add one of these later (no Jetpack needed):

- [Plausible](https://plausible.io) — privacy-friendly
- [Umami](https://umami.is) — self-hosted or cloud
- Cloudflare Web Analytics (free, if on Cloudflare)

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Old WordPress still shows | Remove old A/CNAME records pointing at WordPress.com |
| SSL certificate pending | Wait up to 24h; ensure DNS points only to the new host |
| 404 on journal links | Host must serve `dist/` at domain **root**, not `/soul-searchers/` |
| www works but apex doesn’t | Add apex A/ALIAS records or move DNS to Cloudflare |

---

## Quick local production check

```sh
cd soul-searchers
npm ci
npm run build
npm run preview
```

Open the URL shown (usually http://localhost:4321) and click through Home → Journal → a post.
