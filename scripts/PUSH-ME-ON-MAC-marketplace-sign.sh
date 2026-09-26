#!/bin/sh
# ONE-SHOT: put the Marketplace "Already here" number on thenewsoulsearchers.de
# Run this on the Mac (GitHub account that can push thenewsoulsearchersblog).
# Cursor cloud agents cannot push that repo (GitHub 403) — this script is the live path.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-berlin-crowd-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship Marketplace number sign to LIVE ==="
echo "Branch: $BRANCH"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblogc"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before marketplace-sign push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/marketplace"
echo "You should see a big gold number under ALREADY HERE."
echo ""
