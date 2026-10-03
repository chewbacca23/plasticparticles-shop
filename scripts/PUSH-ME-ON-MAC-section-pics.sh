#!/bin/sh
# ONE-SHOT: ship tip to thenewsoulsearchers.de
# Includes: multi-photo Stores (2–6) + This week galleries (3–15).
# Run on the Mac inside plasticparticles-shop (NOT thenewsoulsearchers-repo).
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-section-pics-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship section-pics tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Repo: $(pwd)"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblog"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before section-pics push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/stores"
echo "  https://thenewsoulsearchers.de/week"
echo "  https://thenewsoulsearchers.de/admin/"
echo "Admin: Stores → Photos (max 6, first = cover)."
echo "Admin: This week → Photos (aim 3–10, max 15)."
echo ""
