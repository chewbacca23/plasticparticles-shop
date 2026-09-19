#!/bin/sh
# Nuclear reset for RESEND_API_KEY on thenewsoulsearchersblogc.
# Deletes any dashboard Variable/Secret confusion by overwriting via wrangler,
# after you have deleted the Variable in the Cloudflare UI.
#
#   1. Cloudflare → Workers → thenewsoulsearchersblogc → Settings → Variables
#      Delete RESEND_API_KEY if it appears as a Variable (eye / visible value).
#   2. Resend → create a fresh key → copy the WHOLE re_… string
#   3. sh scripts/reset-resend-key.sh
#
set -e

WORKER="${CMS_WORKER:-thenewsoulsearchersblogc}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-a81e1d3b6d945aa2b872e4c8fd32f382}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"

WORKDIR=$(mktemp -d)
cd "$WORKDIR"
WRANGLER="npx --yes wrangler@4"

echo "============================================================"
echo " Reset RESEND_API_KEY on $WORKER"
echo "============================================================"
echo
echo "BEFORE you continue:"
echo "  Cloudflare → $WORKER → Settings → Variables and secrets"
echo "  → Delete RESEND_API_KEY if it is listed as a Variable"
echo "    (visible value). Secrets are ok to overwrite."
echo
echo "  Resend → API Keys → Create → copy the full re_… key"
echo
printf "Type YES when the Variable is deleted and you have a fresh re_ key: "
read -r confirm
case "$confirm" in
  YES|yes) ;;
  *)
    echo "Stopped. Delete the Variable first, then run again."
    exit 1
    ;;
esac

if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo
  echo "Cloudflare login — open the URL, type the code."
  $WRANGLER login --device
fi

echo
echo "Paste the Resend key (must start with re_), then Return."
echo "Paste is invisible. One line only — no spaces before re_."
echo
$WRANGLER secret put RESEND_API_KEY --name "$WORKER"

echo
echo "Secrets on $WORKER:"
$WRANGLER secret list --name "$WORKER" || true
echo
echo "Hard-refresh https://thenewsoulsearchers.de/cms-status"
echo "Need: mailKeyShape.startsWithRe true, mailKeyProbe.ok true"
echo "Paste that JSON in chat if it still fails (safe — no secret values)."
