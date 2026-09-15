#!/usr/bin/env python3
"""Keep photos in public/ small enough for a fast site and the CMS.

Decap previews media through the GitHub contents API, which returns
``"encoding": "none"`` and an empty body for files over 1 MB. Phone uploads
must stay under that hard ceiling.

Separately, the live site loads many shots on Now / home. Files near 900 KB
at 3000px are fine for the editor but slow on the road. This script therefore
aims for a tighter *web* target (~350 KB, long edge up to 1800px) while still
enforcing the 1 MB CMS ceiling.

Run with no arguments to shrink anything over the web target:

    python3 scripts/optimise-photos.py

Run with --check to fail only on the hard CMS ceiling (exits 1 if any file
is over 950 KB):

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
# broken thumbnails back.
MAX_BYTES = 950_000

# Comfortable for retina grids and the home hero without eating the pipe.
# Most phone shots land near 250–350 KB at 1600–1800px / q78.
TARGET_BYTES = 350_000

# Largest first — keep as much detail as the byte budget allows.
EDGE_STEPS = (1800, 1600, 1400, 1200, 1000, 800)
QUALITY_STEPS = (80, 76, 72, 68, 64)

RASTER_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def human(size: int) -> str:
    return f"{size / 1_048_576:.2f} MB" if size >= 1_048_576 else f"{size // 1024} KB"


def find_photos(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in RASTER_SUFFIXES
    )


def shrink(path: Path, budget: int) -> tuple[bool, str]:
    """Rewrite `path` under `budget`. Returns (fits, message).

    Encodings are built in memory and only written when smaller than what is
    already on disk, so a stubborn image is never made worse.
    """
    original = path.read_bytes()
    if len(original) <= budget:
        return True, f"already {human(len(original))}"

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

            for quality in (None,) if keep_png else QUALITY_STEPS:
                buffer = io.BytesIO()
                if keep_png:
                    stripped.save(buffer, "PNG", optimize=True)
                else:
                    stripped.save(
                        buffer, "JPEG", quality=quality, optimize=True, progressive=True
                    )
                candidate = buffer.getvalue()

                if len(candidate) <= budget:
                    if len(candidate) < len(original):
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
    return len(best) <= budget, (
        f"smallest was {human(len(best))}{reached}"
        + ("" if len(best) <= budget else " — still over budget")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail only when a photo breaks the editor's 1 MB preview limit",
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
    # Skip the crest SVG wrapper's raster twin if we ever nest oddly; scan flat.
    oversized_cms = [p for p in photos if p.stat().st_size > MAX_BYTES]
    oversized_web = [p for p in photos if p.stat().st_size > TARGET_BYTES]

    print(
        f"Scanned {len(photos)} photo(s) in {root}/ — "
        f"web target {human(TARGET_BYTES)}, CMS ceiling {human(MAX_BYTES)}"
    )

    if args.check:
        if not oversized_cms:
            print("All photos fit the editor's preview limit.")
            if oversized_web:
                print(
                    f"Note: {len(oversized_web)} still over the web target "
                    f"({human(TARGET_BYTES)}). Run without --check to shrink."
                )
            return 0
        for path in oversized_cms:
            print(f"  TOO BIG  {human(path.stat().st_size):>8}  {path}")
        print(f"\n{len(oversized_cms)} photo(s) would break the media library preview.")
        print("Fix with: python3 scripts/optimise-photos.py")
        return 1

    if not oversized_web:
        print("All photos already fit the web target.")
        return 0

    stubborn = []
    saved = 0
    for path in oversized_web:
        before = path.stat().st_size
        # Aim for the web budget; if a PNG with alpha cannot get there, still
        # pull it under the CMS ceiling so the editor keeps working.
        changed, message = shrink(path, TARGET_BYTES)
        after = path.stat().st_size
        if after > MAX_BYTES:
            changed, message = shrink(path, MAX_BYTES)
            after = path.stat().st_size
        if after > MAX_BYTES:
            stubborn.append(path)
        saved += max(0, before - after)
        status = "shrunk" if after < before else ("ok" if after <= TARGET_BYTES else "HEAVY")
        print(f"  {status}  {human(before):>8} -> {message}  {path}")

    print(f"\nSaved about {human(saved)} across {len(oversized_web)} file(s).")

    if stubborn:
        print(
            f"\n{len(stubborn)} photo(s) are still over the CMS ceiling. Their "
            "previews will not load in the editor, but the site will show them."
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
