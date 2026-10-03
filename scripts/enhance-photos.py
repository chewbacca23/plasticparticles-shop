#!/usr/bin/env python3
"""Give uploaded photos a mild Photoshop-style pass: colour + crispness.

Phone and camera JPEGs often land a bit soft and flat. This script:

1. Orients pixels from EXIF (same rule as ``optimise-photos.py``)
2. Applies a tasteful auto-contrast / saturation / contrast polish
3. Sharpens with an unsharp mask (plus a light local-contrast pass)
4. Re-encodes under the same web / CMS budgets as the resizer

Default is safe: write ``*_enhanced.jpg`` next to the original. Pass
``--in-place`` when you always want the file you handed in rewritten.

    python3 scripts/enhance-photos.py path/to/pic.jpg
    python3 scripts/enhance-photos.py public/stories/ --in-place
    python3 scripts/enhance-photos.py path/to/pic.jpg --check

Needs Pillow::

    pip3 install pillow
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
except ImportError:  # pragma: no cover - dependency guidance only
    sys.exit("Pillow is required: pip3 install pillow")

# Shared with optimise-photos.py — keep editor + road budgets in sync.
MAX_BYTES = 950_000
TARGET_BYTES = 350_000
EDGE_STEPS = (1800, 1600, 1400, 1200, 1000, 800)
QUALITY_STEPS = (80, 76, 72, 68, 64)

RASTER_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
# HEIC needs pillow-heif or a Mac pre-convert (see enhance-photo.sh).
HEIC_SUFFIXES = {".heic", ".heif"}

# Mild morning-greeting energy — not Instagram sludge.
SATURATION = 1.08
CONTRAST = 1.06
# UnsharpMask: radius / percent / threshold (Pillow defaults are strong; keep mild).
UNSHARP = (1.2, 120, 3)
# Light clarity: blend a tiny amount of high-pass contrast.
CLARITY = 0.12


def human(size: int) -> str:
    return f"{size / 1_048_576:.2f} MB" if size >= 1_048_576 else f"{size // 1024} KB"


def collect_inputs(paths: list[Path]) -> list[Path]:
    found: list[Path] = []
    for path in paths:
        if path.is_dir():
            found.extend(
                sorted(
                    p
                    for p in path.rglob("*")
                    if p.is_file() and p.suffix.lower() in RASTER_SUFFIXES
                )
            )
        elif path.is_file():
            found.append(path)
        else:
            print(f"No such path: {path}", file=sys.stderr)
    # Skip our own outputs so a second run does not enhance the enhanced.
    return [p for p in found if not p.stem.endswith("_enhanced")]


def load_image(path: Path) -> Image.Image:
    suffix = path.suffix.lower()
    if suffix in HEIC_SUFFIXES:
        try:
            from pillow_heif import register_heif_opener  # type: ignore

            register_heif_opener()
        except ImportError:
            sys.exit(
                f"HEIC needs pillow-heif (pip3 install pillow-heif) or convert first:\n"
                f"  sh scripts/enhance-photo.sh {path}"
            )

    opened = Image.open(path)
    # Bake EXIF rotation into pixels before stripping metadata.
    image = ImageOps.exif_transpose(opened)
    opened.close()
    return image


def polish(image: Image.Image) -> Image.Image:
    """Tasteful colour + crispness. Works in RGB; alpha preserved separately."""
    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )
    alpha = None
    if has_alpha:
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        # Fully opaque PNG — drop alpha to save bytes later.
        if alpha.getextrema()[0] >= 255:
            alpha = None
            image = rgba.convert("RGB")
        else:
            image = rgba.convert("RGB")
    else:
        image = image.convert("RGB")

    # Autocontrast with a small cutoff so skies / shadows stay natural.
    image = ImageOps.autocontrast(image, cutoff=1)
    image = ImageEnhance.Color(image).enhance(SATURATION)
    image = ImageEnhance.Contrast(image).enhance(CONTRAST)

    # Gentle clarity: blend a soft local-contrast pass, then a final unsharp.
    if CLARITY > 0:
        crisp_local = image.filter(
            ImageFilter.UnsharpMask(radius=2.5, percent=80, threshold=8)
        )
        image = Image.blend(image, crisp_local, CLARITY)

    image = image.filter(ImageFilter.UnsharpMask(*UNSHARP))

    if alpha is not None:
        image = image.convert("RGBA")
        image.putalpha(alpha)
    return image


def encode_under_budget(
    image: Image.Image,
    *,
    prefer_png: bool,
    budget: int,
) -> tuple[bytes, str, tuple[int, int]]:
    """Encode enhanced pixels under `budget`. Prefer JPEG unless alpha PNG."""
    has_alpha = image.mode in ("RGBA", "LA")
    keep_png = prefer_png and has_alpha
    working = image.convert("RGBA" if keep_png else "RGB")

    best: bytes | None = None
    best_size: tuple[int, int] = working.size
    best_label = "encode failed"

    for edge in EDGE_STEPS:
        width, height = working.size
        scale = min(1.0, edge / max(width, height))
        resized = (
            working.resize((round(width * scale), round(height * scale)), Image.LANCZOS)
            if scale < 1
            else working
        )
        # Fresh pixels — no EXIF / GPS survives the save.
        stripped = Image.frombytes(resized.mode, resized.size, resized.tobytes())

        for quality in (None,) if keep_png else QUALITY_STEPS:
            buffer = io.BytesIO()
            if keep_png:
                stripped.save(buffer, "PNG", optimize=True)
                label = "PNG"
            else:
                stripped.save(
                    buffer, "JPEG", quality=quality, optimize=True, progressive=True
                )
                label = f"JPEG q{quality}"
            candidate = buffer.getvalue()

            if best is None or len(candidate) < len(best):
                best = candidate
                best_size = stripped.size
                best_label = label

            if len(candidate) <= budget:
                return candidate, label, stripped.size

    assert best is not None
    return best, best_label, best_size


def output_path(src: Path, *, in_place: bool, keep_png: bool) -> Path:
    if in_place:
        if keep_png:
            return src
        # In-place non-PNG becomes .jpg so HEIC/PNG/WebP land as web JPEGs.
        if src.suffix.lower() in {".jpg", ".jpeg"}:
            return src
        return src.with_suffix(".jpg")
    stem = src.stem
    suffix = ".png" if keep_png else ".jpg"
    return src.with_name(f"{stem}_enhanced{suffix}")


def enhance_one(path: Path, *, in_place: bool, dry_run: bool) -> tuple[bool, str]:
    suffix = path.suffix.lower()
    if suffix in HEIC_SUFFIXES and dry_run:
        return True, "HEIC (would convert via pillow-heif or enhance-photo.sh)"
    if suffix not in RASTER_SUFFIXES | HEIC_SUFFIXES:
        return False, f"unsupported type {suffix}"

    try:
        image = load_image(path)
    except Exception as exc:  # noqa: BLE001 — CLI surface
        return False, f"open failed: {exc}"

    original_size = image.size
    prefer_png = suffix == ".png"
    polished = polish(image)
    image.close()

    # Encode to web budget; fall back to CMS ceiling if needed.
    data, label, out_dims = encode_under_budget(
        polished, prefer_png=prefer_png, budget=TARGET_BYTES
    )
    if len(data) > MAX_BYTES:
        data, label, out_dims = encode_under_budget(
            polished, prefer_png=prefer_png, budget=MAX_BYTES
        )

    keep_png = prefer_png and polished.mode == "RGBA"
    dest = output_path(path, in_place=in_place, keep_png=keep_png)
    fits = len(data) <= MAX_BYTES

    if dry_run:
        return fits, (
            f"would write {dest.name}: {original_size[0]}x{original_size[1]} -> "
            f"{out_dims[0]}x{out_dims[1]}, {human(len(data))} ({label})"
            + ("" if fits else " — still over CMS ceiling")
        )

    # If in-place and the destination suffix changed, remove the old file after write.
    dest.write_bytes(data)
    if in_place and dest.resolve() != path.resolve() and path.exists():
        path.unlink()

    return fits, (
        f"{original_size[0]}x{original_size[1]} -> {out_dims[0]}x{out_dims[1]}, "
        f"{human(len(data))} ({label}) -> {dest}"
        + ("" if fits else " — still over CMS ceiling")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="files or directories (default: public/)",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="overwrite the source (default: write *_enhanced.jpg beside it)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="dry-run: show what would be written, exit 1 if any stay over CMS ceiling",
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=None,
        help="extra directory to scan (same idea as optimise-photos.py)",
    )
    args = parser.parse_args()

    targets: list[Path] = list(args.paths)
    if args.dir is not None:
        targets.append(args.dir)
    if not targets:
        targets.append(Path("public"))

    photos = collect_inputs(targets)
    if not photos:
        print("No photos found.", file=sys.stderr)
        return 2

    mode = "check" if args.check else ("in-place" if args.in_place else "copy")
    print(f"Enhancing {len(photos)} photo(s) [{mode}] — web target {human(TARGET_BYTES)}")

    stubborn: list[Path] = []
    for path in photos:
        ok, message = enhance_one(path, in_place=args.in_place, dry_run=args.check)
        status = "ok" if ok else "HEAVY"
        if args.check:
            status = "would" if ok else "HEAVY"
        print(f"  {status}  {message}")
        if not ok:
            stubborn.append(path)

    if stubborn:
        print(
            f"\n{len(stubborn)} photo(s) still over the CMS ceiling after enhance. "
            "Run: npm run photos:fix"
        )
        return 1 if args.check else 0

    if not args.check:
        print("\nDone. If anything feels big, run: npm run photos:fix")
    else:
        print("\nDry-run only — no files written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
