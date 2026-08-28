#!/bin/sh
# Push this cycling-blog branch to the Cloudflare GitHub repo (thenewsoulsearchersblog).
# Run from the shop/blog checkout. You will be asked to log in to GitHub if needed.
set -e
BRANCH=$(git branch --show-current)
echo "Pushing $BRANCH -> thenewsoulsearchersblog main (this updates the live Worker)"
git push --force "https://github.com/chewbacca23/thenewsoulsearchersblog.git" "$BRANCH:main"
echo "Done. Cloudflare should rebuild. Then hard-refresh https://thenewsoulsearchers.de"
