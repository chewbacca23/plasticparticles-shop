#!/usr/bin/env bash
# Publish branch thenewsoulsearchers of plasticparticles-shop as its own GitHub repo:
#   https://github.com/chewbacca23/thenewsoulsearchers
#
# Git only — you do not need the GitHub CLI (gh).
# Create an empty repo in the browser first, then run this script on your Mac.

set -euo pipefail

OWNER="${OWNER:-chewbacca23}"
REPO_NAME="${REPO_NAME:-thenewsoulsearchers}"
SRC_REPO="${SRC_REPO:-https://github.com/chewbacca23/plasticparticles-shop.git}"
SRC_BRANCH="${SRC_BRANCH:-thenewsoulsearchers}"
FULL_NAME="${OWNER}/${REPO_NAME}"
NEW_URL="https://github.com/${FULL_NAME}.git"
NEW_PAGE="https://github.com/new?name=${REPO_NAME}&description=The+Soul+Searchers+journal&visibility=public"
DRY_RUN="${DRY_RUN:-0}"

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

log() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd git
need_cmd python3

need_empty_github_repo() {
  cat >&2 <<EOF
Create the empty GitHub repo in your browser (no README, no .gitignore, no license):

  ${NEW_PAGE}

Then run this again:

  ./scripts/publish-thenewsoulsearchers-repo.sh

Or, after the empty repo exists, push with git only:

  git clone --branch thenewsoulsearchers --single-branch ${SRC_REPO} thenewsoulsearchers-repo
  cd thenewsoulsearchers-repo
  git checkout -B main
  git remote set-url origin ${NEW_URL}
  git push -u origin main

You do not need the gh command.
EOF
}

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/thenewsoulsearchers-publish.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

log "Cloning ${SRC_REPO} (${SRC_BRANCH}) → ${WORKDIR}/repo"
git clone --branch "$SRC_BRANCH" --single-branch "$SRC_REPO" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git checkout -B main

if [[ -f public/admin/config.yml ]]; then
  python3 - <<'PY'
from pathlib import Path
p = Path("public/admin/config.yml")
text = p.read_text()
text = text.replace("repo: chewbacca23/plasticparticles-shop", "repo: chewbacca23/thenewsoulsearchers")
text = text.replace("branch: thenewsoulsearchers", "branch: main")
p.write_text(text)
PY
fi

cat > AGENTS.md <<'EOF'
# The Soul Searchers

Self-owned Astro journal for **thenewsoulsearchers.de**.

The Plastic Particles shop is a **different GitHub repo**: [plasticparticles-shop](https://github.com/chewbacca23/plasticparticles-shop). Do not mix them.

## Cursor Cloud specific instructions

### Run (blog)

```sh
npm install
npm run dev
```

Dev server: **http://localhost:4321**. Production: `npm run build` then `npm run preview`.
Decap editor (local): run `npm run cms:proxy` in a second terminal, then open `http://localhost:4321/admin/` and use **Login to Local Backend** (not GitHub).
Live Strato is plain HTTP; `/admin` includes a `crypto.randomUUID` polyfill. **GitHub login on Strato fails with “Invalid state key”** until a custom OAuth provider exists — expected. Edit locally → `npm run build` → upload `dist/` (see `STRATO.md`).

### Content & routes

- Stories (six photo tiles): `src/content/stories/*.md` and `public/stories/`
- Journal posts: `src/content/journal/*.md`
- Config / Impressum fields: `src/site.config.ts`
- Routes: `/`, `/stories`, `/journal`, `/about`, `/contact`, `/impressum`, `/rss.xml`, `/admin`

### Live domain

`http://thenewsoulsearchers.de` is hosted at **Strato**. HTTPS currently fails TLS until Strato SSL is enabled. Deploy steps: `STRATO.md`. Cloudflare Pages is optional (`CLOUDFLARE.md`).
EOF

if git diff --quiet && git diff --cached --quiet; then
  log "No standalone-doc changes to commit"
else
  git add AGENTS.md public/admin/config.yml
  git commit -m "Point this checkout at the standalone thenewsoulsearchers repo"
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$NEW_URL"

if [[ "$DRY_RUN" == "1" ]]; then
  log "Dry run. Would push main to ${NEW_URL}"
  git log --oneline -5
  log "origin $(git remote get-url origin | sed -E 's#https://[^@]+@#https://#')"
  exit 0
fi

if ! git ls-remote "$NEW_URL" >/dev/null 2>&1; then
  need_empty_github_repo
  exit 1
fi

log "Pushing main to ${NEW_URL}"
if ! git push -u origin main; then
  die "git push to ${NEW_URL} failed. Confirm the empty repo exists and you can push as ${OWNER}."
fi
log "Published ${NEW_URL}"
log "Shop repo is unchanged. After you confirm the new repo, you can ignore branch thenewsoulsearchers on plasticparticles-shop."
