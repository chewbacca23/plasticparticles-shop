#!/bin/sh
# ONE-SHOT: ship ride → home startup-pics tip to thenewsoulsearchers.de
# Run on the Mac (GitHub account that can push thenewsoulsearchersblog).
# Shop PR #45 is NOT the live vehicle. Live Git source is this repo's blog:
#   https://github.com/chewbacca23/thenewsoulsearchersblog  (main)
# Cursor cloud agents often get 403 on that repo — this script is the live path.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-ride-startup-live-9af5}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship ride startup-pics tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Repo: $(pwd)"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblogc"
echo "Site: https://thenewsoulsearchers.de/"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before ride-startup-pics push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/"
echo "A new Ride Save should put its cover into the home dia without Site → Home."
echo ""
