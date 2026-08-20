#!/usr/bin/env bash
# Publish branch thenewsoulsearchers of plasticparticles-shop as its own GitHub repo:
#   https://github.com/chewbacca23/thenewsoulsearchers
#
# Run this on a machine logged into GitHub as chewbacca23 (your Mac).
# Cursor Cloud cannot create that repo: its GitHub App token is limited to this shop.

set -euo pipefail

OWNER="${OWNER:-chewbacca23}"
REPO_NAME="${REPO_NAME:-thenewsoulsearchers}"
SRC_REPO="${SRC_REPO:-https://github.com/chewbacca23/plasticparticles-shop.git}"
SRC_BRANCH="${SRC_BRANCH:-thenewsoulsearchers}"
FULL_NAME="${OWNER}/${REPO_NAME}"
NEW_URL="https://github.com/${FULL_NAME}.git"
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
need_cmd gh

cannot_create_user_repos() {
  cat >&2 <<EOF
This GitHub login cannot create ${FULL_NAME}
(Cursor Cloud uses an app token limited to plasticparticles-shop).

On your Mac, in Terminal (logged into GitHub as ${OWNER}):

  1. Create the empty repo (no README, no .gitignore, no license):
     https://github.com/new?name=${REPO_NAME}&description=The+Soul+Searchers+journal&visibility=public

  2. Publish from the shop (the script is on this branch until it is merged):

     git clone https://github.com/chewbacca23/plasticparticles-shop.git
     cd plasticparticles-shop
     git checkout kuerschner-soulsearchers-own-repo-f04c
     ./scripts/publish-thenewsoulsearchers-repo.sh

     If you already have the shop folder, skip clone and start at cd / git checkout.

  One-shot if gh is already authenticated as ${OWNER}:

     gh repo create ${FULL_NAME} --public --description "The Soul Searchers — journal at thenewsoulsearchers.de" --homepage "http://thenewsoulsearchers.de"
     git checkout kuerschner-soulsearchers-own-repo-f04c
     ./scripts/publish-thenewsoulsearchers-repo.sh
EOF
}

login="$(gh api user --jq .login 2>/dev/null || true)"
if [[ ! "$login" =~ ^[A-Za-z0-9_-]+$ ]]; then
  login=""
fi
if [[ "$login" != "$OWNER" ]]; then
  if [[ "$DRY_RUN" == "1" ]]; then
    log "Dry run: skipping GitHub repo create (login=${login:-not-${OWNER}})"
  else
    cannot_create_user_repos
    exit 1
  fi
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/thenewsoulsearchers-publish.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

log "Cloning ${SRC_REPO} (${SRC_BRANCH}) → ${WORKDIR}/repo"
git clone --branch "$SRC_BRANCH" --single-branch "$SRC_REPO" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git checkout -B main

# Point Decap at the standalone repo (idempotent).
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

if gh repo view "$FULL_NAME" >/dev/null 2>&1; then
  log "Repo ${FULL_NAME} already exists — pushing main"
else
  log "Creating ${FULL_NAME}"
  if ! gh repo create "$FULL_NAME" \
    --public \
    --description "The Soul Searchers — journal at thenewsoulsearchers.de" \
    --homepage "http://thenewsoulsearchers.de" \
    --disable-wiki; then
    cannot_create_user_repos
    exit 1
  fi
fi

if ! git push -u origin main; then
  die "git push to ${NEW_URL} failed. On GitHub: grant this account push access, or run the script as ${OWNER}."
fi
log "Published ${NEW_URL}"
log "Shop repo is unchanged. After you confirm the new repo, you can ignore branch thenewsoulsearchers on plasticparticles-shop."
