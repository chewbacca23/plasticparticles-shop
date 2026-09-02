# Cloudflare — thenewsoulsearchers.de

Live Worker: **`thenewsoulsearchersblogc`** — owns the domain, holds the OAuth secrets, and is the `name` in `wrangler.toml`. The GitHub repo is `thenewsoulsearchersblog` (no `c`); the two are deliberately different, so do not "fix" `wrangler.toml` to match the repo name.  
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

### B. Cloudflare secrets — from the terminal (recommended)

Five Workers are Git-connected to this repo, so the dashboard offers five wrong places to paste the keys. The CLI targets one Worker by name:

```sh
sh scripts/set-cms-secrets.sh
```

It logs you in, asks for the Client ID and the secret, then lists what landed on `thenewsoulsearchersblogc`.

Login uses `wrangler login --device`, which prints a code you type into Cloudflare. The default flow instead waits on a `localhost:8976` callback server that exists only while the command runs, so pausing before you click **Authorize** ends in `ERR_CONNECTION_REFUSED`.

To check any time, without revealing values:

```sh
npx wrangler secret list --name thenewsoulsearchersblogc
```

### B2. Cloudflare secrets — via the dashboard

1. [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → **`thenewsoulsearchersblogc`** (the live journal Worker, the one with a **c** — not the shop, and not `thenewsoulsearchersblog` without the `c`)
3. **Settings** → **Variables and Secrets** — the runtime section. Values added under **Build** never reach the running site.
4. Name `GITHUB_OAUTH_CLIENT_ID` · type **Text** · paste the Client ID → Save
5. **Add** again: name `GITHUB_OAUTH_CLIENT_SECRET` · type **Secret** · paste the secret → Save

### Photos must be under 1 MB

The media library previews images through the GitHub contents API, which returns `"encoding": "none"` and no body for files over 1 MB. The upload still commits, so the photo works on the site while the thumbnail in the editor stays broken. iPhone photos are 2–5 MB and always hit this.

```sh
sh scripts/shrink-photo.sh ~/Desktop/IMG_1234.HEIC
```

Upload the resulting `-web.jpg`. It converts HEIC and caps the long edge at 2000px.

Two things to know about iPhone photos: they carry your **GPS location** in EXIF, and they store the image sideways with an orientation flag. Strip the metadata without rotating the pixels first and the photo shows up rotated 90° in every browser.

### C. Write a post

1. Open **https://thenewsoulsearchers.de/admin/** (apex, not www)
2. **Login with GitHub** → authorize **Soul Searchers CMS**
3. **Ride notes** or **Rides** → New → write → **Publish**
4. Wait about a minute (Cloudflare rebuild) → hard-refresh the public page

If the GitHub popup says login is not wired yet, secrets from **B** are missing.

### Stuck? Ask the Worker instead of guessing

Open **https://thenewsoulsearchers.de/cms-status**. It reports the binding names the live Worker can see — never the values.

| What it says | What it means |
| --- | --- |
| `"textBindingsVisibleToWorker": []` | The Worker sees nothing. Keys went to another Worker, or under **Build** variables instead of runtime **Variables and Secrets**. |
| Names listed but `"loginWired": false` | Names are close but unmatched. Rename to `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`. |
| `"clientIdShape": "does NOT look like a GitHub client id"` | The Client **ID** box holds the wrong value (GitHub ids start `Ov23`). |
| `"loginWired": true` | Login is ready. Go to `/admin/`. |

Five Workers (`thenewsoulsearchersblogc`, `bloga`, `blogb`, `bl`, `blo`) are Git-connected to this repo and all serve this code. `thenewsoulsearchersblogc` is the one on the domain, so its secrets are the ones that count.

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
