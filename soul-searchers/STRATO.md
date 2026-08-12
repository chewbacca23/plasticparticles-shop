# Strato FTP — upload The Soul Searchers

Your domain **thenewsoulsearchers.de** already lives on Strato. You do **not** need to send FTP passwords in chat — keep them in Strato / GitHub Secrets only.

---

## What you need from Strato

In [Strato Login](https://www.strato.de/apps/CustomerLogin) → your package → **FTP & SSH** (or **File Manager**), note:

| Setting | Example | Where |
| --- | --- | --- |
| FTP host | `ftp.strato.de` or `schaltplan.strato.de` | FTP & SSH page |
| Username | your Strato FTP user | same |
| Password | (you set this) | same |
| Remote folder | `/` or `/htdocs/` | often web root for the domain |

Also useful: **SFTP** on port 22 if FTP is blocked (FileZilla: SFTP protocol).

---

## Safest: upload once by hand (~10 min)

1. **Back up WordPress**  
   Download the current web folder via File Manager or FileZilla (zip on your PC).

2. **Build the new site** (on your Mac/PC or after merging the PR):
   ```sh
   cd soul-searchers
   npm install
   npm run build
   ```

3. **Upload**  
   Open FileZilla (or Strato File Manager).  
   Local side: open folder `soul-searchers/dist/`  
   Remote side: web root for `thenewsoulsearchers.de`  
   Upload **everything inside `dist/`** (not the `dist` folder itself):
   - `index.html`
   - `journal/`, `about/`, `contact/`, `path/`
   - `rss.xml`, `sitemap-index.xml`, `favicon.svg`, `CNAME`, etc.

4. **Optional:** rename old WordPress `wp-config.php` / move `wp-admin` to `_wp-backup/` so PHP doesn’t fight the static site.

5. **Check**  
   https://thenewsoulsearchers.de/  
   https://thenewsoulsearchers.de/journal  

6. **`.com` redirect (optional)**  
   In Strato domain settings, point **thenewsoulsearchers.com** to the same folder or set a redirect to `.de`.

---

## Auto deploy from GitHub (no password in chat)

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `STRATO_FTP_SERVER` — e.g. `ftp.strato.de`
   - `STRATO_FTP_USERNAME`
   - `STRATO_FTP_PASSWORD`
   - `STRATO_FTP_REMOTE_DIR` — optional, default `/`

2. **Actions** → **Deploy Soul Searchers to Strato (FTP)** → **Run workflow**

Workflow file: `.github/workflows/deploy-strato-ftp.yml`

---

## Local script (password in terminal only)

```sh
cd soul-searchers
chmod +x scripts/deploy-strato.sh
FTP_SERVER=ftp.strato.de \
FTP_USERNAME=your-user \
FTP_PASSWORD=your-pass \
FTP_REMOTE_DIR=/ \
./scripts/deploy-strato.sh
```

---

## After go-live

- Email `hello@thenewsoulsearchers.de` only works if you set up mail in Strato (optional).
- Old WordPress stats are gone — add Plausible or Cloudflare Analytics later if you want visitor counts.

---

## Do not share in chat

- FTP password  
- Strato login password  

If something fails, paste **error messages only** (redacted usernames), or a screenshot of the FTP host/path fields with password hidden.
