#!/bin/sh
# One-shot enhance for a single photo (macOS-friendly).
#
#   sh scripts/enhance-photo.sh ~/Desktop/IMG_1234.HEIC
#   sh scripts/enhance-photo.sh ~/Desktop/ride.jpg --in-place
#
# HEIC: converts with macOS `sips` to a temp JPEG, then runs the Pillow
# enhancer. Other formats go straight to python3 scripts/enhance-photos.py.
#
# Needs: python3 + Pillow (`pip3 install pillow`). On Mac, `sips` for HEIC.
set -e

SRC="$1"
if [ -z "$SRC" ]; then
  echo "Usage: sh scripts/enhance-photo.sh <photo> [--in-place] [--check]"
  echo "Example: sh scripts/enhance-photo.sh ~/Desktop/IMG_6344.HEIC"
  exit 1
fi
shift || true

if [ ! -f "$SRC" ]; then
  echo "No such file: $SRC"
  exit 1
fi

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
PY="$ROOT/scripts/enhance-photos.py"

IN_PLACE=0
CHECK=0
for arg in "$@"; do
  case "$arg" in
    --in-place) IN_PLACE=1 ;;
    --check) CHECK=1 ;;
  esac
done

EXT=$(printf '%s' "$SRC" | tr '[:upper:]' '[:lower:]')
case "$EXT" in
  *.heic|*.heif)
    command -v sips >/dev/null 2>&1 || {
      echo "HEIC on this machine needs macOS sips, or: pip3 install pillow-heif"
      echo "Falling through to Python (may fail without pillow-heif)…"
      exec python3 "$PY" "$SRC" "$@"
    }
    DIR=$(dirname "$SRC")
    BASE=$(basename "$SRC")
    STEM=${BASE%.*}
    TMP="$DIR/${STEM}.__enhance_src.jpg"
    cleanup() { rm -f "$TMP"; }
    trap cleanup EXIT INT TERM
    # Flatten HEIC → JPEG; enhancer bakes orientation again and strips GPS.
    sips --setProperty format jpeg "$SRC" --out "$TMP" >/dev/null

    if [ "$CHECK" -eq 1 ]; then
      python3 "$PY" "$TMP" --check
      exit $?
    fi

    if [ "$IN_PLACE" -eq 1 ]; then
      # Enhance the temp, then replace a sibling .jpg named after the HEIC.
      python3 "$PY" "$TMP" --in-place
      FINAL="$DIR/${STEM}.jpg"
      mv "$TMP" "$FINAL"
      trap - EXIT INT TERM
      echo "Wrote $FINAL (from HEIC, in-place as JPEG)"
    else
      python3 "$PY" "$TMP"
      ENHANCED="$DIR/${STEM}.__enhance_src_enhanced.jpg"
      FINAL="$DIR/${STEM}_enhanced.jpg"
      if [ -f "$ENHANCED" ]; then
        mv "$ENHANCED" "$FINAL"
        echo "Renamed to $FINAL"
      fi
    fi
    ;;
  *)
    exec python3 "$PY" "$SRC" "$@"
    ;;
esac
