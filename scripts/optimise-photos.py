#!/usr/bin/env python3
"""Keep photos in public/ small enough for the CMS media library.

Decap previews media through the GitHub contents API, which returns
``"encoding": "none"`` and an empty body for files over 1 MB. An upload of a
straight-from-the-phone photo therefore commits fine while its thumbnail in
the editor stays broken forever.

Run with no arguments to resize anything too large in place:

    python3 scripts/optimise-photos.py

Run with --check to report without touching files (exits 1 if any are too
large), which is what you want in a pre-deploy check:

    python3 scripts/optimise-photos.py --check
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - dependency guidance only
    sys.exit("Pillow is required: pip install Pillow")

# Not a preference — GitHub's contents API returns no body above 1 MB, and
# that is what the CMS media library previews through. Raising this number
# does not raise theirs; it just stops photos being resized and puts the
# broken thumbnails back. Headroom is for re-encodes creeping upward.
MAX_BYTES = 950_000

# Largest first, so a photo keeps as much detail as the byte ceiling allows.
# A 12 MP phone photo lands near 880 KB at 3000px/q86, so most arrive close
# to full resolution; the smaller steps are fallbacks for very busy images.
EDGE_STEPS = (3000, 2600, 2200, 1800, 1400, 1000)
QUALITY_STEPS = (86, 82, 78, 74, 70)

RASTER_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def human(size: int) -> str:
    return f"{size / 1_048_576:.2f} MB" if size >= 1_048_576 else f"{size // 1024} KB"


def find_photos(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in RASTER_SUFFIXES
    )


def shrink(path: Path) -> tuple[bool, str]:
    """Rewrite `path` under MAX_BYTES. Returns (fits, message).

    Encodings are built in memory and only written when smaller than what is
    already on disk, so a stubborn image is never made worse.
    """
    original = path.read_bytes()
    best = original
    best_size: tuple[int, int] | None = None

    with Image.open(path) as opened:
        # Bake the EXIF rotation into the pixels first. Stripping metadata
        # without this leaves phone photos lying on their side in browsers.
        image = ImageOps.exif_transpose(opened)
        original_size = image.size

        # Only keep the alpha channel when it is actually used; a fully opaque
        # RGBA png is a quarter larger for nothing.
        is_png = path.suffix.lower() == ".png"
        has_alpha = image.mode in ("RGBA", "LA", "PA") or (
            image.mode == "P" and "transparency" in image.info
        )
        if has_alpha:
            alpha = image.convert("RGBA").getchannel("A")
            has_alpha = alpha.getextrema()[0] < 255

        keep_png = is_png and has_alpha
        image = image.convert("RGBA" if keep_png else "RGB")

        for edge in EDGE_STEPS:
            width, height = image.size
            scale = min(1.0, edge / max(width, height))
            resized = (
                image.resize((round(width * scale), round(height * scale)), Image.LANCZOS)
                if scale < 1
                else image
            )

            # Copy the pixels into a fresh image so no metadata survives the
            # save — phone photos carry GPS coordinates.
            stripped = Image.frombytes(resized.mode, resized.size, resized.tobytes())

            for quality in (None,) if is_png else QUALITY_STEPS:
                buffer = io.BytesIO()
                if is_png:
                    stripped.save(buffer, "PNG", optimize=True)
                else:
                    stripped.save(
                        buffer, "JPEG", quality=quality, optimize=True, progressive=True
                    )
                candidate = buffer.getvalue()

                if len(candidate) <= MAX_BYTES:
                    path.write_bytes(candidate)
                    return True, (
                        f"{original_size[0]}x{original_size[1]} -> "
                        f"{stripped.size[0]}x{stripped.size[1]}, {human(len(candidate))}"
                    )

                if len(candidate) < len(best):
                    best = candidate
                    best_size = stripped.size

    if len(best) < len(original):
        path.write_bytes(best)

    reached = f" at {best_size[0]}x{best_size[1]}" if best_size else ""
    return False, (
        f"smallest was {human(len(best))}{reached} — "
        "save it as a JPEG instead of a PNG"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="report oversized photos without changing them",
    )
    parser.add_argument(
        "--dir",
        default="public",
        help="directory to scan (default: public)",
    )
    args = parser.parse_args()

    root = Path(args.dir)
    if not root.is_dir():
        print(f"No such directory: {root}", file=sys.stderr)
        return 2

    photos = find_photos(root)
    oversized = [p for p in photos if p.stat().st_size > MAX_BYTES]

    print(f"Scanned {len(photos)} photo(s) in {root}/ — limit {human(MAX_BYTES)}")

    if not oversized:
        print("All photos fit the editor's preview limit.")
        return 0

    if args.check:
        for path in oversized:
            print(f"  TOO BIG  {human(path.stat().st_size):>8}  {path}")
        print(f"\n{len(oversized)} photo(s) would break the media library preview.")
        print("Fix with: python3 scripts/optimise-photos.py")
        return 1

    stubborn = []
    for path in oversized:
        before = path.stat().st_size
        changed, message = shrink(path)
        status = "resized" if changed else "TOO BIG"
        if not changed:
            stubborn.append(path)
        print(f"  {status}  {human(before):>8} -> {message}  {path}")

    if stubborn:
        print(
            f"\n{len(stubborn)} photo(s) are still over the limit. Their previews "
            "will not load in the editor, but the site will show them fine."
        )

    # Exit 0 even with stubborn files: the caller should still commit the
    # photos that were successfully shrunk.
    return 0


if __name__ == "__main__":
    sys.exit(main())
