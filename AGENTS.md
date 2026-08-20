# Plastic Particles Shop

React island shop / game (Create React App).

This checkout is **only the shop**. Do not add Soul Searchers blog files here.

**The Soul Searchers** is a separate GitHub repo: [chewbacca23/thenewsoulsearchers](https://github.com/chewbacca23/thenewsoulsearchers). If that repo is not on GitHub yet, publish it from a machine logged in as **chewbacca23**:

```sh
./scripts/publish-thenewsoulsearchers-repo.sh
```

See `REPO_SPLIT.md`.

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
