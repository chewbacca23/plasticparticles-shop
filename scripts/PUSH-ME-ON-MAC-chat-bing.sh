#!/bin/sh
# ONE-SHOT: ship tip to thenewsoulsearchers.de
# Includes: marketplace stack + streamlined home + Call upon bing/nudge.
# Run on the Mac inside plasticparticles-shop (NOT thenewsoulsearchers-repo).
# Cursor cloud agents get 403 on thenewsoulsearchersblog — this is the live path.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-chat-bing-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship chat-bing tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Repo: $(pwd)"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblogc"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before chat-bing push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/marketplace"
echo "Open a Call upon dock — when they reply you get a soft bing + dock nudge."
echo ""
