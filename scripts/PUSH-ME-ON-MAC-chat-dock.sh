#!/bin/sh
# ONE-SHOT: ship Marketplace tip to thenewsoulsearchers.de
# Includes: crowd sign, Berlin map, come-back, cookie note, Call upon, chat dock.
# Run this on the Mac (GitHub account that can push thenewsoulsearchersblog).
# Cursor cloud agents cannot push that repo (GitHub 403) — this script is the live path.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-chat-dock-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship chat-dock tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblogc"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before chat-dock push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/marketplace"
echo "You should see Call upon + the small chat dock that stays open."
echo ""
