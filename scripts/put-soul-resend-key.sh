#!/bin/sh
# Put a FRESH Resend key under a NEW name: SOUL_RESEND_KEY
# (skips the cursed RESEND_API_KEY Variable slot that keeps going bad)
#
#   1. Mac-push this branch to blog main first (so the Worker reads SOUL_RESEND_KEY)
#   2. Resend → create key → copy full re_… once
#   3. sh scripts/put-soul-resend-key.sh
#
set -e

WORKER="${CMS_WORKER:-thenewsoulsearchersblogc}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-a81e1d3b6d945aa2b872e4c8fd32f382}"
SECRET_NAME="${RESEND_SECRET_NAME:-SOUL_RESEND_KEY}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"

WORKDIR=$(mktemp -d)
cd "$WORKDIR"
WRANGLER="npx --yes wrangler@4"

echo "============================================================"
echo " Put $SECRET_NAME on $WORKER"
echo "============================================================"
echo
echo "  This ignores the broken RESEND_API_KEY slot."
echo "  You can leave RESEND_API_KEY alone or delete it later."
echo

if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "Cloudflare login — open the URL, type the code."
  $WRANGLER login --device
  echo
fi

$WRANGLER whoami || true
echo
echo "Paste the Resend key (must start with re_), then Return."
echo "Paste is invisible. One line only."
echo
$WRANGLER secret put "$SECRET_NAME" --name "$WORKER"

echo
echo "Secrets on $WORKER:"
$WRANGLER secret list --name "$WORKER" || true
echo
echo "Hard-refresh https://thenewsoulsearchers.de/cms-status"
echo "Need:"
echo "  mailKeyBinding: \"$SECRET_NAME\""
echo "  mailKeyShape.startsWithRe: true"
echo "  mailKeyProbe.ok: true"
echo
echo "If still false, Mac-push the form-mail-feel branch first — live must know SOUL_RESEND_KEY."
