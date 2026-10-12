#!/bin/sh
# ONE-SHOT: ship tip to thenewsoulsearchers.de
# Includes: marketplace stack + WhatsApp opt-in bridge (phone private, wa.me redirect).
# Run on the Mac inside plasticparticles-shop (NOT thenewsoulsearchers-repo).
# Cursor cloud agents get 403 on thenewsoulsearchersblog — this is the live path.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-wa-bridge-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship wa-bridge tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Repo: $(pwd)"
echo "Target: $BLOG main → Cloudflare Worker thenewsoulsearchersblogc"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
# Match origin tip exactly — old local blog-merge commits make `git pull` diverge.
git reset --hard "origin/$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before wa-bridge push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/marketplace"
echo "Pin with optional WhatsApp phone (+49…); open a person → Message on WhatsApp."
echo "Or tap WhatsApp a buddy — paste name + number from your phone, opens wa.me (client-only)."
echo "Digits never show on the map — only the calm bridge button."
echo ""
