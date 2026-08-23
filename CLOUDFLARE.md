# Cloudflare Pages — free, for thenewsoulsearchers.de

You keep the **domain at Strato**. Cloudflare only **serves** the site. The Free plan is **$0**. Ignore upgrade ads.

The shop repo is still `plasticparticles-shop`. The blog is branch **`thenewsoulsearchers`** (files at the repo root). Do not use branch `main` — that is the game.

---

## 1. Cloudflare account

1. Open [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Use your email. Stay on the **Free** plan.

---

## 2. Create the Pages project

The sidebar often shows only **Workers**. That is normal. Pages is a small extra click.

1. Left menu: **Compute** (or **Workers**) → **Workers & Pages**
2. Top right: **Create** / **Create application**
3. Do **not** stay on the big Workers form. Look near the bottom for **Looking to deploy Pages?** → **Get started**
4. Or open this: [Create a Pages project](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages)
5. Choose **Connect to Git** → **GitHub** → allow **`chewbacca23/plasticparticles-shop`**
6. Use these exact settings:

| Setting | Value |
| --- | --- |
| Project name | `thenewsoulsearchers` |
| Production branch | **`thenewsoulsearchers`** (not `main`) |
| Root directory | *(leave empty)* |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |

7. **Save and Deploy**
8. Wait until it is green. Open the `*.pages.dev` URL they give you — that is already your new site (HTTPS).

If an old project still points at folder `soul-searchers`, delete it or change it to the table above.

---

## 3. Point the real domain (keep it at Strato)

Apex domains (`thenewsoulsearchers.de`) need the domain added as a Cloudflare **zone**, then Strato nameservers.

### If you use Strato email

Before you change nameservers, open Strato DNS and **photo the MX records**. After the domain is in Cloudflare → **DNS** → add the same MX records so mail keeps working.

### Add the zone and nameservers

1. Cloudflare → **Add a site** → `thenewsoulsearchers.de` → **Free**
2. Cloudflare shows two nameservers (like `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`)
3. Strato login → your domain → **Nameserver** (or DNS) → use **Cloudflare’s two nameservers**
4. Back in Cloudflare, wait until the zone is **Active** (can take from a few minutes to a few hours)

### Attach Pages to the domain

1. Pages project `thenewsoulsearchers` → **Custom domains** → **Set up a domain**
2. Add `thenewsoulsearchers.de` and `www.thenewsoulsearchers.de`
3. Cloudflare will create the CNAME for you once nameservers are active
4. Wait for the SSL certificate (usually short)

Then open **https://thenewsoulsearchers.de** — HTTPS should work. You can stop uploading with Cyberduck.

---

## 4. Day to day (this is the easy bit)

On your Mac, blog branch:

```sh
git checkout thenewsoulsearchers
npm run cms
```

Edit at http://localhost:4321/admin/index.html then:

```sh
git add -A
git commit -m "Update journal"
git push
```

Cloudflare rebuilds by itself. No FTP.

---

## 5. Check

- https://thenewsoulsearchers.de/
- https://thenewsoulsearchers.de/journal
- https://thenewsoulsearchers.de/stories

Live `/admin` on HTTPS still cannot GitHub-save until we add OAuth later. Writing on the Mac + `git push` is enough.

---

## If something is red

- Production branch was `main` → change it to **`thenewsoulsearchers`** and Retry
- Build says old Node → set `NODE_VERSION` = `22`
- Domain stuck → nameservers at Strato must match Cloudflare exactly
- Site still shows the old Strato page → DNS not switched yet; use the `*.pages.dev` URL in the meantime
