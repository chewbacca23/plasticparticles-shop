# Two repos: shop + blog

The Soul Searchers blog must not live in this shop repository. Agents and humans mix them up when both projects share `plasticparticles-shop`.

| Project | Location |
| --- | --- |
| **Plastic Particles shop** | This repo (`main`) |
| **The Soul Searchers blog** | Dedicated repo **[chewbacca23/thenewsoulsearchers](https://github.com/chewbacca23/thenewsoulsearchers)** |

Until that dedicated repo exists, the blog *source* is still branch `thenewsoulsearchers` in this repo. Cursor Cloud cannot create the GitHub repo. You do **not** need `gh`.

1. Empty repo (no README): [create thenewsoulsearchers](https://github.com/new?name=thenewsoulsearchers&description=The+Soul+Searchers+journal&visibility=public)
2. On your Mac, in the shop folder:

```sh
git checkout kuerschner-soulsearchers-own-repo-f04c
git pull
./scripts/publish-thenewsoulsearchers-repo.sh
```

## Day-to-day after publish

```sh
# Game
git clone https://github.com/chewbacca23/plasticparticles-shop.git
cd plasticparticles-shop
npm install && npm start

# Blog
git clone https://github.com/chewbacca23/thenewsoulsearchers.git
cd thenewsoulsearchers
npm install && npm run dev
```

Open the blog in Cursor as **its own repo**. Do not `git checkout thenewsoulsearchers` inside the shop.

## Cloudflare Pages

Connect **`chewbacca23/thenewsoulsearchers`**, production branch **`main`**, no root subfolder, output **`dist`**. See `CLOUDFLARE.md` in the blog repo.
