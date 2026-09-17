#!/bin/sh
# Put Resend on the Worker that actually serves thenewsoulsearchers.de.
# Skips the Cloudflare dashboard (easy to land the key on the wrong Worker).
#
#   sh scripts/set-resend-secret.sh
#
# Needs a Resend API key from https://resend.com → API Keys.
# Domain sending for thenewsoulsearchers.de should already be verified.
set -e

WORKER="${CMS_WORKER:-thenewsoulsearchersblogc}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-a81e1d3b6d945aa2b872e4c8fd32f382}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"

# Run outside the repo so a stray wrangler.toml cannot retarget the secret.
WORKDIR=$(mktemp -d)
cd "$WORKDIR"

WRANGLER="npx --yes wrangler@4"

echo "Worker:  $WORKER"
echo "Account: $ACCOUNT"
echo

if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "Logging in to Cloudflare."
  echo "A code will appear below — type it into the page that opens."
  echo
  $WRANGLER login --device
  echo
fi

$WRANGLER whoami || true
echo
echo "------------------------------------------------------------"
echo "Paste the Resend API key (starts with re_), then press Return."
echo "Nothing will appear as you paste — that is normal."
echo "------------------------------------------------------------"
$WRANGLER secret put RESEND_API_KEY --name "$WORKER"

echo
echo "Secrets now on $WORKER:"
$WRANGLER secret list --name "$WORKER"

echo
echo "Done. Hard-refresh https://thenewsoulsearchers.de/cms-status"
echo "Expect \"mailWired\": true and RESEND_API_KEY in textBindingsVisibleToWorker."
echo "Then hard-refresh /contact and send yourself a short test."
