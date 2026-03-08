#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SPLAT_DIR = SCRIPT_DIR.parent
COLORING_DIR = SPLAT_DIR / "src" / "coloring"
BOOKS_DIR = COLORING_DIR / "books"
INTAKE_DIR = COLORING_DIR / "intake"
ASSETS_DIR = COLORING_DIR / "assets"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect crop coverage for a coloring book")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--out", default=None, help="Output directory for inspection images")
    args = parser.parse_args()

    manifest_path = BOOKS_DIR / f"{args.slug}.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text())
    pages = manifest.get("pages", [])

    out_dir = Path(args.out) if args.out else INTAKE_DIR / args.slug / "inspection"
    raw_dir = INTAKE_DIR / args.slug / "raw-pages"
    rendered_dir = ASSETS_DIR / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    panel_paths: list[Path] = []
    for page in pages:
        index = int(page["index"])
        raw_path = raw_dir / f"page-{index:03d}.png"
        rendered_path = rendered_dir / f"page-{index + 1:03d}.png"
        if not raw_path.exists() or not rendered_path.exists():
            continue

        overlay_path = out_dir / f"page-{index + 1:03d}-overlay.png"
        preview_path = out_dir / f"page-{index + 1:03d}-preview.png"
        panel_path = out_dir / f"page-{index + 1:03d}-panel.png"

        crop = page.get("crop")
        if isinstance(crop, dict):
            x = int(crop["x"])
            y = int(crop["y"])
            w = int(crop["width"])
            h = int(crop["height"])
            x2 = x + w - 1
            y2 = y + h - 1
            run(
                [
                    "magick",
                    str(raw_path),
                    "-stroke",
                    "red",
                    "-strokewidth",
                    "8",
                    "-fill",
                    "none",
                    "-draw",
                    f"rectangle {x},{y} {x2},{y2}",
                    str(overlay_path),
                ]
            )
        else:
            run(["magick", str(raw_path), str(overlay_path)])

        run(
            [
                "magick",
                str(rendered_path),
                "-background",
                "white",
                "-alpha",
                "remove",
                "-alpha",
                "off",
                str(preview_path),
            ]
        )

        run(
            [
                "magick",
                str(overlay_path),
                str(preview_path),
                "+append",
                str(panel_path),
            ]
        )
        panel_paths.append(panel_path)

    if panel_paths:
        contact_sheet = out_dir / "contact-sheet.png"
        run(
            [
                "magick",
                "montage",
                *[str(path) for path in panel_paths],
                "-tile",
                "1x",
                "-geometry",
                "+0+8",
                str(contact_sheet),
            ]
        )
        print(f"Wrote inspection contact sheet: {contact_sheet}")


if __name__ == "__main__":
    main()
