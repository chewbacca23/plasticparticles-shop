#!/bin/sh
# Push this branch to the Cloudflare GitHub repo (thenewsoulsearchersblog).
# Prefer a normal fast-forward so live CMS posts are not overwritten.
set -e
BRANCH=$(git branch --show-current)
echo "Pushing $BRANCH -> thenewsoulsearchersblog main (this updates the live Worker)"
if git push "https://github.com/chewbacca23/thenewsoulsearchersblog.git" "$BRANCH:main"; then
  echo "Done. Cloudflare should rebuild. Then hard-refresh https://thenewsoulsearchers.de"
  echo "If you use the editor: https://thenewsoulsearchers.de/admin/"
  exit 0
fi

echo ""
echo "Normal push was rejected (live main has commits this branch does not)."
echo "Pull those first, or you will wipe posts saved in the live editor."
echo ""
echo "  git fetch https://github.com/chewbacca23/thenewsoulsearchersblog.git main"
echo "  git merge FETCH_HEAD"
echo "  then run this script again"
echo ""
echo "Only force-push if you really mean to replace live main:"
echo "  git push --force https://github.com/chewbacca23/thenewsoulsearchersblog.git $BRANCH:main"
exit 1
