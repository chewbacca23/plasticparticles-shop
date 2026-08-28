# Cloudflare — thenewsoulsearchers.de

Live Worker: **`thenewsoulsearchersblog`**  
Git source: **`chewbacca23/thenewsoulsearchersblog`** (`main`)  
Admin: **https://thenewsoulsearchers.de/admin/** (not `www`)

---

## Easy editor (Login with GitHub)

The public site is on Cloudflare. `/admin` saves Markdown into GitHub; Cloudflare rebuilds; the new ride or note goes live.

**First time only** — one GitHub OAuth app, then two Cloudflare secrets.

### A. GitHub OAuth app

1. Open [github.com](https://github.com) as **`chewbacca23`**
2. Photo (top right) → **Settings**
3. Left list, scroll to the bottom → **Developer settings**
4. **OAuth Apps** → **New OAuth App**
5. Fill in:
   - Application name: `Soul Searchers CMS`
   - Homepage URL: `https://thenewsoulsearchers.de`
   - Authorization callback URL: `https://thenewsoulsearchers.de/callback`
6. **Register application**
7. Copy **Client ID**
8. **Generate a new client secret** → copy it (GitHub shows it once)

### B. Cloudflare secrets

1. [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → **`thenewsoulsearchersblog`** (the journal — not `plasticparticles-shop`)
3. **Settings** → **Variables and Secrets** → **Add**
4. Name `GITHUB_OAUTH_CLIENT_ID` · type **Text** · paste the Client ID → Save
5. **Add** again: name `GITHUB_OAUTH_CLIENT_SECRET` · type **Secret** · paste the secret → Save

### C. Write a post

1. Open **https://thenewsoulsearchers.de/admin/** (apex, not www)
2. **Login with GitHub** → authorize **Soul Searchers CMS**
3. **Ride notes** or **Rides** → New → write → **Publish**
4. Wait about a minute (Cloudflare rebuild) → hard-refresh the public page

If the GitHub popup says login is not wired yet, secrets from **B** are missing.

Do not force-push over `thenewsoulsearchersblog` `main` after using the editor — that would wipe those posts.

---

## Pages / Worker build (already live)

Use this repo **`chewbacca23/thenewsoulsearchersblog`** (blog only — no subfolder).

## New project (or reconnect existing)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → your project (or **Create**)
2. **Settings** → **Builds & deployments** → **Connect to Git**
3. Repository: **`chewbacca23/thenewsoulsearchersblog`**
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
2. Change repo to **`thenewsoulsearchersblog`**
3. Clear **root directory** (blank)
4. Build output: **`dist`**
5. Redeploy

Or create a fresh Pages project on this repo and delete the old one — same result.

## Verify

- https://thenewsoulsearchers.de/
- https://thenewsoulsearchers.de/journal
