# Two repos: shop + blog

The **Soul Searchers blog** was split out of this monorepo so the game and blog are not mixed together.

## Where things live now

| Project | Location |
| --- | --- |
| **Plastic Particles shop** | This repo, branch **`main`** |
| **The Soul Searchers blog** | Branch **`thenewsoulsearchers`** (blog files at repo **root** on that branch) |

Blog branch URL: https://github.com/chewbacca23/plasticparticles-shop/tree/thenewsoulsearchers

---

## Create a dedicated GitHub repo (recommended)

On your Mac, once:

```sh
git clone -b thenewsoulsearchers https://github.com/chewbacca23/plasticparticles-shop.git thenewsoulsearchers
cd thenewsoulsearchers
git remote remove origin
git remote add origin https://github.com/YOUR_USER/thenewsoulsearchers.git
git push -u origin main
```

1. First create an **empty** repo on GitHub named **`thenewsoulsearchers`** (no README).
2. Replace `YOUR_USER` with your GitHub username (`chewbacca23`).
3. Update **Cloudflare Pages** → connect **`thenewsoulsearchers`** repo, **no** root subfolder, output **`dist`**.  
   See `CLOUDFLARE.md` on the blog branch.

---

## Day-to-day

```sh
# Game
git clone https://github.com/chewbacca23/plasticparticles-shop.git
cd plasticparticles-shop
npm install && npm start

# Blog (after separate clone)
git clone -b thenewsoulsearchers https://github.com/chewbacca23/plasticparticles-shop.git thenewsoulsearchers
cd thenewsoulsearchers
npm install && npm run dev
```

No more `cd soul-searchers` inside the shop repo.
