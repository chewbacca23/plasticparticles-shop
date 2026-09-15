#!/bin/sh
# Shrink a photo for the editor, on macOS (uses the built-in `sips`).
#
#   sh scripts/shrink-photo.sh ~/Desktop/IMG_1234.HEIC
#
# Writes <name>-web.jpg next to the original and leaves the original alone.
#
# Why: the CMS media library fetches previews through the GitHub contents
# API, which returns no content for files over 1 MB — the upload succeeds but
# the thumbnail is broken. iPhone photos are 2-5 MB, so they always hit this.
#
# Keeps the EXIF orientation tag: stripping it without rotating the pixels
# first leaves the photo sideways in every browser.
set -e

SRC="$1"
if [ -z "$SRC" ]; then
  echo "Usage: sh scripts/shrink-photo.sh <photo>"
  echo "Example: sh scripts/shrink-photo.sh ~/Desktop/IMG_6344.HEIC"
  exit 1
fi
if [ ! -f "$SRC" ]; then
  echo "No such file: $SRC"
  exit 1
fi

command -v sips >/dev/null 2>&1 || {
  echo "This script needs macOS (sips). Send me the photo instead and I'll place it."
  exit 1
}

DIR=$(dirname "$SRC")
BASE=$(basename "$SRC")
STEM=${BASE%.*}
OUT="$DIR/$STEM-web.jpg"

# JPEG (HEIC is converted), long edge 1600px — enough for the site, quick to load.
sips --setProperty format jpeg \
     --resampleHeightWidthMax 1600 \
     "$SRC" --out "$OUT" >/dev/null

SIZE=$(wc -c < "$OUT" | tr -d ' ')
printf 'Wrote %s (%s bytes)\n' "$OUT" "$SIZE"

if [ "$SIZE" -gt 1000000 ]; then
  echo "Still over 1 MB — run again with a smaller max:"
  echo "  sips --setProperty format jpeg --resampleHeightWidthMax 1200 \"$SRC\" --out \"$OUT\""
elif [ "$SIZE" -gt 350000 ]; then
  echo "Under 1 MB (editor OK). For a snappier site you can go smaller:"
  echo "  sips --setProperty format jpeg --resampleHeightWidthMax 1400 \"$SRC\" --out \"$OUT\""
else
  echo "Good web size. Upload this one in the editor."
fi

echo
echo "Note: iPhone photos carry your GPS location. sips may keep it."
echo "Turn it off for future shots in Settings > Privacy & Security >"
echo "Location Services > Camera > Never, or send me the photo and I'll strip it."
