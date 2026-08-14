# Cloudflare Pages — thenewsoulsearchers.de

Use this repo **`chewbacca23/thenewsoulsearchers`** (blog only — no subfolder).

## New project (or reconnect existing)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → your project (or **Create**)
2. **Settings** → **Builds & deployments** → **Connect to Git**
3. Repository: **`chewbacca23/thenewsoulsearchers`**
4. Production branch: **`main`**

| Setting | Value |
| --- | --- |
| Root directory | *(leave empty)* |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |

5. **Save** → trigger deploy
6. **Custom domains** → `thenewsoulsearchers.de` (+ optional `www`)

## If you already deployed from plasticparticles-shop

Your old project pointed at repo `plasticparticles-shop` with root directory **`soul-searchers`**.

**Switch it:**

1. Pages project → **Settings** → **Build**
2. Change repo to **`thenewsoulsearchers`**
3. Clear **root directory** (blank)
4. Build output: **`dist`**
5. Redeploy

Or create a fresh Pages project on this repo and delete the old one — same result.

## Verify

- https://thenewsoulsearchers.de/
- https://thenewsoulsearchers.de/journal
