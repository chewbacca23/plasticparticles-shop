# Plastic Particles Shop

React island shop / game (Create React App).

This checkout is **only the shop**. Do not add Soul Searchers blog files here.

**The Soul Searchers** is a separate GitHub repo: [chewbacca23/thenewsoulsearchers](https://github.com/chewbacca23/thenewsoulsearchers). If that repo is not on GitHub yet, create an empty repo in the browser (no README), then on your Mac:

```sh
git checkout kuerschner-soulsearchers-own-repo-f04c
git pull
./scripts/publish-thenewsoulsearchers-repo.sh
```

You do not need the `gh` command. See `REPO_SPLIT.md`.

## Cursor Cloud specific instructions

### Run the shop

```sh
npm install
npm start
```

Dev server: **http://localhost:3000**

### Tests & build

```sh
CI=true npm test
CI=true npm run build
```
