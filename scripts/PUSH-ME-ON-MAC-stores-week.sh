#!/bin/sh
# ONE-SHOT: ship tip to thenewsoulsearchers.de
# Includes: stores, this week, kit trim (no double-handlebar shots), photo enhance stack.
# Run on the Mac inside plasticparticles-shop (NOT thenewsoulsearchers-repo).
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-stores-week-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship stores-week tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Repo: $(pwd)"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblogc"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before stores-week push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/kit"
echo "  https://thenewsoulsearchers.de/stores"
echo "  https://thenewsoulsearchers.de/week"
echo "Kit should show only jersey, bibs, musette — no double-handlebar shot."
echo ""
