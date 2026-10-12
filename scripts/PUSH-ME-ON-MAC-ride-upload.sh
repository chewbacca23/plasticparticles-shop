#!/bin/sh
# Ship ride-upload tip: UPLOAD PHOTOS block sits under Draft in the editor.
set -e
cd "$(dirname "$0")/.."
BRANCH="${1:-kuerschner-soulsearchers-ride-upload-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git
echo "=== Soul Searchers: ship ride-upload tip to LIVE ==="
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before ride-upload push"
git push "$BLOG" "HEAD:main"
echo "Done. Hard-refresh /admin — UPLOAD PHOTOS sits under Draft on Rides."
