#!/bin/sh
# Put the GitHub OAuth keys on the Worker that actually serves
# thenewsoulsearchers.de, without hunting through the Cloudflare dashboard.
#
#   sh scripts/set-cms-secrets.sh
#
# Targets the Worker by name, so the other Workers connected to this repo
# (thenewsoulsearchersblog, bloga, blogb, bl, blo) cannot swallow the keys.
set -e

WORKER="${CMS_WORKER:-thenewsoulsearchersblogc}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-a81e1d3b6d945aa2b872e4c8fd32f382}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"

# Run outside the repo so the checked-in wrangler.toml (named for the Git
# repo, not this Worker) cannot redirect the secrets somewhere else.
WORKDIR=$(mktemp -d)
cd "$WORKDIR"

WRANGLER="npx --yes wrangler@4"

echo "Worker:  $WORKER"
echo "Account: $ACCOUNT"
echo

if ! $WRANGLER whoami >/dev/null 2>&1; then
  # Device flow instead of the default localhost:8976 callback: that callback
  # server only lives while the command waits, so any pause before clicking
  # Authorize ends in ERR_CONNECTION_REFUSED. Device codes last 5 minutes.
  echo "Logging in to Cloudflare."
  echo "A code will appear below — type it into the page that opens."
  echo
  $WRANGLER login --device
  echo
fi

$WRANGLER whoami || true
echo
echo "------------------------------------------------------------"
echo "1/2  Paste the GitHub OAuth *Client ID* (starts with Ov23),"
echo "     then press Return. Nothing will appear as you paste."
echo "------------------------------------------------------------"
$WRANGLER secret put GITHUB_OAUTH_CLIENT_ID --name "$WORKER"

echo
echo "------------------------------------------------------------"
echo "2/2  Paste the GitHub *client secret*, then press Return."
echo "------------------------------------------------------------"
$WRANGLER secret put GITHUB_OAUTH_CLIENT_SECRET --name "$WORKER"

echo
echo "Secrets now on $WORKER:"
$WRANGLER secret list --name "$WORKER"

echo
echo "Done. Open https://thenewsoulsearchers.de/cms-status"
echo "Expect \"loginWired\": true — then https://thenewsoulsearchers.de/admin/"
