# plasticparticles-shop

## Cursor Cloud specific instructions

This is a single-service [Create React App](https://create-react-app.dev/) project (React 19, `react-scripts` 5). Standard commands are documented in `README.md` and `package.json` `scripts`.

- Dev server: `BROWSER=none PORT=3000 npm start` (run in a persistent tmux session). `BROWSER=none` avoids CRA trying to launch a browser on the headless VM. Serves at `http://localhost:3000`.
- Tests: `CI=true npm test` runs the Jest/RTL suite once (non-watch). Plain `npm test` starts an interactive watcher, which will hang in an agent.
- Lint/build check: `CI=true npm run build` compiles and treats ESLint warnings as errors, so it doubles as a lint gate. ESLint config lives in `package.json` (`react-app` preset).
- The rendered app (`src/index.js` → `src/App.js`) is currently the default CRA template. The shop/game modules under `src/pages/`, `src/shop/`, `src/context/`, etc. exist in the tree but are NOT imported from `index.js`, so they are not part of the build/dev bundle. Some of those files import `react-router-dom`, which is not a declared dependency — that is fine as long as they remain unreferenced by the entry point.
