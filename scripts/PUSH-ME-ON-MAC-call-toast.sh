#!/bin/sh
# ONE-SHOT: ship tip to thenewsoulsearchers.de
# Includes: Call upon top toast + two-colour chat thread (free, on-site only — no WA Business API).
# Run on the Mac inside plasticparticles-shop (NOT thenewsoulsearchers-repo).
# Cursor cloud agents get 403 on thenewsoulsearchersblog — this is the live path.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-call-toast-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship call-toast tip to LIVE ==="
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
git merge FETCH_HEAD -m "Merge live blog main before call-toast push"

echo "Pushing to live..."
git push "$BLOG" "HEAD:main"

echo ""
echo "Done. Wait ~1–2 min for Cloudflare, then hard-refresh:"
echo "  https://thenewsoulsearchers.de/marketplace"
echo "Call upon: top toast “{Name} is calling you” → Open the chat."
echo "Thread: their bubbles cool map teal, yours marketplace amber."
echo "WhatsApp outbound door still free / client-only (wa.me)."
echo ""
