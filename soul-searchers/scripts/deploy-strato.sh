#!/usr/bin/env bash
# Build The Soul Searchers and optionally upload to Strato via FTP.
# Never commit passwords — use env vars or GitHub Actions secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Building site…"
npm ci
npm run build

DIST="$ROOT/dist"
if [[ ! -f "$DIST/index.html" ]]; then
  echo "Build failed: $DIST/index.html missing" >&2
  exit 1
fi

echo "✓ Build ready: $DIST"
echo ""
echo "Manual upload (Strato File Manager or FileZilla):"
echo "  Upload ALL files inside dist/ to your web root."
echo "  Back up WordPress files first if they are still there."
echo ""

if [[ -z "${FTP_SERVER:-}" || -z "${FTP_USERNAME:-}" || -z "${FTP_PASSWORD:-}" ]]; then
  echo "Optional auto-upload: set FTP_SERVER, FTP_USERNAME, FTP_PASSWORD"
  echo "  Optional: FTP_REMOTE_DIR (default: /)"
  echo "  Example: FTP_SERVER=ftp.strato.de FTP_USERNAME=... FTP_PASSWORD=... ./scripts/deploy-strato.sh"
  exit 0
fi

REMOTE="${FTP_REMOTE_DIR:-/}"

if ! command -v lftp >/dev/null 2>&1; then
  echo "Install lftp for auto-upload (apt install lftp / brew install lftp)" >&2
  exit 1
fi

echo "→ Uploading to $FTP_SERVER:$REMOTE …"
lftp -c "
set ssl:verify-certificate no;
open -u $FTP_USERNAME,$FTP_PASSWORD $FTP_SERVER;
lcd $DIST;
cd $REMOTE;
mirror -R --delete --verbose . .
"

echo "✓ Upload complete. Check https://thenewsoulsearchers.de/"
