#!/bin/sh
# Push this branch to the Cloudflare GitHub repo (thenewsoulsearchersblog).
# Prefer a normal fast-forward so live CMS posts are not overwritten.
set -e
BRANCH=$(git branch --show-current)
BLOG_URL="${BLOG_PUSH_URL:-https://github.com/chewbacca23/thenewsoulsearchersblog.git}"
echo "Pushing $BRANCH -> thenewsoulsearchersblog main (this updates the live Worker)"

set +e
PUSH_OUT=$(git push "$BLOG_URL" "$BRANCH:main" 2>&1)
PUSH_CODE=$?
set -e
echo "$PUSH_OUT"

if [ "$PUSH_CODE" -eq 0 ]; then
  echo "Done. Cloudflare should rebuild. Then hard-refresh https://thenewsoulsearchers.de"
  echo "If you use the editor: https://thenewsoulsearchers.de/admin/"
  exit 0
fi

echo ""
case "$PUSH_OUT" in
  *Permission*denied*|*403*|*denied\ to\ cursor*)
    echo "GitHub refused the push (no write access to thenewsoulsearchersblog from this environment)."
    echo "On a Mac logged into a GitHub account that can push that repo, run:"
    echo ""
    echo "  git fetch origin && git checkout $BRANCH && git pull && \\"
    echo "    git fetch https://github.com/chewbacca23/thenewsoulsearchersblog.git main && \\"
    echo "    git merge FETCH_HEAD && ./scripts/push-live-cloudflare-blog.sh"
    echo ""
    echo "Then hard-refresh https://thenewsoulsearchers.de/marketplace"
    exit 1
    ;;
esac

echo "Normal push was rejected (live main likely has commits this branch does not)."
echo "Pull those first, or you will wipe posts saved in the live editor."
echo ""
echo "  git fetch https://github.com/chewbacca23/thenewsoulsearchersblog.git main"
echo "  git merge FETCH_HEAD"
echo "  then run this script again"
echo ""
echo "Only force-push if you really mean to replace live main:"
echo "  git push --force https://github.com/chewbacca23/thenewsoulsearchersblog.git $BRANCH:main"
exit 1
