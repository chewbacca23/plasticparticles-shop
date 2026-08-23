# Strato FTP — upload The Soul Searchers

Your domain **thenewsoulsearchers.de** already lives on Strato. You do **not** need to send FTP passwords in chat — keep them in Strato / GitHub Secrets only.

---

## What you need from Strato

In [Strato Login](https://www.strato.de/apps/CustomerLogin) → your package → **FTP & SSH** (or **File Manager**), note:

| Setting | Example | Where |
| --- | --- | --- |
| FTP host | `stu672058243` | FTP & SSH page |
| Username | `thenewsoulsearchers` | same |
| Password | *(you set this — never share it)* | same |
| Remote folder | `/` | web root for the domain |

Also useful: **SFTP** on port 22 if FTP is blocked (FileZilla: SFTP protocol).

---

## Safest: upload once by hand (~10 min)

1. **Back up WordPress**  
   Download the current web folder via File Manager or FileZilla (zip on your PC).

2. Locally:
   ```sh
   npm install
   npm run build
   ```

3. **Upload**  
   Open FileZilla (or Strato File Manager).  
   Local side: open folder **`dist/`**  
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
chmod +x scripts/deploy-strato.sh
FTP_SERVER=stu672058243 \
FTP_USERNAME=thenewsoulsearchers \
FTP_PASSWORD=YOUR_PASSWORD \
FTP_REMOTE_DIR=/ \
./scripts/deploy-strato.sh
```

---

## Edit content (Decap) — working path

**Do not use “Login with GitHub” on the live Strato site.**  
That flow needs a separate OAuth app + server. Without it you get:

`Authentication Error … Invalid state key`

That message means the GitHub login handshake lost its security token (no OAuth backend for this host). It is **not** a bad password and **not** a broken `config.yml`.

### What to do instead

1. On your Mac, in the blog folder:
   ```sh
   cd ~/thenewsoulsearchers
   git pull
   npm install
   ```
2. **Terminal 1:** `npm run cms:proxy`  
3. **Terminal 2:** `npm run dev`  
4. Browser: **http://localhost:4321/admin/index.html**  
5. Click **Login to Local Backend** (not GitHub).  
6. Edit stories / journal / photos.  
7. Publish locally, then:
   ```sh
   npm run build
   ```
8. Cyberduck: upload **everything inside `dist/`** to Strato `/` (overwrite).

Live `/admin` can open the CMS UI, but saving via GitHub login will keep failing until OAuth is set up later (optional).

---

## After go-live

- Email `hello@thenewsoulsearchers.de` only works if you set up mail in Strato (optional).
- Old WordPress stats are gone — add Plausible or Cloudflare Analytics later if you want visitor counts.

---

## Do not share in chat

- FTP password  
- Strato login password  

If something fails, paste **error messages only** (redacted usernames), or a screenshot of the FTP host/path fields with password hidden.
