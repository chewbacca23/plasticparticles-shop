#!/bin/sh
# Put ONE working Resend key on the Worker that serves thenewsoulsearchers.de.
#
# Prefer this over the Cloudflare dashboard (easy to edit the wrong Worker,
# or leave the key as a dead Variable while junk keys sit beside it).
#
#   sh scripts/set-resend-secret.sh
#
# Before you run it:
#   1. Open https://resend.com/api-keys
#   2. Delete / revoke old keys (anything you pasted into chat is burned)
#   3. Create → name it "soulsearchers-live" → copy the re_… key once
#
set -e

WORKER="${CMS_WORKER:-thenewsoulsearchersblogc}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-a81e1d3b6d945aa2b872e4c8fd32f382}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"

# Run outside the repo so a stray wrangler.toml cannot retarget the secret.
WORKDIR=$(mktemp -d)
cd "$WORKDIR"

WRANGLER="npx --yes wrangler@4"

echo "============================================================"
echo " Soul Searchers — Resend key → live Worker"
echo "============================================================"
echo
echo "  Worker (must have the trailing c):  $WORKER"
echo "  Account:                            $ACCOUNT"
echo
echo "  Wrong Workers to ignore: thenewsoulsearchersblog (no c),"
echo "  bloga, blogb, bl, blo, plasticparticles-shop."
echo

if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "Step 1/3 — Cloudflare login"
  echo "A code will appear below. Open the URL it prints and type the code."
  echo
  $WRANGLER login --device
  echo
fi

echo "Logged in as:"
$WRANGLER whoami || true
echo
echo "Step 2/3 — Paste the NEW Resend key (starts with re_), then press Return."
echo "Nothing will appear as you paste — that is normal. One line only."
echo
# secret put deploys a new Worker version with the key attached.
$WRANGLER secret put RESEND_API_KEY --name "$WORKER"

echo
echo "Step 3/3 — Names on $WORKER (values stay hidden):"
$WRANGLER secret list --name "$WORKER" || true

echo
echo "Done with the terminal. Now in the browser:"
echo "  1. Hard-refresh https://thenewsoulsearchers.de/cms-status"
echo "     Expect mailWired true, mailVia resend."
echo "  2. Cloudflare → Workers → $WORKER → Settings → Variables"
echo "     Delete junk Variables named thenewsoulsearchers or soulsearchers"
echo "     if they still show (wrong names, unused)."
echo "  3. Hard-refresh /contact and send yourself one short test → Sent."
echo
echo "If Send still says the mail key was rejected, the Resend key is still"
echo "wrong — create another fresh key in Resend and run this script again."
