#!/bin/sh
# Ship side-thumbs tip: photos sit on the right of the text; migrate old store photo fields.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-kuerschner-soulsearchers-side-thumbs-f04c}"
BLOG=https://github.com/chewbacca23/thenewsoulsearchersblog.git

echo ""
echo "=== Soul Searchers: ship side-thumbs tip to LIVE ==="
echo "Branch: $BRANCH"
echo "Repo: $(pwd)"
echo ""

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "Merging live editor Saves from blog main (so we do not wipe posts)..."
git fetch "$BLOG" main
git merge FETCH_HEAD -m "Merge live blog main before side-thumbs push" || {
  echo ""
  echo "Merge hit a conflict. If it is Fast Pedal Manchester (already deleted on live):"
  echo "  git rm -f src/content/stores/fast-pedal-manchester.md"
  echo "  git commit -m \"Merge live blog main; keep Manchester store deleted\""
  echo "Then re-run: sh scripts/PUSH-ME-ON-MAC-side-thumbs.sh"
  exit 1
}

echo "Migrating old singular store photo: fields into photos: lists..."
sh scripts/migrate-store-photos.sh
if ! git diff --quiet -- src/content/stores; then
  git add src/content/stores
  git commit -m "Migrate store photo fields into photos lists for the editor"
fi

git push "$BLOG" "HEAD:main"
echo ""
echo "Done. Hard-refresh:"
echo "  https://thenewsoulsearchers.de/admin/"
echo "  https://thenewsoulsearchers.de/stores"
echo "  https://thenewsoulsearchers.de/week"
echo "Thumbs sit on the right of the text. Re-attach any week shots under UPLOAD PHOTOS → Save."
